import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { FlatList, Image, Pressable, StyleSheet, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { CATEGORIES } from "@/constants/categories";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useWardrobe } from "@/hooks/useWardrobe";
import { useWardrobeStore } from "@/stores/wardrobeStore";
import type { ClothingCategory, Season } from "@/types";

const seasonFilters: Array<{ label: string; value: Season | "all" }> = [
  { label: "Tum sezonlar", value: "all" },
  { label: "Ilkbahar", value: "ilkbahar" },
  { label: "Yaz", value: "yaz" },
  { label: "Sonbahar", value: "sonbahar" },
  { label: "Kis", value: "kis" },
];

export default function WardrobeScreen() {
  const { items, error, isLoading, isRefetching, refetch } = useWardrobe();
  const { category, season, search, setCategory, setSeason, setSearch } = useWardrobeStore();
  const normalizedQuery = search.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    const categoryMatch = category === "all" || item.category === category;
    const seasonMatch = season === "all" || item.season.includes(season);
    const queryMatch =
      !normalizedQuery ||
      [item.category, item.subcategory, item.brand, ...item.colors, ...item.season]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));

    return categoryMatch && seasonMatch && queryMatch;
  });

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

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={seasonFilters}
        keyExtractor={(item) => item.value}
        contentContainerStyle={styles.seasonFilters}
        renderItem={({ item }) => {
          const active = item.value === season;
          return (
            <Pressable style={[styles.seasonChip, active && styles.activeSeasonChip]} onPress={() => setSeason(item.value)}>
              <Text variant="caption" color={active ? "inverse" : "secondary"}>
                {item.label}
              </Text>
            </Pressable>
          );
        }}
      />

      <Input label="Dolapta ara" value={search} onChangeText={setSearch} placeholder="Marka, renk, sezon veya kategori" autoCapitalize="none" />

      {isLoading ? (
        <WardrobeSkeleton />
      ) : error && items.length === 0 ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Dolap yuklenemedi"
          body="Baglanti veya Supabase tarafinda gecici bir sorun olabilir."
          actionLabel="Tekrar Dene"
          loading={isRefetching}
          onAction={() => void refetch()}
          style={styles.emptyState}
        />
      ) : filteredItems.length > 0 ? (
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
        <EmptyState
          icon={items.length > 0 ? "search-outline" : "shirt-outline"}
          title={items.length > 0 ? "Aramana uyan kiyafet yok" : "Ilk kiyafetini ekle"}
          body={
            items.length > 0
              ? "Filtreleri sadelestirerek veya aramayi temizleyerek tekrar bakabilirsin."
              : "Kamera veya galeriden fotograf ekleyince AI metadata formunu hazirlayacak."
          }
          actionLabel={items.length > 0 ? "Filtreleri Temizle" : "Kiyafet Ekle"}
          onAction={
            items.length > 0
              ? () => {
                  setCategory("all");
                  setSeason("all");
                  setSearch("");
                }
              : () => router.push("/item/add")
          }
          style={styles.emptyState}
        />
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
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  seasonFilters: {
    gap: SPACING.sm,
    paddingBottom: SPACING.md,
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
  seasonChip: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  activeSeasonChip: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  emptyState: {
    marginTop: SPACING.xl,
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
  skeletonGrid: {
    gap: SPACING.md,
    paddingBottom: 120,
  },
  skeletonRow: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  skeletonCard: {
    flex: 1,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  skeletonImage: {
    aspectRatio: 4 / 5,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    width: "100%",
  },
  skeletonLine: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 999,
    height: 12,
    width: "72%",
  },
  skeletonLineShort: {
    width: "48%",
  },
});

function WardrobeSkeleton() {
  return (
    <View style={styles.skeletonGrid}>
      {[0, 1, 2].map((row) => (
        <View key={row} style={styles.skeletonRow}>
          {[0, 1].map((column) => (
            <Card key={column} style={styles.skeletonCard}>
              <View style={styles.skeletonImage} />
              <View style={styles.skeletonLine} />
              <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
            </Card>
          ))}
        </View>
      ))}
    </View>
  );
}
