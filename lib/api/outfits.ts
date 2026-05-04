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

export async function saveSharedOutfit(userId: string, input: OutfitRecommendationInput, suggestion: OutfitSuggestion): Promise<OutfitRecord> {
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
      is_shareable: true,
      share_token: nanoid(12),
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
