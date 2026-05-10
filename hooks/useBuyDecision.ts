import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { deleteBuyDecision, fetchBuyDecisionHistory, requestBuyDecision, saveBuyDecisionResult } from "@/lib/api/buyDecision";
import { captureError, captureEvent } from "@/lib/observability";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import type { BuyDecisionInput, BuyDecisionResult } from "@/types";

export function useBuyDecision() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const queryClient = useQueryClient();

  const decisionMutation = useMutation({
    mutationFn: (input: BuyDecisionInput) => requestBuyDecision(input),
    onError: (error, input) => {
      captureError(error, {
        area: "buy_decision_generate",
        has_image: Boolean(input.imageUri),
        has_price: input.price !== null,
        wardrobe_count: input.wardrobe.length,
      });
    },
    onSuccess: (result, input) => {
      captureEvent("buy_decision_generated", {
        decision: result.decision,
        has_image: Boolean(input.imageUri),
        has_price: input.price !== null,
        similar_count: result.similar_items_in_wardrobe.length,
        wardrobe_count: input.wardrobe.length,
      });
    },
  });

  const historyQuery = useQuery({
    enabled: Boolean(userId),
    queryFn: () => fetchBuyDecisionHistory(userId!),
    queryKey: ["buy-decisions", userId],
  });

  const saveMutation = useMutation({
    mutationFn: ({ result, imageUri, price }: { result: BuyDecisionResult; imageUri: string | null; price: number | null }) =>
      saveBuyDecisionResult(userId!, result, imageUri, price),
    onError: (error, variables) => {
      captureError(error, {
        area: "buy_decision_save",
        decision: variables.result.decision,
        has_image: Boolean(variables.imageUri),
        has_price: variables.price !== null,
      });
    },
    onSuccess: async () => {
      captureEvent("buy_decision_saved");
      await queryClient.invalidateQueries({ queryKey: ["buy-decisions", userId] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (decisionId: string) => deleteBuyDecision(userId!, decisionId),
    onError: (error) => {
      captureError(error, { area: "buy_decision_delete" });
    },
    onSuccess: async () => {
      captureEvent("buy_decision_deleted");
      await queryClient.invalidateQueries({ queryKey: ["buy-decisions", userId] });
    },
  });

  useEffect(() => {
    if (!userId) {
      return;
    }

    const channel = supabase
      .channel(`buy-decisions-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "buy_decisions", filter: `user_id=eq.${userId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["buy-decisions", userId] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  return {
    userId,
    decide: decisionMutation.mutateAsync,
    result: decisionMutation.data,
    isDeciding: decisionMutation.isPending,
    saveResult: saveMutation.mutateAsync,
    deleteDecision: deleteMutation.mutateAsync,
    isSaving: saveMutation.isPending || deleteMutation.isPending,
    canSave: Boolean(userId),
    history: historyQuery.data ?? [],
    historyError: historyQuery.error,
    isLoadingHistory: historyQuery.isLoading,
    isRefetchingHistory: historyQuery.isRefetching,
    refetchHistory: historyQuery.refetch,
  };
}
