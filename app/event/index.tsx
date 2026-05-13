import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
import type { TravelPackingPlan } from "@/utils/packingList";
import { buildTravelPackingPlan } from "@/utils/packingList";
import { buildStyleCalendar } from "@/utils/styleCalendar";

const eventDateFormatMessage = "Tarih ve saat YYYY-AA-GGTHH:mm formatinda ve gelecek bir zaman olmali.";

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
  const packingPlan = useMemo(() => buildTravelPackingPlan(eventInput), [eventDate, eventType, items, location, notes, title, weather]);
  const hasPackingPlan = Boolean(packingPlan);

  useEffect(() => {
    captureEvent("event_planner_screen_viewed", {
      event_count: events.length,
      packing_plan_available: hasPackingPlan,
      suggestion_count: suggestions.length,
      wardrobe_count: items.length,
      weather_available: Boolean(weather),
    });
  }, [events.length, hasPackingPlan, items.length, suggestions.length, weather]);

  async function handleRecommend() {
    if (isBusy) {
      captureEvent("event_recommend_blocked", { reason: "busy" });
      return;
    }

    if (!checkGate("EVENT_PLANNING")) {
      captureEvent("event_recommend_blocked", { reason: "gate" });
      router.push("/paywall");
      return;
    }

    if (items.length < 2) {
      captureEvent("event_recommend_blocked", { reason: "not_enough_items", wardrobe_count: items.length });
      Alert.alert("Dolap bos", "Etkinlik kombini icin once en az iki kiyafet eklemelisin.");
      return;
    }

    const validationError = getEventFormValidationError(title, eventDate);
    if (validationError) {
      captureEvent("event_recommend_blocked", { reason: validationError.reason });
      Alert.alert(validationError.title, validationError.message);
      return;
    }

    try {
      await recommend(eventInput);
    } catch (error) {
      captureError(error, { area: "event_recommend_action", event_type: eventInput.event_type, wardrobe_count: items.length });
      Alert.alert("Kombin bulunamadi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  async function handleSave() {
    if (isBusy) {
      captureEvent("event_save_blocked", { reason: "busy" });
      return;
    }

    if (!checkGate("EVENT_PLANNING")) {
      captureEvent("event_save_blocked", { reason: "gate" });
      router.push("/paywall");
      return;
    }

    if (!canSave) {
      captureEvent("event_save_blocked", { reason: "auth" });
      Alert.alert("Giris gerekli", "Etkinligi kaydetmek icin once giris yapmalisin.");
      return;
    }

    const validationError = getEventFormValidationError(title, eventDate);
    if (validationError) {
      captureEvent("event_save_blocked", { reason: validationError.reason });
      Alert.alert(validationError.title, validationError.message);
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
      clearEventDraft(setTitle, setLocation, setNotes);
      Alert.alert("Kaydedildi", "Etkinlik planina eklendi.");
    } catch (error) {
      captureError(error, { area: "event_save_action", event_type: eventInput.event_type });
      Alert.alert("Kaydedilemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  async function handleSaveToCalendar() {
    if (isBusy) {
      captureEvent("event_calendar_save_blocked", { reason: "busy" });
      return;
    }

    if (!checkGate("EVENT_PLANNING")) {
      captureEvent("event_calendar_save_blocked", { reason: "gate" });
      router.push("/paywall");
      return;
    }

    if (!canSave) {
      captureEvent("event_calendar_save_blocked", { reason: "auth" });
      Alert.alert("Giris gerekli", "Etkinligi takvime eklemek icin once giris yapmalisin.");
      return;
    }

    const validationError = getEventFormValidationError(title, eventDate);
    if (validationError) {
      captureEvent("event_calendar_save_blocked", { reason: validationError.reason });
      Alert.alert(validationError.title, validationError.message);
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
      clearEventDraft(setTitle, setLocation, setNotes);
      Alert.alert(calendarEventId ? "Takvime eklendi" : "Etkinlik kaydedildi", calendarEventId ? "Cihaz takvimine ve Shipirio planina eklendi." : "Cihaz takvimi uygun degil; Shipirio planina kaydedildi.");
    } catch (error) {
      captureError(error, { area: "event_calendar_add", event_type: eventInput.event_type });
      Alert.alert("Takvime eklenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  async function handlePlanSuggestion(suggestion: OutfitSuggestion) {
    if (isBusy) {
      captureEvent("event_suggestion_plan_blocked", { reason: "busy", item_count: suggestion.items.length });
      return;
    }

    if (!checkGate("EVENT_PLANNING")) {
      captureEvent("event_suggestion_plan_blocked", { reason: "gate", item_count: suggestion.items.length });
      router.push("/paywall");
      return;
    }

    if (!canSave) {
      captureEvent("event_suggestion_plan_blocked", { reason: "auth", item_count: suggestion.items.length });
      Alert.alert("Giris gerekli", "Kombini planlamak icin once giris yapmalisin.");
      return;
    }

    const validationError = getEventFormValidationError(title, eventDate);
    if (validationError) {
      captureEvent("event_suggestion_plan_blocked", { reason: validationError.reason, item_count: suggestion.items.length });
      Alert.alert(validationError.title, validationError.message);
      return;
    }

    try {
      await saveSuggestionAsEvent({ input: eventInput, suggestion });
      captureEvent("event_suggestion_planned", { event_type: eventInput.event_type, item_count: suggestion.items.length });
      clearEventDraft(setTitle, setLocation, setNotes);
      Alert.alert("Planlandi", "Kombin kaydedildi ve etkinlik planina baglandi.");
    } catch (error) {
      captureError(error, { area: "event_suggestion_plan_action", event_type: eventInput.event_type, item_count: suggestion.items.length });
      Alert.alert("Planlanamadi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} disabled={isBusy} />
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
          if (isBusy) {
            captureEvent("style_calendar_day_blocked", { date: day.date, reason: "busy", status: day.status });
            return;
          }

          setEventType(day.suggested_event_type);
          setEventDate(`${day.date}T09:00`);
          setTitle(day.status === "planned" ? day.title : "");
          setNotes(day.status === "planned" ? day.body : `Stil takvimi: ${day.title}. ${day.body}`);
          captureEvent("style_calendar_day_selected", { date: day.date, status: day.status });
        }}
        disabled={isBusy}
      />

      {packingPlan ? (
        <TravelPackingCard
          plan={packingPlan}
          disabled={isBusy}
          onUsePlan={() => {
            const missingItems = packingPlan.items.filter((item) => item.status === "missing").map((item) => item.label);
            const planNote = `Valiz plani: ${packingPlan.items.map((item) => item.label).join(", ")}.`;
            setNotes((current) => {
              const currentNote = current.trim();
              return currentNote ? `${currentNote}\n${planNote}` : planNote;
            });
            captureEvent("event_travel_packing_plan_used", {
              missing_count: missingItems.length,
              ready_count: packingPlan.items.length - missingItems.length,
            });
          }}
        />
      ) : null}

      <Input label="Etkinlik adi" value={title} onChangeText={setTitle} placeholder="Orn. Cuma aksami yemek" editable={!isBusy} />

      <Text variant="h3">Etkinlik tipi</Text>
      <View style={styles.wrap}>
        {EVENT_TYPES.map((event) => {
          const active = event.value === eventType;
          return (
            <Pressable
              key={event.value}
              style={[styles.chip, active && styles.activeChip]}
              onPress={() => {
                if (isBusy) {
                  captureEvent("event_type_blocked", { event_type: event.value, reason: "busy" });
                  return;
                }

                setEventType(event.value);
                captureEvent("event_type_selected", { event_type: event.value });
              }}
              disabled={isBusy}
            >
              <Text variant="label" color={active ? "inverse" : "secondary"}>
                {event.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Input label="Tarih ve saat" value={eventDate} onChangeText={setEventDate} placeholder={getExampleEventDate()} error={getEventDateInputError(eventDate)} editable={!isBusy} />
      <Input label="Lokasyon" value={location} onChangeText={setLocation} placeholder="Opsiyonel" editable={!isBusy} />
      <Input label="Not" value={notes} onChangeText={setNotes} placeholder="Dress code, mekan, hava notu..." editable={!isBusy} />

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
            onAction={() => {
              captureEvent("event_plans_refetch_requested");
              void refetchEvents();
            }}
          />
        ) : events.length > 0 ? (
          events.map((event) => (
            <EventPlanCard
              key={event.id}
              event={event}
              onUpdate={updateEvent}
              onDelete={deleteEvent}
              isSaving={isSaving}
              disabled={isBusy}
            />
          ))
        ) : (
          <EmptyState icon="calendar-outline" title="Etkinlik yok" body="Henuz kayitli etkinlik yok." />
        )}
      </View>
    </ScrollView>
  );
}

function StyleCalendarCard({ days, onPlanDay, disabled }: { days: StyleCalendarDay[]; onPlanDay: (day: StyleCalendarDay) => void; disabled: boolean }) {
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
          <Pressable key={day.date} style={[styles.dayCard, day.status === "planned" && styles.dayCardPlanned, disabled && styles.disabledAction]} onPress={() => onPlanDay(day)} disabled={disabled}>
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

function TravelPackingCard({ plan, onUsePlan, disabled }: { plan: TravelPackingPlan; onUsePlan: () => void; disabled: boolean }) {
  return (
    <Card style={styles.packingCard}>
      <View style={styles.calendarHeader}>
        <View style={styles.eventCopy}>
          <Text variant="caption" color="muted">
            VALIZ PLANI
          </Text>
          <Text variant="h3">{plan.title}</Text>
          <Text variant="body" color="secondary">
            {plan.summary}
          </Text>
        </View>
        <Ionicons name="bag-handle-outline" size={24} color={COLORS.primary} />
      </View>

      <View style={styles.packingList}>
        {plan.items.map((item) => (
          <View key={item.label} style={styles.packingItem}>
            <Ionicons name={item.status === "ready" ? "checkmark-circle-outline" : "alert-circle-outline"} size={20} color={item.status === "ready" ? COLORS.success : COLORS.warning} />
            <View style={styles.eventCopy}>
              <Text variant="label">{item.label}</Text>
              <Text variant="caption" color="muted">
                {item.reason}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Button title="Nota Ekle" variant="secondary" onPress={onUsePlan} disabled={disabled} />
    </Card>
  );
}

function EventPlanCard({
  event,
  onUpdate,
  onDelete,
  isSaving,
  disabled,
}: {
  event: EventRecord;
  onUpdate: ReturnType<typeof useEventPlanner>["updateEvent"];
  onDelete: ReturnType<typeof useEventPlanner>["deleteEvent"];
  isSaving: boolean;
  disabled: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [eventType, setEventType] = useState(event.event_type);
  const [eventDate, setEventDate] = useState(event.event_date.slice(0, 16));
  const [location, setLocation] = useState(event.location ?? "");
  const [notes, setNotes] = useState(event.notes ?? "");
  const [activeAction, setActiveAction] = useState<"save" | "calendar" | "reminder" | "delete" | null>(null);
  const isCardBusy = disabled || isSaving || Boolean(activeAction);

  useEffect(() => {
    setTitle(event.title);
    setEventType(event.event_type);
    setEventDate(event.event_date.slice(0, 16));
    setLocation(event.location ?? "");
    setNotes(event.notes ?? "");
  }, [event]);

  async function handleSave() {
    if (isCardBusy) {
      captureEvent("event_plan_edit_blocked", { event_id: event.id, reason: "busy" });
      return;
    }

    const validationError = getEventFormValidationError(title, eventDate);
    if (validationError) {
      captureEvent("event_plan_edit_blocked", { event_id: event.id, reason: validationError.reason });
      Alert.alert(validationError.title, validationError.message);
      return;
    }

    setActiveAction("save");
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
      captureEvent("event_plan_edit_saved", { event_id: event.id, event_type: eventType });
    } catch (error) {
      captureError(error, { area: "event_plan_edit_save_action", event_id: event.id });
      Alert.alert("Guncellenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setActiveAction(null);
    }
  }

  async function handleAddToCalendar() {
    if (isCardBusy) {
      captureEvent("event_calendar_existing_blocked", { event_id: event.id, reason: "busy" });
      return;
    }

    setActiveAction("calendar");
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
    } finally {
      setActiveAction(null);
    }
  }

  async function handleScheduleReminder() {
    if (isCardBusy) {
      captureEvent("event_reminder_blocked", { event_id: event.id, reason: "busy" });
      return;
    }

    setActiveAction("reminder");
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
    } finally {
      setActiveAction(null);
    }
  }

  function handleDelete() {
    if (isCardBusy) {
      captureEvent("event_plan_delete_blocked", { event_id: event.id, reason: "busy" });
      return;
    }

    captureEvent("event_plan_delete_prompt_opened", { event_id: event.id });
    Alert.alert("Etkinligi sil", "Bu plan kayitli etkinliklerinden kaldirilacak.", [
      { text: "Vazgec", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          setActiveAction("delete");
          try {
            await cancelEventReminder(event.id);
            await onDelete(event.id);
            captureEvent("event_plan_deleted_from_card", { event_id: event.id });
          } catch (error) {
            captureError(error, { area: "event_plan_delete_action", event_id: event.id });
            Alert.alert("Silinemedi", error instanceof Error ? error.message : "Tekrar dene.");
          } finally {
            setActiveAction(null);
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
          <Pressable
            style={styles.iconButton}
            onPress={() => {
              if (isCardBusy) {
                captureEvent("event_plan_edit_toggle_blocked", { event_id: event.id, reason: "busy" });
                return;
              }

              const nextValue = !isEditing;
              captureEvent("event_plan_edit_toggled", { event_id: event.id, is_editing: nextValue });
              setIsEditing(nextValue);
            }}
            disabled={isCardBusy}
          >
            <Ionicons name={isEditing ? "close-outline" : "create-outline"} size={20} color={COLORS.primary} />
          </Pressable>
          <Pressable style={[styles.iconButton, activeAction === "delete" ? styles.iconButtonBusy : null]} onPress={handleDelete} disabled={isCardBusy}>
            <Ionicons name={activeAction === "delete" ? "hourglass-outline" : "trash-outline"} size={20} color={COLORS.danger} />
          </Pressable>
        </View>
      </View>

      {isEditing ? (
        <View style={styles.editForm}>
          <Input label="Etkinlik adi" value={title} onChangeText={setTitle} editable={!isCardBusy} />
          <Text variant="label">Etkinlik tipi</Text>
          <View style={styles.wrap}>
            {EVENT_TYPES.map((option) => {
              const active = option.value === eventType;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.chip, active && styles.activeChip, isCardBusy && styles.disabledAction]}
                  onPress={() => {
                    if (isCardBusy) {
                      captureEvent("event_plan_type_blocked", { event_id: event.id, event_type: option.value, reason: "busy" });
                      return;
                    }

                    setEventType(option.value);
                  }}
                  disabled={isCardBusy}
                >
                  <Text variant="label" color={active ? "inverse" : "secondary"}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Input label="Tarih ve saat" value={eventDate} onChangeText={setEventDate} error={getEventDateInputError(eventDate)} editable={!isCardBusy} />
          <Input label="Lokasyon" value={location} onChangeText={setLocation} editable={!isCardBusy} />
          <Input label="Not" value={notes} onChangeText={setNotes} editable={!isCardBusy} />
          <Button title="Degisiklikleri Kaydet" onPress={handleSave} loading={activeAction === "save"} disabled={isCardBusy} />
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
            <Button title="Takvime Ekle" variant="secondary" onPress={() => void handleAddToCalendar()} loading={activeAction === "calendar"} disabled={isCardBusy} />
          ) : null}
          {new Date(event.event_date).getTime() > Date.now() ? (
            <Button title="Hatirlatici Kur" variant="ghost" onPress={() => void handleScheduleReminder()} loading={activeAction === "reminder"} disabled={isCardBusy} />
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

function getExampleEventDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(20, 0, 0, 0);
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

function getEventDateInputError(value: string) {
  if (!value) {
    return undefined;
  }

  if (!isValidEventDate(value)) {
    return eventDateFormatMessage;
  }

  if (isPastEventDate(value)) {
    return "Etkinlik tarihi gecmiste olamaz.";
  }

  return undefined;
}

function getEventFormValidationError(title: string, eventDate: string) {
  if (!title.trim()) {
    return { message: "Plan icin etkinlik adi bos olamaz.", reason: "missing_title", title: "Etkinlik adi gerekli" };
  }

  if (!isValidEventDate(eventDate)) {
    return { message: eventDateFormatMessage, reason: "invalid_date", title: "Tarih gecersiz" };
  }

  if (isPastEventDate(eventDate)) {
    return { message: "Etkinlik tarihi gecmiste olamaz.", reason: "past_date", title: "Tarih gecersiz" };
  }

  return null;
}

function clearEventDraft(
  setTitle: (value: string) => void,
  setLocation: (value: string) => void,
  setNotes: (value: string) => void,
) {
  setTitle("");
  setLocation("");
  setNotes("");
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
  packingCard: {
    gap: SPACING.sm,
  },
  packingList: {
    gap: SPACING.xs,
  },
  packingItem: {
    alignItems: "flex-start",
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    flexDirection: "row",
    gap: SPACING.sm,
    padding: SPACING.sm,
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
  disabledAction: {
    opacity: 0.52,
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
  iconButtonBusy: {
    opacity: 0.6,
  },
  editForm: {
    gap: SPACING.sm,
  },
});
