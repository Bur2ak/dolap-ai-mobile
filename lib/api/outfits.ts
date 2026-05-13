import { nanoid } from "nanoid/non-secure";

import { throwApiError } from "@/lib/api/errors";
import { invokeFunctionWithRetry } from "@/lib/api/functions";
import { filterUsersByNotificationPreference, userAllowsNotification } from "@/lib/api/notifications";
import { cacheOutfitSuggestions, getCachedOutfitSuggestions } from "@/lib/offlineCache";
import { captureError } from "@/lib/observability";
import { isUuid } from "@/lib/routeParams";
import { supabase } from "@/lib/supabase";
import type { Friendship, OutfitRecommendationInput, OutfitRecord, OutfitSuggestion, OutfitVote, OutfitVoteValue, SharedOutfit, WardrobeItem } from "@/types";
import { formatDateOnly } from "@/utils/formatters";

const validCategories = new Set(["ust", "alt", "elbise", "etek", "dis_giyim", "ayakkabi", "canta", "aksesuar", "ic_giyim", "spor", "diger"]);
const validSeasons = new Set(["ilkbahar", "yaz", "sonbahar", "kis"]);
const validVotes = new Set<OutfitVoteValue>(["yes", "no", "love"]);

export async function recommendOutfits(input: OutfitRecommendationInput): Promise<OutfitSuggestion[]> {
  const userId = input.wardrobe[0]?.user_id;
  const normalizedInput = normalizeOutfitRecommendationInput(input);

  try {
    const data = await invokeFunctionWithRetry<OutfitSuggestion[]>("recommend-outfit", normalizedInput);
    const allowedItemIds = new Set(normalizedInput.wardrobe.map((item) => item.id));
    const suggestions = normalizeOutfitSuggestions(data, allowedItemIds);

    if (userId && suggestions.length > 0) {
      await cacheOutfitSuggestions(userId, suggestions);
    }

    return suggestions;
  } catch (error) {
    if (userId) {
      const cachedSuggestions = await getCachedOutfitSuggestions(userId);
      if (cachedSuggestions.length > 0) {
        return cachedSuggestions;
      }
    }

    throwApiError(error, "Kombin onerilemedi.");
  }
}

export async function saveOutfit(userId: string, input: OutfitRecommendationInput, suggestion: OutfitSuggestion, isShareable = false): Promise<OutfitRecord> {
  assertUserId(userId);
  const normalizedInput = normalizeOutfitRecommendationInput(input);
  const itemIds = normalizeSuggestionItemIds(userId, input.wardrobe, suggestion.items);
  if (itemIds.length === 0) {
    throw new Error("Kombin kaydetmek icin dolabindaki en az bir parca gerekli.");
  }
  const normalizedSuggestion = normalizeOutfitSuggestion(suggestion);

  const { data: outfit, error } = await supabase
    .from("outfits")
    .insert({
      user_id: userId,
      name: normalizedSuggestion.name,
      event_type: normalizedInput.event,
      weather_temp: normalizedInput.weather?.temp ?? null,
      weather_description: normalizedInput.weather?.description ?? null,
      mood: normalizedInput.mood,
      ai_reasoning: normalizedSuggestion.reason,
      is_shareable: isShareable,
      share_token: isShareable ? nanoid(12) : null,
    })
    .select("*")
    .single();

  if (error) {
    throwApiError(error, "Kombin kaydedilemedi.");
  }

  const rows = itemIds.map((itemId, index) => ({
    outfit_id: outfit.id,
    item_id: itemId,
    position: index,
  }));

  if (rows.length > 0) {
    const { error: itemsError } = await supabase.from("outfit_items").insert(rows);
    if (itemsError) {
      await cleanupOutfitAfterFailedItemInsert(userId, outfit.id);
      throwApiError(itemsError, "Kombin parcalari kaydedilemedi.");
    }
  }

  const normalizedOutfit = normalizeOutfitRecord(outfit);
  if (!normalizedOutfit) {
    await cleanupOutfitAfterFailedItemInsert(userId, outfit.id);
    throw new Error("Kombin kaydi gecersiz dondu.");
  }

  return normalizedOutfit;
}

function normalizeSuggestionItemIds(userId: string, wardrobe: WardrobeItem[], itemIds: string[]) {
  const allowedItemIds = new Set(wardrobe.filter((item) => item.user_id === userId && item.is_active && isUuid(item.id)).map((item) => item.id));
  const seenItemIds = new Set<string>();

  return itemIds.filter((itemId) => {
    if (!isUuid(itemId) || !allowedItemIds.has(itemId) || seenItemIds.has(itemId)) {
      return false;
    }

    seenItemIds.add(itemId);
    return true;
  });
}

function normalizeOutfitSuggestion(suggestion: OutfitSuggestion): OutfitSuggestion {
  return {
    ...suggestion,
    accessory_note: suggestion.accessory_note?.trim().slice(0, 240) || null,
    name: suggestion.name.trim().replace(/\s+/g, " ").slice(0, 80) || "Shipirio Kombini",
    reason: suggestion.reason.trim().slice(0, 500) || "Dolabindaki uyumlu parcalardan olusturuldu.",
  };
}

function normalizeOutfitSuggestions(value: unknown, allowedItemIds: Set<string>): OutfitSuggestion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((suggestion) => normalizeOutfitSuggestionRecord(suggestion, allowedItemIds))
    .filter((suggestion): suggestion is OutfitSuggestion => suggestion !== null)
    .slice(0, 5);
}

function normalizeOutfitSuggestionRecord(value: unknown, allowedItemIds: Set<string>): OutfitSuggestion | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const items = Array.isArray(record.items)
    ? [...new Set(record.items.filter((itemId): itemId is string => typeof itemId === "string" && allowedItemIds.has(itemId)))].slice(0, 8)
    : [];
  if (items.length === 0) {
    return null;
  }

  return {
    items,
    name: normalizeText(record.name, "Shipirio Kombini", 80),
    reason: normalizeText(record.reason, "Dolabindaki uyumlu parcalardan olusturuldu.", 500),
    accessory_note: typeof record.accessory_note === "string" ? normalizeNullableText(record.accessory_note, 240) : null,
    formality_match: typeof record.formality_match === "string" ? normalizeText(record.formality_match, "uygun", 80) : undefined,
  };
}

function normalizeOutfitRecord(value: unknown): OutfitRecord | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== "string" || !isUuid(record.id) || typeof record.user_id !== "string" || !isUuid(record.user_id)) {
    return null;
  }

  return {
    id: record.id,
    user_id: record.user_id,
    name: typeof record.name === "string" ? normalizeNullableText(record.name, 80) : null,
    event_type: typeof record.event_type === "string" ? normalizeNullableText(record.event_type, 80) : null,
    weather_temp: normalizeNullableNumber(record.weather_temp, -80, 80),
    weather_description: typeof record.weather_description === "string" ? normalizeNullableText(record.weather_description, 120) : null,
    mood: typeof record.mood === "string" ? normalizeNullableText(record.mood, 80) : null,
    ai_reasoning: typeof record.ai_reasoning === "string" ? normalizeNullableText(record.ai_reasoning, 800) : null,
    worn_at: normalizeNullableDate(record.worn_at),
    is_favorite: record.is_favorite === true,
    is_shareable: record.is_shareable === true,
    share_token: typeof record.share_token === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(record.share_token) ? record.share_token : null,
    created_at: normalizeDate(record.created_at),
  };
}

function normalizeOutfitVote(value: unknown): OutfitVote | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== "string" || !isUuid(record.id) || typeof record.outfit_id !== "string" || !isUuid(record.outfit_id) || typeof record.voter_id !== "string" || !isUuid(record.voter_id)) {
    return null;
  }

  const vote = typeof record.vote === "string" && validVotes.has(record.vote as OutfitVoteValue) ? (record.vote as OutfitVoteValue) : null;
  if (!vote) {
    return null;
  }

  return {
    id: record.id,
    outfit_id: record.outfit_id,
    voter_id: record.voter_id,
    vote,
    created_at: normalizeDate(record.created_at),
    voter: normalizeVoteProfile(record.voter),
  };
}

function normalizeVoteProfile(value: unknown): OutfitVote["voter"] {
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

function normalizeWardrobeItemRecord(value: unknown): WardrobeItem | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== "string" || !isUuid(record.id) || typeof record.user_id !== "string" || !isUuid(record.user_id)) {
    return null;
  }

  const seasons = Array.isArray(record.season)
    ? record.season.filter((season, index, allSeasons): season is WardrobeItem["season"][number] => typeof season === "string" && validSeasons.has(season) && allSeasons.indexOf(season) === index)
    : [];
  const colors = Array.isArray(record.colors)
    ? [...new Set(record.colors.filter((color): color is string => typeof color === "string" && color.trim().length > 0).map((color) => color.trim().toLowerCase()))].slice(0, 8)
    : [];
  const category = typeof record.category === "string" && validCategories.has(record.category) ? (record.category as WardrobeItem["category"]) : "diger";

  return {
    id: record.id,
    user_id: record.user_id,
    image_url: typeof record.image_url === "string" ? record.image_url.trim() : "",
    thumbnail_url: typeof record.thumbnail_url === "string" ? normalizeNullableText(record.thumbnail_url, 500) : null,
    category,
    subcategory: typeof record.subcategory === "string" ? normalizeNullableText(record.subcategory, 80) : null,
    colors,
    dominant_color_hex: typeof record.dominant_color_hex === "string" && /^#[0-9a-f]{6}$/i.test(record.dominant_color_hex.trim()) ? record.dominant_color_hex.trim() : null,
    season: seasons,
    brand: typeof record.brand === "string" ? normalizeNullableText(record.brand, 80) : null,
    fabric: typeof record.fabric === "string" ? normalizeNullableText(record.fabric, 80) : null,
    usage_context: Array.isArray(record.usage_context)
      ? [...new Set(record.usage_context.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).map((entry) => entry.trim().toLowerCase()))].slice(0, 8)
      : [],
    purchase_price: normalizeNullableNumber(record.purchase_price, 0, 10_000_000),
    wear_count: normalizeCount(record.wear_count),
    last_worn: normalizeNullableDate(record.last_worn),
    is_shareable: record.is_shareable === true,
    is_lendable: record.is_lendable === true,
    is_active: record.is_active !== false,
    created_at: normalizeDate(record.created_at),
    updated_at: normalizeDate(record.updated_at),
  };
}

async function cleanupOutfitAfterFailedItemInsert(userId: string, outfitId: string) {
  const { error } = await supabase.from("outfits").delete().eq("id", outfitId).eq("user_id", userId);
  if (error) {
    captureError(error, { area: "outfit_cleanup_after_item_insert", outfit_id: outfitId });
  }
}

export async function saveSharedOutfit(userId: string, input: OutfitRecommendationInput, suggestion: OutfitSuggestion): Promise<OutfitRecord> {
  return saveOutfit(userId, input, suggestion, true);
}

export async function makeOutfitShareable(userId: string, outfit: OutfitRecord): Promise<OutfitRecord> {
  assertUserId(userId);
  assertOutfitOwner(userId, outfit);

  if (outfit.is_shareable && outfit.share_token) {
    return outfit;
  }

  const { data, error } = await supabase
    .from("outfits")
    .update({
      is_shareable: true,
      share_token: outfit.share_token ?? nanoid(12),
    })
    .eq("id", outfit.id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    throwApiError(error, "Kombin paylasima acilamadi.");
  }

  const sharedOutfit = normalizeOutfitRecord(data);
  if (!sharedOutfit) {
    throw new Error("Kombin kaydi gecersiz dondu.");
  }

  return sharedOutfit;
}

export async function askFriendsToVoteOnOutfit(userId: string, outfit: OutfitRecord): Promise<number> {
  assertUserId(userId);
  assertOutfitId(outfit.id);

  const { data: friendships, error: friendshipsError } = await supabase
    .from("friendships")
    .select("*")
    .eq("status", "accepted")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  if (friendshipsError) {
    throwApiError(friendshipsError, "Arkadas listesi kontrol edilemedi.");
  }

  const friendIds = ((friendships ?? []) as Friendship[])
    .map((friendship) => (friendship.requester_id === userId ? friendship.addressee_id : friendship.requester_id))
    .filter((friendId, index, allFriendIds) => isUuid(friendId) && friendId !== userId && allFriendIds.indexOf(friendId) === index);

  if (friendIds.length === 0) {
    return 0;
  }

  const notificationUserIds = await filterUsersByNotificationPreference(friendIds, "outfit_votes");

  if (notificationUserIds.length === 0) {
    return 0;
  }

  const { error: notificationsError } = await supabase.from("notifications").insert(
    notificationUserIds.map((friendId) => ({
      user_id: friendId,
      type: "outfit_vote",
      title: "Arkadasin kombin fikrini istiyor",
      body: `${outfit.name ?? "Yeni kombin"} icin oy verir misin?`,
      data: {
        outfit_id: outfit.id,
        requester_id: userId,
      },
    })),
  );

  if (notificationsError) {
    throwApiError(notificationsError, "Arkadas oylama bildirimi olusturulamadi.");
  }

  return notificationUserIds.length;
}

export async function fetchUserOutfits(userId: string): Promise<SharedOutfit[]> {
  assertUserId(userId);
  const { data: outfits, error } = await supabase
    .from("outfits")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throwApiError(error, "Kayitli kombinler yuklenemedi.");
  }

  const normalizedOutfits = (outfits ?? []).map(normalizeOutfitRecord).filter((outfit): outfit is OutfitRecord => outfit !== null);
  return Promise.all(normalizedOutfits.map((outfit) => fetchSharedOutfit(outfit.id)));
}

export async function fetchPublicOutfitFeed(): Promise<SharedOutfit[]> {
  const { data: outfits, error } = await supabase
    .from("outfits")
    .select("*")
    .eq("is_shareable", true)
    .not("share_token", "is", null)
    .order("created_at", { ascending: false })
    .limit(24);

  if (error) {
    throwApiError(error, "Stil panosu yuklenemedi.");
  }

  const normalizedOutfits = (outfits ?? []).map(normalizeOutfitRecord).filter((outfit): outfit is OutfitRecord => outfit !== null);
  const feedItems = await Promise.allSettled(normalizedOutfits.map((outfit) => fetchSharedOutfit(outfit.id)));

  return feedItems.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
}

export async function fetchSharedOutfit(outfitId: string): Promise<SharedOutfit> {
  assertOutfitId(outfitId);
  const { data: outfit, error: outfitError } = await supabase.from("outfits").select("*").eq("id", outfitId).single();

  if (outfitError) {
    throwApiError(outfitError, "Kombin acilamadi.");
  }

  const { data: itemRows, error: itemsError } = await supabase
    .from("outfit_items")
    .select("position, item:wardrobe_items(*)")
    .eq("outfit_id", outfitId)
    .order("position", { ascending: true });

  if (itemsError) {
    throwApiError(itemsError, "Kombin parcalari yuklenemedi.");
  }

  const { data: votes, error: votesError } = await supabase
    .from("outfit_votes")
    .select("*, voter:profiles!outfit_votes_voter_id_fkey(id, username, full_name, avatar_url)")
    .eq("outfit_id", outfitId)
    .order("created_at", { ascending: false });

  if (votesError) {
    throwApiError(votesError, "Kombin oylari yuklenemedi.");
  }

  const normalizedOutfit = normalizeOutfitRecord(outfit);
  if (!normalizedOutfit) {
    throw new Error("Kombin kaydi gecersiz dondu.");
  }

  return {
    outfit: normalizedOutfit,
    items: (itemRows ?? [])
      .flatMap((row) => (Array.isArray(row.item) ? row.item : row.item ? [row.item] : []))
      .map(normalizeWardrobeItemRecord)
      .filter((item): item is WardrobeItem => item !== null),
    votes: (votes ?? []).map(normalizeOutfitVote).filter((vote): vote is OutfitVote => vote !== null),
  };
}

export async function fetchSharedOutfitByToken(token: string): Promise<SharedOutfit> {
  const normalizedToken = token.trim();
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(normalizedToken)) {
    throw new Error("Paylasim linki gecersiz.");
  }

  const { data: outfit, error } = await supabase
    .from("outfits")
    .select("*")
    .eq("share_token", normalizedToken)
    .eq("is_shareable", true)
    .single();

  if (error) {
    throwApiError(error, "Paylasilan kombin bulunamadi.");
  }

  const normalizedOutfit = normalizeOutfitRecord(outfit);
  if (!normalizedOutfit) {
    throw new Error("Paylasilan kombin kaydi gecersiz.");
  }

  return fetchSharedOutfit(normalizedOutfit.id);
}

export async function voteOnOutfit(userId: string, outfit: OutfitRecord, vote: OutfitVoteValue): Promise<void> {
  assertUserId(userId);
  assertOutfitId(outfit.id);
  assertUserId(outfit.user_id);

  if (vote !== "yes" && vote !== "no" && vote !== "love") {
    throw new Error("Oy degeri gecersiz.");
  }

  const { error } = await supabase.from("outfit_votes").upsert(
    {
      outfit_id: outfit.id,
      voter_id: userId,
      vote,
    },
    { onConflict: "outfit_id,voter_id" },
  );

  if (error) {
    throwApiError(error, "Kombine oy verilemedi.");
  }

  if (outfit.user_id !== userId && (await userAllowsNotification(outfit.user_id, "outfit_votes"))) {
    const { error: notificationError } = await supabase.from("notifications").insert({
      user_id: outfit.user_id,
      type: "outfit_vote",
      title: "Kombinine oy geldi",
      body: `${outfit.name ?? "Kombin"} icin yeni oy: ${vote}`,
      data: {
        outfit_id: outfit.id,
        vote,
      },
    });

    if (notificationError) {
      captureError(notificationError, { area: "outfit_vote_notification", outfit_id: outfit.id, owner_id: outfit.user_id });
    }
  }
}

export async function markOutfitWorn(userId: string, sharedOutfit: SharedOutfit): Promise<void> {
  assertUserId(userId);
  assertOutfitOwner(userId, sharedOutfit.outfit);
  const today = formatDateOnly(new Date());
  const { error } = await supabase
    .from("outfits")
    .update({ worn_at: today })
    .eq("id", sharedOutfit.outfit.id)
    .eq("user_id", userId);

  if (error) {
    throwApiError(error, "Kombin giyildi olarak isaretlenemedi.");
  }

  const itemUpdates = await Promise.all(
    sharedOutfit.items
      .filter((item) => item.user_id === userId && item.is_active && isUuid(item.id))
      .map((item) =>
      supabase
        .from("wardrobe_items")
        .update({
          wear_count: item.wear_count + 1,
          last_worn: today,
        })
        .eq("id", item.id)
        .eq("user_id", userId),
      ),
  );

  const itemError = itemUpdates.find((result) => result.error)?.error;
  if (itemError) {
    throwApiError(itemError, "Kombin parcalari giyildi olarak isaretlenemedi.");
  }
}

export async function toggleOutfitFavorite(userId: string, outfit: OutfitRecord): Promise<OutfitRecord> {
  assertUserId(userId);
  assertOutfitOwner(userId, outfit);

  const { data, error } = await supabase
    .from("outfits")
    .update({ is_favorite: !outfit.is_favorite })
    .eq("id", outfit.id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    throwApiError(error, "Favori durumu guncellenemedi.");
  }

  const updatedOutfit = normalizeOutfitRecord(data);
  if (!updatedOutfit) {
    throw new Error("Kombin kaydi gecersiz dondu.");
  }

  return updatedOutfit;
}

export async function deleteOutfit(userId: string, outfitId: string): Promise<void> {
  assertUserId(userId);
  assertOutfitId(outfitId);

  const { error } = await supabase.from("outfits").delete().eq("id", outfitId).eq("user_id", userId);

  if (error) {
    throwApiError(error, "Kombin silinemedi.");
  }
}

function normalizeOutfitRecommendationInput(input: OutfitRecommendationInput): OutfitRecommendationInput {
  return {
    ...input,
    event: input.event.trim().replace(/\s+/g, " ").slice(0, 80) || "kombin",
    focus_item_id: input.focus_item_id && isUuid(input.focus_item_id) ? input.focus_item_id : null,
    mood: input.mood.trim().replace(/\s+/g, " ").slice(0, 80) || "rahat",
    wardrobe: input.wardrobe.filter((item) => item.is_active && isUuid(item.id)).slice(0, 100),
    weather: input.weather
      ? {
          ...input.weather,
          description: input.weather.description.trim().replace(/\s+/g, " ").slice(0, 120),
          temp: Number.isFinite(input.weather.temp) ? Math.round(input.weather.temp * 10) / 10 : 0,
        }
      : null,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizeText(value: unknown, fallback: string, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : fallback;
}

function normalizeNullableText(value: string, maxLength: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength) || null;
}

function normalizeNullableNumber(value: unknown, min: number, max: number) {
  if (value === null || value === undefined) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? Math.round(number * 100) / 100 : null;
}

function normalizeCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.min(10_000, Math.trunc(count))) : 0;
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
  return Number.isFinite(date.getTime()) ? value : null;
}

function assertUserId(value: string) {
  if (!isUuid(value)) {
    throw new Error("Oturum bilgisi gecersiz. Tekrar giris yapmayi dene.");
  }
}

function assertOutfitId(value: string) {
  if (!isUuid(value)) {
    throw new Error("Kombin kaydi gecersiz.");
  }
}

function assertOutfitOwner(userId: string, outfit: OutfitRecord) {
  assertOutfitId(outfit.id);
  if (outfit.user_id !== userId) {
    throw new Error("Bu kombin icin yetkin yok.");
  }
}
