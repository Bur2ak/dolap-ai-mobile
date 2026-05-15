import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { Card } from "@/components/ui/Card";
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
        if (disabled) {
          captureEvent("wardrobe_item_open_blocked", { item_id: item.id, reason: "busy" });
          return;
        }
        captureEvent("wardrobe_item_opened", { item_id: item.id, category: item.category });
        router.push(`/item/${item.id}`);
      }}
      disabled={disabled}
    >
      <Card style={styles.card}>
        <CachedImage
          accessibilityLabel={item.subcategory ?? item.category}
          fallbackColor={item.dominant_color_hex}
          sourceUri={item.thumbnail_url ?? item.image_url}
          style={styles.image}
        />
        <Text variant="label">{item.subcategory ?? item.category}</Text>
        <Text variant="caption" color="muted">
          {item.wear_count} kez giyildi
        </Text>
        <Text variant="caption" color="secondary">
          {[item.brand, item.colors[0], item.season[0]].filter(Boolean).join(" - ") || "Metadata bekliyor"}
        </Text>
        {item.is_shareable || item.is_lendable ? (
          <View style={styles.signals}>
            {item.is_shareable ? <SignalPill label="Paylasim" /> : null}
            {item.is_lendable ? <SignalPill label="Odunc" /> : null}
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

function SignalPill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Text variant="caption" color="primary">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
  },
  card: {
    flex: 1,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    minHeight: 168,
  },
  image: {
    aspectRatio: 4 / 5,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    width: "100%",
  },
  signals: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  pill: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
});
