import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { checkPriceTrackings, createPriceTracking, deletePriceTracking, fetchPriceTrackings } from "@/lib/api/priceTracking";
import { useAuthStore } from "@/stores/authStore";
import type { CreatePriceTrackingInput } from "@/types";

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
    deleteTracking: deleteMutation.mutateAsync,
    checkPrices: checkMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isChecking: checkMutation.isPending,
    canUse: Boolean(userId),
  };
}
