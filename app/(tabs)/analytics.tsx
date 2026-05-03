import { StyleSheet, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";

const stats = [
  ["Toplam kiyafet", "0"],
  ["Gardrop degeri", "0 TL"],
  ["Ort. maliyet/giyim", "0 TL"],
  ["Bu ay harcama", "0 TL"],
];

export default function AnalyticsScreen() {
  return (
    <View style={styles.container}>
      <Text variant="h1">Analiz</Text>
      <Text variant="body" color="secondary">
        Kiyafet sayisi, kullanim ve harcama verileri burada toplanacak.
      </Text>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    gap: SPACING.md,
    padding: SPACING.lg,
    paddingTop: 64,
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
});
