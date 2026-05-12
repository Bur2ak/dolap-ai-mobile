import * as Calendar from "expo-calendar";
import { Platform } from "react-native";

import type { EventPlanInput } from "@/types";

export async function createCalendarEvent(input: Omit<EventPlanInput, "weather" | "wardrobe">): Promise<string | null> {
  if (Platform.OS === "web") {
    return null;
  }

  const available = await Calendar.isAvailableAsync();
  if (!available) {
    return null;
  }

  const startDate = new Date(input.event_date);
  if (!Number.isFinite(startDate.getTime()) || startDate.getTime() < Date.now() - 60_000) {
    throw new Error("Gecerli ve gelecek bir etkinlik tarihi gerekli.");
  }

  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
  const result = await Calendar.createEventInCalendarAsync({
    title: input.title,
    startDate,
    endDate,
    location: input.location ?? undefined,
    notes: input.notes ?? "Shipirio etkinlik plani",
  });

  return result.id;
}
