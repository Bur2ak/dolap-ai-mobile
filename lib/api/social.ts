import { throwApiError } from "@/lib/api/errors";
import { userAllowsNotification } from "@/lib/api/notifications";
import { captureError, captureEvent } from "@/lib/observability";
import { supabase } from "@/lib/supabase";
import type { FriendWardrobe, Friendship, LoanRequest, LoanRequestStatus, ReferralReward, UserSearchResult, WardrobeItem } from "@/types";
import { formatDateOnly } from "@/utils/formatters";

export async function searchUsers(query: string, currentUserId: string): Promise<UserSearchResult[]> {
  const normalized = query.trim();
  if (!normalized) {
    return [];
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized);
  const queryBuilder = supabase.from("profiles").select("id, username, full_name, avatar_url").neq("id", currentUserId).limit(10);
  const { data, error } = isUuid
    ? await queryBuilder.eq("id", normalized)
    : await queryBuilder.or(`username.ilike.%${normalized}%,full_name.ilike.%${normalized}%`);

  if (error) {
    throwApiError(error, "Kullanici aramasi yapilamadi.");
  }

  return (data ?? []) as UserSearchResult[];
}

export async function fetchFriendships(userId: string): Promise<Friendship[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("*, requester:profiles!friendships_requester_id_fkey(*), addressee:profiles!friendships_addressee_id_fkey(*)")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order("updated_at", { ascending: false });

  if (error) {
    throwApiError(error, "Arkadas listesi yuklenemedi.");
  }

  return (data ?? []) as Friendship[];
}

export async function sendFriendRequest(userId: string, addresseeId: string): Promise<void> {
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
  const { data, error } = await supabase
    .from("referral_rewards")
    .select("*, referrer:profiles!referral_rewards_referrer_id_fkey(*), referred:profiles!referral_rewards_referred_id_fkey(*)")
    .or(`referrer_id.eq.${userId},referred_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (error) {
    throwApiError(error, "Davet odulleri yuklenemedi.");
  }

  return (data ?? []) as ReferralReward[];
}

export async function fetchFriendWardrobe(friendId: string): Promise<FriendWardrobe> {
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

  return {
    profile: profile as FriendWardrobe["profile"],
    items: (items ?? []) as FriendWardrobe["items"],
  };
}

export interface BorrowWardrobeItemInput {
  dueDate?: string | null;
  note?: string | null;
}

export async function requestBorrowWardrobeItem(userId: string, item: WardrobeItem, input: BorrowWardrobeItemInput = {}): Promise<LoanRequest> {
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

  return loanRequest as LoanRequest;
}

export async function fetchLoanRequests(userId: string): Promise<LoanRequest[]> {
  const { data, error } = await supabase
    .from("loan_requests")
    .select("*, item:wardrobe_items(*), owner:profiles!loan_requests_owner_id_fkey(*), requester:profiles!loan_requests_requester_id_fkey(*)")
    .or(`owner_id.eq.${userId},requester_id.eq.${userId}`)
    .order("requested_at", { ascending: false });

  if (error) {
    throwApiError(error, "Odunc istekleri yuklenemedi.");
  }

  return (data ?? []) as LoanRequest[];
}

export async function updateLoanRequestStatus(userId: string, loanRequest: LoanRequest, status: LoanRequestStatus): Promise<LoanRequest> {
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

  return data as LoanRequest;
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
