import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  checkPriceTrackings,
  createPriceTracking,
  deletePriceTracking,
  fetchPriceTrackings,
  updatePriceTracking,
} from "@/lib/api/priceTracking";
import { captureEvent } from "@/lib/observability";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import type { CreatePriceTrackingInput, UpdatePriceTrackingInput } from "@/types";

export function usePriceTracking() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.session?.user.id);

  const trackingsQuery = useQuery({
    queryKey: ["price-trackings", userId],
    queryFn: () => fetchPriceTrackings(userId!),
    enabled: Boolean(userId),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreatePriceTrackingInput) => createPriceTracking(userId!, input),
    onSuccess: (_tracking, input) => {
      captureEvent("price_tracking_created", {
        has_current_price: input.current_price !== null,
        has_target_price: input.target_price !== null,
        has_url: Boolean(input.product_url),
      });
      void queryClient.invalidateQueries({ queryKey: ["price-trackings", userId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (trackingId: string) => deletePriceTracking(userId!, trackingId),
    onSuccess: () => {
      captureEvent("price_tracking_deleted");
      void queryClient.invalidateQueries({ queryKey: ["price-trackings", userId] });
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ trackingId, input }: { trackingId: string; input: UpdatePriceTrackingInput }) => updatePriceTracking(userId!, trackingId, input),
    onSuccess: (_tracking, variables) => {
      captureEvent("price_tracking_updated", {
        changed_current_price: variables.input.current_price !== undefined,
        changed_target_price: variables.input.target_price !== undefined,
        changed_url: variables.input.product_url !== undefined,
      });
      void queryClient.invalidateQueries({ queryKey: ["price-trackings", userId] });
    },
  });
  const checkMutation = useMutation({
    mutationFn: () => checkPriceTrackings(),
    onSuccess: (result) => {
      captureEvent("price_tracking_checked", {
        checked: result.checked,
        notified: result.notified,
        updated: result.updated,
      });
      void queryClient.invalidateQueries({ queryKey: ["price-trackings", userId] });
      void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    },
  });

  useEffect(() => {
    if (!userId) {
      return;
    }

    const channel = supabase
      .channel(`price-trackings-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "price_tracking", filter: `user_id=eq.${userId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["price-trackings", userId] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  return {
    trackings: trackingsQuery.data ?? [],
    error: trackingsQuery.error,
    isLoading: trackingsQuery.isLoading,
    isRefetching: trackingsQuery.isRefetching,
    refetch: trackingsQuery.refetch,
    createTracking: createMutation.mutateAsync,
    updateTracking: updateMutation.mutateAsync,
    deleteTracking: deleteMutation.mutateAsync,
    checkPrices: checkMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isChecking: checkMutation.isPending,
    canUse: Boolean(userId),
  };
}
