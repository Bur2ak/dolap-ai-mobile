import { supabase } from "@/lib/supabase";
import type { OutfitRecommendationInput, OutfitSuggestion } from "@/types";

export async function recommendOutfits(input: OutfitRecommendationInput): Promise<OutfitSuggestion[]> {
  const { data, error } = await supabase.functions.invoke<OutfitSuggestion[]>("recommend-outfit", {
    body: input,
  });

  if (error) {
    throw error;
  }

  return data ?? [];
}
