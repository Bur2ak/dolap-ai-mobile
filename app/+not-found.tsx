import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="compass-outline" size={34} color={COLORS.primary} />
        </View>
        <Text variant="h1" style={styles.centerText}>
          Sayfa bulunamadi
        </Text>
        <Text variant="body" color="secondary" style={styles.centerText}>
          Bu link artik gecersiz olabilir veya Shipirio icinde henuz boyle bir ekran yok.
        </Text>
        <View style={styles.actions}>
          <Button title="Ana Sayfaya Don" onPress={() => router.replace("/(tabs)")} />
          <Button title="Geri" variant="secondary" onPress={() => router.back()} />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: COLORS.background,
    flex: 1,
    justifyContent: "center",
    padding: SPACING.lg,
  },
  card: {
    alignItems: "center",
    gap: SPACING.md,
    maxWidth: 420,
    width: "100%",
  },
  iconWrap: {
    alignItems: "center",
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    height: 72,
    justifyContent: "center",
    width: 72,
  },
  centerText: {
    textAlign: "center",
  },
  actions: {
    gap: SPACING.sm,
    width: "100%",
  },
});
