import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, FlatList, Share, StyleSheet, View } from "react-native";

import { PremiumGate } from "@/components/shared/PremiumGate";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CachedImage } from "@/components/ui/CachedImage";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { CATEGORIES } from "@/constants/categories";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useFriendWardrobe } from "@/hooks/useSocial";
import { useSubscription } from "@/hooks/useSubscription";
import { createPublicAppLink } from "@/lib/links";
import { getUuidParam } from "@/lib/routeParams";
import { formatDateOnly } from "@/utils/formatters";
import type { ClothingCategory, FriendWardrobe, LoanRequest, WardrobeItem } from "@/types";

type SharedCategoryFilter = ClothingCategory | "all";

export default function FriendWardrobeScreen() {
  const { userId: friendIdParam } = useLocalSearchParams<{ userId: string | string[] }>();
  const friendId = getUuidParam(friendIdParam);
  const { premium } = useSubscription();
  const { data, isLoading, isRefetching, error, refetch, loanRequests, requestBorrowItem, isRequestingBorrow } = useFriendWardrobe(friendId);
  const [category, setCategory] = useState<SharedCategoryFilter>("all");
  const [query, setQuery] = useState("");
  const [borrowDueDate, setBorrowDueDate] = useState(getDefaultBorrowDueDate());
  const [borrowNote, setBorrowNote] = useState("");
  const [friendOutfitIdea, setFriendOutfitIdea] = useState<FriendOutfitIdea | null>(null);
  const activeLoanByItemId = useMemo(() => {
    const entries = loanRequests
      .filter((request) => request.owner_id === friendId && (request.status === "pending" || request.status === "approved"))
      .map((request) => [request.item_id, request] as const);
    return new Map(entries);
  }, [friendId, loanRequests]);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleItems = data?.profile.privacy_settings.wardrobe_visible ? data.items : [];
  const filteredItems = visibleItems.filter((item) => {
    const categoryMatch = category === "all" || item.category === category;
    const queryMatch =
      !normalizedQuery ||
      [item.category, item.subcategory, item.brand, ...item.colors, ...item.season]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));

    return categoryMatch && queryMatch;
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} />
        <Text variant="h2">Arkadas Dolabi</Text>
        <View style={styles.headerSpacer} />
      </View>

      {!friendId ? (
        <EmptyState icon="alert-circle-outline" title="Arkadas linki gecersiz" body="Bu dolap linki eksik veya bozuk gorunuyor." style={styles.emptyState} />
      ) : !premium ? (
        <PremiumGate title="Arkadas dolabi Premium" body="Arkadaslarinin paylastigi parcalari gormek icin Premium gerekir." />
      ) : error ? (
        <EmptyState
          icon="lock-closed-outline"
          title="Dolap acilamadi"
          body="Arkadaslik onayi veya gizlilik izni gerekiyor olabilir."
          actionLabel="Tekrar Dene"
          loading={isRefetching}
          onAction={() => void refetch()}
          style={styles.emptyState}
        />
      ) : isLoading ? (
        <EmptyState icon="sync-outline" title="Dolap yukleniyor" body="Arkadas dolabi hazirlaniyor." style={styles.emptyState} />
      ) : data ? (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          numColumns={2}
          ListHeaderComponent={
            <SharedWardrobeHeader
              data={data}
              borrowDueDate={borrowDueDate}
              borrowNote={borrowNote}
              category={category}
              friendOutfitIdea={friendOutfitIdea}
              query={query}
              visibleCount={visibleItems.length}
              onBorrowDueDateChange={setBorrowDueDate}
              onBorrowNoteChange={setBorrowNote}
              onCategoryChange={setCategory}
              onGenerateOutfit={() => setFriendOutfitIdea(buildFriendOutfitIdea(visibleItems))}
              onQueryChange={setQuery}
            />
          }
          ListEmptyComponent={
            <EmptySharedWardrobe
              hasSharedItems={visibleItems.length > 0}
              onClearFilters={() => {
                setCategory("all");
                setQuery("");
              }}
            />
          }
          columnWrapperStyle={filteredItems.length > 0 ? styles.gridRow : undefined}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <SharedWardrobeItem
              item={item}
              loanRequest={activeLoanByItemId.get(item.id)}
              onBorrow={() => void handleBorrowRequest(item, requestBorrowItem, { dueDate: borrowDueDate, note: borrowNote })}
              loading={isRequestingBorrow}
            />
          )}
        />
      ) : null}
    </View>
  );
}

interface FriendOutfitIdea {
  name: string;
  items: WardrobeItem[];
  reason: string;
}

async function handleBorrowRequest(
  item: WardrobeItem,
  requestBorrowItem: (payload: { item: WardrobeItem; input?: { dueDate?: string | null; note?: string | null } }) => Promise<LoanRequest>,
  input: { dueDate: string; note: string },
) {
  if (!isValidBorrowDueDate(input.dueDate)) {
    Alert.alert("Tarih gecersiz", "Iade tarihi YYYY-MM-DD formatinda ve bugunden erken olmamali.");
    return;
  }

  try {
    await requestBorrowItem({ item, input: { dueDate: input.dueDate, note: input.note } });
    Alert.alert("Istek gonderildi", "Arkadasina odunc alma istegi bildirimi gonderildi.");
  } catch (error) {
    Alert.alert("Istek gonderilemedi", error instanceof Error ? error.message : "Tekrar dene.");
  }
}

async function handleAskFriendAboutOutfit(data: FriendWardrobe, idea: FriendOutfitIdea) {
  const friendName = data.profile.full_name ?? data.profile.username ?? "arkadasim";
  const itemLabels = idea.items.map(getItemLabel).join(", ");
  const link = createPublicAppLink(`/social/${data.profile.id}`);

  try {
    await Share.share({
      title: "Shipirio kombin fikri",
      message: `${friendName}, dolabindan bu kombini dusundum: ${itemLabels}. Sence olur mu? ${link}`,
      url: link,
    });
  } catch (error) {
    Alert.alert("Paylasilamadi", error instanceof Error ? error.message : "Tekrar dene.");
  }
}

function SharedWardrobeHeader({
  borrowDueDate,
  borrowNote,
  data,
  category,
  friendOutfitIdea,
  query,
  visibleCount,
  onCategoryChange,
  onBorrowDueDateChange,
  onBorrowNoteChange,
  onGenerateOutfit,
  onQueryChange,
}: {
  borrowDueDate: string;
  borrowNote: string;
  data: FriendWardrobe;
  category: SharedCategoryFilter;
  friendOutfitIdea: FriendOutfitIdea | null;
  query: string;
  visibleCount: number;
  onBorrowDueDateChange: (value: string) => void;
  onBorrowNoteChange: (value: string) => void;
  onCategoryChange: (value: SharedCategoryFilter) => void;
  onGenerateOutfit: () => void;
  onQueryChange: (value: string) => void;
}) {
  return (
    <View style={styles.listHeader}>
      <Card style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text variant="h2" color="inverse">
            {(data.profile.full_name?.[0] ?? data.profile.username?.[0] ?? "D").toUpperCase()}
          </Text>
        </View>
        <View style={styles.profileCopy}>
          <Text variant="h3">{data.profile.full_name ?? "Shipirio kullanicisi"}</Text>
          <Text variant="caption" color="muted">
            @{data.profile.username ?? "username-yok"}
          </Text>
          {data.profile.bio ? (
            <Text variant="body" color="secondary">
              {data.profile.bio}
            </Text>
          ) : null}
          <Text variant="body" color="secondary">
            {visibleCount} paylasilan kiyafet
          </Text>
        </View>
      </Card>

      <Card style={styles.outfitCard}>
        <View style={styles.outfitHeader}>
          <View style={styles.outfitCopy}>
            <Text variant="caption" color="muted">
              ARKADAS DOLABINDAN
            </Text>
            <Text variant="h3">{friendOutfitIdea?.name ?? "Kombin fikri iste"}</Text>
            <Text variant="body" color="secondary">
              {friendOutfitIdea?.reason ?? "Paylasilan parcalardan hizli bir kombin fikri hazirla."}
            </Text>
          </View>
          <Ionicons name="sparkles-outline" size={26} color={COLORS.primary} />
        </View>

        {friendOutfitIdea ? (
          <View style={styles.outfitPreview}>
            {friendOutfitIdea.items.map((item) => (
              <View key={item.id} style={styles.outfitPreviewItem}>
                <CachedImage
                  accessibilityLabel={getItemLabel(item)}
                  fallbackColor={item.dominant_color_hex}
                  sourceUri={item.thumbnail_url ?? item.image_url}
                  style={styles.outfitPreviewImage}
                />
                <Text variant="caption" color="secondary" style={styles.centerText}>
                  {getItemLabel(item)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.outfitActions}>
          <Button
            title={friendOutfitIdea ? "Baska Fikir" : "Kombin Fikri Uret"}
            variant="secondary"
            onPress={onGenerateOutfit}
            disabled={visibleCount < 2}
          />
          {friendOutfitIdea ? (
            <Button title="Arkadasa Sor" variant="ghost" onPress={() => void handleAskFriendAboutOutfit(data, friendOutfitIdea)} />
          ) : null}
        </View>
      </Card>

      <Card style={styles.borrowSettingsCard}>
        <Text variant="h3">Odunc istegi ayarlari</Text>
        <Input label="Iade tarihi" value={borrowDueDate} onChangeText={onBorrowDueDateChange} placeholder="YYYY-MM-DD" autoCapitalize="none" />
        <Input label="Not" value={borrowNote} onChangeText={onBorrowNoteChange} placeholder="Opsiyonel" multiline />
      </Card>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ label: "Tumu", value: "all" as const }, ...CATEGORIES]}
        keyExtractor={(item) => item.value}
        contentContainerStyle={styles.filters}
        renderItem={({ item }) => {
          const active = item.value === category;
          return (
            <Button
              title={item.label}
              variant={active ? "primary" : "secondary"}
              onPress={() => onCategoryChange(item.value === "all" ? "all" : (item.value as ClothingCategory))}
              style={styles.filterButton}
            />
          );
        }}
      />

      <Input label="Arkadas dolabinda ara" value={query} onChangeText={onQueryChange} placeholder="Marka, renk, sezon veya kategori" autoCapitalize="none" />
    </View>
  );
}

function buildFriendOutfitIdea(items: WardrobeItem[]): FriendOutfitIdea | null {
  const activeItems = items.filter((item) => item.is_active);
  if (activeItems.length < 2) {
    return null;
  }

  const top = findFirstByCategories(activeItems, ["ust", "elbise"]);
  const bottom = top?.category === "elbise" ? null : findFirstByCategories(activeItems, ["alt", "etek"]);
  const shoes = findFirstByCategories(activeItems, ["ayakkabi"]);
  const outer = findFirstByCategories(activeItems, ["dis_giyim"]);
  const accessory = findFirstByCategories(activeItems, ["aksesuar", "canta"]);
  const selected = uniqueItems([top, bottom, shoes, outer, accessory]).slice(0, 4);
  const fallback = activeItems.filter((item) => !selected.some((selectedItem) => selectedItem.id === item.id)).slice(0, 4 - selected.length);
  const outfitItems = [...selected, ...fallback];

  return {
    name: top?.category === "elbise" ? "Tek parcali net kombin" : "Uyumlu arkadas kombini",
    items: outfitItems,
    reason:
      outfitItems.length >= 3
        ? "Ust/alt veya ana parca, ayakkabi ve tamamlayici parcalari dengeli sectim."
        : "Arkadasinin paylastigi uygun parcalardan sade bir kombin cikardim.",
  };
}

function findFirstByCategories(items: WardrobeItem[], categories: ClothingCategory[]) {
  return items.find((item) => categories.includes(item.category));
}

function uniqueItems(items: Array<WardrobeItem | null | undefined>) {
  const seenIds = new Set<string>();

  return items.filter((item): item is WardrobeItem => {
    if (!item || seenIds.has(item.id)) {
      return false;
    }

    seenIds.add(item.id);
    return true;
  });
}

function getItemLabel(item: WardrobeItem) {
  const categoryLabel = CATEGORIES.find((category) => category.value === item.category)?.label ?? item.category;
  return item.subcategory ?? item.brand ?? categoryLabel;
}

function getDefaultBorrowDueDate() {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);
  return formatDateOnly(dueDate);
}

function isValidBorrowDueDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const timestamp = new Date(`${value}T00:00:00`).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Number.isFinite(timestamp) && timestamp >= today.getTime();
}

function SharedWardrobeItem({
  item,
  loanRequest,
  onBorrow,
  loading,
}: {
  item: WardrobeItem;
  loanRequest?: LoanRequest;
  onBorrow: () => void;
  loading: boolean;
}) {
  const borrowTitle = loanRequest ? (loanRequest.status === "approved" ? "Onaylandi" : "Istek Bekliyor") : "Odunc Iste";

  return (
    <View style={styles.itemPressable}>
      <Card style={styles.itemCard}>
        <CachedImage
          accessibilityLabel={getItemLabel(item)}
          fallbackColor={item.dominant_color_hex}
          sourceUri={item.thumbnail_url ?? item.image_url}
          style={styles.itemImage}
        />
        <Text variant="label">{getItemLabel(item)}</Text>
        <Text variant="caption" color="muted">
          {loanRequest
            ? loanRequest.status === "approved"
              ? "Arkadasin odunc istegini onayladi"
              : "Odunc istegin arkadasinda bekliyor"
            : item.is_lendable
              ? "Odunc alinabilir"
              : `${item.wear_count} kez giyildi`}
        </Text>
        {item.is_lendable ? <Button title={borrowTitle} variant="secondary" onPress={onBorrow} loading={loading} disabled={Boolean(loanRequest)} /> : null}
      </Card>
    </View>
  );
}

function EmptySharedWardrobe({ hasSharedItems, onClearFilters }: { hasSharedItems: boolean; onClearFilters: () => void }) {
  return (
    <EmptyState
      icon="shirt-outline"
      title={hasSharedItems ? "Aramana uyan kiyafet yok" : "Paylasilan kiyafet yok"}
      body={
        hasSharedItems
          ? "Farkli bir kategori veya arama dene."
          : "Arkadasin dolabini acmis olsa bile sadece paylasilabilir isaretlenen parcalar burada gorunur."
      }
      actionLabel={hasSharedItems ? "Filtreleri Temizle" : undefined}
      onAction={hasSharedItems ? onClearFilters : undefined}
      style={styles.emptyState}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    flex: 1,
    padding: SPACING.lg,
    paddingTop: 56,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
  },
  headerSpacer: {
    width: 72,
  },
  profileCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
  },
  listHeader: {
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  filters: {
    gap: SPACING.sm,
  },
  filterButton: {
    minHeight: 40,
    paddingHorizontal: SPACING.md,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  profileCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  outfitCard: {
    gap: SPACING.md,
  },
  outfitHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: SPACING.md,
    justifyContent: "space-between",
  },
  outfitCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  outfitPreview: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  outfitPreviewItem: {
    flex: 1,
    gap: SPACING.xs,
    minWidth: 0,
  },
  outfitPreviewImage: {
    aspectRatio: 4 / 5,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    width: "100%",
  },
  outfitActions: {
    gap: SPACING.sm,
  },
  borrowSettingsCard: {
    gap: SPACING.sm,
  },
  grid: {
    gap: SPACING.md,
    paddingBottom: 120,
  },
  gridRow: {
    gap: SPACING.md,
  },
  itemPressable: {
    flex: 1,
  },
  itemCard: {
    flex: 1,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    minHeight: 176,
  },
  itemImage: {
    aspectRatio: 4 / 5,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    width: "100%",
  },
  colorBlock: {
    borderRadius: 8,
    height: 104,
    width: "100%",
  },
  emptyState: {
    marginTop: SPACING.md,
  },
  centerText: {
    textAlign: "center",
  },
});
