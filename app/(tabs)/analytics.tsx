import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { PremiumGate } from "@/components/shared/PremiumGate";
import { CATEGORIES } from "@/constants/categories";
import { COLORS } from "@/constants/colors";
import { SEASONS } from "@/constants/seasons";
import { SPACING } from "@/constants/spacing";
import { useSubscription } from "@/hooks/useSubscription";
import { useWardrobeAnalytics } from "@/hooks/useWardrobeAnalytics";
import type { DistributionPoint, WardrobeItem } from "@/types";
import { formatCurrency, formatNumber } from "@/utils/formatters";

export default function AnalyticsScreen() {
  const { analytics, isLoading } = useWardrobeAnalytics();
  const { checkGate } = useSubscription();
  const topCategory = analytics.category_distribution[0];
  const focusText =
    analytics.total_items === 0
      ? "Ilk parcalari ekledikce dolap dengesi burada netlesir."
      : analytics.inactive_items_count > analytics.total_items / 2
        ? "Dolabin yarisindan fazlasi 90 gundur giyilmemis gorunuyor."
        : analytics.utilization_score >= 70
          ? "Dolap kullanim orani iyi; favori parcalarini takip etmeye devam et."
          : "Kullanim orani yukselebilir; kombin onerileriyle atil parcalari deneyebilirsin.";
  const stats = [
    ["Toplam kiyafet", formatNumber(analytics.total_items)],
    ["Gardrop degeri", formatCurrency(analytics.total_value)],
    ["Ort. maliyet/giyim", formatCurrency(analytics.avg_cost_per_wear)],
    ["Bu ay harcama", formatCurrency(analytics.monthly_spending)],
    ["Kullanim skoru", `%${analytics.utilization_score}`],
    ["90 gun atil", formatNumber(analytics.inactive_items_count)],
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="h1">Analiz</Text>
      <Text variant="body" color="secondary">
        {isLoading ? "Gardrop verileri yukleniyor." : "Kullanim, harcama ve dolap dengesi."}
      </Text>

      <Card style={styles.insightCard}>
        <Text variant="caption" color="muted">
          DOLAP OZETI
        </Text>
        <Text variant="h3">{focusText}</Text>
        <View style={styles.insightMetaRow}>
          <Text variant="caption" color="muted">
            EN YOGUN KATEGORI: {topCategory ? formatCategory(topCategory.label) : "YOK"}
          </Text>
          <Text variant="caption" color="muted">
            RENK SAYISI: {formatNumber(analytics.color_distribution.length)}
          </Text>
        </View>
      </Card>

      <View style={styles.grid}>
        {stats.map(([label, value]) => (
          <Card key={label} style={styles.stat}>
            <Text variant="caption" color="muted">
              {label}
            </Text>
            <Text variant="h2">{value}</Text>
          </Card>
        ))}
      </View>

      <DistributionCard title="Kategori dagilimi" points={analytics.category_distribution} />
      <DistributionCard title="Renk dagilimi" points={analytics.color_distribution} showSwatch />
      <DistributionCard title="Sezon dagilimi" points={analytics.season_distribution} />
      <ItemList title="En cok giyilenler" items={analytics.most_worn} empty="Henuz giyilme verisi yok." />
      <ItemList title="Hic giyilmeyenler" items={analytics.never_worn} empty="Harika, her sey kullanilmis gorunuyor." />
      {checkGate("ANALYTICS_FULL") ? (
        <>
          <ItemList title="Yuksek degerli atil parcalar" items={analytics.high_value_unused} empty="Yuksek degerli atil parca yok." />
          <ItemList title="Sat veya bagisla adaylari" items={analytics.suggestions_to_remove} empty="Simdilik aday yok." />
        </>
      ) : (
        <PremiumGate
          title="Gelismis analiz Premium"
          body="Sat veya bagisla onerileri, verimsiz parcalari ve dolap temizleme yardimi Premium ile acilir."
        />
      )}
    </ScrollView>
  );
}

function formatCategory(value: string) {
  return CATEGORIES.find((category) => category.value === value)?.label ?? value.replace("_", " ");
}

function formatDistributionLabel(value: string) {
  return SEASONS.find((season) => season.value === value)?.label ?? formatCategory(value);
}

function DistributionCard({ title, points, showSwatch = false }: { title: string; points: DistributionPoint[]; showSwatch?: boolean }) {
  const max = Math.max(...points.map((point) => point.value), 1);

  return (
    <Card style={styles.section}>
      <Text variant="h3">{title}</Text>
      {points.length > 0 ? (
        points.map((point) => (
          <View key={point.label} style={styles.barRow}>
            {showSwatch ? <View style={[styles.swatch, { backgroundColor: point.color ?? COLORS.primarySoft }]} /> : null}
            <Text variant="label" style={styles.barLabel}>
              {formatDistributionLabel(point.label)}
            </Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${Math.max((point.value / max) * 100, 8)}%` }]} />
            </View>
            <Text variant="caption" color="muted">
              {point.value}
            </Text>
          </View>
        ))
      ) : (
        <Text variant="body" color="secondary">
          Veri yok.
        </Text>
      )}
    </Card>
  );
}

function ItemList({ title, items, empty }: { title: string; items: WardrobeItem[]; empty: string }) {
  return (
    <Card style={styles.section}>
      <Text variant="h3">{title}</Text>
      {items.length > 0 ? (
        items.map((item) => (
          <Pressable key={item.id} style={styles.itemRow} onPress={() => router.push(`/item/${item.id}`)}>
            <View style={[styles.itemDot, { backgroundColor: item.dominant_color_hex ?? COLORS.primarySoft }]} />
            <View style={styles.itemText}>
              <Text variant="label">{item.subcategory ?? item.category}</Text>
              <Text variant="caption" color="muted">
                {item.wear_count} giyim
              </Text>
            </View>
            <Text variant="caption" color="muted">
              {item.purchase_price ? formatCurrency(item.purchase_price) : ""}
            </Text>
          </Pressable>
        ))
      ) : (
        <Text variant="body" color="secondary">
          {empty}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    gap: SPACING.md,
    padding: SPACING.lg,
    paddingTop: 64,
    paddingBottom: 120,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
  },
  stat: {
    minHeight: 112,
    width: "47%",
  },
  section: {
    gap: SPACING.md,
  },
  insightCard: {
    gap: SPACING.sm,
  },
  insightMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  barRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  swatch: {
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 18,
    width: 18,
  },
  barLabel: {
    width: 88,
  },
  barTrack: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 999,
    flex: 1,
    height: 10,
    overflow: "hidden",
  },
  barFill: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: "100%",
  },
  itemRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  itemDot: {
    borderRadius: 999,
    height: 28,
    width: 28,
  },
  itemText: {
    flex: 1,
  },
});
