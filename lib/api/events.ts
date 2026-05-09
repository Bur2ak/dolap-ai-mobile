import { invokeFunctionWithRetry } from "@/lib/api/functions";
import { throwApiError } from "@/lib/api/errors";
import { supabase } from "@/lib/supabase";
import type { EventPlanInput, EventRecord, OutfitSuggestion, UpdateEventInput } from "@/types";

export async function recommendEventOutfits(input: EventPlanInput): Promise<OutfitSuggestion[]> {
  const data = await invokeFunctionWithRetry<OutfitSuggestion[]>("event-outfit", input);
  return data ?? [];
}

export async function fetchEventPlans(userId: string): Promise<EventRecord[]> {
  const { data, error } = await supabase.from("events").select("*").eq("user_id", userId).order("event_date", { ascending: true });

  if (error) {
    throwApiError(error, "Etkinlikler yuklenemedi.");
  }

  return (data ?? []) as EventRecord[];
}

export async function saveEventPlan(
  userId: string,
  input: Omit<EventPlanInput, "weather" | "wardrobe"> & { calendar_event_id?: string | null; outfit_id?: string | null },
): Promise<EventRecord> {
  const { data, error } = await supabase
    .from("events")
    .insert({
      user_id: userId,
      title: input.title,
      event_type: input.event_type,
      event_date: input.event_date,
      location: input.location,
      notes: input.notes,
      calendar_event_id: input.calendar_event_id ?? null,
      outfit_id: input.outfit_id ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throwApiError(error, "Etkinlik kaydedilemedi.");
  }

  return data as EventRecord;
}

export async function updateEventPlan(userId: string, eventId: string, input: UpdateEventInput): Promise<EventRecord> {
  const { data, error } = await supabase
    .from("events")
    .update(input)
    .eq("user_id", userId)
    .eq("id", eventId)
    .select("*")
    .single();

  if (error) {
    throwApiError(error, "Etkinlik guncellenemedi.");
  }

  return data as EventRecord;
}

export async function deleteEventPlan(userId: string, eventId: string): Promise<void> {
  const { error } = await supabase.from("events").delete().eq("user_id", userId).eq("id", eventId);

  if (error) {
    throwApiError(error, "Etkinlik silinemedi.");
  }
}
