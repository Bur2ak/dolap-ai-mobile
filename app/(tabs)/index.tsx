import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { FlashList } from "@shopify/flash-list";
import { Alert, Pressable, Share, StyleSheet, View } from "react-native";

import { AdBanner } from "@/components/shared/AdBanner";
import { AddItemSheet } from "@/components/wardrobe/AddItemSheet";
import { CategoryFilter } from "@/components/wardrobe/CategoryFilter";
import { SeasonFilter } from "@/components/wardrobe/SeasonFilter";
import { WardrobeItemCard } from "@/components/wardrobe/WardrobeItemCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { CATEGORIES } from "@/constants/categories";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useWardrobe } from "@/hooks/useWardrobe";
import { useImagePicker } from "@/hooks/useImagePicker";
import { captureEvent } from "@/lib/observability";
import { useSubscription } from "@/hooks/useSubscription";
import { useWardrobeStore } from "@/stores/wardrobeStore";
import type { ClothingCategory, Season, WardrobeItem } from "@/types";

const seasonFilters: Array<{ label: string; value: Season | "all" }> = [
  { label: "Tum sezonlar", value: "all" },
  { label: "Ilkbahar", value: "ilkbahar" },
  { label: "Yaz", value: "yaz" },
  { label: "Sonbahar", value: "sonbahar" },
  { label: "Kis", value: "kis" },
];
type SortMode = "newest" | "least_worn" | "most_worn";
const sortModes: Array<{ label: string; value: SortMode }> = [
  { label: "Yeni", value: "newest" },
  { label: "Az giyilen", value: "least_worn" },
  { label: "Cok giyilen", value: "most_worn" },
];

export default function WardrobeScreen() {
  const { items, error, isLoading, isRefetching, refetch } = useWardrobe();
  const { category, season, search, setCategory, setSeason, setSearch } = useWardrobeStore();
  const { premium } = useSubscription();
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [isSharingSummary, setIsSharingSummary] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const { takePhoto, pickFromLibrary } = useImagePicker();
  const normalizedQuery = search.trim().toLowerCase();
  const hasActiveFilters = category !== "all" || season !== "all" || Boolean(normalizedQuery);
  const isBusy = isLoading || isRefetching || isSharingSummary;
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
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortMode === "least_worn") {
      return a.wear_count - b.wear_count || newestFirst(a.created_at, b.created_at);
    }

    if (sortMode === "most_worn") {
      return b.wear_count - a.wear_count || newestFirst(a.created_at, b.created_at);
    }

    return newestFirst(a.created_at, b.created_at);
  });
  const unwornCount = items.filter((item) => item.wear_count === 0).length;
  const shareableCount = items.filter((item) => item.is_shareable).length;
  const metadataMissingCount = items.filter((item) => item.colors.length === 0 || item.season.length === 0 || !item.subcategory).length;

  useEffect(() => {
    captureEvent("wardrobe_screen_viewed", {
      item_count: items.length,
      filtered_count: sortedItems.length,
      has_active_filters: hasActiveFilters,
      sort_mode: sortMode,
    });
  }, [hasActiveFilters, items.length, sortMode, sortedItems.length]);

  function clearFilters(source: "summary" | "empty") {
    if (isBusy) {
      return;
    }

    setCategory("all");
    setSeason("all");
    setSearch("");
    captureEvent("wardrobe_filters_cleared", { source });
  }

  function openAddItem() {
    if (isBusy) {
      return;
    }
    captureEvent("wardrobe_add_item_sheet_opened");
    setSheetVisible(true);
  }

  async function handleCameraAdd() {
    const uri = await takePhoto();
    if (uri) {
      captureEvent("wardrobe_add_item_opened", { source: "camera" });
      router.push({ pathname: "/item/add", params: { imageUri: uri, source: "camera" } });
    }
  }

  async function handleLibraryAdd() {
    const uri = await pickFromLibrary();
    if (uri) {
      captureEvent("wardrobe_add_item_opened", { source: "library" });
      router.push({ pathname: "/item/add", params: { imageUri: uri, source: "library" } });
    }
  }

  async function handleShareWardrobeSummary() {
    if (isBusy) {
      return;
    }

    if (items.length === 0) {
      Alert.alert("Ozet hazir degil", "Dolap ozeti paylasmak icin once bir kiyafet ekleyelim.");
      return;
    }

    setIsSharingSummary(true);
    try {
      const result = await Share.share({
        title: "Shipirio dolap ozeti",
        message: buildWardrobeShareText({
          filteredCount: sortedItems.length,
          hasActiveFilters,
          items,
          metadataMissingCount,
          shareableCount,
          sortMode,
          unwornCount,
        }),
      });
      captureEvent("wardrobe_summary_shared", {
        action: result.action,
        completed: result.action === Share.sharedAction,
        filtered_count: sortedItems.length,
        item_count: items.length,
      });
    } catch (error) {
      captureEvent("wardrobe_summary_share_failed", { message: error instanceof Error ? error.message : "unknown" });
      Alert.alert("Ozet paylasilamadi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setIsSharingSummary(false);
    }
  }

  return (
    <View style={styles.container}>
      <AddItemSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onCamera={() => void handleCameraAdd()}
        onLibrary={() => void handleLibraryAdd()}
        disabled={isBusy}
      />
      <View style={styles.header}>
        <View>
          <Text variant="h1">Dolabim</Text>
          <Text variant="body" color="secondary">
            {items.length} kiyafet
          </Text>
        </View>
        <Pressable style={[styles.iconButton, isBusy ? styles.disabledAction : null]} onPress={openAddItem} disabled={isBusy}>
          <Ionicons name="add" size={28} color={COLORS.surface} />
        </Pressable>
      </View>

      <CategoryFilter
        value={category}
        onChange={(val) => {
          if (isBusy) {
            return;
          }
          setCategory(val);
          captureEvent("wardrobe_filter_changed", { filter: "category", value: val });
        }}
        disabled={isBusy}
      />

      <SeasonFilter
        value={season}
        onChange={(val) => {
          if (isBusy) {
            return;
          }
          setSeason(val);
          captureEvent("wardrobe_filter_changed", { filter: "season", value: val });
        }}
        disabled={isBusy}
      />

      <Input label="Dolapta ara" value={search} onChangeText={setSearch} placeholder="Marka, renk, sezon veya kategori" autoCapitalize="none" editable={!isBusy} />
      <View style={styles.sortSection}>
        <Text variant="caption" color="muted">
          Siralama
        </Text>
        <View style={styles.sortChips}>
          {sortModes.map((mode) => {
            const active = mode.value === sortMode;
            return (
              <Pressable
                key={mode.value}
                style={[styles.sortChip, active && styles.activeSortChip]}
                onPress={() => {
                  if (isBusy) {
                    return;
                  }

                  setSortMode(mode.value);
                  captureEvent("wardrobe_sort_changed", { sort_mode: mode.value });
                }}
                disabled={isBusy}
              >
                <Text variant="caption" color={active ? "inverse" : "secondary"}>
                  {mode.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {items.length > 0 ? (
        <View style={styles.summaryPanel}>
          <View style={styles.wardrobeSignals}>
            <SummaryPill label={`${unwornCount} giyilmemis`} tone={unwornCount > 0 ? "warning" : "normal"} />
            <SummaryPill label={`${shareableCount} paylasimda`} tone="normal" />
            <SummaryPill label={`${metadataMissingCount} eksik metadata`} tone={metadataMissingCount > 0 ? "warning" : "normal"} />
          </View>
          <Button
            title="Dolap Ozetini Paylas"
            variant="secondary"
            onPress={() => void handleShareWardrobeSummary()}
            loading={isSharingSummary}
            disabled={isBusy}
            style={styles.summaryShareButton}
          />
        </View>
      ) : null}
      {hasActiveFilters ? (
        <View style={styles.filterSummary}>
          <Text variant="caption" color="muted">
            {sortedItems.length}/{items.length} kiyafet gosteriliyor
          </Text>
          <Pressable
            onPress={() => {
              clearFilters("summary");
            }}
            disabled={isBusy}
          >
            <Text variant="caption" color="primary">
              Temizle
            </Text>
          </Pressable>
        </View>
      ) : null}

      {isLoading ? (
        <WardrobeSkeleton />
      ) : error && items.length === 0 ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Dolap yuklenemedi"
          body="Baglanti veya Supabase tarafinda gecici bir sorun olabilir."
          actionLabel="Tekrar Dene"
          loading={isRefetching}
          onAction={() => {
            captureEvent("wardrobe_refetch_requested");
            void refetch();
          }}
          style={styles.emptyState}
        />
      ) : sortedItems.length > 0 ? (
        <FlashList<WardrobeItem>
          data={sortedItems}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => <WardrobeItemCard item={item} disabled={isBusy} />}
          ListFooterComponent={!premium ? <AdBanner /> : null}
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
                  clearFilters("empty");
                }
              : openAddItem
          }
          style={styles.emptyState}
        />
      )}
    </View>
  );
}

function SignalPill({ label }: { label: string }) {
  return (
    <View style={styles.signalPill}>
      <Text variant="caption" color="primary">
        {label}
      </Text>
    </View>
  );
}

function SummaryPill({ label, tone }: { label: string; tone: "normal" | "warning" }) {
  return (
    <View style={[styles.summaryPill, tone === "warning" ? styles.summaryPillWarning : null]}>
      <Text variant="caption" color="secondary">
        {label}
      </Text>
    </View>
  );
}

function newestFirst(a: string, b: string) {
  return getSortableTime(b) - getSortableTime(a);
}

function getSortableTime(value: string) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function buildWardrobeShareText({
  filteredCount,
  hasActiveFilters,
  items,
  metadataMissingCount,
  shareableCount,
  sortMode,
  unwornCount,
}: {
  filteredCount: number;
  hasActiveFilters: boolean;
  items: WardrobeItem[];
  metadataMissingCount: number;
  shareableCount: number;
  sortMode: SortMode;
  unwornCount: number;
}) {
  const totalWearCount = items.reduce((sum, item) => sum + item.wear_count, 0);
  const topCategories = summarizeValues(items.map((item) => formatCategoryLabel(item.category)));
  const topColors = summarizeValues(items.flatMap((item) => item.colors));
  const topSeasons = summarizeValues(items.flatMap((item) => item.season.map(formatSeasonLabel)));
  const topBrands = summarizeValues(items.map((item) => item.brand).filter(isPresent));
  const activeFilterLine = hasActiveFilters ? `Aktif filtre sonucu: ${filteredCount}/${items.length} parca` : "Aktif filtre yok";

  return [
    "Shipirio dolap ozeti",
    "",
    `Toplam kiyafet: ${items.length}`,
    `Toplam giyilme: ${totalWearCount}`,
    `Hic giyilmemis: ${unwornCount}`,
    `Paylasima acik: ${shareableCount}`,
    `Metadata eksigi: ${metadataMissingCount}`,
    activeFilterLine,
    `Siralama: ${getSortLabel(sortMode)}`,
    "",
    `Kategori agirligi: ${topCategories}`,
    `Renk paleti: ${topColors}`,
    `Sezon kapsami: ${topSeasons}`,
    `Markalar: ${topBrands}`,
  ].join("\n");
}

function summarizeValues(values: string[]) {
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach((value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });

  const summary = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label, count]) => `${label} (${count})`)
    .join(", ");

  return summary || "Veri yok";
}

function formatCategoryLabel(value: ClothingCategory) {
  return CATEGORIES.find((category) => category.value === value)?.label ?? value;
}

function formatSeasonLabel(value: Season) {
  const labels: Record<Season, string> = {
    ilkbahar: "Ilkbahar",
    yaz: "Yaz",
    sonbahar: "Sonbahar",
    kis: "Kis",
  };

  return labels[value];
}

function getSortLabel(value: SortMode) {
  return sortModes.find((mode) => mode.value === value)?.label ?? value;
}

function isPresent(value: string | null): value is string {
  return Boolean(value);
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
  filterSummary: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: SPACING.sm,
  },
  sortSection: {
    gap: SPACING.xs,
    paddingBottom: SPACING.sm,
  },
  sortChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  sortChip: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  activeSortChip: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  summaryPanel: {
    gap: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  wardrobeSignals: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  summaryShareButton: {
    alignSelf: "flex-start",
    minHeight: 38,
    paddingHorizontal: SPACING.md,
  },
  summaryPill: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  summaryPillWarning: {
    backgroundColor: COLORS.warningSoft,
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
  disabledAction: {
    opacity: 0.52,
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
  itemSignals: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  signalPill: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
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
