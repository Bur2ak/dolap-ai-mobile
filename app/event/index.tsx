import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CachedImage } from "@/components/ui/CachedImage";
import { EmptyState } from "@/components/ui/EmptyState";
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
import { cancelEventReminder, scheduleEventReminder } from "@/lib/notifications";
import { captureError, captureEvent } from "@/lib/observability";
import type { EventPlanInput, EventRecord, OutfitSuggestion, StyleCalendarDay, WardrobeItem } from "@/types";
import { formatDateTimeLocal } from "@/utils/formatters";
import { buildStyleCalendar } from "@/utils/styleCalendar";

const eventDateFormatMessage = "Tarih ve saat YYYY-AA-GGTHH:mm formatinda olmali. Ornek: 2026-05-08T20:00";

export default function EventPlannerScreen() {
  const { items } = useWardrobe();
  const { weather, isLoading: isWeatherLoading } = useWeather();
  const {
    events,
    eventsError,
    isLoadingEvents,
    isRefetchingEvents,
    refetchEvents,
    recommend,
    suggestions,
    isRecommending,
    saveEvent,
    saveSuggestionAsEvent,
    updateEvent,
    deleteEvent,
    isSaving,
    canSave,
  } = useEventPlanner();
  const { checkGate } = useSubscription();
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<string>(EVENT_TYPES[0].value);
  const [eventDate, setEventDate] = useState(getDefaultEventDate());
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const styleCalendar = buildStyleCalendar(events, items);
  const isBusy = isRecommending || isSaving;

  const eventInput: EventPlanInput = {
    title: title.trim(),
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

    if (!validateEventForm(title, eventDate)) {
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

    if (!validateEventForm(title, eventDate)) {
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

    if (!validateEventForm(title, eventDate)) {
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
      captureEvent("event_calendar_added", { calendar_available: Boolean(calendarEventId), event_type: eventInput.event_type });
      Alert.alert(calendarEventId ? "Takvime eklendi" : "Etkinlik kaydedildi", calendarEventId ? "Cihaz takvimine ve Shipirio planina eklendi." : "Cihaz takvimi uygun degil; Shipirio planina kaydedildi.");
    } catch (error) {
      captureError(error, { area: "event_calendar_add", event_type: eventInput.event_type });
      Alert.alert("Takvime eklenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  async function handlePlanSuggestion(suggestion: OutfitSuggestion) {
    if (!checkGate("EVENT_PLANNING")) {
      router.push("/paywall");
      return;
    }

    if (!canSave) {
      Alert.alert("Giris gerekli", "Kombini planlamak icin once giris yapmalisin.");
      return;
    }

    if (!validateEventForm(title, eventDate)) {
      return;
    }

    try {
      await saveSuggestionAsEvent({ input: eventInput, suggestion });
      Alert.alert("Planlandi", "Kombin kaydedildi ve etkinlik planina baglandi.");
    } catch (error) {
      Alert.alert("Planlanamadi", error instanceof Error ? error.message : "Tekrar dene.");
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

      <StyleCalendarCard
        days={styleCalendar}
        onPlanDay={(day) => {
          setEventType(day.suggested_event_type);
          setEventDate(`${day.date}T09:00`);
          setTitle(day.status === "planned" ? day.title : "");
          setNotes(day.status === "planned" ? day.body : `Stil takvimi: ${day.title}. ${day.body}`);
        }}
      />

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

      <Input label="Tarih ve saat" value={eventDate} onChangeText={setEventDate} placeholder="2026-05-08T20:00" error={eventDate && !isValidEventDate(eventDate) ? eventDateFormatMessage : undefined} />
      <Input label="Lokasyon" value={location} onChangeText={setLocation} placeholder="Opsiyonel" />
      <Input label="Not" value={notes} onChangeText={setNotes} placeholder="Dress code, mekan, hava notu..." />

      <View style={styles.actions}>
        <Button title="Kombin Bul" onPress={handleRecommend} loading={isRecommending} disabled={isBusy} />
        <Button title="Etkinligi Kaydet" variant="secondary" onPress={handleSave} loading={isSaving} disabled={isBusy} />
        <Button title="Takvime Ekle" variant="secondary" onPress={handleSaveToCalendar} loading={isSaving} disabled={isBusy} />
      </View>

      {suggestions.length > 0 ? (
        <View style={styles.results}>
          <Text variant="h3">Oneriler</Text>
          {suggestions.map((suggestion) => {
            const suggestionItems = suggestion.items
              .map((itemId) => items.find((wardrobeItem) => wardrobeItem.id === itemId))
              .filter((item): item is WardrobeItem => Boolean(item));

            return (
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
                {suggestion.accessory_note ? (
                  <Text variant="caption" color="muted">
                    {suggestion.accessory_note}
                  </Text>
                ) : null}
                <Text variant="caption" color="muted">
                  {suggestion.items.length} parca
                </Text>
                {suggestionItems.length > 0 ? (
                  <View style={styles.suggestionItems}>
                    {suggestionItems.map((item) => (
                      <View key={item.id} style={styles.suggestionItem}>
                        <CachedImage
                          accessibilityLabel={item.subcategory ?? item.category}
                          fallbackColor={item.dominant_color_hex}
                          sourceUri={item.thumbnail_url ?? item.image_url}
                          style={styles.suggestionImage}
                        />
                        <Text variant="caption" color="secondary" style={styles.suggestionItemLabel}>
                          {item.subcategory ?? item.category}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                <Button title="Planla ve Kaydet" variant="secondary" onPress={() => void handlePlanSuggestion(suggestion)} loading={isSaving} disabled={isBusy} />
              </Card>
            );
          })}
        </View>
      ) : null}

      <View style={styles.results}>
        <Text variant="h3">Kayitli etkinlikler</Text>
        {isLoadingEvents ? (
          <EmptyState icon="sync-outline" title="Etkinlikler yukleniyor" body="Kayitli etkinlik planlarin hazirlaniyor." />
        ) : eventsError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Etkinlikler yuklenemedi"
            body="Baglanti veya Supabase tarafinda gecici bir sorun olabilir."
            actionLabel="Tekrar Dene"
            loading={isRefetchingEvents}
            onAction={() => void refetchEvents()}
          />
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
          <EmptyState icon="calendar-outline" title="Etkinlik yok" body="Henuz kayitli etkinlik yok." />
        )}
      </View>
    </ScrollView>
  );
}

function StyleCalendarCard({ days, onPlanDay }: { days: StyleCalendarDay[]; onPlanDay: (day: StyleCalendarDay) => void }) {
  return (
    <Card style={styles.calendarCard}>
      <View style={styles.calendarHeader}>
        <View>
          <Text variant="caption" color="muted">
            STIL TAKVIMI
          </Text>
          <Text variant="h3">Onumuzdeki 7 gun</Text>
        </View>
        <Ionicons name="calendar-number-outline" size={24} color={COLORS.primary} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.calendarStrip}>
        {days.map((day) => (
          <Pressable key={day.date} style={[styles.dayCard, day.status === "planned" && styles.dayCardPlanned]} onPress={() => onPlanDay(day)}>
            <Text variant="caption" color={day.status === "planned" ? "inverse" : "muted"}>
              {day.day_label}
            </Text>
            <Text variant="label" color={day.status === "planned" ? "inverse" : "primary"} style={styles.dayTitle}>
              {day.title}
            </Text>
            <Text variant="caption" color={day.status === "planned" ? "inverse" : "secondary"} style={styles.dayBody}>
              {day.body}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text variant="caption" color="muted">
        Bir gune dokununca form o gunun stil niyetiyle dolar.
      </Text>
    </Card>
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

    if (!isValidEventDate(eventDate)) {
      Alert.alert("Tarih gecersiz", eventDateFormatMessage);
      return;
    }

    if (isPastEventDate(eventDate)) {
      Alert.alert("Tarih gecersiz", "Etkinlik tarihi gecmiste olamaz.");
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

  async function handleAddToCalendar() {
    try {
      const calendarEventId = await createCalendarEvent({
        title: event.title,
        event_type: event.event_type,
        event_date: event.event_date,
        location: event.location,
        notes: event.notes,
      });

      if (!calendarEventId) {
        Alert.alert("Takvim uygun degil", "Bu cihazda takvim ekleme kullanilamiyor.");
        return;
      }

      await onUpdate({
        eventId: event.id,
        input: {
          calendar_event_id: calendarEventId,
        },
      });
      captureEvent("event_calendar_added", { calendar_available: true, event_type: event.event_type });
      Alert.alert("Takvime eklendi", "Etkinlik cihaz takvimine baglandi.");
    } catch (error) {
      captureError(error, { area: "event_calendar_add_existing", event_id: event.id });
      Alert.alert("Takvime eklenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  async function handleScheduleReminder() {
    try {
      const identifier = await scheduleEventReminder(event);
      captureEvent("event_reminder_scheduled", { event_id: event.id, success: Boolean(identifier) });
      Alert.alert(
        identifier ? "Hatirlatici kuruldu" : "Hatirlatici kurulamadi",
        identifier ? "Etkinlikten 2 saat once bildirim gelecek." : "Etkinlik zamani cok yakin veya cihaz bildirimi uygun degil.",
      );
    } catch (error) {
      captureError(error, { area: "event_reminder_schedule", event_id: event.id });
      Alert.alert("Hatirlatici kurulamadi", error instanceof Error ? error.message : "Tekrar dene.");
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
            await cancelEventReminder(event.id);
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
          <Input label="Tarih ve saat" value={eventDate} onChangeText={setEventDate} error={eventDate && !isValidEventDate(eventDate) ? eventDateFormatMessage : undefined} />
          <Input label="Lokasyon" value={location} onChangeText={setLocation} />
          <Input label="Not" value={notes} onChangeText={setNotes} />
          <Button title="Degisiklikleri Kaydet" onPress={handleSave} loading={isSaving} disabled={isSaving} />
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
            {event.outfit_id ? "Kombin bagli" : event.calendar_event_id ? "Takvime eklendi" : "Sadece Shipirio plani"}
          </Text>
          {!event.calendar_event_id ? (
            <Button title="Takvime Ekle" variant="secondary" onPress={() => void handleAddToCalendar()} loading={isSaving} disabled={isSaving} />
          ) : null}
          {new Date(event.event_date).getTime() > Date.now() ? (
            <Button title="Hatirlatici Kur" variant="ghost" onPress={() => void handleScheduleReminder()} loading={isSaving} disabled={isSaving} />
          ) : null}
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

function getDefaultEventDate() {
  const date = new Date();
  date.setHours(date.getHours() + 2, 0, 0, 0);
  return formatDateTimeLocal(date);
}

function isValidEventDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return false;
  }

  return !Number.isNaN(new Date(value).getTime());
}

function isPastEventDate(value: string) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

function validateEventForm(title: string, eventDate: string) {
  if (!title.trim()) {
    Alert.alert("Etkinlik adi gerekli", "Plan icin etkinlik adi bos olamaz.");
    return false;
  }

  if (!isValidEventDate(eventDate)) {
    Alert.alert("Tarih gecersiz", eventDateFormatMessage);
    return false;
  }

  if (isPastEventDate(eventDate)) {
    Alert.alert("Tarih gecersiz", "Etkinlik tarihi gecmiste olamaz.");
    return false;
  }

  return true;
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
  calendarCard: {
    gap: SPACING.sm,
  },
  calendarHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  calendarStrip: {
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  dayCard: {
    backgroundColor: COLORS.surfaceMuted,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: SPACING.xs,
    minHeight: 148,
    padding: SPACING.sm,
    width: 140,
  },
  dayCardPlanned: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dayTitle: {
    minHeight: 36,
  },
  dayBody: {
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
  suggestionItems: {
    flexDirection: "row",
    gap: SPACING.sm,
    paddingTop: SPACING.xs,
  },
  suggestionItem: {
    flex: 1,
    gap: SPACING.xs,
    minWidth: 0,
  },
  suggestionImage: {
    aspectRatio: 4 / 5,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    width: "100%",
  },
  suggestionColorBlock: {
    aspectRatio: 4 / 5,
    borderRadius: 8,
    width: "100%",
  },
  suggestionItemLabel: {
    textAlign: "center",
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
