import { invokeFunctionWithRetry } from "@/lib/api/functions";
import { throwApiError } from "@/lib/api/errors";
import { isUuid } from "@/lib/routeParams";
import { supabase } from "@/lib/supabase";
import type { EventPlanInput, EventRecord, OutfitSuggestion, UpdateEventInput } from "@/types";

export async function recommendEventOutfits(input: EventPlanInput): Promise<OutfitSuggestion[]> {
  const normalizedInput = normalizeEventPlanInput(input);
  const data = await invokeFunctionWithRetry<OutfitSuggestion[]>("event-outfit", normalizedInput);
  return normalizeOutfitSuggestions(data, new Set(normalizedInput.wardrobe.map((item) => item.id)));
}

export async function fetchEventPlans(userId: string): Promise<EventRecord[]> {
  assertUserId(userId);
  const { data, error } = await supabase.from("events").select("*").eq("user_id", userId).order("event_date", { ascending: true });

  if (error) {
    throwApiError(error, "Etkinlikler yuklenemedi.");
  }

  return (data ?? []).map(normalizeEventRecord).filter((event): event is EventRecord => event !== null);
}

export async function saveEventPlan(
  userId: string,
  input: Omit<EventPlanInput, "weather" | "wardrobe"> & { calendar_event_id?: string | null; outfit_id?: string | null },
): Promise<EventRecord> {
  assertUserId(userId);
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

  const event = normalizeEventRecord(data);
  if (!event) {
    throw new Error("Etkinlik kaydi gecersiz dondu.");
  }

  return event;
}

export async function updateEventPlan(userId: string, eventId: string, input: UpdateEventInput): Promise<EventRecord> {
  assertUserId(userId);
  assertEventId(eventId);
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

  const event = normalizeEventRecord(data);
  if (!event) {
    throw new Error("Etkinlik kaydi gecersiz dondu.");
  }

  return event;
}

export async function deleteEventPlan(userId: string, eventId: string): Promise<void> {
  assertUserId(userId);
  assertEventId(eventId);
  const { error } = await supabase.from("events").delete().eq("user_id", userId).eq("id", eventId);

  if (error) {
    throwApiError(error, "Etkinlik silinemedi.");
  }
}

function normalizeEventRecord(value: unknown): EventRecord | null {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Partial<EventRecord>) : {};
  if (typeof record.id !== "string" || !isUuid(record.id) || typeof record.user_id !== "string" || !isUuid(record.user_id)) {
    return null;
  }

  return {
    id: record.id,
    user_id: record.user_id,
    outfit_id: typeof record.outfit_id === "string" && isUuid(record.outfit_id) ? record.outfit_id : null,
    title: normalizeText(record.title, "Etkinlik", 120),
    event_type: normalizeText(record.event_type, "diger", 40),
    event_date: normalizeDate(record.event_date),
    location: typeof record.location === "string" ? normalizeNullableText(record.location, 160) : null,
    notes: typeof record.notes === "string" ? normalizeNullableText(record.notes, 500) : null,
    calendar_event_id: typeof record.calendar_event_id === "string" ? normalizeNullableText(record.calendar_event_id, 160) : null,
    created_at: normalizeDate(record.created_at),
  };
}

function normalizeOutfitSuggestions(value: unknown, allowedItemIds: Set<string>): OutfitSuggestion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((suggestion) => normalizeOutfitSuggestion(suggestion, allowedItemIds))
    .filter((suggestion): suggestion is OutfitSuggestion => suggestion !== null)
    .slice(0, 5);
}

function normalizeOutfitSuggestion(value: unknown, allowedItemIds: Set<string>): OutfitSuggestion | null {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Partial<OutfitSuggestion>) : {};
  const items = Array.isArray(record.items)
    ? [...new Set(record.items.filter((itemId): itemId is string => typeof itemId === "string" && allowedItemIds.has(itemId)))].slice(0, 8)
    : [];

  if (items.length === 0) {
    return null;
  }

  return {
    items,
    name: normalizeText(record.name, "Etkinlik Kombini", 80),
    reason: normalizeText(record.reason, "Dolabindaki uyumlu parcalar secildi.", 500),
    accessory_note: typeof record.accessory_note === "string" ? normalizeNullableText(record.accessory_note, 240) : null,
    formality_match: typeof record.formality_match === "string" ? normalizeText(record.formality_match, "uygun", 80) : undefined,
  };
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
    if (eventDate.getTime() < Date.now() - 60_000) {
      throw new Error("Etkinlik tarihi gecmiste olamaz.");
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

function normalizeEventPlanInput(input: EventPlanInput): EventPlanInput {
  return {
    ...input,
    event_type: input.event_type.trim().replace(/\s+/g, " ").slice(0, 40) || "diger",
    location: input.location?.trim().replace(/\s+/g, " ").slice(0, 160) || null,
    notes: input.notes?.trim().slice(0, 500) || null,
    title: input.title.trim().replace(/\s+/g, " ").slice(0, 120) || "Etkinlik",
    wardrobe: input.wardrobe.filter((item) => item.is_active && isUuid(item.id)).slice(0, 100),
    weather: input.weather
      ? {
          ...input.weather,
          city: input.weather.city.trim().replace(/\s+/g, " ").slice(0, 80),
          description: input.weather.description.trim().replace(/\s+/g, " ").slice(0, 120),
          feels_like: Number.isFinite(input.weather.feels_like) ? Math.round(input.weather.feels_like * 10) / 10 : 0,
          humidity: Number.isFinite(input.weather.humidity) ? Math.max(0, Math.min(100, Math.round(input.weather.humidity))) : 0,
          temp: Number.isFinite(input.weather.temp) ? Math.round(input.weather.temp * 10) / 10 : 0,
        }
      : null,
  };
}

function normalizeText(value: unknown, fallback: string, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : fallback;
}

function normalizeNullableText(value: string, maxLength: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength) || null;
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string") {
    return new Date().toISOString();
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function assertUserId(value: string) {
  if (!isUuid(value)) {
    throw new Error("Oturum bilgisi gecersiz. Tekrar giris yapmayi dene.");
  }
}

function assertEventId(value: string) {
  if (!isUuid(value)) {
    throw new Error("Etkinlik kaydi gecersiz.");
  }
}
