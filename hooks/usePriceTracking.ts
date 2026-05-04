import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  checkPriceTrackings,
  createPriceTracking,
  deletePriceTracking,
  fetchPriceTrackings,
  updatePriceTracking,
} from "@/lib/api/priceTracking";
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["price-trackings", userId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (trackingId: string) => deletePriceTracking(userId!, trackingId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["price-trackings", userId] });
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ trackingId, input }: { trackingId: string; input: UpdatePriceTrackingInput }) => updatePriceTracking(userId!, trackingId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["price-trackings", userId] });
    },
  });
  const checkMutation = useMutation({
    mutationFn: () => checkPriceTrackings(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["price-trackings", userId] });
      void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    },
  });

  return {
    trackings: trackingsQuery.data ?? [],
    isLoading: trackingsQuery.isLoading,
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
