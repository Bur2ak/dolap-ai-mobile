import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { EVENT_TYPES } from "@/constants/events";
import { SPACING } from "@/constants/spacing";
import { useEventPlanner } from "@/hooks/useEventPlanner";
import { useSubscription } from "@/hooks/useSubscription";
import { useWardrobe } from "@/hooks/useWardrobe";
import { useWeather } from "@/hooks/useWeather";
import { createCalendarEvent } from "@/lib/calendar";
import type { EventPlanInput, EventRecord } from "@/types";

export default function EventPlannerScreen() {
  const { items } = useWardrobe();
  const { weather, isLoading: isWeatherLoading } = useWeather();
  const { events, isLoadingEvents, recommend, suggestions, isRecommending, saveEvent, updateEvent, deleteEvent, isSaving, canSave } = useEventPlanner();
  const { checkGate } = useSubscription();
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
    if (!checkGate("EVENT_PLANNING")) {
      router.push("/paywall");
      return;
    }

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
    if (!checkGate("EVENT_PLANNING")) {
      router.push("/paywall");
      return;
    }

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

  async function handleSaveToCalendar() {
    if (!checkGate("EVENT_PLANNING")) {
      router.push("/paywall");
      return;
    }

    if (!canSave) {
      Alert.alert("Giris gerekli", "Etkinligi takvime eklemek icin once giris yapmalisin.");
      return;
    }

    try {
      const calendarEventId = await createCalendarEvent({
        title: eventInput.title,
        event_type: eventInput.event_type,
        event_date: eventInput.event_date,
        location: eventInput.location,
        notes: eventInput.notes,
      });
      await saveEvent({
        title: eventInput.title,
        event_type: eventInput.event_type,
        event_date: eventInput.event_date,
        location: eventInput.location,
        notes: eventInput.notes,
        calendar_event_id: calendarEventId,
      });
      Alert.alert(calendarEventId ? "Takvime eklendi" : "Etkinlik kaydedildi", calendarEventId ? "Cihaz takvimine ve Shipirio planina eklendi." : "Cihaz takvimi uygun degil; Shipirio planina kaydedildi.");
    } catch (error) {
      Alert.alert("Takvime eklenemedi", error instanceof Error ? error.message : "Tekrar dene.");
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
        <Button title="Takvime Ekle" variant="secondary" onPress={handleSaveToCalendar} loading={isSaving} />
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

      <View style={styles.results}>
        <Text variant="h3">Kayitli etkinlikler</Text>
        {isLoadingEvents ? (
          <Card style={styles.suggestion}>
            <Text variant="body" color="secondary">
              Etkinlikler yukleniyor.
            </Text>
          </Card>
        ) : events.length > 0 ? (
          events.map((event) => (
            <EventPlanCard
              key={event.id}
              event={event}
              onUpdate={updateEvent}
              onDelete={deleteEvent}
              isSaving={isSaving}
            />
          ))
        ) : (
          <Card style={styles.suggestion}>
            <Text variant="body" color="secondary">
              Henuz kayitli etkinlik yok.
            </Text>
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

function EventPlanCard({
  event,
  onUpdate,
  onDelete,
  isSaving,
}: {
  event: EventRecord;
  onUpdate: ReturnType<typeof useEventPlanner>["updateEvent"];
  onDelete: ReturnType<typeof useEventPlanner>["deleteEvent"];
  isSaving: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [eventType, setEventType] = useState(event.event_type);
  const [eventDate, setEventDate] = useState(event.event_date.slice(0, 16));
  const [location, setLocation] = useState(event.location ?? "");
  const [notes, setNotes] = useState(event.notes ?? "");

  useEffect(() => {
    setTitle(event.title);
    setEventType(event.event_type);
    setEventDate(event.event_date.slice(0, 16));
    setLocation(event.location ?? "");
    setNotes(event.notes ?? "");
  }, [event]);

  async function handleSave() {
    if (!title.trim()) {
      Alert.alert("Etkinlik adi gerekli", "Plan icin etkinlik adi bos olamaz.");
      return;
    }

    try {
      await onUpdate({
        eventId: event.id,
        input: {
          event_date: eventDate,
          event_type: eventType,
          location: location.trim() || null,
          notes: notes.trim() || null,
          title: title.trim(),
        },
      });
      setIsEditing(false);
    } catch (error) {
      Alert.alert("Guncellenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  function handleDelete() {
    Alert.alert("Etkinligi sil", "Bu plan kayitli etkinliklerinden kaldirilacak.", [
      { text: "Vazgec", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          try {
            await onDelete(event.id);
          } catch (error) {
            Alert.alert("Silinemedi", error instanceof Error ? error.message : "Tekrar dene.");
          }
        },
      },
    ]);
  }

  return (
    <Card style={styles.suggestion}>
      <View style={styles.eventHeader}>
        <View style={styles.eventCopy}>
          <Text variant="h3">{event.title}</Text>
          <Text variant="body" color="secondary">
            {event.event_type} - {formatEventDate(event.event_date)}
          </Text>
        </View>
        <View style={styles.eventActions}>
          <Pressable style={styles.iconButton} onPress={() => setIsEditing((value) => !value)} disabled={isSaving}>
            <Ionicons name={isEditing ? "close-outline" : "create-outline"} size={20} color={COLORS.primary} />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={handleDelete} disabled={isSaving}>
            <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
          </Pressable>
        </View>
      </View>

      {isEditing ? (
        <View style={styles.editForm}>
          <Input label="Etkinlik adi" value={title} onChangeText={setTitle} />
          <Text variant="label">Etkinlik tipi</Text>
          <View style={styles.wrap}>
            {EVENT_TYPES.map((option) => {
              const active = option.value === eventType;
              return (
                <Pressable key={option.value} style={[styles.chip, active && styles.activeChip]} onPress={() => setEventType(option.value)}>
                  <Text variant="label" color={active ? "inverse" : "secondary"}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Input label="Tarih ve saat" value={eventDate} onChangeText={setEventDate} />
          <Input label="Lokasyon" value={location} onChangeText={setLocation} />
          <Input label="Not" value={notes} onChangeText={setNotes} />
          <Button title="Degisiklikleri Kaydet" onPress={handleSave} loading={isSaving} />
        </View>
      ) : (
        <>
          {event.location ? (
            <Text variant="caption" color="muted">
              {event.location}
            </Text>
          ) : null}
          {event.notes ? (
            <Text variant="body" color="secondary">
              {event.notes}
            </Text>
          ) : null}
          <Text variant="caption" color="muted">
            {event.calendar_event_id ? "Takvime eklendi" : "Sadece Shipirio plani"}
          </Text>
        </>
      )}
    </Card>
  );
}

function formatEventDate(value: string) {
  return new Date(value).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
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
  eventHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
    justifyContent: "space-between",
  },
  eventCopy: {
    flex: 1,
  },
  eventActions: {
    flexDirection: "row",
    gap: SPACING.xs,
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  editForm: {
    gap: SPACING.sm,
  },
});
