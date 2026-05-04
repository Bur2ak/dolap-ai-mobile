import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchSharedOutfit, recommendOutfits, saveSharedOutfit, voteOnOutfit } from "@/lib/api/outfits";
import { useAuthStore } from "@/stores/authStore";
import type { OutfitRecommendationInput, OutfitSuggestion, OutfitVoteValue } from "@/types";

export function useOutfitRecommendation() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const mutation = useMutation({
    mutationFn: (input: OutfitRecommendationInput) => recommendOutfits(input),
  });
  const saveMutation = useMutation({
    mutationFn: ({ input, suggestion }: { input: OutfitRecommendationInput; suggestion: OutfitSuggestion }) =>
      saveSharedOutfit(userId!, input, suggestion),
  });

  return {
    userId,
    recommend: mutation.mutateAsync,
    suggestions: mutation.data ?? [],
    isRecommending: mutation.isPending,
    saveSharedOutfit: saveMutation.mutateAsync,
    isSavingSharedOutfit: saveMutation.isPending,
    error: mutation.error,
  };
}

export function useSharedOutfit(outfitId?: string) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.session?.user.id);
  const outfitQuery = useQuery({
    queryKey: ["shared-outfit", outfitId],
    queryFn: () => fetchSharedOutfit(outfitId!),
    enabled: Boolean(outfitId),
  });
  const voteMutation = useMutation({
    mutationFn: (vote: OutfitVoteValue) => voteOnOutfit(userId!, outfitQuery.data!.outfit, vote),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["shared-outfit", outfitId] });
    },
  });

  return {
    userId,
    sharedOutfit: outfitQuery.data,
    isLoading: outfitQuery.isLoading,
    error: outfitQuery.error,
    vote: voteMutation.mutateAsync,
    isVoting: voteMutation.isPending,
    canVote: Boolean(userId && outfitQuery.data && outfitQuery.data.outfit.user_id !== userId),
  };
}
