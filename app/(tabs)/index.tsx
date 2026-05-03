import { Ionicons } from "@expo/vector-icons";
import { FlatList, Pressable, StyleSheet, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { CATEGORIES } from "@/constants/categories";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";

export default function WardrobeScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text variant="h1">Dolabim</Text>
          <Text variant="body" color="secondary">
            0 kiyafet
          </Text>
        </View>
        <Pressable style={styles.iconButton}>
          <Ionicons name="add" size={28} color={COLORS.surface} />
        </Pressable>
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={["Tumu", ...CATEGORIES.map((category) => category.label)]}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.filters}
        renderItem={({ item, index }) => (
          <View style={[styles.chip, index === 0 && styles.activeChip]}>
            <Text variant="label" color={index === 0 ? "inverse" : "secondary"}>
              {item}
            </Text>
          </View>
        )}
      />

      <Card style={styles.empty}>
        <Ionicons name="shirt-outline" size={44} color={COLORS.primary} />
        <Text variant="h3" style={styles.centerText}>
          Ilk kiyafetini ekle
        </Text>
        <Text variant="body" color="secondary" style={styles.centerText}>
          Kamera veya galeriden fotograf ekleyince AI metadata formunu hazirlayacak.
        </Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
    paddingTop: 64,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  filters: {
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
  },
  chip: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  activeChip: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  empty: {
    alignItems: "center",
    gap: SPACING.sm,
    marginTop: SPACING.xl,
    paddingVertical: 40,
  },
  centerText: {
    textAlign: "center",
  },
});
