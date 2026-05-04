import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuthStore } from "@/stores/authStore";

const limitLabels = {
  MAX_WARDROBE_ITEMS: "Dolap kapasitesi",
  DAILY_OUTFIT_SUGGESTIONS: "Gunluk kombin onerisi",
  BUY_DECISIONS_PER_MONTH: "Aylik karar motoru",
  PRICE_TRACKING_ITEMS: "Fiyat takip urunu",
  FRIENDS: "Sosyal arkadas",
  ANALYTICS_FULL: "Gelismis analiz",
  EVENT_PLANNING: "Etkinlik planlama",
} as const;

export default function SubscriptionSettingsScreen() {
  const profile = useAuthStore((state) => state.profile);
  const { premium, localPremiumOverride, limits, setLocalPremiumOverride } = useSubscription();
  const planName = premium ? "Premium" : "Free";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} />
        <Text variant="h2">Abonelik</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Card style={styles.hero}>
        <Text variant="caption" color="muted">
          Aktif plan
        </Text>
        <Text variant="display">{planName}</Text>
        <Text variant="body" color="secondary">
          {localPremiumOverride
            ? "Yerel premium onizleme modu acik."
            : `Supabase profil plani: ${profile?.subscription_tier ?? "free"}`}
        </Text>
        <Text variant="caption" color="muted">
          Bitis: {profile?.subscription_expires_at ?? "Belirtilmemis"}
        </Text>
      </Card>

      <Card style={styles.section}>
        <Text variant="h3">Limitler</Text>
        {Object.entries(limits).map(([key, value]) => (
          <View key={key} style={styles.limitRow}>
            <Text variant="body">{limitLabels[key as keyof typeof limitLabels]}</Text>
            <Text variant="label" color="primary">
              {formatLimit(value)}
            </Text>
          </View>
        ))}
      </Card>

      <View style={styles.actions}>
        <Button title={premium ? "Paywall'i Ac" : "Premium'a Gec"} onPress={() => router.push("/paywall")} />
        {localPremiumOverride ? (
          <Button title="Onizlemeyi Kapat" variant="secondary" onPress={() => setLocalPremiumOverride(false)} />
        ) : null}
      </View>
    </ScrollView>
  );
}

function formatLimit(value: number | boolean) {
  if (typeof value === "boolean") {
    return value ? "Acik" : "Kapali";
  }

  if (!Number.isFinite(value)) {
    return "Sinirsiz";
  }

  return String(value);
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  content: {
    gap: SPACING.md,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
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
  hero: {
    gap: SPACING.sm,
  },
  section: {
    gap: SPACING.md,
  },
  limitRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actions: {
    gap: SPACING.sm,
  },
});
