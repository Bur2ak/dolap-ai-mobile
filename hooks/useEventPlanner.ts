import { useMutation } from "@tanstack/react-query";

import { recommendEventOutfits, saveEventPlan } from "@/lib/api/events";
import { useAuthStore } from "@/stores/authStore";
import type { EventPlanInput } from "@/types";

export function useEventPlanner() {
  const userId = useAuthStore((state) => state.session?.user.id);

  const recommendMutation = useMutation({
    mutationFn: (input: EventPlanInput) => recommendEventOutfits(input),
  });

  const saveMutation = useMutation({
    mutationFn: (input: Omit<EventPlanInput, "weather" | "wardrobe">) => saveEventPlan(userId!, input),
  });

  return {
    recommend: recommendMutation.mutateAsync,
    suggestions: recommendMutation.data ?? [],
    isRecommending: recommendMutation.isPending,
    saveEvent: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    canSave: Boolean(userId),
  };
}
