import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { captureEvent } from "@/lib/observability";
import type { WardrobeItem } from "@/types";

interface WearCountListProps {
  title: string;
  items: WardrobeItem[];
  empty: string;
  maxItems?: number;
}

export function WearCountList({ title, items, empty, maxItems = 5 }: WearCountListProps) {
  const displayed = items.slice(0, maxItems);
  const max = Math.max(...displayed.map((i) => i.wear_count), 1);

  return (
    <Card style={styles.card}>
      <Text variant="h3">{title}</Text>
      {displayed.length > 0 ? (
        displayed.map((item, index) => (
          <Pressable
            key={item.id}
            style={styles.row}
            onPress={() => {
              captureEvent("analytics_wear_list_item_opened", { item_id: item.id });
              router.push(`/item/${item.id}`);
            }}
          >
            <Text variant="label" style={styles.rank} color="muted">
              {index + 1}
            </Text>
            <View style={[styles.dot, { backgroundColor: item.dominant_color_hex ?? COLORS.primarySoft }]} />
            <View style={styles.info}>
              <Text variant="label" numberOfLines={1}>{item.subcategory ?? item.category}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${Math.max((item.wear_count / max) * 100, 4)}%` as `${number}%` }]} />
              </View>
            </View>
            <Text variant="label" color="secondary" style={styles.count}>
              {item.wear_count}x
            </Text>
          </Pressable>
        ))
      ) : (
        <Text variant="body" color="secondary">{empty}</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACING.md },
  row: { alignItems: "center", flexDirection: "row", gap: SPACING.sm },
  rank: { width: 18, textAlign: "center" },
  dot: { borderRadius: 999, height: 24, width: 24 },
  info: { flex: 1, gap: 4 },
  barTrack: { backgroundColor: COLORS.surfaceMuted, borderRadius: 999, height: 6, overflow: "hidden" },
  barFill: { backgroundColor: COLORS.primary, borderRadius: 999, height: "100%" },
  count: { width: 36, textAlign: "right" },
});
