import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { FlatList, Image, Pressable, StyleSheet, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { CATEGORIES } from "@/constants/categories";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useWardrobe } from "@/hooks/useWardrobe";
import { useWardrobeStore } from "@/stores/wardrobeStore";
import type { ClothingCategory } from "@/types";

export default function WardrobeScreen() {
  const { items, isLoading } = useWardrobe();
  const { category, setCategory } = useWardrobeStore();
  const filteredItems = category === "all" ? items : items.filter((item) => item.category === category);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text variant="h1">Dolabim</Text>
          <Text variant="body" color="secondary">
            {items.length} kiyafet
          </Text>
        </View>
        <Pressable style={styles.iconButton} onPress={() => router.push("/item/add")}>
          <Ionicons name="add" size={28} color={COLORS.surface} />
        </Pressable>
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ label: "Tumu", value: "all" as const }, ...CATEGORIES]}
        keyExtractor={(item) => item.value}
        contentContainerStyle={styles.filters}
        renderItem={({ item }) => {
          const active = item.value === category;
          return (
          <Pressable
            style={[styles.chip, active && styles.activeChip]}
            onPress={() => setCategory(item.value === "all" ? "all" : (item.value as ClothingCategory))}
          >
            <Text variant="label" color={active ? "inverse" : "secondary"}>
              {item.label}
            </Text>
          </Pressable>
        );
        }}
      />

      {filteredItems.length > 0 ? (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <Pressable style={styles.itemPressable} onPress={() => router.push(`/item/${item.id}`)}>
              <Card style={styles.itemCard}>
              {item.thumbnail_url || item.image_url ? (
                <Image source={{ uri: item.thumbnail_url ?? item.image_url }} style={styles.itemImage} />
              ) : (
                <View style={[styles.colorBlock, { backgroundColor: item.dominant_color_hex ?? COLORS.primarySoft }]} />
              )}
              <Text variant="label">{item.subcategory ?? item.category}</Text>
              <Text variant="caption" color="muted">
                {item.wear_count} kez giyildi
              </Text>
              </Card>
            </Pressable>
          )}
        />
      ) : (
        <Card style={styles.empty}>
          <Ionicons name={isLoading ? "sync-outline" : "shirt-outline"} size={44} color={COLORS.primary} />
          <Text variant="h3" style={styles.centerText}>
            {isLoading ? "Dolap yukleniyor" : items.length > 0 ? "Bu filtrede kiyafet yok" : "Ilk kiyafetini ekle"}
          </Text>
          <Text variant="body" color="secondary" style={styles.centerText}>
            Kamera veya galeriden fotograf ekleyince AI metadata formunu hazirlayacak.
          </Text>
        </Card>
      )}
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
  grid: {
    gap: SPACING.md,
    paddingBottom: 120,
  },
  gridRow: {
    gap: SPACING.md,
  },
  itemCard: {
    flex: 1,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    minHeight: 168,
  },
  itemPressable: {
    flex: 1,
  },
  itemImage: {
    aspectRatio: 4 / 5,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    width: "100%",
  },
  colorBlock: {
    borderRadius: 8,
    height: 96,
    width: "100%",
  },
  centerText: {
    textAlign: "center",
  },
});
