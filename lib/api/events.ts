import { supabase } from "@/lib/supabase";
import type { EventPlanInput, OutfitSuggestion } from "@/types";

export async function recommendEventOutfits(input: EventPlanInput): Promise<OutfitSuggestion[]> {
  const { data, error } = await supabase.functions.invoke<OutfitSuggestion[]>("event-outfit", {
    body: input,
  });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function saveEventPlan(userId: string, input: Omit<EventPlanInput, "weather" | "wardrobe">): Promise<void> {
  const { error } = await supabase.from("events").insert({
    user_id: userId,
    title: input.title,
    event_type: input.event_type,
    event_date: input.event_date,
    location: input.location,
    notes: input.notes,
  });

  if (error) {
    throw error;
  }
}
