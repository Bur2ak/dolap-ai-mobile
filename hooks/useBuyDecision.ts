import { useMutation } from "@tanstack/react-query";

import { requestBuyDecision, saveBuyDecisionResult } from "@/lib/api/buyDecision";
import { useAuthStore } from "@/stores/authStore";
import type { BuyDecisionInput, BuyDecisionResult } from "@/types";

export function useBuyDecision() {
  const userId = useAuthStore((state) => state.session?.user.id);

  const decisionMutation = useMutation({
    mutationFn: (input: BuyDecisionInput) => requestBuyDecision(input),
  });

  const saveMutation = useMutation({
    mutationFn: ({ result, imageUrl, price }: { result: BuyDecisionResult; imageUrl: string | null; price: number | null }) =>
      saveBuyDecisionResult(userId!, result, imageUrl, price),
  });

  return {
    decide: decisionMutation.mutateAsync,
    result: decisionMutation.data,
    isDeciding: decisionMutation.isPending,
    saveResult: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    canSave: Boolean(userId),
  };
}
