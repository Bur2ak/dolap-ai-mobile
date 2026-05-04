import { nanoid } from "nanoid/non-secure";

import { supabase } from "@/lib/supabase";
import type { OutfitRecommendationInput, OutfitRecord, OutfitSuggestion, OutfitVoteValue, SharedOutfit, WardrobeItem } from "@/types";

export async function recommendOutfits(input: OutfitRecommendationInput): Promise<OutfitSuggestion[]> {
  const { data, error } = await supabase.functions.invoke<OutfitSuggestion[]>("recommend-outfit", {
    body: input,
  });

  if (error) {
    throw error;
  }

  return data ?? [];
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
    throw error;
  }

  const rows = suggestion.items.map((itemId, index) => ({
    outfit_id: outfit.id,
    item_id: itemId,
    position: index,
  }));

  if (rows.length > 0) {
    const { error: itemsError } = await supabase.from("outfit_items").insert(rows);
    if (itemsError) {
      throw itemsError;
    }
  }

  return outfit as OutfitRecord;
}

export async function saveSharedOutfit(userId: string, input: OutfitRecommendationInput, suggestion: OutfitSuggestion): Promise<OutfitRecord> {
  return saveOutfit(userId, input, suggestion, true);
}

export async function fetchUserOutfits(userId: string): Promise<SharedOutfit[]> {
  const { data: outfits, error } = await supabase
    .from("outfits")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw error;
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
    throw outfitError;
  }

  const { data: itemRows, error: itemsError } = await supabase
    .from("outfit_items")
    .select("position, item:wardrobe_items(*)")
    .eq("outfit_id", outfitId)
    .order("position", { ascending: true });

  if (itemsError) {
    throw itemsError;
  }

  const { data: votes, error: votesError } = await supabase.from("outfit_votes").select("*").eq("outfit_id", outfitId);

  if (votesError) {
    throw votesError;
  }

  return {
    outfit: outfit as OutfitRecord,
    items: (itemRows ?? []).flatMap((row) => (Array.isArray(row.item) ? row.item : row.item ? [row.item] : [])) as WardrobeItem[],
    votes: (votes ?? []) as SharedOutfit["votes"],
  };
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
    throw error;
  }

  if (outfit.user_id !== userId) {
    await supabase.from("notifications").insert({
      user_id: outfit.user_id,
      type: "outfit_vote",
      title: "Kombinine oy geldi",
      body: `${outfit.name ?? "Kombin"} icin yeni oy: ${vote}`,
      data: {
        outfit_id: outfit.id,
        vote,
      },
    });
  }
}

export async function markOutfitWorn(userId: string, sharedOutfit: SharedOutfit): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from("outfits")
    .update({ worn_at: today })
    .eq("id", sharedOutfit.outfit.id)
    .eq("user_id", userId);

  if (error) {
    throw error;
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
    throw itemError;
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
    throw error;
  }

  return data as OutfitRecord;
}
