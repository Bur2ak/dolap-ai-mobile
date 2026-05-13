import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { CachedImage } from "@/components/ui/CachedImage";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { CATEGORIES } from "@/constants/categories";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useWardrobe } from "@/hooks/useWardrobe";
import { captureEvent } from "@/lib/observability";
import { useWardrobeStore } from "@/stores/wardrobeStore";
import type { ClothingCategory, Season } from "@/types";

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
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const normalizedQuery = search.trim().toLowerCase();
  const hasActiveFilters = category !== "all" || season !== "all" || Boolean(normalizedQuery);
  const isBusy = isLoading || isRefetching;
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
      captureEvent("wardrobe_filters_clear_blocked", { reason: "busy", source });
      return;
    }

    setCategory("all");
    setSeason("all");
    setSearch("");
    captureEvent("wardrobe_filters_cleared", { source });
  }

  function openAddItem() {
    if (isBusy) {
      captureEvent("wardrobe_add_item_blocked", { reason: "busy" });
      return;
    }

    captureEvent("wardrobe_add_item_opened");
    router.push("/item/add");
  }

  return (
    <View style={styles.container}>
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
              onPress={() => {
                if (isBusy) {
                  captureEvent("wardrobe_filter_blocked", { filter: "category", reason: "busy", value: item.value });
                  return;
                }

                setCategory(item.value === "all" ? "all" : (item.value as ClothingCategory));
                captureEvent("wardrobe_filter_changed", { filter: "category", value: item.value });
              }}
              disabled={isBusy}
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
            <Pressable
              style={[styles.seasonChip, active && styles.activeSeasonChip]}
              onPress={() => {
                if (isBusy) {
                  captureEvent("wardrobe_filter_blocked", { filter: "season", reason: "busy", value: item.value });
                  return;
                }

                setSeason(item.value);
                captureEvent("wardrobe_filter_changed", { filter: "season", value: item.value });
              }}
              disabled={isBusy}
            >
              <Text variant="caption" color={active ? "inverse" : "secondary"}>
                {item.label}
              </Text>
            </Pressable>
          );
        }}
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
                    captureEvent("wardrobe_sort_blocked", { reason: "busy", sort_mode: mode.value });
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
        <View style={styles.wardrobeSignals}>
          <SummaryPill label={`${unwornCount} giyilmemis`} tone={unwornCount > 0 ? "warning" : "normal"} />
          <SummaryPill label={`${shareableCount} paylasimda`} tone="normal" />
          <SummaryPill label={`${metadataMissingCount} eksik metadata`} tone={metadataMissingCount > 0 ? "warning" : "normal"} />
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
        <FlatList
          data={sortedItems}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <Pressable
              style={styles.itemPressable}
              onPress={() => {
                if (isBusy) {
                  captureEvent("wardrobe_item_open_blocked", { item_id: item.id, reason: "busy" });
                  return;
                }

                captureEvent("wardrobe_item_opened", { item_id: item.id, category: item.category });
                router.push(`/item/${item.id}`);
              }}
              disabled={isBusy}
            >
              <Card style={styles.itemCard}>
                <CachedImage
                  accessibilityLabel={item.subcategory ?? item.category}
                  fallbackColor={item.dominant_color_hex}
                  sourceUri={item.thumbnail_url ?? item.image_url}
                  style={styles.itemImage}
                />
                <Text variant="label">{item.subcategory ?? item.category}</Text>
                <Text variant="caption" color="muted">
                  {item.wear_count} kez giyildi
                </Text>
                <Text variant="caption" color="secondary">
                  {[item.brand, item.colors[0], item.season[0]].filter(Boolean).join(" - ") || "Metadata bekliyor"}
                </Text>
                <View style={styles.itemSignals}>
                  {item.is_shareable ? <SignalPill label="Paylasim" /> : null}
                  {item.is_lendable ? <SignalPill label="Odunc" /> : null}
                </View>
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
  wardrobeSignals: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
    paddingBottom: SPACING.sm,
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
