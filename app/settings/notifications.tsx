import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useNotifications } from "@/hooks/useNotifications";
import { useWardrobe } from "@/hooks/useWardrobe";
import { useWeather } from "@/hooks/useWeather";
import { cancelOutfitReminders, getPushNotificationReadiness, scheduleOutfitReminder, type PushNotificationReadiness } from "@/lib/notifications";
import { captureError, captureEvent } from "@/lib/observability";
import type { NotificationPreferences } from "@/types";
import { buildSmartOutfitNotification } from "@/utils/smartNotifications";

const rows: Array<{ key: keyof NotificationPreferences; title: string; body: string }> = [
  {
    key: "outfit_reminder",
    title: "Sabah kombin hatirlaticisi",
    body: "Her sabah 08:00'de kombin onerisi icin nazik bir hatirlatici.",
  },
  {
    key: "price_drops",
    title: "Fiyat dususleri",
    body: "Takip ettigin urun hedef fiyata inince haber ver.",
  },
  {
    key: "friend_requests",
    title: "Arkadas istekleri",
    body: "Sosyal modul aktif oldugunda arkadas isteklerini bildir.",
  },
  {
    key: "outfit_votes",
    title: "Kombin oylari",
    body: "Arkadaslarin kombinlerine oy verdiginde bildir.",
  },
  {
    key: "lend_requests",
    title: "Odunc istekleri",
    body: "Paylastigin parcalar icin gelen odunc isteklerini ve durumlarini bildir.",
  },
];

export default function NotificationSettingsScreen() {
  const { preferences, registerForPush, isRegistering, updatePreferences, isUpdating } = useNotifications();
  const { items } = useWardrobe();
  const { weather, isLoading: isWeatherLoading, refetch } = useWeather();
  const [isSchedulingReminder, setIsSchedulingReminder] = useState(false);
  const [pushReadiness, setPushReadiness] = useState<PushNotificationReadiness | null>(null);
  const [isCheckingPush, setIsCheckingPush] = useState(false);
  const [updatingPreference, setUpdatingPreference] = useState<keyof NotificationPreferences | null>(null);
  const smartPlan = buildSmartOutfitNotification(weather, items);
  const isBusy = isRegistering || isUpdating || isSchedulingReminder || isCheckingPush || Boolean(updatingPreference);

  useEffect(() => {
    void refreshPushReadiness();
  }, []);

  useEffect(() => {
    captureEvent("notification_settings_screen_viewed", {
      outfit_reminder: preferences.outfit_reminder,
      price_drops: preferences.price_drops,
      friend_requests: preferences.friend_requests,
      outfit_votes: preferences.outfit_votes,
      lend_requests: preferences.lend_requests,
    });
  }, [preferences.friend_requests, preferences.lend_requests, preferences.outfit_reminder, preferences.outfit_votes, preferences.price_drops]);

  async function refreshPushReadiness() {
    if (isCheckingPush) {
      return;
    }

    try {
      setIsCheckingPush(true);
      const readiness = await getPushNotificationReadiness();
      setPushReadiness(readiness);
      captureEvent("notification_push_readiness_checked", {
        device_ready: readiness.deviceReady,
        eas_project_ready: readiness.easProjectReady,
        granted: readiness.granted,
      });
    } catch (error) {
      captureError(error, { area: "push_readiness" });
    } finally {
      setIsCheckingPush(false);
    }
  }

  async function handleEnablePush() {
    if (isBusy) {
      captureEvent("push_enable_blocked", { reason: "busy" });
      return;
    }

    try {
      const token = await registerForPush();
      await refreshPushReadiness();
      captureEvent("push_enable_requested", { success: Boolean(token) });
      Alert.alert(token ? "Bildirimler hazir" : "Bildirim acilamadi", token ? "Push token kaydedildi." : "Cihaz veya izin uygun degil.");
    } catch (error) {
      captureError(error, { area: "push_enable_request" });
      Alert.alert("Bildirim acilamadi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  async function togglePreference(key: keyof NotificationPreferences) {
    if (isBusy) {
      captureEvent("notification_preference_toggle_blocked", { preference: key, reason: "busy" });
      return;
    }

    setUpdatingPreference(key);
    try {
      const enabled = !preferences[key];
      await updatePreferences({ [key]: enabled });
      captureEvent("notification_preference_toggled", { enabled, preference: key });
    } catch (error) {
      captureError(error, { area: "notification_preference_toggle", preference: key });
      Alert.alert("Guncellenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setUpdatingPreference(null);
    }
  }

  async function handleScheduleSmartReminder() {
    if (isBusy) {
      captureEvent("smart_outfit_reminder_schedule_blocked", { reason: "busy" });
      return;
    }

    try {
      setIsSchedulingReminder(true);
      const latestWeather = weather ?? (await refetch()).data ?? null;
      const plan = buildSmartOutfitNotification(latestWeather, items);
      const identifier = await scheduleOutfitReminder(plan);
      if (identifier && !preferences.outfit_reminder) {
        await updatePreferences({ outfit_reminder: true });
      }
      captureEvent("smart_outfit_reminder_scheduled", { success: Boolean(identifier), weather_available: Boolean(latestWeather) });
      Alert.alert(identifier ? "Akilli hatirlatici kuruldu" : "Kurulamadi", identifier ? "Sabah bildirimi hava durumuna gore hazir." : "Bu cihazda lokal bildirim uygun degil.");
    } catch (error) {
      captureError(error, { area: "smart_outfit_reminder_schedule" });
      Alert.alert("Kurulamadi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setIsSchedulingReminder(false);
    }
  }

  async function handleCancelSmartReminder() {
    if (isBusy) {
      captureEvent("smart_outfit_reminder_cancel_blocked", { reason: "busy" });
      return;
    }

    try {
      setIsSchedulingReminder(true);
      await cancelOutfitReminders();
      await updatePreferences({ outfit_reminder: false });
      captureEvent("smart_outfit_reminder_cancelled");
      Alert.alert("Hatirlatici kapatildi", "Sabah kombin hatirlaticisi iptal edildi.");
    } catch (error) {
      captureError(error, { area: "smart_outfit_reminder_cancel" });
      Alert.alert("Kapatilamadi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setIsSchedulingReminder(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} disabled={isBusy} />
        <Text variant="h2">Bildirimler</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Card style={styles.intro}>
        <Text variant="h3">Push bildirimlerini ac</Text>
        <Text variant="body" color="secondary">
          Hatirlaticilar ve fiyat dususleri icin cihaz bildirimi izni gerekir.
        </Text>
        <Button title="Bildirimleri Etkinlestir" onPress={handleEnablePush} loading={isRegistering} disabled={isBusy} />
      </Card>

      <Card style={styles.intro}>
        <Text variant="caption" color="muted">
          PUSH DURUMU
        </Text>
        <Text variant="h3">{pushReadiness?.granted ? "Izin verilmis" : pushReadiness?.available ? "Izin alinabilir" : "Hazir degil"}</Text>
        <Text variant="body" color="secondary">
          {pushReadiness?.reason ?? "Cihaz ve bildirim durumu kontrol ediliyor."}
        </Text>
        {pushReadiness ? (
          <View style={styles.statusGrid}>
            <StatusPill label="Cihaz" ok={pushReadiness.deviceReady} />
            <StatusPill label="EAS" ok={pushReadiness.easProjectReady} />
            <StatusPill label="Izin" ok={pushReadiness.granted} />
          </View>
        ) : null}
        <Button title="Durumu Yenile" variant="secondary" onPress={() => void refreshPushReadiness()} loading={isCheckingPush} disabled={isBusy} />
      </Card>

      <Card style={styles.intro}>
        <Text variant="caption" color="muted">
          AKILLI HAVA BILDIRIMI
        </Text>
        <Text variant="h3">{smartPlan.title}</Text>
        <Text variant="body" color="secondary">
          {isWeatherLoading ? "Hava durumu kontrol ediliyor." : smartPlan.body}
        </Text>
        <Text variant="caption" color="muted">
          {smartPlan.reason}
        </Text>
        <Button
          title="Akilli Hatirlaticiyi Kur"
          variant="secondary"
          onPress={handleScheduleSmartReminder}
          loading={isWeatherLoading || isSchedulingReminder}
          disabled={isBusy}
        />
        {preferences.outfit_reminder ? (
          <Button title="Hatirlaticiyi Kapat" variant="ghost" onPress={handleCancelSmartReminder} loading={isSchedulingReminder} disabled={isBusy} />
        ) : null}
      </Card>

      {rows.map((row) => {
        const enabled = preferences[row.key];
        return (
          <Pressable key={row.key} onPress={() => void togglePreference(row.key)} disabled={isBusy}>
            <Card style={[styles.row, isBusy && styles.rowDisabled]}>
              <View style={styles.rowCopy}>
                <Text variant="h3">{row.title}</Text>
                <Text variant="body" color="secondary">
                  {row.body}
                </Text>
              </View>
              <View style={[styles.toggle, enabled && styles.toggleActive, updatingPreference === row.key && styles.toggleUpdating]}>
                <View style={[styles.knob, enabled && styles.knobActive]} />
              </View>
            </Card>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function StatusPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <View style={[styles.statusPill, ok ? styles.statusPillOk : styles.statusPillWarn]}>
      <Text variant="caption" color={ok ? "inverse" : "secondary"}>
        {label}: {ok ? "OK" : "Eksik"}
      </Text>
    </View>
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
    paddingBottom: SPACING.xl,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerSpacer: {
    width: 72,
  },
  intro: {
    gap: SPACING.md,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
  },
  rowDisabled: {
    opacity: 0.72,
  },
  rowCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  statusPillOk: {
    backgroundColor: COLORS.success,
  },
  statusPillWarn: {
    backgroundColor: COLORS.surfaceMuted,
  },
  toggle: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 999,
    height: 30,
    justifyContent: "center",
    paddingHorizontal: 3,
    width: 54,
  },
  toggleActive: {
    backgroundColor: COLORS.primary,
  },
  toggleUpdating: {
    borderColor: COLORS.warning,
    borderWidth: 1,
  },
  knob: {
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    height: 24,
    width: 24,
  },
  knobActive: {
    transform: [{ translateX: 24 }],
  },
});
