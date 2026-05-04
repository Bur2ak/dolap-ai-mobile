import { supabase } from "@/lib/supabase";
import type { EventPlanInput, EventRecord, OutfitSuggestion } from "@/types";

export async function recommendEventOutfits(input: EventPlanInput): Promise<OutfitSuggestion[]> {
  const { data, error } = await supabase.functions.invoke<OutfitSuggestion[]>("event-outfit", {
    body: input,
  });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function fetchEventPlans(userId: string): Promise<EventRecord[]> {
  const { data, error } = await supabase.from("events").select("*").eq("user_id", userId).order("event_date", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as EventRecord[];
}

export async function saveEventPlan(
  userId: string,
  input: Omit<EventPlanInput, "weather" | "wardrobe"> & { calendar_event_id?: string | null },
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
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as EventRecord;
}
