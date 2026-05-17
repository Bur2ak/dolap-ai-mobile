import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { FlashList } from "@shopify/flash-list";
import { Pressable, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

import { AddItemSheet } from "@/components/wardrobe/AddItemSheet";
import { WardrobeItemCard } from "@/components/wardrobe/WardrobeItemCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { CATEGORIES } from "@/constants/categories";
import { COLORS } from "@/constants/colors";
import { FONTS, FONT_SIZE } from "@/constants/typography";
import { SPACING } from "@/constants/spacing";
import { useWardrobe } from "@/hooks/useWardrobe";
import { useImagePicker } from "@/hooks/useImagePicker";
import { captureEvent } from "@/lib/observability";
import { useWardrobeStore } from "@/stores/wardrobeStore";
import type { ClothingCategory, WardrobeItem } from "@/types";

const CATEGORY_FILTERS: Array<{ label: string; value: ClothingCategory | "all" }> = [
  { label: "Tümü", value: "all" },
  { label: "Üst", value: "ust" },
  { label: "Alt", value: "alt" },
  { label: "Elbise", value: "elbise" },
  { label: "Ayakkabı", value: "ayakkabi" },
  { label: "Çanta", value: "canta" },
  { label: "Aksesuar", value: "aksesuar" },
];

type SortMode = "newest" | "least_worn" | "most_worn";

export default function WardrobeScreen() {
  const { items, error, isLoading, isRefetching, refetch } = useWardrobe();
  const { category, search, setCategory, setSearch } = useWardrobeStore();
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [sheetVisible, setSheetVisible] = useState(false);
  const { takePhoto, pickFromLibrary } = useImagePicker();

  const normalizedQuery = search.trim().toLowerCase();

  const filteredItems = items.filter((item) => {
    const catMatch = category === "all" || item.category === category;
    const queryMatch =
      !normalizedQuery ||
      [item.category, item.subcategory, item.brand, ...item.colors]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(normalizedQuery));
    return catMatch && queryMatch;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortMode === "least_worn") return a.wear_count - b.wear_count;
    if (sortMode === "most_worn") return b.wear_count - a.wear_count;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const mostWornThisWeek = [...items]
    .filter((i) => i.wear_count > 0)
    .sort((a, b) => b.wear_count - a.wear_count)
    .slice(0, 5);

  useEffect(() => {
    captureEvent("wardrobe_tab_viewed", { item_count: items.length });
  }, [items.length]);

  async function handleCameraAdd() {
    const uri = await takePhoto();
    if (uri) router.push({ pathname: "/item/add", params: { imageUri: uri } });
  }

  async function handleLibraryAdd() {
    const uri = await pickFromLibrary();
    if (uri) router.push({ pathname: "/item/add", params: { imageUri: uri } });
  }

  return (
    <View style={styles.container}>
      <AddItemSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onCamera={() => void handleCameraAdd()}
        onLibrary={() => void handleLibraryAdd()}
      />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text variant="h1">Gardırobum</Text>
          <Text variant="body" color="secondary">
            {items.length} parça, kombinlerin seni bekliyor
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setSheetVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={22} color={COLORS.textInverse} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Parça ara..."
          placeholderTextColor={COLORS.textMuted}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category filters + sort */}
      <View style={styles.filtersRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChips}>
          {CATEGORY_FILTERS.map((cat) => (
            <TouchableOpacity
              key={cat.value}
              style={[styles.catChip, category === cat.value && styles.catChipActive]}
              onPress={() => {
                setCategory(cat.value as ClothingCategory | "all");
                captureEvent("wardrobe_category_filter", { value: cat.value });
              }}
              activeOpacity={0.7}
            >
              <Text
                variant="label"
                color={category === cat.value ? "inverse" : "secondary"}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => {
            const next = sortMode === "newest" ? "most_worn" : sortMode === "most_worn" ? "least_worn" : "newest";
            setSortMode(next);
          }}
        >
          <Ionicons name="funnel-outline" size={16} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Item count */}
      {normalizedQuery || category !== "all" ? (
        <View style={styles.filterSummaryRow}>
          <Text variant="caption" color="muted">
            {sortedItems.length}/{items.length} parça gösteriliyor
          </Text>
          <TouchableOpacity onPress={() => { setSearch(""); setCategory("all"); }}>
            <Text variant="caption" color="primary">Temizle</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Grid */}
      {isLoading ? (
        <WardrobeSkeleton />
      ) : error && items.length === 0 ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Dolap yüklenemedi"
          body="Bağlantı sorunu olabilir."
          actionLabel="Tekrar Dene"
          loading={isRefetching}
          onAction={() => void refetch()}
          style={styles.emptyState}
        />
      ) : sortedItems.length > 0 ? (
        <FlashList<WardrobeItem>
          data={sortedItems}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <View style={styles.gridItem}>
              <WardrobeItemCard item={item} />
            </View>
          )}
          ListFooterComponent={
            mostWornThisWeek.length > 0 ? (
              <View style={styles.bottomSection}>
                <Text variant="h3" style={styles.bottomSectionTitle}>
                  Bu hafta en çok kullanılanlar
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topItemsRow}>
                  {mostWornThisWeek.map((item) => (
                    <Pressable
                      key={item.id}
                      style={styles.topItem}
                      onPress={() => router.push(`/item/${item.id}`)}
                    >
                      <View style={[styles.topItemSwatch, { backgroundColor: item.dominant_color_hex ?? COLORS.surfaceMuted }]} />
                      <Text variant="caption" color="secondary" numberOfLines={1}>{item.subcategory ?? item.category}</Text>
                      <Text variant="caption" color="muted">{item.wear_count} kez</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null
          }
        />
      ) : (
        <EmptyState
          icon={items.length > 0 ? "search-outline" : "shirt-outline"}
          title={items.length > 0 ? "Aramana uyan parça yok" : "İlk parçanı ekle"}
          body={
            items.length > 0
              ? "Filtreleri temizleyerek tekrar bakabilirsin."
              : "Kamera veya galeriden fotoğraf ekle, AI analizi başlasın."
          }
          actionLabel={items.length > 0 ? "Temizle" : "Parça Ekle"}
          onAction={items.length > 0 ? () => { setSearch(""); setCategory("all"); } : () => setSheetVisible(true)}
          style={styles.emptyState}
        />
      )}
    </View>
  );
}

function WardrobeSkeleton() {
  return (
    <View style={styles.skeletonGrid}>
      {[0, 1, 2].map((row) => (
        <View key={row} style={styles.skeletonRow}>
          {[0, 1, 2].map((col) => (
            <View key={col} style={styles.skeletonItem}>
              <View style={styles.skeletonImg} />
              <View style={styles.skeletonLine} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const ITEM_GAP = 8;

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.background, flex: 1 },

  header: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingTop: 56,
  },
  addButton: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: 44,
    justifyContent: "center",
    width: 44,
  },

  // Search
  searchBar: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
  },
  searchInput: {
    color: COLORS.text,
    flex: 1,
    fontFamily: FONTS.sansRegular,
    fontSize: FONT_SIZE.body,
  },

  // Category chips
  filtersRow: { alignItems: "center", flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.sm },
  categoryChips: { gap: SPACING.sm, paddingHorizontal: SPACING.lg },
  catChip: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
  },
  catChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  sortButton: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    marginRight: SPACING.lg,
    width: 36,
  },

  filterSummaryRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },

  // Grid
  grid: { paddingHorizontal: SPACING.lg, paddingBottom: 100 },
  gridItem: { flex: 1, margin: ITEM_GAP / 2 },

  emptyState: { marginTop: SPACING.xl },

  // Bottom section
  bottomSection: { marginTop: SPACING.xl, gap: SPACING.md },
  bottomSectionTitle: { paddingHorizontal: 0 },
  topItemsRow: { gap: SPACING.md },
  topItem: { alignItems: "center", gap: SPACING.xs, width: 64 },
  topItemSwatch: { borderRadius: 10, height: 64, width: 64 },

  // Skeleton
  skeletonGrid: { gap: ITEM_GAP, padding: SPACING.lg },
  skeletonRow: { flexDirection: "row", gap: ITEM_GAP },
  skeletonItem: { flex: 1, gap: SPACING.xs },
  skeletonImg: {
    aspectRatio: 3 / 4,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 14,
    width: "100%",
  },
  skeletonLine: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 999,
    height: 10,
    width: "60%",
  },
});
