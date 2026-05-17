import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { FREE_LIMITS, PREMIUM_LIMITS, type LimitKey } from "@/constants/limits";
import { SPACING } from "@/constants/spacing";
import { useSubscription } from "@/hooks/useSubscription";
import {
  getRevenueCatPackages,
  getRevenueCatReadiness,
  hasPremiumEntitlement,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
} from "@/lib/revenuecat";
import { captureError, captureEvent } from "@/lib/observability";
import { useAuthStore } from "@/stores/authStore";
import { useSubscriptionStore } from "@/stores/subscriptionStore";

const features = [
  "Sinirsiz kiyafet",
  "Sinirsiz kombin onerisi",
  "Almali Miyim karar motoru",
  "Etkinlik planlayici",
  "Gelismis gardrop analizi",
  "Fiyat takibi ve bildirimler",
];

const trustNotes = [
  "Abonelik App Store veya Google Play hesabindan yonetilir.",
  "Geri yukleme ayni hesapla satin alinmis Premium erisimini kontrol eder.",
  "Uygulama ici satin alma hazir degilse deneme modu yalnizca gelistirmede gorunur.",
];

const comparisonRows: Array<{ key: LimitKey; label: string }> = [
  { key: "MAX_WARDROBE_ITEMS", label: "Dolap kapasitesi" },
  { key: "DAILY_OUTFIT_SUGGESTIONS", label: "Gunluk kombin" },
  { key: "BUY_DECISIONS_PER_MONTH", label: "Almali Miyim" },
  { key: "PRICE_TRACKING_ITEMS", label: "Fiyat takibi" },
  { key: "ANALYTICS_FULL", label: "Gelismis analiz" },
  { key: "EVENT_PLANNING", label: "Etkinlik planlama" },
];

export default function PaywallScreen() {
  const { setLocalPremiumOverride } = useSubscription();
  const fetchProfile = useAuthStore((state) => state.fetchProfile);
  const setRevenueCatPremium = useSubscriptionStore((state) => state.setRevenueCatPremium);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [packageLoadReason, setPackageLoadReason] = useState<string | null>(null);
  const [isLoadingPackages, setIsLoadingPackages] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [activePackageId, setActivePackageId] = useState<string | null>(null);
  const isBusy = isPurchasing || isRestoring || isLoadingPackages;
  const planCards = packages.length > 0 ? packages.map(getPackagePlanCard) : fallbackPlanCards;

  const loadPackages = useCallback(async () => {
    try {
      setIsLoadingPackages(true);
      const readiness = getRevenueCatReadiness();
      if (!readiness.configured) {
        setPackageLoadReason(readiness.reason ?? "RevenueCat hazir degil.");
        setPackages([]);
        captureEvent("paywall_packages_unavailable", { reason: readiness.reason ?? "not_configured" });
        return;
      }

      const nextPackages = await getRevenueCatPackages();
      setPackages(nextPackages);
      setPackageLoadReason(nextPackages.length > 0 ? null : "RevenueCat teklifleri bos dondu.");
      captureEvent("paywall_packages_loaded", { package_count: nextPackages.length });
    } catch (error) {
      setPackages([]);
      setPackageLoadReason(error instanceof Error ? error.message : "RevenueCat teklifleri yuklenemedi.");
      captureError(error, { area: "paywall_packages" });
    } finally {
      setIsLoadingPackages(false);
    }
  }, []);

  useEffect(() => {
    void loadPackages();
  }, [loadPackages]);

  useEffect(() => {
    captureEvent("paywall_screen_viewed", {
      package_count: packages.length,
      packages_loading: isLoadingPackages,
      fallback_plans: packages.length === 0,
    });
  }, [isLoadingPackages, packages.length]);

  function activatePreview() {
    if (isBusy) {
      return;
    }

    captureEvent("premium_preview_activated");
    setLocalPremiumOverride(true);
    router.back();
  }

  function handlePurchasePrompt(revenueCatPackage: PurchasesPackage) {
    if (isBusy) {
      return;
    }

    captureEvent("purchase_prompt_opened", {
      package_id: revenueCatPackage.identifier,
      price: revenueCatPackage.product.priceString,
    });
    Alert.alert("Premium satin al", `${revenueCatPackage.product.title} planini ${revenueCatPackage.product.priceString} ile baslatmak istiyor musun?`, [
      { text: "Vazgec", style: "cancel" },
      {
        text: "Devam Et",
        onPress: () => {
          void handlePurchase(revenueCatPackage);
        },
      },
    ]);
  }

  async function handlePurchase(revenueCatPackage: PurchasesPackage) {
    if (isBusy) {
      return;
    }

    setActivePackageId(revenueCatPackage.identifier);
    try {
      setIsPurchasing(true);
      captureEvent("purchase_started", { package_id: revenueCatPackage.identifier });
      const customerInfo = await purchaseRevenueCatPackage(revenueCatPackage);
      const premium = hasPremiumEntitlement(customerInfo);
      setRevenueCatPremium(premium);
      await fetchProfile();
      captureEvent("purchase_completed", {
        package_id: revenueCatPackage.identifier,
        premium,
      });
      Alert.alert(premium ? "Premium aktif" : "Satin alma tamamlandi", premium ? "Shipirio Premium hesabinda aktif." : "RevenueCat satin almayi tamamladi.");
      router.back();
    } catch (error) {
      captureError(error, {
        area: "revenuecat_purchase",
        package_id: revenueCatPackage.identifier,
      });
      Alert.alert("Satin alma tamamlanamadi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setIsPurchasing(false);
      setActivePackageId(null);
    }
  }

  async function handleRestore() {
    if (isBusy) {
      return;
    }

    try {
      setIsRestoring(true);
      captureEvent("purchase_restore_started");
      const customerInfo = await restoreRevenueCatPurchases();
      const premium = hasPremiumEntitlement(customerInfo);
      setRevenueCatPremium(premium);
      await fetchProfile();
      captureEvent("purchase_restore_completed", { premium });
      Alert.alert(premium ? "Abonelik bulundu" : "Abonelik bulunamadi", premium ? "Premium erisimin geri yuklendi." : "Bu hesapta aktif Premium gorunmuyor.");
      if (premium) {
        router.back();
      }
    } catch (error) {
      captureError(error, { area: "revenuecat_restore" });
      Alert.alert("Geri yuklenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setIsRestoring(false);
    }
  }

  function handleRetryPackages() {
    if (isBusy) {
      return;
    }

    captureEvent("paywall_packages_retry_pressed");
    void loadPackages();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} disabled={isBusy} />
        <Text variant="h2">Shipirio Premium</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Card style={styles.hero}>
        <Text variant="display">Premium</Text>
        <Text variant="body" color="secondary">
          Dolabini sinirsiz yonet, daha cok karar al, etkinlik ve analiz ozelliklerini ac.
        </Text>
        <View style={styles.heroSignals}>
          <SignalPill label="RevenueCat" active={packages.length > 0} />
          <SignalPill label="Restore" active />
          <SignalPill label="Iptal kontrolu magazada" active />
        </View>
      </Card>

      <Card style={styles.section}>
        {features.map((feature) => (
          <View key={feature} style={styles.featureRow}>
            <View style={styles.dot} />
            <Text variant="body">{feature}</Text>
          </View>
        ))}
      </Card>

      <Card style={styles.section}>
        <Text variant="h3">Free ve Premium</Text>
        {comparisonRows.map((row) => (
          <View key={row.key} style={styles.comparisonRow}>
            <Text variant="body" style={styles.comparisonLabel}>
              {row.label}
            </Text>
            <View style={styles.comparisonValues}>
              <View style={styles.comparisonColumn}>
                <Text variant="caption" color="muted">
                  Free
                </Text>
                <Text variant="label">{formatLimit(FREE_LIMITS[row.key])}</Text>
              </View>
              <View style={styles.comparisonColumn}>
                <Text variant="caption" color="muted">
                  Premium
                </Text>
                <Text variant="label" color="primary">
                  {formatLimit(PREMIUM_LIMITS[row.key])}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </Card>

      <View style={styles.plans}>
        {planCards.slice(0, 2).map((plan, index) => (
          <Card key={plan.key} style={[styles.plan, index === 1 && styles.featuredPlan]}>
            <Text variant="caption" color="muted">
              {plan.label}
            </Text>
            <Text variant="h1">{plan.price}</Text>
            <Text variant="body" color="secondary">
              {plan.body}
            </Text>
            {index === 1 ? (
              <Text variant="caption" color="primary">
                En avantajli
              </Text>
            ) : null}
          </Card>
        ))}
      </View>

      <Card style={styles.section}>
        <Text variant="h3">Plan sec</Text>
        {isLoadingPackages ? (
          <Text variant="body" color="secondary">
            RevenueCat teklifleri yukleniyor.
          </Text>
        ) : packages.length > 0 ? (
          packages.map((revenueCatPackage) => (
            <Button
              key={revenueCatPackage.identifier}
              title={`${revenueCatPackage.product.title} - ${revenueCatPackage.product.priceString}`}
              onPress={() => handlePurchasePrompt(revenueCatPackage)}
              loading={activePackageId === revenueCatPackage.identifier}
              disabled={isBusy}
            />
          ))
        ) : (
          <>
            <Text variant="body" color="secondary">
              {packageLoadReason ?? "RevenueCat teklifleri henuz hazir degil. App Store / Google Play urunleri baglandiginda burada gercek planlar gorunecek."}
            </Text>
            <Button
              title="Tekrar Dene"
              variant="secondary"
              onPress={handleRetryPackages}
              loading={isLoadingPackages}
              disabled={isBusy}
            />
            {__DEV__ ? <Button title="Gelistirme Icin Premium Ac" variant="secondary" onPress={activatePreview} disabled={isBusy} /> : null}
          </>
        )}
      </Card>

      <Button title="Aboneligi Geri Yukle" variant="secondary" onPress={() => void handleRestore()} loading={isRestoring} disabled={isBusy} />
      <Card style={styles.section}>
        <Text variant="h3">Satin alma notlari</Text>
        {trustNotes.map((note) => (
          <View key={note} style={styles.trustRow}>
            <View style={styles.dot} />
            <Text variant="caption" color="secondary" style={styles.trustText}>
              {note}
            </Text>
          </View>
        ))}
      </Card>
      <View style={styles.legalLinks}>
        <Button
          title="Gizlilik Politikasi"
          variant="ghost"
          onPress={() => {
            if (isBusy) {
              return;
            }

            captureEvent("paywall_legal_link_opened", { target: "privacy" });
            router.push("/legal/privacy");
          }}
          disabled={isBusy}
        />
        <Button
          title="Kullanim Sartlari"
          variant="ghost"
          onPress={() => {
            if (isBusy) {
              return;
            }

            captureEvent("paywall_legal_link_opened", { target: "terms" });
            router.push("/legal/terms");
          }}
          disabled={isBusy}
        />
      </View>
    </ScrollView>
  );
}

const fallbackPlanCards = [
  {
    body: "Esnek baslangic.",
    key: "fallback-monthly",
    label: "Aylik",
    price: "79 TL",
  },
  {
    body: "En avantajli plan.",
    key: "fallback-yearly",
    label: "Yillik",
    price: "599 TL",
  },
];

function getPackagePlanCard(revenueCatPackage: PurchasesPackage) {
  const packageType = String(revenueCatPackage.packageType ?? "").toLowerCase();
  const title = getPackageTitle(revenueCatPackage);

  return {
    body: packageType.includes("annual") ? "En avantajli plan." : packageType.includes("monthly") ? "Esnek baslangic." : title,
    key: revenueCatPackage.identifier,
    label: getPackageLabel(revenueCatPackage),
    price: getPackagePrice(revenueCatPackage),
  };
}

function getPackageLabel(revenueCatPackage: PurchasesPackage) {
  const packageType = String(revenueCatPackage.packageType ?? "").toLowerCase();
  if (packageType.includes("annual")) {
    return "Yillik";
  }

  if (packageType.includes("monthly")) {
    return "Aylik";
  }

  return getPackageTitle(revenueCatPackage);
}

function getPackageTitle(revenueCatPackage: PurchasesPackage) {
  return revenueCatPackage.product.title?.trim() || revenueCatPackage.identifier || "Premium";
}

function getPackagePrice(revenueCatPackage: PurchasesPackage) {
  return revenueCatPackage.product.priceString?.trim() || "Fiyat hazir degil";
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

function SignalPill({ label, active }: { active: boolean; label: string }) {
  return (
    <View style={[styles.signalPill, active ? styles.signalPillActive : styles.signalPillMuted]}>
      <Text variant="caption" color={active ? "inverse" : "secondary"}>
        {label}
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
  hero: {
    gap: SPACING.sm,
  },
  heroSignals: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  signalPill: {
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  signalPillActive: {
    backgroundColor: COLORS.primary,
  },
  signalPillMuted: {
    backgroundColor: COLORS.surfaceMuted,
  },
  section: {
    gap: SPACING.md,
  },
  featureRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  dot: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  plans: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  plan: {
    flex: 1,
    gap: SPACING.xs,
  },
  featuredPlan: {
    borderColor: COLORS.accent,
    borderWidth: 2,
  },
  comparisonRow: {
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
    gap: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  comparisonLabel: {
    flexShrink: 1,
  },
  comparisonValues: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  comparisonColumn: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 12,
    flex: 1,
    gap: 2,
    padding: SPACING.sm,
  },
  legalLinks: {
    gap: SPACING.xs,
  },
  trustRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  trustText: {
    flex: 1,
  },
});
