import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { deleteEventPlan, fetchEventPlans, recommendEventOutfits, saveEventPlan, updateEventPlan } from "@/lib/api/events";
import { useAuthStore } from "@/stores/authStore";
import type { EventPlanInput, UpdateEventInput } from "@/types";

export function useEventPlanner() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.session?.user.id);
  const eventsQuery = useQuery({
    queryKey: ["event-plans", userId],
    queryFn: () => fetchEventPlans(userId!),
    enabled: Boolean(userId),
  });

  const recommendMutation = useMutation({
    mutationFn: (input: EventPlanInput) => recommendEventOutfits(input),
  });

  const saveMutation = useMutation({
    mutationFn: (input: Omit<EventPlanInput, "weather" | "wardrobe"> & { calendar_event_id?: string | null }) => saveEventPlan(userId!, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["event-plans", userId] });
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ eventId, input }: { eventId: string; input: UpdateEventInput }) => updateEventPlan(userId!, eventId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["event-plans", userId] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (eventId: string) => deleteEventPlan(userId!, eventId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["event-plans", userId] });
    },
  });

  return {
    events: eventsQuery.data ?? [],
    isLoadingEvents: eventsQuery.isLoading,
    recommend: recommendMutation.mutateAsync,
    suggestions: recommendMutation.data ?? [],
    isRecommending: recommendMutation.isPending,
    saveEvent: saveMutation.mutateAsync,
    updateEvent: updateMutation.mutateAsync,
    deleteEvent: deleteMutation.mutateAsync,
    isSaving: saveMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
    canSave: Boolean(userId),
  };
}
