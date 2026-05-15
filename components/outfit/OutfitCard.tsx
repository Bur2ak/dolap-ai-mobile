import { StyleSheet, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { CachedImage } from "@/components/ui/CachedImage";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import type { OutfitSuggestion, WardrobeItem } from "@/types";

interface OutfitCardProps {
  suggestion: OutfitSuggestion;
  items: WardrobeItem[];
  actions?: React.ReactNode;
}

export function OutfitCard({ suggestion, items, actions }: OutfitCardProps) {
  const suggestionItems = suggestion.items
    .map((itemId) => items.find((w) => w.id === itemId))
    .filter((item): item is WardrobeItem => Boolean(item));

  return (
    <Card style={styles.card}>
      <Text variant="h3">{suggestion.name}</Text>
      <Text variant="body" color="secondary">
        {suggestion.reason}
      </Text>
      {suggestion.accessory_note ? (
        <Text variant="caption" color="muted">
          {suggestion.accessory_note}
        </Text>
      ) : null}
      <Text variant="caption" color="muted">
        {suggestion.items.length} parca
      </Text>
      {suggestionItems.length > 0 ? (
        <View style={styles.grid}>
          {suggestionItems.map((item) => (
            <View key={item.id} style={styles.itemWrap}>
              <CachedImage
                accessibilityLabel={item.subcategory ?? item.category}
                fallbackColor={item.dominant_color_hex}
                sourceUri={item.thumbnail_url ?? item.image_url}
                style={styles.image}
              />
              <Text variant="caption" color="secondary" style={styles.label}>
                {item.subcategory ?? item.category}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: SPACING.xs,
  },
  grid: {
    flexDirection: "row",
    gap: SPACING.sm,
    paddingTop: SPACING.xs,
  },
  itemWrap: {
    flex: 1,
    gap: SPACING.xs,
    minWidth: 0,
  },
  image: {
    aspectRatio: 4 / 5,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    width: "100%",
  },
  label: {
    textAlign: "center",
  },
  actions: {
    gap: SPACING.sm,
    paddingTop: SPACING.xs,
  },
});
