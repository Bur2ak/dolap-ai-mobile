import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchSharedOutfit, fetchUserOutfits, markOutfitWorn, recommendOutfits, saveOutfit, saveSharedOutfit, voteOnOutfit } from "@/lib/api/outfits";
import { useAuthStore } from "@/stores/authStore";
import type { OutfitRecommendationInput, OutfitSuggestion, OutfitVoteValue } from "@/types";

export function useOutfitRecommendation() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const queryClient = useQueryClient();
  const savedOutfitsQuery = useQuery({
    queryKey: ["saved-outfits", userId],
    queryFn: () => fetchUserOutfits(userId!),
    enabled: Boolean(userId),
  });
  const mutation = useMutation({
    mutationFn: (input: OutfitRecommendationInput) => recommendOutfits(input),
  });
  const saveLocalMutation = useMutation({
    mutationFn: ({ input, suggestion }: { input: OutfitRecommendationInput; suggestion: OutfitSuggestion }) => saveOutfit(userId!, input, suggestion),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["saved-outfits", userId] });
    },
  });
  const saveMutation = useMutation({
    mutationFn: ({ input, suggestion }: { input: OutfitRecommendationInput; suggestion: OutfitSuggestion }) =>
      saveSharedOutfit(userId!, input, suggestion),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["saved-outfits", userId] });
    },
  });

  return {
    userId,
    savedOutfits: savedOutfitsQuery.data ?? [],
    isLoadingSavedOutfits: savedOutfitsQuery.isLoading,
    recommend: mutation.mutateAsync,
    suggestions: mutation.data ?? [],
    isRecommending: mutation.isPending,
    saveOutfit: saveLocalMutation.mutateAsync,
    saveSharedOutfit: saveMutation.mutateAsync,
    isSavingOutfit: saveLocalMutation.isPending || saveMutation.isPending,
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
  const markWornMutation = useMutation({
    mutationFn: () => markOutfitWorn(userId!, outfitQuery.data!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["shared-outfit", outfitId] });
      void queryClient.invalidateQueries({ queryKey: ["saved-outfits", userId] });
      void queryClient.invalidateQueries({ queryKey: ["wardrobe-items", userId] });
    },
  });

  return {
    userId,
    sharedOutfit: outfitQuery.data,
    isLoading: outfitQuery.isLoading,
    error: outfitQuery.error,
    vote: voteMutation.mutateAsync,
    markWorn: markWornMutation.mutateAsync,
    isVoting: voteMutation.isPending,
    isMarkingWorn: markWornMutation.isPending,
    canVote: Boolean(userId && outfitQuery.data && outfitQuery.data.outfit.user_id !== userId),
    canMarkWorn: Boolean(userId && outfitQuery.data && outfitQuery.data.outfit.user_id === userId),
  };
}
