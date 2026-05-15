import { StyleSheet, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { formatCurrency } from "@/utils/formatters";

interface MonthlyPoint {
  month: string;
  amount: number;
}

interface MonthlySpendingProps {
  data: MonthlyPoint[];
}

export function MonthlySpending({ data }: MonthlySpendingProps) {
  const displayed = data.slice(-6);
  const max = Math.max(...displayed.map((d) => d.amount), 1);
  const total = displayed.reduce((sum, d) => sum + d.amount, 0);

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text variant="h3">Aylık Harcama</Text>
        <Text variant="caption" color="muted">Son 6 ay · {formatCurrency(total)}</Text>
      </View>
      {displayed.length > 0 ? (
        <View style={styles.chart}>
          {displayed.map((point) => {
            const heightPct = Math.max((point.amount / max) * 100, 4);
            return (
              <View key={point.month} style={styles.barCol}>
                <Text variant="caption" color="muted" style={styles.barValue}>
                  {point.amount > 0 ? formatCurrency(point.amount) : ""}
                </Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height: `${heightPct}%` as `${number}%` }]} />
                </View>
                <Text variant="caption" color="muted" style={styles.monthLabel}>
                  {point.month}
                </Text>
              </View>
            );
          })}
        </View>
      ) : (
        <Text variant="body" color="secondary">Henüz harcama verisi yok.</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACING.md },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  chart: { flexDirection: "row", gap: SPACING.sm, height: 120, alignItems: "flex-end" },
  barCol: { alignItems: "center", flex: 1, gap: 4 },
  barValue: { fontSize: 9, textAlign: "center" },
  barTrack: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 4,
    flex: 1,
    justifyContent: "flex-end",
    overflow: "hidden",
    width: "100%",
  },
  barFill: {
    backgroundColor: COLORS.primary,
    borderRadius: 4,
    width: "100%",
  },
  monthLabel: { textAlign: "center" },
});
