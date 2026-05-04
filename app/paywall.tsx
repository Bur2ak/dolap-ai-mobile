import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useSubscription } from "@/hooks/useSubscription";

const features = [
  "Sinirsiz kiyafet",
  "Sinirsiz kombin onerisi",
  "Almali Miyim karar motoru",
  "Etkinlik planlayici",
  "Gelismis gardrop analizi",
  "Fiyat takibi ve bildirimler",
];

export default function PaywallScreen() {
  const { setLocalPremiumOverride } = useSubscription();

  function activatePreview() {
    setLocalPremiumOverride(true);
    router.back();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} />
        <Text variant="h2">Shipirio Premium</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Card style={styles.hero}>
        <Text variant="display">Premium</Text>
        <Text variant="body" color="secondary">
          Dolabini sinirsiz yonet, daha cok karar al, etkinlik ve analiz ozelliklerini ac.
        </Text>
      </Card>

      <Card style={styles.section}>
        {features.map((feature) => (
          <View key={feature} style={styles.featureRow}>
            <View style={styles.dot} />
            <Text variant="body">{feature}</Text>
          </View>
        ))}
      </Card>

      <View style={styles.plans}>
        <Card style={styles.plan}>
          <Text variant="caption" color="muted">
            Aylik
          </Text>
          <Text variant="h1">79 TL</Text>
          <Text variant="body" color="secondary">
            Esnek baslangic.
          </Text>
        </Card>
        <Card style={[styles.plan, styles.featuredPlan]}>
          <Text variant="caption" color="muted">
            Yillik
          </Text>
          <Text variant="h1">599 TL</Text>
          <Text variant="body" color="secondary">
            En avantajli plan.
          </Text>
        </Card>
      </View>

      <Button title="RevenueCat Baglaninca Satin Al" onPress={activatePreview} />
      <Button title="Aboneligi Geri Yukle" variant="secondary" onPress={activatePreview} />
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
  hero: {
    gap: SPACING.sm,
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
});
