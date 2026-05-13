import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { FREE_LIMITS, PREMIUM_LIMITS, type LimitKey } from "@/constants/limits";
import { SPACING } from "@/constants/spacing";
import { useBuyDecision } from "@/hooks/useBuyDecision";
import { usePriceTracking } from "@/hooks/usePriceTracking";
import { useSubscription } from "@/hooks/useSubscription";
import { useWardrobe } from "@/hooks/useWardrobe";
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

const trackedLimitRows: Array<{ key: LimitKey; helper: string; usage?: "wardrobe" | "priceTracking" | "monthlyBuyDecisions" }> = [
  {
    helper: "Dolabina eklenen aktif kiyafetler.",
    key: "MAX_WARDROBE_ITEMS",
    usage: "wardrobe",
  },
  {
    helper: "Kayitli fiyat takipleri ve indirim sinyalleri.",
    key: "PRICE_TRACKING_ITEMS",
    usage: "priceTracking",
  },
  {
    helper: "Bu ay kaydedilen Almali Miyim sonuclari.",
    key: "BUY_DECISIONS_PER_MONTH",
    usage: "monthlyBuyDecisions",
  },
  {
    helper: "Gunluk kombin uretimi kullanim aninda sayilir.",
    key: "DAILY_OUTFIT_SUGGESTIONS",
  },
  {
    helper: "Dolap dagilimi, kullanim ve alisveris analizleri.",
    key: "ANALYTICS_FULL",
  },
  {
    helper: "Etkinlik bazli planlama ve hazirlik akislari.",
    key: "EVENT_PLANNING",
  },
];

export default function SubscriptionSettingsScreen() {
  const profile = useAuthStore((state) => state.profile);
  const fetchProfile = useAuthStore((state) => state.fetchProfile);
  const setRevenueCatPremium = useSubscriptionStore((state) => state.setRevenueCatPremium);
  const { premium, localPremiumOverride, limits, setLocalPremiumOverride } = useSubscription();
  const { items } = useWardrobe();
  const { trackings } = usePriceTracking();
  const { history } = useBuyDecision();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const planName = premium ? "Premium" : "Free";
  const profilePlanName = profile?.subscription_tier ?? "free";
  const expiryLabel = profile?.subscription_expires_at ? formatDate(profile.subscription_expires_at) : "Belirtilmemis";
  const revenueCatReadiness = getRevenueCatReadiness();
  const monthlyBuyDecisionCount = history.filter((decision) => isCurrentMonth(decision.created_at)).length;
  const usageByKey = {
    monthlyBuyDecisions: monthlyBuyDecisionCount,
    priceTracking: trackings.length,
    wardrobe: items.length,
  } satisfies Record<NonNullable<(typeof trackedLimitRows)[number]["usage"]>, number>;

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

  function handleOpenPaywall() {
    if (isRefreshing) {
      captureEvent("subscription_paywall_open_blocked", { reason: "busy" });
      return;
    }

    captureEvent("subscription_paywall_opened", { current_plan: planName });
    router.push("/paywall");
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
        {trackedLimitRows.map((row) => {
          const value = limits[row.key];
          const usage = row.usage ? usageByKey[row.usage] : undefined;
          const progress = getUsageProgress(usage, value);

          return (
            <View key={row.key} style={styles.limitCard}>
              <View style={styles.limitHeader}>
                <Text variant="body">{limitLabels[row.key]}</Text>
                <Text variant="label" color="primary">
                  {formatLimit(value)}
                </Text>
              </View>
              <Text variant="caption" color="muted">
                {row.helper}
              </Text>
              {typeof usage === "number" ? (
                <View style={styles.usageBlock}>
                  <View style={styles.usageTrack}>
                    <View style={[styles.usageFill, { width: `${progress}%` }]} />
                  </View>
                  <Text variant="caption" color="secondary">
                    {formatUsage(usage, value)}
                  </Text>
                </View>
              ) : null}
              <Text variant="caption" color="muted">
                Free: {formatLimit(FREE_LIMITS[row.key])} - Premium: {formatLimit(PREMIUM_LIMITS[row.key])}
              </Text>
            </View>
          );
        })}
        <View style={styles.limitCard}>
          <View style={styles.limitHeader}>
            <Text variant="body">{limitLabels.FRIENDS}</Text>
            <Text variant="label" color="primary">
              {formatLimit(limits.FRIENDS)}
            </Text>
          </View>
          <Text variant="caption" color="muted">
            Sosyal ozellikler arkadas ekleme ve paylasimli dolap akislariyla buyur.
          </Text>
          <Text variant="caption" color="muted">
            Free: {formatLimit(FREE_LIMITS.FRIENDS)} - Premium: {formatLimit(PREMIUM_LIMITS.FRIENDS)}
          </Text>
        </View>
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
          onPress={handleOpenPaywall}
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

function formatUsage(usage: number, limit: number | boolean) {
  if (typeof limit === "boolean") {
    return `${usage} kullanim`;
  }

  if (!Number.isFinite(limit)) {
    return `${usage} kullanim - Sinirsiz`;
  }

  return `${usage} / ${limit} kullanildi`;
}

function getUsageProgress(usage: number | undefined, limit: number | boolean) {
  if (typeof usage !== "number" || typeof limit !== "number" || !Number.isFinite(limit) || limit <= 0) {
    return usage && usage > 0 ? 100 : 0;
  }

  return Math.min(100, Math.round((usage / limit) * 100));
}

function isCurrentMonth(dateValue: string) {
  const date = new Date(dateValue);
  const now = new Date();

  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
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
  limitCard: {
    borderColor: COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: SPACING.xs,
    padding: SPACING.md,
  },
  limitHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
    justifyContent: "space-between",
  },
  usageBlock: {
    gap: SPACING.xs,
  },
  usageTrack: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 999,
    height: 8,
    overflow: "hidden",
  },
  usageFill: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: "100%",
  },
  actions: {
    gap: SPACING.sm,
  },
});
