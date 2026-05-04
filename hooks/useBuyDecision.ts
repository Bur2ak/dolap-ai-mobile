import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchBuyDecisionHistory, requestBuyDecision, saveBuyDecisionResult } from "@/lib/api/buyDecision";
import { useAuthStore } from "@/stores/authStore";
import type { BuyDecisionInput, BuyDecisionResult } from "@/types";

export function useBuyDecision() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const queryClient = useQueryClient();

  const decisionMutation = useMutation({
    mutationFn: (input: BuyDecisionInput) => requestBuyDecision(input),
  });

  const historyQuery = useQuery({
    enabled: Boolean(userId),
    queryFn: () => fetchBuyDecisionHistory(userId!),
    queryKey: ["buy-decisions", userId],
  });

  const saveMutation = useMutation({
    mutationFn: ({ result, imageUrl, price }: { result: BuyDecisionResult; imageUrl: string | null; price: number | null }) =>
      saveBuyDecisionResult(userId!, result, imageUrl, price),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["buy-decisions", userId] });
    },
  });

  return {
    decide: decisionMutation.mutateAsync,
    result: decisionMutation.data,
    isDeciding: decisionMutation.isPending,
    saveResult: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    canSave: Boolean(userId),
    history: historyQuery.data ?? [],
    isLoadingHistory: historyQuery.isLoading,
  };
}
