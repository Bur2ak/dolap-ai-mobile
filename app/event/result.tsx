import { router, useLocalSearchParams } from "expo-router";
import { Alert, ScrollView, Share, StyleSheet, View } from "react-native";

import { OutfitCard } from "@/components/outfit/OutfitCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useEventPlanner } from "@/hooks/useEventPlanner";
import { useWardrobe } from "@/hooks/useWardrobe";
import { useEventWeather } from "@/hooks/useWeather";
import { createCalendarEvent } from "@/lib/calendar";
import { captureError, captureEvent } from "@/lib/observability";
import type { OutfitSuggestion } from "@/types";
import { useState } from "react";

export default function EventResultScreen() {
  const { title, eventType, eventDate, location, suggestionsJson } = useLocalSearchParams<{
    title?: string;
    eventType?: string;
    eventDate?: string;
    location?: string;
    suggestionsJson?: string;
  }>();
  const { items } = useWardrobe();
  const { saveSuggestionAsEvent, isSaving, canSave } = useEventPlanner();
  const { weather } = useEventWeather(eventDate ?? null);
  const [activePlanAction, setActivePlanAction] = useState<string | null>(null);
  const [isSharingPlan, setIsSharingPlan] = useState(false);
  const isBusy = isSaving || isSharingPlan || Boolean(activePlanAction);

  const suggestions: OutfitSuggestion[] = (() => {
    try { return suggestionsJson ? JSON.parse(suggestionsJson) : []; } catch { return []; }
  })();

  const eventInput = {
    title: title ?? "",
    event_type: eventType ?? "",
    event_date: eventDate ?? "",
    location: location ?? null,
    notes: null,
    weather: weather ?? null,
    wardrobe: items,
  };

  async function handlePlan(suggestion: OutfitSuggestion) {
    if (isBusy || !canSave) return;
    setActivePlanAction(suggestion.name);
    try {
      await saveSuggestionAsEvent({ input: eventInput, suggestion });
      captureEvent("event_suggestion_planned", { event_type: eventType ?? "", item_count: suggestion.items.length });
      Alert.alert("Planlandi", "Kombin kaydedildi ve etkinlige baglandi.");
    } catch (error) {
      captureError(error, { area: "event_result_plan" });
      Alert.alert("Planlanamadi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setActivePlanAction(null);
    }
  }

  async function handleAddToCalendar() {
    if (isBusy || !canSave) return;
    try {
      setActivePlanAction("calendar");
      const calendarEventId = await createCalendarEvent({
        title: title ?? "",
        event_type: eventType ?? "",
        event_date: eventDate ?? "",
        location: location ?? null,
        notes: null,
      });
      captureEvent("event_calendar_added", { calendar_available: Boolean(calendarEventId), event_type: eventType ?? "" });
      Alert.alert(calendarEventId ? "Takvime eklendi" : "Kaydedildi", calendarEventId ? "Cihaz takvimine eklendi." : "Shipirio planina kaydedildi.");
    } catch (error) {
      captureError(error, { area: "event_result_calendar" });
      Alert.alert("Takvime eklenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setActivePlanAction(null);
    }
  }

  async function handleShare(suggestion: OutfitSuggestion) {
    setIsSharingPlan(true);
    try {
      const suggestionItems = suggestion.items
        .map((id) => items.find((w) => w.id === id))
        .filter(Boolean)
        .map((i) => `- ${i!.subcategory ?? i!.category}${i!.brand ? ` (${i!.brand})` : ""}`)
        .join("\n");
      await Share.share({
        title: "Shipirio etkinlik kombini",
        message: `${title ?? "Etkinlik"} kombini:\n${suggestion.name}\n${suggestion.reason}\n\nParcalar:\n${suggestionItems}`,
      });
    } catch { } finally {
      setIsSharingPlan(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} disabled={isBusy} />
        <Text variant="h2">Etkinlik Kombini</Text>
        <View style={styles.spacer} />
      </View>

      <Card style={styles.eventInfo}>
        <Text variant="h3">{title}</Text>
        <Text variant="body" color="secondary">{eventType} · {eventDate?.slice(0, 10)}</Text>
        {location ? <Text variant="caption" color="muted">{location}</Text> : null}
        {weather ? <Text variant="caption" color="muted">{weather.temp}°C · {weather.description}</Text> : null}
      </Card>

      <Button title="Takvime Ekle" variant="secondary" onPress={() => void handleAddToCalendar()} loading={activePlanAction === "calendar"} disabled={isBusy} />

      {suggestions.length === 0 ? (
        <EmptyState icon="calendar-outline" title="Oneri yok" body="Kombin onerisi alinamadi." />
      ) : (
        suggestions.map((suggestion) => (
          <OutfitCard
            key={suggestion.name}
            suggestion={suggestion}
            items={items}
            actions={
              <View style={styles.actions}>
                <Button title="Planla ve Kaydet" variant="secondary" onPress={() => void handlePlan(suggestion)} loading={activePlanAction === suggestion.name} disabled={isBusy} />
                <Button title="Paylas" variant="ghost" onPress={() => void handleShare(suggestion)} loading={isSharingPlan} disabled={isBusy} />
              </View>
            }
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  content: {
    gap: SPACING.md,
    padding: SPACING.lg,
    paddingBottom: 100,
    paddingTop: 56,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  spacer: {
    width: 72,
  },
  eventInfo: {
    gap: SPACING.xs,
  },
  actions: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
});
