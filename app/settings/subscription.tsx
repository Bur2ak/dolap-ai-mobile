import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useSubscription } from "@/hooks/useSubscription";
import { captureError, captureEvent } from "@/lib/observability";
import { getRevenueCatCustomerInfo, getRevenueCatReadiness, hasPremiumEntitlement } from "@/lib/revenuecat";
import { useAuthStore } from "@/stores/authStore";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { formatDate } from "@/utils/formatters";

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
  const fetchProfile = useAuthStore((state) => state.fetchProfile);
  const setRevenueCatPremium = useSubscriptionStore((state) => state.setRevenueCatPremium);
  const { premium, localPremiumOverride, limits, setLocalPremiumOverride } = useSubscription();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const planName = premium ? "Premium" : "Free";
  const profilePlanName = profile?.subscription_tier ?? "free";
  const expiryLabel = profile?.subscription_expires_at ? formatDate(profile.subscription_expires_at) : "Belirtilmemis";
  const revenueCatReadiness = getRevenueCatReadiness();

  useEffect(() => {
    captureEvent("subscription_settings_screen_viewed", {
      local_preview: localPremiumOverride,
      plan: planName,
      revenuecat_ready: revenueCatReadiness.configured,
    });
  }, [localPremiumOverride, planName, revenueCatReadiness.configured]);

  async function handleRefreshSubscription() {
    if (isRefreshing) {
      captureEvent("subscription_refresh_blocked", { reason: "busy" });
      return;
    }

    try {
      setIsRefreshing(true);
      if (!revenueCatReadiness.configured) {
        captureEvent("subscription_refresh_skipped", { reason: revenueCatReadiness.reason ?? "not_configured" });
        Alert.alert("RevenueCat hazir degil", revenueCatReadiness.reason ?? "Gercek abonelik kontrolu icin RevenueCat anahtari gerekiyor.");
        return;
      }

      const customerInfo = await getRevenueCatCustomerInfo();
      const revenueCatPremium = hasPremiumEntitlement(customerInfo);
      setRevenueCatPremium(revenueCatPremium);
      await fetchProfile();
      captureEvent("subscription_refreshed", { premium: revenueCatPremium });
      Alert.alert("Guncellendi", "Abonelik durumu yeniden kontrol edildi.");
    } catch (error) {
      captureError(error, { area: "subscription_refresh" });
      Alert.alert("Kontrol edilemedi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} disabled={isRefreshing} />
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
            : `Profil plani: ${profilePlanName}`}
        </Text>
        <Text variant="caption" color="muted">
          Bitis: {expiryLabel}
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

      <Card style={styles.section}>
        <Text variant="h3">RevenueCat Durumu</Text>
        <Text variant="body" color="secondary">
          {revenueCatReadiness.configured ? "Gercek satin alma baglantisi hazir." : revenueCatReadiness.reason ?? "RevenueCat henuz hazir degil."}
        </Text>
      </Card>

      <View style={styles.actions}>
        <Button
          title={premium ? "Paywall'i Ac" : "Premium'a Gec"}
          onPress={() => {
            captureEvent("subscription_paywall_opened", { current_plan: planName });
            router.push("/paywall");
          }}
          disabled={isRefreshing}
        />
        <Button title="Aboneligi Yenile" variant="secondary" onPress={() => void handleRefreshSubscription()} loading={isRefreshing} disabled={isRefreshing} />
        {localPremiumOverride ? (
          <Button
            title="Onizlemeyi Kapat"
            variant="secondary"
            onPress={() => {
              if (isRefreshing) {
                captureEvent("premium_preview_deactivate_blocked", { reason: "busy" });
                return;
              }

              setLocalPremiumOverride(false);
              captureEvent("premium_preview_deactivated");
            }}
            disabled={isRefreshing}
          />
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
