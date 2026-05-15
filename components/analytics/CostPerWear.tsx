import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { captureEvent } from "@/lib/observability";
import { formatCurrency } from "@/utils/formatters";
import type { WardrobeItem } from "@/types";

interface CostPerWearProps {
  items: WardrobeItem[];
  maxItems?: number;
}

function computeCpw(item: WardrobeItem): number | null {
  if (!item.purchase_price || item.wear_count === 0) return null;
  return item.purchase_price / item.wear_count;
}

export function CostPerWear({ items, maxItems = 5 }: CostPerWearProps) {
  const withCpw = items
    .map((item) => ({ item, cpw: computeCpw(item) }))
    .filter((entry): entry is { item: WardrobeItem; cpw: number } => entry.cpw !== null)
    .sort((a, b) => a.cpw - b.cpw)
    .slice(0, maxItems);

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text variant="h3">Maliyet / Giyim</Text>
        <Text variant="caption" color="muted">En verimli ilk {maxItems}</Text>
      </View>
      {withCpw.length > 0 ? (
        withCpw.map(({ item, cpw }) => (
          <Pressable
            key={item.id}
            style={styles.row}
            onPress={() => {
              captureEvent("analytics_cpw_item_opened", { item_id: item.id });
              router.push(`/item/${item.id}`);
            }}
          >
            <View style={[styles.dot, { backgroundColor: item.dominant_color_hex ?? COLORS.primarySoft }]} />
            <View style={styles.info}>
              <Text variant="label" numberOfLines={1}>{item.subcategory ?? item.category}</Text>
              <Text variant="caption" color="muted">{item.wear_count} giyim · {formatCurrency(item.purchase_price!)}</Text>
            </View>
            <View style={styles.cpwBadge}>
              <Text variant="label" color="inverse">{formatCurrency(cpw)}</Text>
            </View>
          </Pressable>
        ))
      ) : (
        <Text variant="body" color="secondary">Fiyat bilgisi girilen kıyafet yok.</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACING.md },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  row: { alignItems: "center", flexDirection: "row", gap: SPACING.sm },
  dot: { borderRadius: 999, height: 24, width: 24 },
  info: { flex: 1, gap: 2 },
  cpwBadge: {
    alignItems: "center",
    backgroundColor: COLORS.success,
    borderRadius: 8,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
});
