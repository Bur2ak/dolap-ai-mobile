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
  const normalizedInput = normalizeEventInput(input, true);
  const { data, error } = await supabase
    .from("events")
    .insert({
      user_id: userId,
      title: normalizedInput.title,
      event_type: normalizedInput.event_type,
      event_date: normalizedInput.event_date,
      location: normalizedInput.location,
      notes: normalizedInput.notes,
      calendar_event_id: normalizedInput.calendar_event_id ?? null,
      outfit_id: normalizedInput.outfit_id ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throwApiError(error, "Etkinlik kaydedilemedi.");
  }

  return data as EventRecord;
}

export async function updateEventPlan(userId: string, eventId: string, input: UpdateEventInput): Promise<EventRecord> {
  const normalizedInput = normalizeEventInput(input, false);
  const { data, error } = await supabase
    .from("events")
    .update(normalizedInput)
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

function normalizeEventInput<T extends UpdateEventInput>(input: T, requireRequiredFields: boolean): T {
  const normalized = { ...input };

  if (normalized.title !== undefined) {
    normalized.title = normalized.title.trim().replace(/\s+/g, " ").slice(0, 120);
    if (!normalized.title) {
      throw new Error("Etkinlik adi gerekli.");
    }
  } else if (requireRequiredFields) {
    throw new Error("Etkinlik adi gerekli.");
  }

  if (normalized.event_type !== undefined) {
    normalized.event_type = normalized.event_type.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!normalized.event_type) {
      throw new Error("Etkinlik tipi gerekli.");
    }
  } else if (requireRequiredFields) {
    throw new Error("Etkinlik tipi gerekli.");
  }

  if (normalized.event_date !== undefined) {
    const eventDate = new Date(normalized.event_date);
    if (!Number.isFinite(eventDate.getTime())) {
      throw new Error("Gecerli bir etkinlik tarihi gir.");
    }
    normalized.event_date = eventDate.toISOString();
  } else if (requireRequiredFields) {
    throw new Error("Etkinlik tarihi gerekli.");
  }

  if (normalized.location !== undefined) {
    normalized.location = normalized.location?.trim().replace(/\s+/g, " ").slice(0, 160) || null;
  }

  if (normalized.notes !== undefined) {
    normalized.notes = normalized.notes?.trim().slice(0, 500) || null;
  }

  return normalized;
}
