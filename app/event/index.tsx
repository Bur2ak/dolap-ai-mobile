import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { EVENT_TYPES } from "@/constants/events";
import { SPACING } from "@/constants/spacing";
import { useEventPlanner } from "@/hooks/useEventPlanner";
import { useWardrobe } from "@/hooks/useWardrobe";
import { useWeather } from "@/hooks/useWeather";
import type { EventPlanInput } from "@/types";

export default function EventPlannerScreen() {
  const { items } = useWardrobe();
  const { weather, isLoading: isWeatherLoading } = useWeather();
  const { recommend, suggestions, isRecommending, saveEvent, isSaving, canSave } = useEventPlanner();
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<string>(EVENT_TYPES[0].value);
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 16));
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const eventInput: EventPlanInput = {
    title: title.trim() || "Planlanan etkinlik",
    event_type: eventType,
    event_date: eventDate,
    location: location.trim() || null,
    notes: notes.trim() || null,
    weather,
    wardrobe: items,
  };

  async function handleRecommend() {
    if (items.length < 2) {
      Alert.alert("Dolap bos", "Etkinlik kombini icin once en az iki kiyafet eklemelisin.");
      return;
    }

    try {
      await recommend(eventInput);
    } catch (error) {
      Alert.alert("Kombin bulunamadi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  async function handleSave() {
    if (!canSave) {
      Alert.alert("Giris gerekli", "Etkinligi kaydetmek icin once giris yapmalisin.");
      return;
    }

    try {
      await saveEvent({
        title: eventInput.title,
        event_type: eventInput.event_type,
        event_date: eventInput.event_date,
        location: eventInput.location,
        notes: eventInput.notes,
      });
      Alert.alert("Kaydedildi", "Etkinlik planina eklendi.");
    } catch (error) {
      Alert.alert("Kaydedilemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} />
        <Text variant="h2">Suraya Gidiyorum</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Card style={styles.weather}>
        <Ionicons name="calendar-outline" size={28} color={COLORS.primary} />
        <View style={styles.weatherText}>
          <Text variant="h3">{weather ? `${weather.temp} C, ${weather.city}` : "Hava bilgisi yok"}</Text>
          <Text variant="body" color="secondary">
            {weather ? weather.description : isWeatherLoading ? "Hava bilgisi aliniyor." : "Konum izni veya OpenWeather anahtari gerekebilir."}
          </Text>
        </View>
      </Card>

      <Input label="Etkinlik adi" value={title} onChangeText={setTitle} placeholder="Orn. Cuma aksami yemek" />

      <Text variant="h3">Etkinlik tipi</Text>
      <View style={styles.wrap}>
        {EVENT_TYPES.map((event) => {
          const active = event.value === eventType;
          return (
            <Pressable key={event.value} style={[styles.chip, active && styles.activeChip]} onPress={() => setEventType(event.value)}>
              <Text variant="label" color={active ? "inverse" : "secondary"}>
                {event.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Input label="Tarih ve saat" value={eventDate} onChangeText={setEventDate} placeholder="2026-05-04T20:00" />
      <Input label="Lokasyon" value={location} onChangeText={setLocation} placeholder="Opsiyonel" />
      <Input label="Not" value={notes} onChangeText={setNotes} placeholder="Dress code, mekan, hava notu..." />

      <View style={styles.actions}>
        <Button title="Kombin Bul" onPress={handleRecommend} loading={isRecommending} />
        <Button title="Etkinligi Kaydet" variant="secondary" onPress={handleSave} loading={isSaving} />
      </View>

      {suggestions.length > 0 ? (
        <View style={styles.results}>
          <Text variant="h3">Oneriler</Text>
          {suggestions.map((suggestion) => (
            <Card key={suggestion.name} style={styles.suggestion}>
              <Text variant="h3">{suggestion.name}</Text>
              <Text variant="body" color="secondary">
                {suggestion.reason}
              </Text>
              {suggestion.formality_match ? (
                <Text variant="caption" color="muted">
                  {suggestion.formality_match}
                </Text>
              ) : null}
              <Text variant="caption" color="muted">
                {suggestion.items.length} parca
              </Text>
            </Card>
          ))}
        </View>
      ) : null}
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
    paddingTop: 56,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerSpacer: {
    width: 72,
  },
  weather: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
  },
  weatherText: {
    flex: 1,
  },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  chip: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  activeChip: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  actions: {
    gap: SPACING.sm,
  },
  results: {
    gap: SPACING.sm,
    paddingBottom: SPACING.xl,
  },
  suggestion: {
    gap: SPACING.xs,
  },
});
