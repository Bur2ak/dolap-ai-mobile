import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { FlashList } from "@shopify/flash-list";
import { Pressable, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

import { AddItemSheet } from "@/components/wardrobe/AddItemSheet";
import { CachedImage } from "@/components/ui/CachedImage";
import { EmptyState } from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
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

  const totalWearCount = mostWornThisWeek.reduce((s, i) => s + i.wear_count, 0);

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

  function cycleSortMode() {
    const next = sortMode === "newest" ? "most_worn" : sortMode === "most_worn" ? "least_worn" : "newest";
    setSortMode(next);
    captureEvent("wardrobe_sort_changed", { sort_mode: next });
  }

  const sortLabel = sortMode === "newest" ? "Yeni" : sortMode === "most_worn" ? "Çok Giyilen" : "Az Giyilen";

  return (
    <View style={styles.container}>
      <AddItemSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onCamera={() => void handleCameraAdd()}
        onLibrary={() => void handleLibraryAdd()}
      />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text variant="h1">Gardırobum</Text>
          <Text variant="body" color="secondary">Parçalarını düzenle, kombinlerini kolayca oluştur.</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setSheetVisible(true)} activeOpacity={0.8}>
          <Ionicons name="add" size={24} color={COLORS.textInverse} />
        </TouchableOpacity>
      </View>

      {/* ── Search + Filtrele + Sırala ── */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={15} color={COLORS.textMuted} />
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
              <Ionicons name="close-circle" size={15} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.filterBtn} onPress={() => {}} activeOpacity={0.7}>
          <Ionicons name="options-outline" size={14} color={COLORS.textSecondary} />
          <Text variant="label" color="secondary">Filtrele</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterBtn} onPress={cycleSortMode} activeOpacity={0.7}>
          <Ionicons name="swap-vertical-outline" size={14} color={COLORS.textSecondary} />
          <Text variant="label" color="secondary">{sortLabel}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Kategori chips ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRow}
        style={styles.categoryScroll}
      >
        {CATEGORY_FILTERS.map((cat) => {
          const active = category === cat.value;
          return (
            <TouchableOpacity
              key={cat.value}
              style={[styles.catChip, active && styles.catChipActive]}
              onPress={() => {
                setCategory(cat.value as ClothingCategory | "all");
                captureEvent("wardrobe_category_filter", { value: cat.value });
              }}
              activeOpacity={0.7}
            >
              <Text
                variant="label"
                style={active ? styles.catChipTextActive : styles.catChipText}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Filter summary ── */}
      {(normalizedQuery || category !== "all") && (
        <View style={styles.filterSummaryRow}>
          <Text variant="caption" color="muted">
            {sortedItems.length}/{items.length} parça
          </Text>
          <TouchableOpacity onPress={() => { setSearch(""); setCategory("all"); }}>
            <Text variant="caption" style={styles.clearText}>Temizle</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Grid ── */}
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
          numColumns={4}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <View style={styles.gridItem}>
              <GridCard item={item} />
            </View>
          )}
          ListFooterComponent={
            <View style={styles.footerSections}>
              {/* Bu hafta en çok kullandıkların */}
              {mostWornThisWeek.length > 0 && (
                <View style={styles.weeklyCard}>
                  <View style={styles.weeklyLeft}>
                    <View style={styles.weeklyIconWrap}>
                      <Ionicons name="sparkles-outline" size={20} color={COLORS.accentText} />
                    </View>
                    <View style={styles.weeklyCopy}>
                      <Text variant="h3">Bu hafta en çok kullandıkların</Text>
                      <Text variant="body" color="secondary">
                        {mostWornThisWeek.length} parçayı{"\n"}{totalWearCount} kombininde kullandın.
                      </Text>
                    </View>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weeklyItems}>
                    {mostWornThisWeek.map((item) => (
                      <Pressable key={item.id} onPress={() => router.push(`/item/${item.id}`)}>
                        {item.thumbnail_url || item.image_url ? (
                          <CachedImage
                            accessibilityLabel={item.subcategory ?? item.category}
                            fallbackColor={item.dominant_color_hex}
                            sourceUri={item.thumbnail_url ?? item.image_url}
                            style={styles.weeklyThumb}
                          />
                        ) : (
                          <View style={[styles.weeklyThumb, { backgroundColor: item.dominant_color_hex ?? COLORS.surfaceMuted }]} />
                        )}
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Bunlarla kombin oluştur */}
              <TouchableOpacity
                style={styles.kombinCard}
                onPress={() => router.push("/(tabs)/outfit")}
                activeOpacity={0.85}
              >
                <View style={styles.kombinIcon}>
                  <Ionicons name="shirt-outline" size={22} color={COLORS.textInverse} />
                </View>
                <View style={styles.kombinCopy}>
                  <Text variant="h3" style={styles.kombinTitle}>Bunlarla kombin oluştur</Text>
                  <Text variant="body" style={styles.kombinSubtitle}>Seçtiğin parçalara özel önerileri gör.</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kombinPhotos}>
                  {items.slice(0, 3).map((item) => (
                    item.thumbnail_url || item.image_url ? (
                      <CachedImage
                        key={item.id}
                        accessibilityLabel=""
                        fallbackColor={item.dominant_color_hex}
                        sourceUri={item.thumbnail_url ?? item.image_url}
                        style={styles.kombinThumb}
                      />
                    ) : (
                      <View key={item.id} style={[styles.kombinThumb, { backgroundColor: item.dominant_color_hex ?? COLORS.surface }]} />
                    )
                  ))}
                </ScrollView>
                <View style={styles.kombinArrow}>
                  <Ionicons name="arrow-forward" size={16} color={COLORS.textInverse} />
                </View>
              </TouchableOpacity>
            </View>
          }
        />
      ) : (
        <ScrollView contentContainerStyle={styles.onboardWrap} showsVerticalScrollIndicator={false}>
          <View style={styles.onboardIcon}>
            <Ionicons name="sparkles" size={32} color={COLORS.accentText} />
          </View>
          <Text variant="h2" style={styles.onboardTitle}>En sevdiğin{"\n"}5 parçayla başla</Text>
          <Text variant="body" color="secondary" style={styles.onboardBody}>
            Tüm dolabını eklemene gerek yok. Sadece birkaç favori parçanı ekle,
            Shipirio sana hemen kombin önersin.
          </Text>

          {/* Progress hint */}
          <View style={styles.progressHint}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: "0%" }]} />
            </View>
            <Text variant="caption" color="muted">Dolabın %0 hazır — 5 parça eklersen AI öneriler başlar</Text>
          </View>

          {/* Primary: Smart scan */}
          <TouchableOpacity style={styles.onboardPrimary} onPress={() => router.push("/item/smart-scan")} activeOpacity={0.85}>
            <Ionicons name="scan-outline" size={20} color={COLORS.textInverse} />
            <View style={styles.onboardPrimaryCopy}>
              <Text variant="label" color="inverse">Akıllı Tarama ile Başla</Text>
              <Text variant="caption" style={styles.onboardPrimarySub}>Tek fotoğrafla birden fazla parça</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.onboardSecondary} onPress={() => setSheetVisible(true)} activeOpacity={0.7}>
            <Text variant="label" color="secondary">Tek tek eklemeyi tercih et</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

function GridCard({ item }: { item: WardrobeItem }) {
  return (
    <Pressable style={styles.gridCard} onPress={() => {
      captureEvent("wardrobe_item_opened", { item_id: item.id });
      router.push(`/item/${item.id}`);
    }}>
      <View style={styles.gridPhotoWrap}>
        {item.thumbnail_url || item.image_url ? (
          <CachedImage
            accessibilityLabel={item.subcategory ?? item.category}
            fallbackColor={item.dominant_color_hex}
            sourceUri={item.thumbnail_url ?? item.image_url}
            style={styles.gridPhoto}
          />
        ) : (
          <View style={[styles.gridPhoto, styles.gridPhotoPlaceholder]}>
            <View style={[styles.gridColorSwatch, { backgroundColor: item.dominant_color_hex ?? COLORS.surfaceMuted }]} />
          </View>
        )}
      </View>
      <Text variant="caption" color="secondary" numberOfLines={1} style={styles.gridName}>
        {item.subcategory ?? item.category}
      </Text>
    </Pressable>
  );
}

function WardrobeSkeleton() {
  return (
    <View style={styles.skeletonGrid}>
      {[0, 1, 2].map((row) => (
        <View key={row} style={styles.skeletonRow}>
          {[0, 1, 2, 3].map((col) => (
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

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.background, flex: 1 },

  // Header
  header: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingTop: 60,
  },
  addBtn: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: 44,
    justifyContent: "center",
    width: 44,
  },

  // Search row
  searchRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  searchBar: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 9,
  },
  searchInput: {
    color: COLORS.text,
    flex: 1,
    fontFamily: FONTS.sansRegular,
    fontSize: FONT_SIZE.body,
  },
  filterBtn: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 9,
  },

  // Category chips
  categoryScroll: { flexGrow: 0, marginBottom: SPACING.sm },
  categoryRow: { gap: SPACING.sm, paddingHorizontal: SPACING.lg },
  catChip: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
  },
  catChipActive: {
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.accent,
  },
  catChipText: { color: COLORS.textSecondary, fontFamily: FONTS.sansMedium, fontSize: FONT_SIZE.label },
  catChipTextActive: { color: COLORS.accentText, fontFamily: FONTS.sansBold, fontSize: FONT_SIZE.label },

  filterSummaryRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  clearText: { color: COLORS.primary, fontFamily: FONTS.sansMedium },

  // Grid — 4 sütun
  grid: { paddingHorizontal: SPACING.sm, paddingBottom: 20 },
  gridItem: { flex: 1, margin: 4 },
  gridCard: { alignItems: "center", gap: 4 },
  gridPhotoWrap: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    overflow: "hidden",
    width: "100%",
  },
  gridPhoto: {
    aspectRatio: 3 / 4,
    width: "100%",
  },
  gridPhotoPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  gridColorSwatch: {
    aspectRatio: 3 / 4,
    width: "100%",
  },
  gridName: {
    fontFamily: FONTS.sansRegular,
    fontSize: 10,
    textAlign: "center",
    width: "100%",
  },

  emptyState: { marginTop: SPACING.xl },
  onboardWrap: { alignItems: "center", gap: SPACING.md, paddingHorizontal: SPACING.lg, paddingTop: SPACING.xl },
  onboardIcon: {
    alignItems: "center", backgroundColor: COLORS.accentSoft, borderRadius: 20,
    height: 72, justifyContent: "center", width: 72,
  },
  onboardTitle: { textAlign: "center" },
  onboardBody: { textAlign: "center", maxWidth: 320 },
  progressHint: { gap: SPACING.xs, width: "100%", maxWidth: 340, alignItems: "center" },
  progressBar: { backgroundColor: COLORS.surfaceMuted, borderRadius: 999, height: 6, overflow: "hidden", width: "100%" },
  progressFill: { backgroundColor: COLORS.accent, borderRadius: 999, height: "100%" },
  onboardPrimary: {
    alignItems: "center", backgroundColor: COLORS.primary, borderRadius: 16,
    flexDirection: "row", gap: SPACING.sm, justifyContent: "center",
    marginTop: SPACING.sm, maxWidth: 340, minHeight: 56, paddingHorizontal: SPACING.lg, width: "100%",
  },
  onboardPrimaryCopy: { alignItems: "flex-start" },
  onboardPrimarySub: { color: "rgba(255,255,255,0.7)" },
  onboardSecondary: { padding: SPACING.sm },

  // Footer sections
  footerSections: { gap: SPACING.md, padding: SPACING.md, paddingBottom: 100 },

  // Bu hafta en çok kullandıkların
  weeklyCard: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 16,
    gap: SPACING.sm,
    overflow: "hidden",
    padding: SPACING.md,
  },
  weeklyLeft: { alignItems: "flex-start", flexDirection: "row", gap: SPACING.sm },
  weeklyIconWrap: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  weeklyCopy: { flex: 1, gap: 2 },
  weeklyItems: { gap: SPACING.sm },
  weeklyThumb: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    height: 52,
    width: 40,
  },

  // Bunlarla kombin oluştur
  kombinCard: {
    alignItems: "center",
    backgroundColor: COLORS.cta,
    borderRadius: 16,
    flexDirection: "row",
    gap: SPACING.sm,
    overflow: "hidden",
    padding: SPACING.md,
  },
  kombinIcon: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  kombinCopy: { flex: 1, gap: 2 },
  kombinTitle: { color: COLORS.textInverse, fontFamily: FONTS.sansBold },
  kombinSubtitle: { color: "rgba(255,255,255,0.75)", fontFamily: FONTS.sansRegular, fontSize: FONT_SIZE.caption },
  kombinPhotos: { gap: 4 },
  kombinThumb: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
    height: 52,
    width: 36,
  },
  kombinArrow: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 999,
    height: 32,
    justifyContent: "center",
    width: 32,
  },

  // Skeleton
  skeletonGrid: { gap: 8, padding: SPACING.sm },
  skeletonRow: { flexDirection: "row", gap: 8 },
  skeletonItem: { flex: 1, gap: 4 },
  skeletonImg: {
    aspectRatio: 3 / 4,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 12,
    width: "100%",
  },
  skeletonLine: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 999,
    height: 8,
    width: "60%",
  },
});
