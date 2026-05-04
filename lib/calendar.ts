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
