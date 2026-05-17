import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { CachedImage } from "@/components/ui/CachedImage";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { captureEvent } from "@/lib/observability";
import type { WardrobeItem } from "@/types";

interface WardrobeItemCardProps {
  item: WardrobeItem;
  disabled?: boolean;
}

export function WardrobeItemCard({ item, disabled }: WardrobeItemCardProps) {
  return (
    <Pressable
      style={styles.pressable}
      onPress={() => {
        if (disabled) return;
        captureEvent("wardrobe_item_opened", { item_id: item.id, category: item.category });
        router.push(`/item/${item.id}`);
      }}
      disabled={disabled}
    >
      <View style={styles.card}>
        {item.image_url ? (
          <CachedImage
            accessibilityLabel={item.subcategory ?? item.category}
            fallbackColor={item.dominant_color_hex}
            sourceUri={item.thumbnail_url ?? item.image_url}
            style={styles.image}
          />
        ) : (
          <View style={[styles.image, { backgroundColor: item.dominant_color_hex ?? COLORS.surfaceMuted }]} />
        )}
        <View style={styles.info}>
          <Text variant="label" numberOfLines={1}>
            {item.subcategory ?? item.category}
          </Text>
          {item.brand ? (
            <Text variant="caption" color="muted" numberOfLines={1}>
              {item.brand}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    overflow: "hidden",
  },
  image: {
    aspectRatio: 3 / 4,
    backgroundColor: COLORS.surfaceMuted,
    width: "100%",
  },
  info: {
    gap: 2,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
});
