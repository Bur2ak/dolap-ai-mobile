import { StyleSheet, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import type { DistributionPoint } from "@/types";

interface DistributionChartProps {
  title: string;
  points: DistributionPoint[];
  showSwatch?: boolean;
  formatLabel?: (label: string) => string;
}

export function DistributionChart({ title, points, showSwatch = false, formatLabel }: DistributionChartProps) {
  const max = Math.max(...points.map((p) => p.value), 1);

  return (
    <Card style={styles.card}>
      <Text variant="h3">{title}</Text>
      {points.length > 0 ? (
        points.map((point) => (
          <View key={point.label} style={styles.row}>
            {showSwatch ? (
              <View style={[styles.swatch, { backgroundColor: point.color ?? COLORS.primarySoft }]} />
            ) : null}
            <Text variant="label" style={styles.label}>
              {formatLabel ? formatLabel(point.label) : point.label}
            </Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.max((point.value / max) * 100, 8)}%` as `${number}%` }]} />
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

const styles = StyleSheet.create({
  card: {
    gap: SPACING.md,
  },
  row: {
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
  label: {
    width: 88,
  },
  track: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 999,
    flex: 1,
    height: 10,
    overflow: "hidden",
  },
  fill: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: "100%",
  },
});
