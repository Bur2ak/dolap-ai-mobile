import { router } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useNotifications } from "@/hooks/useNotifications";
import { useWardrobe } from "@/hooks/useWardrobe";
import { useWeather } from "@/hooks/useWeather";
import { scheduleOutfitReminder } from "@/lib/notifications";
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
  const smartPlan = buildSmartOutfitNotification(weather, items);

  async function handleEnablePush() {
    try {
      const token = await registerForPush();
      Alert.alert(token ? "Bildirimler hazir" : "Bildirim acilamadi", token ? "Push token kaydedildi." : "Cihaz veya izin uygun degil.");
    } catch (error) {
      Alert.alert("Bildirim acilamadi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  async function togglePreference(key: keyof NotificationPreferences) {
    try {
      await updatePreferences({ [key]: !preferences[key] });
    } catch (error) {
      Alert.alert("Guncellenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  async function handleScheduleSmartReminder() {
    try {
      const latestWeather = weather ?? (await refetch()).data ?? null;
      const plan = buildSmartOutfitNotification(latestWeather, items);
      const identifier = await scheduleOutfitReminder(plan);
      Alert.alert(identifier ? "Akilli hatirlatici kuruldu" : "Kurulamadi", identifier ? "Sabah bildirimi hava durumuna gore hazir." : "Bu cihazda lokal bildirim uygun degil.");
    } catch (error) {
      Alert.alert("Kurulamadi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} />
        <Text variant="h2">Bildirimler</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Card style={styles.intro}>
        <Text variant="h3">Push bildirimlerini ac</Text>
        <Text variant="body" color="secondary">
          Hatirlaticilar ve fiyat dususleri icin cihaz bildirimi izni gerekir.
        </Text>
        <Button title="Bildirimleri Etkinlestir" onPress={handleEnablePush} loading={isRegistering} />
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
        <Button title="Akilli Hatirlaticiyi Kur" variant="secondary" onPress={handleScheduleSmartReminder} loading={isWeatherLoading} />
      </Card>

      {rows.map((row) => {
        const enabled = preferences[row.key];
        return (
          <Pressable key={row.key} onPress={() => void togglePreference(row.key)} disabled={isUpdating}>
            <Card style={styles.row}>
              <View style={styles.rowCopy}>
                <Text variant="h3">{row.title}</Text>
                <Text variant="body" color="secondary">
                  {row.body}
                </Text>
              </View>
              <View style={[styles.toggle, enabled && styles.toggleActive]}>
                <View style={[styles.knob, enabled && styles.knobActive]} />
              </View>
            </Card>
          </Pressable>
        );
      })}
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
  rowCopy: {
    flex: 1,
    gap: SPACING.xs,
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
