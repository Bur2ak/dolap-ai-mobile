import { nanoid } from "nanoid/non-secure";

import { throwApiError } from "@/lib/api/errors";
import { invokeFunctionWithRetry } from "@/lib/api/functions";
import { filterUsersByNotificationPreference, userAllowsNotification } from "@/lib/api/notifications";
import { cacheOutfitSuggestions, getCachedOutfitSuggestions } from "@/lib/offlineCache";
import { supabase } from "@/lib/supabase";
import type { Friendship, OutfitRecommendationInput, OutfitRecord, OutfitSuggestion, OutfitVoteValue, SharedOutfit, WardrobeItem } from "@/types";
import { formatDateOnly } from "@/utils/formatters";

export async function recommendOutfits(input: OutfitRecommendationInput): Promise<OutfitSuggestion[]> {
  const userId = input.wardrobe[0]?.user_id;

  try {
    const data = await invokeFunctionWithRetry<OutfitSuggestion[]>("recommend-outfit", input);
    const suggestions = data ?? [];

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
  const { data: outfit, error } = await supabase
    .from("outfits")
    .insert({
      user_id: userId,
      name: suggestion.name,
      event_type: input.event,
      weather_temp: input.weather?.temp ?? null,
      weather_description: input.weather?.description ?? null,
      mood: input.mood,
      ai_reasoning: suggestion.reason,
      is_shareable: isShareable,
      share_token: isShareable ? nanoid(12) : null,
    })
    .select("*")
    .single();

  if (error) {
    throwApiError(error, "Kombin kaydedilemedi.");
  }

  const rows = suggestion.items.map((itemId, index) => ({
    outfit_id: outfit.id,
    item_id: itemId,
    position: index,
  }));

  if (rows.length > 0) {
    const { error: itemsError } = await supabase.from("outfit_items").insert(rows);
    if (itemsError) {
      throwApiError(itemsError, "Kombin parcalari kaydedilemedi.");
    }
  }

  return outfit as OutfitRecord;
}

export async function saveSharedOutfit(userId: string, input: OutfitRecommendationInput, suggestion: OutfitSuggestion): Promise<OutfitRecord> {
  return saveOutfit(userId, input, suggestion, true);
}

export async function makeOutfitShareable(userId: string, outfit: OutfitRecord): Promise<OutfitRecord> {
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

  return data as OutfitRecord;
}

export async function askFriendsToVoteOnOutfit(userId: string, outfit: OutfitRecord): Promise<number> {
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
    .filter((friendId, index, allFriendIds) => friendId !== userId && allFriendIds.indexOf(friendId) === index);

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
  const { data: outfits, error } = await supabase
    .from("outfits")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throwApiError(error, "Kayitli kombinler yuklenemedi.");
  }

  const results = [];

  for (const outfit of (outfits ?? []) as OutfitRecord[]) {
    const sharedOutfit = await fetchSharedOutfit(outfit.id);
    results.push(sharedOutfit);
  }

  return results;
}

export async function fetchSharedOutfit(outfitId: string): Promise<SharedOutfit> {
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

  return {
    outfit: outfit as OutfitRecord,
    items: (itemRows ?? []).flatMap((row) => (Array.isArray(row.item) ? row.item : row.item ? [row.item] : [])) as WardrobeItem[],
    votes: (votes ?? []) as SharedOutfit["votes"],
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

  return fetchSharedOutfit((outfit as OutfitRecord).id);
}

export async function voteOnOutfit(userId: string, outfit: OutfitRecord, vote: OutfitVoteValue): Promise<void> {
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
      throwApiError(notificationError, "Oy bildirimi olusturulamadi.");
    }
  }
}

export async function markOutfitWorn(userId: string, sharedOutfit: SharedOutfit): Promise<void> {
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
    sharedOutfit.items.map((item) =>
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

  return data as OutfitRecord;
}

export async function deleteOutfit(userId: string, outfitId: string): Promise<void> {
  const { error } = await supabase.from("outfits").delete().eq("id", outfitId).eq("user_id", userId);

  if (error) {
    throwApiError(error, "Kombin silinemedi.");
  }
}
