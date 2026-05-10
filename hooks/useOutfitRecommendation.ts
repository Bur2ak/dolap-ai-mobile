import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  askFriendsToVoteOnOutfit,
  deleteOutfit,
  fetchSharedOutfit,
  fetchSharedOutfitByToken,
  fetchUserOutfits,
  markOutfitWorn,
  makeOutfitShareable,
  recommendOutfits,
  saveOutfit,
  saveSharedOutfit,
  toggleOutfitFavorite,
  voteOnOutfit,
} from "@/lib/api/outfits";
import { captureError, captureEvent } from "@/lib/observability";
import { supabase } from "@/lib/supabase";
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
    onError: (error, input) => {
      captureError(error, {
        area: "outfit_recommend",
        event: input.event,
        mood: input.mood,
        wardrobe_count: input.wardrobe.length,
        weather_available: Boolean(input.weather),
      });
    },
    onSuccess: (suggestions, input) => {
      captureEvent("outfit_recommendation_generated", {
        event: input.event,
        mood: input.mood,
        suggestion_count: suggestions.length,
        wardrobe_count: input.wardrobe.length,
        weather_available: Boolean(input.weather),
      });
    },
  });
  const saveLocalMutation = useMutation({
    mutationFn: ({ input, suggestion }: { input: OutfitRecommendationInput; suggestion: OutfitSuggestion }) => saveOutfit(userId!, input, suggestion),
    onError: (error, variables) => {
      captureError(error, {
        area: "outfit_save_local",
        event: variables.input.event,
        item_count: variables.suggestion.items.length,
      });
    },
    onSuccess: (_outfit, variables) => {
      captureEvent("outfit_saved", {
        event: variables.input.event,
        item_count: variables.suggestion.items.length,
        shared: false,
      });
      void queryClient.invalidateQueries({ queryKey: ["saved-outfits", userId] });
    },
  });
  const saveMutation = useMutation({
    mutationFn: ({ input, suggestion }: { input: OutfitRecommendationInput; suggestion: OutfitSuggestion }) =>
      saveSharedOutfit(userId!, input, suggestion),
    onError: (error, variables) => {
      captureError(error, {
        area: "outfit_save_shared",
        event: variables.input.event,
        item_count: variables.suggestion.items.length,
      });
    },
    onSuccess: (_outfit, variables) => {
      captureEvent("outfit_saved", {
        event: variables.input.event,
        item_count: variables.suggestion.items.length,
        shared: true,
      });
      void queryClient.invalidateQueries({ queryKey: ["saved-outfits", userId] });
    },
  });
  const askFriendsMutation = useMutation({
    mutationFn: async ({ input, suggestion }: { input: OutfitRecommendationInput; suggestion: OutfitSuggestion }) => {
      const outfit = await saveSharedOutfit(userId!, input, suggestion);
      const notifiedFriendsCount = await askFriendsToVoteOnOutfit(userId!, outfit);
      return { outfit, notifiedFriendsCount };
    },
    onError: (error, variables) => {
      captureError(error, {
        area: "outfit_friend_vote_request_recommendation",
        item_count: variables.suggestion.items.length,
      });
    },
    onSuccess: (result, variables) => {
      captureEvent("outfit_friend_vote_requested", {
        item_count: variables.suggestion.items.length,
        notified_friends_count: result.notifiedFriendsCount,
        surface: "recommendation",
      });
      void queryClient.invalidateQueries({ queryKey: ["saved-outfits", userId] });
    },
  });

  useEffect(() => {
    if (!userId) {
      return;
    }

    const invalidateSavedOutfits = () => {
      void queryClient.invalidateQueries({ queryKey: ["saved-outfits", userId] });
    };
    const outfitsChannel = supabase
      .channel(`saved-outfits-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "outfits", filter: `user_id=eq.${userId}` }, invalidateSavedOutfits)
      .subscribe();
    const outfitItemsChannel = supabase
      .channel(`saved-outfit-items-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "outfit_items" }, invalidateSavedOutfits)
      .subscribe();

    return () => {
      void supabase.removeChannel(outfitsChannel);
      void supabase.removeChannel(outfitItemsChannel);
    };
  }, [queryClient, userId]);

  return {
    userId,
    savedOutfits: savedOutfitsQuery.data ?? [],
    savedOutfitsError: savedOutfitsQuery.error,
    isLoadingSavedOutfits: savedOutfitsQuery.isLoading,
    isRefetchingSavedOutfits: savedOutfitsQuery.isRefetching,
    refetchSavedOutfits: savedOutfitsQuery.refetch,
    recommend: mutation.mutateAsync,
    suggestions: mutation.data ?? [],
    isRecommending: mutation.isPending,
    saveOutfit: saveLocalMutation.mutateAsync,
    saveSharedOutfit: saveMutation.mutateAsync,
    askFriendsToVote: askFriendsMutation.mutateAsync,
    isSavingOutfit: saveLocalMutation.isPending || saveMutation.isPending || askFriendsMutation.isPending,
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
    onError: (error, vote) => {
      captureError(error, { area: "shared_outfit_vote", outfit_id: outfitId ?? "unknown", vote });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["shared-outfit", outfitId] });
    },
  });
  const markWornMutation = useMutation({
    mutationFn: () => markOutfitWorn(userId!, outfitQuery.data!),
    onError: (error) => {
      captureError(error, { area: "shared_outfit_mark_worn", outfit_id: outfitId ?? "unknown" });
    },
    onSuccess: () => {
      captureEvent("outfit_marked_worn", { outfit_id: outfitId ?? "unknown" });
      void queryClient.invalidateQueries({ queryKey: ["shared-outfit", outfitId] });
      void queryClient.invalidateQueries({ queryKey: ["saved-outfits", userId] });
      void queryClient.invalidateQueries({ queryKey: ["wardrobe-items", userId] });
    },
  });
  const favoriteMutation = useMutation({
    mutationFn: () => toggleOutfitFavorite(userId!, outfitQuery.data!.outfit),
    onError: (error) => {
      captureError(error, { area: "shared_outfit_toggle_favorite", outfit_id: outfitId ?? "unknown" });
    },
    onSuccess: () => {
      captureEvent("outfit_favorite_toggled", { outfit_id: outfitId ?? "unknown" });
      void queryClient.invalidateQueries({ queryKey: ["shared-outfit", outfitId] });
      void queryClient.invalidateQueries({ queryKey: ["saved-outfits", userId] });
    },
  });
  const shareMutation = useMutation({
    mutationFn: () => makeOutfitShareable(userId!, outfitQuery.data!.outfit),
    onError: (error) => {
      captureError(error, { area: "shared_outfit_share", outfit_id: outfitId ?? "unknown" });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["shared-outfit", outfitId] });
      void queryClient.invalidateQueries({ queryKey: ["saved-outfits", userId] });
    },
  });
  const askFriendsMutation = useMutation({
    mutationFn: async () => {
      const outfit = await makeOutfitShareable(userId!, outfitQuery.data!.outfit);
      const notifiedFriendsCount = await askFriendsToVoteOnOutfit(userId!, outfit);
      return { outfit, notifiedFriendsCount };
    },
    onError: (error) => {
      captureError(error, { area: "shared_outfit_ask_friends", outfit_id: outfitId ?? "unknown" });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["shared-outfit", outfitId] });
      void queryClient.invalidateQueries({ queryKey: ["saved-outfits", userId] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteOutfit(userId!, outfitId!),
    onError: (error) => {
      captureError(error, { area: "shared_outfit_delete", outfit_id: outfitId ?? "unknown" });
    },
    onSuccess: () => {
      captureEvent("outfit_deleted", { outfit_id: outfitId ?? "unknown" });
      void queryClient.removeQueries({ queryKey: ["shared-outfit", outfitId] });
      void queryClient.invalidateQueries({ queryKey: ["saved-outfits", userId] });
    },
  });

  useEffect(() => {
    if (!outfitId) {
      return;
    }

    const channel = supabase
      .channel(`outfit-votes-${outfitId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "outfit_votes", filter: `outfit_id=eq.${outfitId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["shared-outfit", outfitId] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [outfitId, queryClient]);

  return {
    userId,
    sharedOutfit: outfitQuery.data,
    isLoading: outfitQuery.isLoading,
    isRefetching: outfitQuery.isRefetching,
    error: outfitQuery.error,
    refetch: outfitQuery.refetch,
    vote: voteMutation.mutateAsync,
    markWorn: markWornMutation.mutateAsync,
    toggleFavorite: favoriteMutation.mutateAsync,
    shareOutfit: shareMutation.mutateAsync,
    askFriendsToVote: askFriendsMutation.mutateAsync,
    deleteOutfit: deleteMutation.mutateAsync,
    isVoting: voteMutation.isPending,
    isMarkingWorn: markWornMutation.isPending,
    isTogglingFavorite: favoriteMutation.isPending,
    isSharingOutfit: shareMutation.isPending,
    isAskingFriends: askFriendsMutation.isPending,
    isDeletingOutfit: deleteMutation.isPending,
    canVote: Boolean(userId && outfitQuery.data),
    canMarkWorn: Boolean(userId && outfitQuery.data && outfitQuery.data.outfit.user_id === userId),
    canToggleFavorite: Boolean(userId && outfitQuery.data && outfitQuery.data.outfit.user_id === userId),
    canShareOutfit: Boolean(userId && outfitQuery.data && outfitQuery.data.outfit.user_id === userId),
    canDeleteOutfit: Boolean(userId && outfitQuery.data && outfitQuery.data.outfit.user_id === userId),
  };
}

export function usePublicSharedOutfit(token?: string) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.session?.user.id);
  const outfitQuery = useQuery({
    queryKey: ["shared-outfit-token", token],
    queryFn: () => fetchSharedOutfitByToken(token!),
    enabled: Boolean(token),
  });
  const voteMutation = useMutation({
    mutationFn: (vote: OutfitVoteValue) => voteOnOutfit(userId!, outfitQuery.data!.outfit, vote),
    onError: (error, vote) => {
      captureError(error, { area: "public_shared_outfit_vote", token: token ?? "unknown", vote });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["shared-outfit-token", token] });
    },
  });

  useEffect(() => {
    const outfitId = outfitQuery.data?.outfit.id;
    if (!outfitId) {
      return;
    }

    const channel = supabase
      .channel(`public-outfit-votes-${outfitId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "outfit_votes", filter: `outfit_id=eq.${outfitId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["shared-outfit-token", token] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [outfitQuery.data?.outfit.id, queryClient, token]);

  return {
    userId,
    sharedOutfit: outfitQuery.data,
    isLoading: outfitQuery.isLoading,
    isRefetching: outfitQuery.isRefetching,
    error: outfitQuery.error,
    refetch: outfitQuery.refetch,
    vote: voteMutation.mutateAsync,
    isVoting: voteMutation.isPending,
    canVote: Boolean(userId && outfitQuery.data),
  };
}
