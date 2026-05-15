import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { captureEvent } from "@/lib/observability";
import { formatCurrency } from "@/utils/formatters";
import { getCostPerWearLabel } from "@/utils/formatters";
import type { WardrobeItem } from "@/types";

interface ItemListCardProps {
  title: string;
  items: WardrobeItem[];
  empty: string;
  listKey?: string;
}

export function ItemListCard({ title, items, empty, listKey }: ItemListCardProps) {
  return (
    <Card style={styles.card}>
      <Text variant="h3">{title}</Text>
      {items.length > 0 ? (
        items.map((item) => {
          const costPerWear = getCostPerWearLabel(item.purchase_price, item.wear_count);
          return (
            <Pressable
              key={item.id}
              style={styles.row}
              onPress={() => {
                captureEvent("analytics_item_list_item_opened", { item_id: item.id, list_title: listKey ?? title });
                router.push(`/item/${item.id}`);
              }}
            >
              <View style={[styles.dot, { backgroundColor: item.dominant_color_hex ?? COLORS.primarySoft }]} />
              <View style={styles.copy}>
                <Text variant="label">{item.subcategory ?? item.category}</Text>
                <Text variant="caption" color="muted">
                  {item.wear_count} giyim
                </Text>
              </View>
              <View style={styles.costCol}>
                <Text variant="caption" color="muted">
                  {item.purchase_price ? formatCurrency(item.purchase_price) : ""}
                </Text>
                <Text variant="caption" color="muted">
                  {costPerWear.value}
                </Text>
              </View>
            </Pressable>
          );
        })
      ) : (
        <Text variant="body" color="secondary">
          {empty}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: SPACING.md,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  dot: {
    borderRadius: 999,
    height: 28,
    width: 28,
  },
  copy: {
    flex: 1,
  },
  costCol: {
    alignItems: "flex-end",
    gap: 2,
  },
});
