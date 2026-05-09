import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { deleteEventPlan, fetchEventPlans, recommendEventOutfits, saveEventPlan, updateEventPlan } from "@/lib/api/events";
import { saveOutfit } from "@/lib/api/outfits";
import { captureEvent } from "@/lib/observability";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import type { EventPlanInput, OutfitSuggestion, UpdateEventInput } from "@/types";

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
    onSuccess: (suggestions, input) => {
      captureEvent("event_outfit_recommendation_generated", {
        event_type: input.event_type,
        suggestion_count: suggestions.length,
        wardrobe_count: input.wardrobe.length,
        weather_available: Boolean(input.weather),
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: (input: Omit<EventPlanInput, "weather" | "wardrobe"> & { calendar_event_id?: string | null; outfit_id?: string | null }) =>
      saveEventPlan(userId!, input),
    onSuccess: (_event, input) => {
      captureEvent("event_plan_saved", {
        event_type: input.event_type,
        has_calendar_event: Boolean(input.calendar_event_id),
        has_outfit: Boolean(input.outfit_id),
      });
      void queryClient.invalidateQueries({ queryKey: ["event-plans", userId] });
    },
  });
  const saveSuggestionMutation = useMutation({
    mutationFn: async ({ input, suggestion }: { input: EventPlanInput; suggestion: OutfitSuggestion }) => {
      const outfit = await saveOutfit(
        userId!,
        {
          event: input.event_type,
          mood: input.notes ?? "Etkinlik",
          weather: input.weather,
          wardrobe: input.wardrobe,
        },
        suggestion,
      );

      return saveEventPlan(userId!, {
        title: input.title,
        event_type: input.event_type,
        event_date: input.event_date,
        location: input.location,
        notes: input.notes,
        outfit_id: outfit.id,
      });
    },
    onSuccess: (_event, variables) => {
      captureEvent("event_plan_saved", {
        event_type: variables.input.event_type,
        has_calendar_event: false,
        has_outfit: true,
      });
      void queryClient.invalidateQueries({ queryKey: ["event-plans", userId] });
      void queryClient.invalidateQueries({ queryKey: ["saved-outfits", userId] });
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ eventId, input }: { eventId: string; input: UpdateEventInput }) => updateEventPlan(userId!, eventId, input),
    onSuccess: (_event, variables) => {
      captureEvent("event_plan_updated", {
        changed_calendar_event: variables.input.calendar_event_id !== undefined,
        changed_date: variables.input.event_date !== undefined,
        changed_outfit: variables.input.outfit_id !== undefined,
      });
      void queryClient.invalidateQueries({ queryKey: ["event-plans", userId] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (eventId: string) => deleteEventPlan(userId!, eventId),
    onSuccess: () => {
      captureEvent("event_plan_deleted");
      void queryClient.invalidateQueries({ queryKey: ["event-plans", userId] });
    },
  });

  useEffect(() => {
    if (!userId) {
      return;
    }

    const channel = supabase
      .channel(`event-plans-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `user_id=eq.${userId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["event-plans", userId] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  return {
    events: eventsQuery.data ?? [],
    eventsError: eventsQuery.error,
    isLoadingEvents: eventsQuery.isLoading,
    isRefetchingEvents: eventsQuery.isRefetching,
    refetchEvents: eventsQuery.refetch,
    recommend: recommendMutation.mutateAsync,
    suggestions: recommendMutation.data ?? [],
    isRecommending: recommendMutation.isPending,
    saveEvent: saveMutation.mutateAsync,
    saveSuggestionAsEvent: saveSuggestionMutation.mutateAsync,
    updateEvent: updateMutation.mutateAsync,
    deleteEvent: deleteMutation.mutateAsync,
    isSaving: saveMutation.isPending || saveSuggestionMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
    canSave: Boolean(userId),
  };
}
