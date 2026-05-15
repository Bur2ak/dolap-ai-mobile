import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { captureEvent } from "@/lib/observability";

interface AdBannerProps {
  onUpgrade?: () => void;
}

export function AdBanner({ onUpgrade }: AdBannerProps) {
  function handlePress() {
    captureEvent("ad_banner_upgrade_tapped");
    if (onUpgrade) {
      onUpgrade();
    } else {
      router.push("/paywall");
    }
  }

  return (
    <Pressable style={styles.container} onPress={handlePress} accessibilityRole="button" accessibilityLabel="Premium'a geç">
      <View style={styles.left}>
        <Text variant="caption" color="muted" style={styles.adLabel}>
          TANITIM
        </Text>
        <Text variant="label">Reklamları kaldır & Premium özellikleri aç</Text>
        <Text variant="caption" color="secondary">
          Sınırsız kombin, fiyat takibi ve daha fazlası.
        </Text>
      </View>
      <View style={styles.cta}>
        <Text variant="caption" color="inverse" style={styles.ctaText}>
          Premium
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACING.md,
    justifyContent: "space-between",
    padding: SPACING.md,
  },
  left: {
    flex: 1,
    gap: 2,
  },
  adLabel: {
    letterSpacing: 0.5,
  },
  cta: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  ctaText: {
    letterSpacing: 0.3,
  },
});
