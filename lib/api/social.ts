import { throwApiError } from "@/lib/api/errors";
import { userAllowsNotification } from "@/lib/api/notifications";
import { captureError, captureEvent } from "@/lib/observability";
import { isUuid } from "@/lib/routeParams";
import { supabase } from "@/lib/supabase";
import type { FriendWardrobe, Friendship, LoanRequest, LoanRequestStatus, ReferralReward, UserSearchResult, WardrobeItem } from "@/types";
import { formatDateOnly } from "@/utils/formatters";

const validLoanStatuses = new Set<LoanRequestStatus>(["pending", "approved", "declined", "returned"]);

export async function searchUsers(query: string, currentUserId: string): Promise<UserSearchResult[]> {
  const normalized = normalizeUserSearchQuery(query);
  if (!normalized) {
    return [];
  }

  if (!isUuid(currentUserId)) {
    throw new Error("Oturum bilgisi gecersiz. Tekrar giris yapmayi dene.");
  }

  const queryIsUuid = isUuid(normalized);
  const queryBuilder = supabase.from("profiles").select("id, username, full_name, avatar_url").neq("id", currentUserId).limit(10);
  const { data, error } = queryIsUuid
    ? await queryBuilder.eq("id", normalized)
    : await queryBuilder.or(`username.ilike.${toIlikePattern(normalized)},full_name.ilike.${toIlikePattern(normalized)}`);

  if (error) {
    throwApiError(error, "Kullanici aramasi yapilamadi.");
  }

  return (data ?? []).map(normalizeUserSearchResult).filter((user): user is UserSearchResult => user !== null);
}

function normalizeUserSearchQuery(query: string) {
  return query
    .trim()
    .replace(/^@+/, "")
    .replace(/[,%()\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function toIlikePattern(value: string) {
  return `*${value.replace(/\*/g, " ").trim()}*`;
}

export async function fetchFriendships(userId: string): Promise<Friendship[]> {
  assertUserId(userId);
  const { data, error } = await supabase
    .from("friendships")
    .select("*, requester:profiles!friendships_requester_id_fkey(*), addressee:profiles!friendships_addressee_id_fkey(*)")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order("updated_at", { ascending: false });

  if (error) {
    throwApiError(error, "Arkadas listesi yuklenemedi.");
  }

  return (data ?? []).map(normalizeFriendship).filter((friendship): friendship is Friendship => friendship !== null);
}

export async function sendFriendRequest(userId: string, addresseeId: string): Promise<void> {
  assertUserId(userId);
  assertUserId(addresseeId);

  if (userId === addresseeId) {
    throw new Error("Kendine arkadaslik istegi gonderemezsin.");
  }

  const { data: existingFriendship, error: existingError } = await supabase
    .from("friendships")
    .select("status, requester_id, addressee_id")
    .or(`and(requester_id.eq.${userId},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${userId})`)
    .maybeSingle();

  if (existingError) {
    throwApiError(existingError, "Arkadaslik durumu kontrol edilemedi.");
  }

  if (existingFriendship) {
    throw new Error(getFriendshipConflictMessage(existingFriendship.status, existingFriendship.requester_id === userId));
  }

  const { data, error } = await supabase
    .from("friendships")
    .insert({
      requester_id: userId,
      addressee_id: addresseeId,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    throwApiError(error, "Arkadaslik istegi gonderilemedi.");
  }

  captureEvent("friend_request_sent");

  if (await userAllowsNotification(addresseeId, "friend_requests")) {
    const { error: notificationError } = await supabase.from("notifications").insert({
      user_id: addresseeId,
      type: "friend_request",
      title: "Yeni arkadaslik istegi",
      body: "Bir Shipirio kullanicisi sana arkadaslik istegi gonderdi.",
      data: {
        friendship_id: data.id,
        requester_id: userId,
      },
    });

    if (notificationError) {
      captureError(notificationError, { area: "friend_request_notification", addressee_id: addresseeId });
    }
  }
}

function getFriendshipConflictMessage(status: string, outgoing: boolean) {
  if (status === "accepted") {
    return "Bu kullanici zaten arkadas listende.";
  }

  if (status === "blocked") {
    return "Bu kullanici ile arkadaslik akisi engellenmis.";
  }

  return outgoing ? "Bu kullaniciya zaten bekleyen bir istek gonderdin." : "Bu kullanicidan zaten bekleyen bir istek var.";
}

export async function updateFriendshipStatus(userId: string, friendshipId: string, status: "accepted" | "blocked"): Promise<{ referralRewarded: boolean }> {
  assertUserId(userId);
  assertRecordId(friendshipId, "Arkadaslik kaydi gecersiz.");

  const { error } = await supabase
    .from("friendships")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", friendshipId)
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  if (error) {
    throwApiError(error, "Arkadaslik durumu guncellenemedi.");
  }

  captureEvent("friendship_status_updated", { status });

  if (status !== "accepted") {
    return { referralRewarded: false };
  }

  const { data: referralRewarded, error: rewardError } = await supabase.rpc("claim_friend_referral_reward", {
    p_friendship_id: friendshipId,
  });

  if (rewardError) {
    throwApiError(rewardError, "Davet odulu islenemedi.");
  }

  return { referralRewarded: Boolean(referralRewarded) };
}

export async function deleteFriendship(userId: string, friendshipId: string): Promise<void> {
  assertUserId(userId);
  assertRecordId(friendshipId, "Arkadaslik kaydi gecersiz.");

  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", friendshipId)
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  if (error) {
    throwApiError(error, "Arkadaslik silinemedi.");
  }

  captureEvent("friendship_deleted");
}

export async function fetchReferralRewards(userId: string): Promise<ReferralReward[]> {
  assertUserId(userId);
  const { data, error } = await supabase
    .from("referral_rewards")
    .select("*, referrer:profiles!referral_rewards_referrer_id_fkey(*), referred:profiles!referral_rewards_referred_id_fkey(*)")
    .or(`referrer_id.eq.${userId},referred_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (error) {
    throwApiError(error, "Davet odulleri yuklenemedi.");
  }

  return (data ?? []).map(normalizeReferralReward).filter((reward): reward is ReferralReward => reward !== null);
}

export async function fetchFriendWardrobe(friendId: string): Promise<FriendWardrobe> {
  assertUserId(friendId);
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url, bio, privacy_settings")
    .eq("id", friendId)
    .single();

  if (profileError) {
    throwApiError(profileError, "Arkadas profili acilamadi.");
  }

  const { data: items, error: itemsError } = await supabase
    .from("wardrobe_items")
    .select("*")
    .eq("user_id", friendId)
    .eq("is_active", true)
    .eq("is_shareable", true)
    .order("created_at", { ascending: false });

  if (itemsError) {
    throwApiError(itemsError, "Arkadas dolabi yuklenemedi.");
  }

  const normalizedProfile = normalizeFriendWardrobeProfile(profile);
  if (!normalizedProfile) {
    throw new Error("Arkadas profili gecersiz dondu.");
  }

  return {
    profile: normalizedProfile,
    items: (items ?? []).map(normalizeWardrobeItem).filter((item): item is WardrobeItem => item !== null),
  };
}

export interface BorrowWardrobeItemInput {
  dueDate?: string | null;
  note?: string | null;
}

export async function requestBorrowWardrobeItem(userId: string, item: WardrobeItem, input: BorrowWardrobeItemInput = {}): Promise<LoanRequest> {
  assertUserId(userId);
  assertUserId(item.user_id);
  assertRecordId(item.id, "Kiyafet kaydi gecersiz.");

  if (item.user_id === userId) {
    throw new Error("Kendi parcana odunc istegi gonderemezsin.");
  }

  if (!item.is_active || !item.is_shareable) {
    throw new Error("Bu parca artik paylasima acik degil.");
  }

  if (!item.is_lendable) {
    throw new Error("Bu parca odunc alinabilir olarak isaretlenmemis.");
  }

  const { data: existingLoan, error: existingLoanError } = await supabase
    .from("loan_requests")
    .select("id, status")
    .eq("item_id", item.id)
    .eq("requester_id", userId)
    .in("status", ["pending", "approved"])
    .maybeSingle();

  if (existingLoanError) {
    throwApiError(existingLoanError, "Odunc durumu kontrol edilemedi.");
  }

  if (existingLoan) {
    throw new Error(existingLoan.status === "approved" ? "Bu parca icin odunc istegin zaten onaylanmis." : "Bu parca icin zaten bekleyen bir odunc istegin var.");
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);
  const note = input.note?.trim().slice(0, 240) || null;
  const dueDateValue = input.dueDate?.trim() || formatDateOnly(dueDate);
  if (!isValidBorrowDueDate(dueDateValue)) {
    throw new Error("Iade tarihi YYYY-MM-DD formatinda, bugunden erken ve 1 yildan ileri olmamali.");
  }

  const { data: loanRequest, error: loanError } = await supabase
    .from("loan_requests")
    .insert({
      item_id: item.id,
      owner_id: item.user_id,
      requester_id: userId,
      status: "pending",
      due_date: dueDateValue,
      note,
    })
    .select("*, item:wardrobe_items(*), owner:profiles!loan_requests_owner_id_fkey(*), requester:profiles!loan_requests_requester_id_fkey(*)")
    .single();

  if (loanError) {
    throwApiError(loanError, "Odunc istegi gonderilemedi.");
  }

  captureEvent("loan_request_created", {
    category: item.category,
    due_date_set: true,
    has_note: Boolean(note),
  });

  if (await userAllowsNotification(item.user_id, "lend_requests")) {
    const itemLabel = item.subcategory ?? item.brand ?? item.category;
    const { error } = await supabase.from("notifications").insert({
      user_id: item.user_id,
      type: "lend_request",
      title: "Odunc istegi",
      body: `${itemLabel} icin odunc alma istegi geldi.`,
      data: {
        item_id: item.id,
        loan_request_id: loanRequest.id,
        requester_id: userId,
      },
    });

    if (error) {
      captureError(error, { area: "loan_request_notification", item_id: item.id, owner_id: item.user_id });
    }
  }

  const normalizedLoanRequest = normalizeLoanRequest(loanRequest);
  if (!normalizedLoanRequest) {
    throw new Error("Odunc kaydi gecersiz dondu.");
  }

  return normalizedLoanRequest;
}

export async function fetchLoanRequests(userId: string): Promise<LoanRequest[]> {
  assertUserId(userId);
  const { data, error } = await supabase
    .from("loan_requests")
    .select("*, item:wardrobe_items(*), owner:profiles!loan_requests_owner_id_fkey(*), requester:profiles!loan_requests_requester_id_fkey(*)")
    .or(`owner_id.eq.${userId},requester_id.eq.${userId}`)
    .order("requested_at", { ascending: false });

  if (error) {
    throwApiError(error, "Odunc istekleri yuklenemedi.");
  }

  return (data ?? []).map(normalizeLoanRequest).filter((loanRequest): loanRequest is LoanRequest => loanRequest !== null);
}

export async function updateLoanRequestStatus(userId: string, loanRequest: LoanRequest, status: LoanRequestStatus): Promise<LoanRequest> {
  assertUserId(userId);
  assertRecordId(loanRequest.id, "Odunc kaydi gecersiz.");
  assertUserId(loanRequest.requester_id);
  validateLoanStatusTransition(loanRequest.status, status);

  const updates = {
    status,
    returned_at: status === "returned" ? new Date().toISOString() : null,
  };
  const { data, error } = await supabase
    .from("loan_requests")
    .update(updates)
    .eq("id", loanRequest.id)
    .eq("owner_id", userId)
    .select("*, item:wardrobe_items(*), owner:profiles!loan_requests_owner_id_fkey(*), requester:profiles!loan_requests_requester_id_fkey(*)")
    .single();

  if (error) {
    throwApiError(error, "Odunc istegi guncellenemedi.");
  }

  captureEvent("loan_request_status_updated", { status });

  if (await userAllowsNotification(loanRequest.requester_id, "lend_requests")) {
    const itemLabel = loanRequest.item?.subcategory ?? loanRequest.item?.brand ?? loanRequest.item?.category ?? "Kiyafet";
    const title =
      status === "approved"
        ? "Odunc istegin kabul edildi"
        : status === "declined"
          ? "Odunc istegin reddedildi"
          : status === "returned"
            ? "Odunc kaydi iade edildi"
            : "Odunc istegi guncellendi";

    const { error: notificationError } = await supabase.from("notifications").insert({
      user_id: loanRequest.requester_id,
      type: "lend_request",
      title,
      body: `${itemLabel} icin odunc durumu: ${status}`,
      data: {
        item_id: loanRequest.item_id,
        loan_request_id: loanRequest.id,
        status,
      },
    });

    if (notificationError) {
      captureError(notificationError, { area: "loan_status_notification", loan_request_id: loanRequest.id, status });
    }
  }

  const updatedLoanRequest = normalizeLoanRequest(data);
  if (!updatedLoanRequest) {
    throw new Error("Odunc kaydi gecersiz dondu.");
  }

  return updatedLoanRequest;
}

function normalizeUserSearchResult(value: unknown): UserSearchResult | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== "string" || !isUuid(record.id)) {
    return null;
  }

  return {
    id: record.id,
    username: typeof record.username === "string" ? normalizeNullableText(record.username, 24) : null,
    full_name: typeof record.full_name === "string" ? normalizeNullableText(record.full_name, 80) : null,
    avatar_url: typeof record.avatar_url === "string" ? normalizeNullableText(record.avatar_url, 500) : null,
  };
}

function normalizeFriendship(value: unknown): Friendship | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== "string" || !isUuid(record.id) || typeof record.requester_id !== "string" || !isUuid(record.requester_id) || typeof record.addressee_id !== "string" || !isUuid(record.addressee_id)) {
    return null;
  }

  const status = record.status === "accepted" || record.status === "blocked" || record.status === "pending" ? record.status : "pending";

  return {
    id: record.id,
    requester_id: record.requester_id,
    addressee_id: record.addressee_id,
    status,
    created_at: normalizeDate(record.created_at),
    updated_at: normalizeDate(record.updated_at),
    requester: normalizeProfile(record.requester) ?? undefined,
    addressee: normalizeProfile(record.addressee) ?? undefined,
  };
}

function normalizeReferralReward(value: unknown): ReferralReward | null {
  const record = asRecord(value);
  if (
    !record ||
    typeof record.id !== "string" ||
    !isUuid(record.id) ||
    typeof record.friendship_id !== "string" ||
    !isUuid(record.friendship_id) ||
    typeof record.referrer_id !== "string" ||
    !isUuid(record.referrer_id) ||
    typeof record.referred_id !== "string" ||
    !isUuid(record.referred_id)
  ) {
    return null;
  }

  const rewardDays = Number(record.reward_days);

  return {
    id: record.id,
    friendship_id: record.friendship_id,
    referrer_id: record.referrer_id,
    referred_id: record.referred_id,
    reward_days: Number.isFinite(rewardDays) ? Math.max(0, Math.min(365, Math.round(rewardDays))) : 0,
    created_at: normalizeDate(record.created_at),
    referrer: normalizeProfile(record.referrer),
    referred: normalizeProfile(record.referred),
  };
}

function normalizeFriendWardrobeProfile(value: unknown): FriendWardrobe["profile"] | null {
  const profile = normalizeProfile(value);
  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    username: profile.username,
    full_name: profile.full_name,
    avatar_url: profile.avatar_url,
    bio: profile.bio,
    privacy_settings: profile.privacy_settings,
  };
}

function normalizeLoanRequest(value: unknown): LoanRequest | null {
  const record = asRecord(value);
  if (
    !record ||
    typeof record.id !== "string" ||
    !isUuid(record.id) ||
    typeof record.item_id !== "string" ||
    !isUuid(record.item_id) ||
    typeof record.owner_id !== "string" ||
    !isUuid(record.owner_id) ||
    typeof record.requester_id !== "string" ||
    !isUuid(record.requester_id)
  ) {
    return null;
  }

  const status = typeof record.status === "string" && validLoanStatuses.has(record.status as LoanRequestStatus) ? (record.status as LoanRequestStatus) : "pending";

  return {
    id: record.id,
    item_id: record.item_id,
    owner_id: record.owner_id,
    requester_id: record.requester_id,
    status,
    requested_at: normalizeDate(record.requested_at),
    due_date: typeof record.due_date === "string" && isValidBorrowDueDate(record.due_date) ? record.due_date : null,
    returned_at: normalizeNullableDate(record.returned_at),
    note: typeof record.note === "string" ? normalizeNullableText(record.note, 240) : null,
    item: normalizeWardrobeItem(record.item),
    owner: normalizeProfile(record.owner),
    requester: normalizeProfile(record.requester),
  };
}

function validateLoanStatusTransition(currentStatus: LoanRequestStatus, nextStatus: LoanRequestStatus) {
  if (nextStatus === "pending") {
    throw new Error("Odunc istegi tekrar beklemeye alinamaz.");
  }

  if ((nextStatus === "approved" || nextStatus === "declined") && currentStatus !== "pending") {
    throw new Error("Sadece bekleyen odunc istekleri onaylanabilir veya reddedilebilir.");
  }

  if (nextStatus === "returned" && currentStatus !== "approved") {
    throw new Error("Sadece onaylanmis odunc istekleri iade edildi olarak isaretlenebilir.");
  }
}

function isValidBorrowDueDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const timestamp = new Date(`${value}T00:00:00`).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDueDate = new Date(today);
  maxDueDate.setFullYear(maxDueDate.getFullYear() + 1);
  return Number.isFinite(timestamp) && timestamp >= today.getTime() && timestamp <= maxDueDate.getTime();
}

function normalizeProfile(value: unknown): Friendship["requester"] | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== "string" || !isUuid(record.id)) {
    return null;
  }

  const subscriptionTier = record.subscription_tier === "premium" || record.subscription_tier === "family" ? record.subscription_tier : "free";
  const notificationPreferences = asRecord(record.notification_preferences);
  const privacySettings = asRecord(record.privacy_settings);

  return {
    id: record.id,
    username: typeof record.username === "string" ? normalizeNullableText(record.username, 24) : null,
    full_name: typeof record.full_name === "string" ? normalizeNullableText(record.full_name, 80) : null,
    avatar_url: typeof record.avatar_url === "string" ? normalizeNullableText(record.avatar_url, 500) : null,
    bio: typeof record.bio === "string" ? normalizeNullableText(record.bio, 240) : null,
    subscription_tier: subscriptionTier,
    subscription_expires_at: normalizeNullableDate(record.subscription_expires_at),
    revenuecat_customer_id: typeof record.revenuecat_customer_id === "string" ? normalizeNullableText(record.revenuecat_customer_id, 160) : null,
    push_token: typeof record.push_token === "string" ? normalizeNullableText(record.push_token, 240) : null,
    notification_preferences: {
      outfit_reminder: notificationPreferences?.outfit_reminder !== false,
      price_drops: notificationPreferences?.price_drops !== false,
      friend_requests: notificationPreferences?.friend_requests !== false,
      outfit_votes: notificationPreferences?.outfit_votes !== false,
      lend_requests: notificationPreferences?.lend_requests !== false,
    },
    privacy_settings: {
      wardrobe_visible: privacySettings?.wardrobe_visible !== false,
      allow_friend_requests: privacySettings?.allow_friend_requests !== false,
    },
    onboarding_completed: record.onboarding_completed === true,
    kvkk_consent_at: normalizeNullableDate(record.kvkk_consent_at),
    terms_accepted_at: normalizeNullableDate(record.terms_accepted_at),
    deletion_requested_at: normalizeNullableDate(record.deletion_requested_at),
    deletion_scheduled_for: normalizeNullableDate(record.deletion_scheduled_for),
    created_at: normalizeDate(record.created_at),
    updated_at: normalizeDate(record.updated_at),
  };
}

function normalizeWardrobeItem(value: unknown): WardrobeItem | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== "string" || !isUuid(record.id) || typeof record.user_id !== "string" || !isUuid(record.user_id)) {
    return null;
  }

  const validCategories = new Set(["ust", "alt", "elbise", "etek", "dis_giyim", "ayakkabi", "canta", "aksesuar", "ic_giyim", "spor", "diger"]);
  const validSeasons = new Set(["ilkbahar", "yaz", "sonbahar", "kis"]);
  const purchasePrice = Number(record.purchase_price);
  const wearCount = Number(record.wear_count);
  const seasons = Array.isArray(record.season) ? record.season.filter((season): season is WardrobeItem["season"][number] => typeof season === "string" && validSeasons.has(season)) : [];

  return {
    id: record.id,
    user_id: record.user_id,
    image_url: typeof record.image_url === "string" ? record.image_url : "",
    thumbnail_url: typeof record.thumbnail_url === "string" ? normalizeNullableText(record.thumbnail_url, 500) : null,
    category: typeof record.category === "string" && validCategories.has(record.category) ? (record.category as WardrobeItem["category"]) : "diger",
    subcategory: typeof record.subcategory === "string" ? normalizeNullableText(record.subcategory, 80) : null,
    colors: Array.isArray(record.colors) ? record.colors.filter((color): color is string => typeof color === "string" && color.trim().length > 0).map((color) => color.trim().slice(0, 40)).slice(0, 8) : [],
    dominant_color_hex: typeof record.dominant_color_hex === "string" ? normalizeNullableText(record.dominant_color_hex, 16) : null,
    season: seasons,
    brand: typeof record.brand === "string" ? normalizeNullableText(record.brand, 80) : null,
    fabric: typeof record.fabric === "string" ? normalizeNullableText(record.fabric, 80) : null,
    usage_context: Array.isArray(record.usage_context)
      ? [...new Set(record.usage_context.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).map((entry) => entry.trim().toLowerCase()))].slice(0, 8)
      : [],
    purchase_price: Number.isFinite(purchasePrice) && purchasePrice >= 0 && purchasePrice <= 10_000_000 ? Math.round(purchasePrice * 100) / 100 : null,
    wear_count: Number.isFinite(wearCount) ? Math.max(0, Math.min(10_000, Math.round(wearCount))) : 0,
    last_worn: normalizeNullableDate(record.last_worn),
    is_shareable: record.is_shareable === true,
    is_lendable: record.is_lendable === true,
    is_active: record.is_active !== false,
    created_at: normalizeDate(record.created_at),
    updated_at: normalizeDate(record.updated_at),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizeNullableText(value: string, maxLength: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength) || null;
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string") {
    return new Date().toISOString();
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function normalizeNullableDate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function assertUserId(value: string) {
  if (!isUuid(value)) {
    throw new Error("Oturum bilgisi gecersiz. Tekrar giris yapmayi dene.");
  }
}

function assertRecordId(value: string, message: string) {
  if (!isUuid(value)) {
    throw new Error(message);
  }
}
