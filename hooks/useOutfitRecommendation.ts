import { useMutation } from "@tanstack/react-query";

import { recommendOutfits } from "@/lib/api/outfits";
import type { OutfitRecommendationInput } from "@/types";

export function useOutfitRecommendation() {
  const mutation = useMutation({
    mutationFn: (input: OutfitRecommendationInput) => recommendOutfits(input),
  });

  return {
    recommend: mutation.mutateAsync,
    suggestions: mutation.data ?? [],
    isRecommending: mutation.isPending,
    error: mutation.error,
  };
}
