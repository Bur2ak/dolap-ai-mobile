import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CachedImage } from "@/components/ui/CachedImage";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { CATEGORIES } from "@/constants/categories";
import { COLORS } from "@/constants/colors";
import { SEASONS } from "@/constants/seasons";
import { SPACING } from "@/constants/spacing";
import { useWardrobeItem } from "@/hooks/useWardrobe";
import { captureError, captureEvent } from "@/lib/observability";
import { getUuidParam } from "@/lib/routeParams";
import type { CareRecommendation, ClothingCategory, Season, SustainabilityInsight } from "@/types";
import { getCareRecommendations } from "@/utils/care";
import { getCostPerWearLabel, getCurrencyInputError, parseCurrencyInput } from "@/utils/formatters";
import { getSustainabilityInsight } from "@/utils/sustainability";
import { getColorListInputError, getSubcategoryInputError, getWardrobeMetadataInputError, parseColorList } from "@/utils/wardrobeValidation";

export default function ItemDetailScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string | string[] }>();
  const id = getUuidParam(idParam);
  const { item, error, isLoading, isRefetching, refetch, updateItem, markWorn, deleteItem, isUpdating } = useWardrobeItem(id);
  const [isEditing, setIsEditing] = useState(false);
  const [category, setCategory] = useState<ClothingCategory>("ust");
  const [subcategory, setSubcategory] = useState("");
  const [colors, setColors] = useState("");
  const [brand, setBrand] = useState("");
  const [price, setPrice] = useState("");
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [activeAction, setActiveAction] = useState<"save" | "worn" | "shareable" | "lendable" | "delete" | null>(null);
  const isBusy = isUpdating;
  const isActionBusy = Boolean(activeAction) || isBusy;

  const categoryLabel = CATEGORIES.find((category) => category.value === item?.category)?.label ?? item?.category;

  useEffect(() => {
    if (!item) {
      return;
    }

    setCategory(item.category);
    setSubcategory(item.subcategory ?? "");
    setColors(item.colors.join(", "));
    setBrand(item.brand ?? "");
    setPrice(item.purchase_price ? String(item.purchase_price) : "");
    setSeasons(item.season);
  }, [item]);

  const costPerWear = item ? getCostPerWearLabel(item.purchase_price, item.wear_count) : null;
  const careRecommendations = item ? getCareRecommendations(item) : [];
  const sustainabilityInsight = item ? getSustainabilityInsight(item) : null;

  useEffect(() => {
    captureEvent("wardrobe_item_detail_viewed", {
      item_id: id ?? "invalid",
      loaded: Boolean(item),
      category: item?.category ?? "unknown",
    });
  }, [id, item]);

  function toggleSeason(season: Season) {
    if (isActionBusy) {
      captureEvent("wardrobe_item_detail_season_blocked", { reason: "busy", season });
      return;
    }

    setSeasons((current) => (current.includes(season) ? current.filter((item) => item !== season) : [...current, season]));
  }

  async function handleSaveEdits() {
    if (!item || isActionBusy) {
      captureEvent("wardrobe_item_detail_save_blocked", { item_id: item?.id ?? "missing", reason: isActionBusy ? "busy" : "missing_item" });
      return;
    }

    const metadataError = getWardrobeMetadataInputError({
      colorsText: colors,
      price,
      seasons,
      subcategory,
    });
    if (metadataError) {
      captureEvent("wardrobe_item_detail_save_blocked", { reason: "metadata", item_id: item.id });
      Alert.alert(metadataError.title, metadataError.message);
      return;
    }

    setActiveAction("save");
    try {
      const purchasePrice = parseCurrencyInput(price);

      await updateItem({
        brand: brand.trim() || null,
        category,
        colors: parseColorList(colors),
        purchase_price: purchasePrice,
        season: seasons,
        subcategory: subcategory.trim(),
      });
      setIsEditing(false);
      captureEvent("wardrobe_item_detail_saved", {
        category,
        season_count: seasons.length,
      });
      Alert.alert("Kaydedildi", "Kiyafet bilgileri guncellendi.");
    } catch (error) {
      captureError(error, { area: "wardrobe_item_detail_save", category });
      Alert.alert("Kaydedilemedi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setActiveAction(null);
    }
  }

  async function handleMarkWorn() {
    if (!item || isActionBusy) {
      captureEvent("wardrobe_item_detail_mark_worn_blocked", { item_id: item?.id ?? "missing", reason: isActionBusy ? "busy" : "missing_item" });
      return;
    }

    setActiveAction("worn");
    try {
      await markWorn(item);
      captureEvent("wardrobe_item_detail_mark_worn", { item_id: item.id, category: item.category });
    } catch (error) {
      captureError(error, { area: "wardrobe_item_detail_mark_worn_action" });
      Alert.alert("Guncellenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setActiveAction(null);
    }
  }

  async function handleShareableToggle() {
    if (!item || isActionBusy) {
      captureEvent("wardrobe_item_shareable_toggle_blocked", { item_id: item?.id ?? "missing", reason: isActionBusy ? "busy" : "missing_item" });
      return;
    }

    setActiveAction("shareable");
    try {
      await updateItem(item.is_shareable ? { is_shareable: false, is_lendable: false } : { is_shareable: true });
      captureEvent("wardrobe_item_shareable_toggled", { enabled: !item.is_shareable });
    } catch (error) {
      captureError(error, { area: "wardrobe_item_shareable_toggle" });
      Alert.alert("Guncellenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setActiveAction(null);
    }
  }

  async function handleLendableToggle() {
    if (!item || isActionBusy) {
      captureEvent("wardrobe_item_lendable_toggle_blocked", { item_id: item?.id ?? "missing", reason: isActionBusy ? "busy" : "missing_item" });
      return;
    }

    setActiveAction("lendable");
    try {
      await updateItem(item.is_lendable ? { is_lendable: false } : { is_lendable: true, is_shareable: true });
      captureEvent("wardrobe_item_lendable_toggled", { enabled: !item.is_lendable });
    } catch (error) {
      captureError(error, { area: "wardrobe_item_lendable_toggle" });
      Alert.alert("Guncellenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setActiveAction(null);
    }
  }

  function handleDelete() {
    if (!item || isActionBusy) {
      captureEvent("wardrobe_item_detail_delete_blocked", { item_id: item?.id ?? "missing", reason: isActionBusy ? "busy" : "missing_item" });
      return;
    }

    captureEvent("wardrobe_item_detail_delete_prompt_opened", { item_id: item.id });
    Alert.alert("Kiyafeti sil", "Bu kiyafet dolabindan kaldirilacak.", [
      { text: "Vazgec", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          if (isActionBusy) {
            captureEvent("wardrobe_item_detail_delete_blocked", { item_id: item.id, reason: "busy_after_confirm" });
            return;
          }

          setActiveAction("delete");
          try {
            await deleteItem();
            captureEvent("wardrobe_item_detail_deleted", { item_id: item.id });
            router.replace("/(tabs)");
          } catch (error) {
            captureError(error, { area: "wardrobe_item_detail_delete_action" });
            Alert.alert("Silinemedi", error instanceof Error ? error.message : "Tekrar dene.");
          } finally {
            setActiveAction(null);
          }
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} disabled={isActionBusy} />
        <Text variant="h2">Kiyafet Detay</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <EmptyState icon="sync-outline" title="Kiyafet yukleniyor" body="Kiyafet detaylari hazirlaniyor." />
      ) : error ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Kiyafet yuklenemedi"
          body="Baglanti veya izin tarafinda gecici bir sorun olabilir."
          actionLabel="Tekrar Dene"
          loading={isRefetching}
          onAction={() => {
            if (isActionBusy) {
              captureEvent("wardrobe_item_detail_refetch_blocked", { item_id: id ?? "invalid", reason: "busy" });
              return;
            }

            captureEvent("wardrobe_item_detail_refetch_requested", { item_id: id ?? "invalid" });
            void refetch();
          }}
        />
      ) : item ? (
        <>
          <CachedImage
            accessibilityLabel={item.subcategory ?? "Kiyafet"}
            fallbackColor={item.dominant_color_hex}
            sourceUri={item.image_url}
            style={styles.heroImage}
          />

          <Card style={styles.summary}>
            <Text variant="caption" color="muted">
              {categoryLabel}
            </Text>
            <Text variant="h1">{item.subcategory ?? "Kiyafet"}</Text>
            <Text variant="body" color="secondary">
              {item.brand ? `${item.brand} markasi` : "Marka bilgisi eklenmemis"}
            </Text>
            <Button
              title={isEditing ? "Duzenlemeyi Kapat" : "Bilgileri Duzenle"}
              variant="secondary"
              onPress={() => {
                if (isActionBusy) {
                  captureEvent("wardrobe_item_detail_edit_blocked", { item_id: item.id, reason: "busy" });
                  return;
                }

                setIsEditing((value) => {
                  const nextValue = !value;
                  captureEvent("wardrobe_item_detail_edit_toggled", { enabled: nextValue });
                  return nextValue;
                });
              }}
              disabled={isActionBusy}
            />
          </Card>

          {isEditing ? (
            <Card style={styles.editCard}>
              <Text variant="h3">Bilgileri duzenle</Text>

              <Text variant="label">Kategori</Text>
              <View style={styles.wrap}>
                {CATEGORIES.map((itemCategory) => {
                  const active = itemCategory.value === category;
                  return (
                    <Button
                      key={itemCategory.value}
                      title={itemCategory.label}
                      variant={active ? "primary" : "secondary"}
                      onPress={() => {
                        if (isActionBusy) {
                          captureEvent("wardrobe_item_detail_category_blocked", { category: itemCategory.value, item_id: item.id, reason: "busy" });
                          return;
                        }

                        captureEvent("wardrobe_item_detail_category_selected", { category: itemCategory.value });
                        setCategory(itemCategory.value);
                      }}
                      disabled={isActionBusy}
                      style={styles.chipButton}
                    />
                  );
                })}
              </View>

              <Text variant="label">Sezon</Text>
              <View style={styles.wrap}>
                {SEASONS.map((season) => {
                  const active = seasons.includes(season.value);
                  return (
                    <Button
                      key={season.value}
                      title={season.label}
                      variant={active ? "primary" : "secondary"}
                      onPress={() => toggleSeason(season.value)}
                      disabled={isActionBusy}
                      style={styles.chipButton}
                    />
                  );
                })}
              </View>

              <Input label="Alt kategori" value={subcategory} onChangeText={setSubcategory} error={getSubcategoryInputError(subcategory)} editable={!isActionBusy} />
              <Input label="Renkler" value={colors} onChangeText={setColors} error={getColorListInputError(colors)} editable={!isActionBusy} />
              <Input label="Marka" value={brand} onChangeText={setBrand} editable={!isActionBusy} />
              <Input label="Fiyat" value={price} onChangeText={setPrice} keyboardType="decimal-pad" error={getCurrencyInputError(price)} editable={!isActionBusy} />
              <Button title="Degisiklikleri Kaydet" onPress={handleSaveEdits} loading={activeAction === "save"} disabled={isActionBusy} />
            </Card>
          ) : null}

          <View style={styles.stats}>
            <Card style={styles.statCard}>
              <Text variant="caption" color="muted">
                Giyilme
              </Text>
              <Text variant="h2">{item.wear_count}</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text variant="caption" color="muted">
                Son giyilme
              </Text>
              <Text variant="h3">{item.last_worn ?? "Yok"}</Text>
            </Card>
          </View>

          <Card style={styles.costCard}>
            <View style={styles.costHeader}>
              <View>
                <Text variant="caption" color="muted">
                  Kullanim basi maliyet
                </Text>
                <Text variant="h2">{costPerWear?.value}</Text>
              </View>
              <Ionicons name="calculator-outline" size={28} color={COLORS.primary} />
            </View>
            <Text variant="body" color="secondary">
              {costPerWear?.helper}
            </Text>
          </Card>

          <Card style={styles.meta}>
            <Text variant="h3">Metadata</Text>
            <Text variant="body" color="secondary">
              Renkler: {item.colors.length > 0 ? item.colors.join(", ") : "Yok"}
            </Text>
            <Text variant="body" color="secondary">
              Sezon: {item.season.length > 0 ? item.season.join(", ") : "Yok"}
            </Text>
            <Text variant="body" color="secondary">
              Fiyat: {item.purchase_price ? `${item.purchase_price} TL` : "Yok"}
            </Text>
          </Card>

          <CareCard recommendations={careRecommendations} />

          <SustainabilityCard insight={sustainabilityInsight} />

          <Card style={styles.meta}>
            <Text variant="h3">Paylasim</Text>
            <View style={styles.statusPills}>
              <StatusPill label="Paylasim" enabled={item.is_shareable} />
              <StatusPill label="Odunc" enabled={item.is_lendable} />
            </View>
            <Text variant="body" color="secondary">
              Arkadas dolabinda gorunme: {item.is_shareable ? "Acik" : "Kapali"}
            </Text>
            <Text variant="body" color="secondary">
              Odunc verilebilir: {item.is_lendable ? "Evet" : "Hayir"}
            </Text>
            <Text variant="caption" color="muted">
              Odunc verilebilir acilinca parca arkadas dolabinda da gorunur.
            </Text>
            <View style={styles.inlineActions}>
              <Button
                title={item.is_shareable ? "Paylasimi Kapat" : "Paylas"}
                variant="secondary"
                onPress={() => void handleShareableToggle()}
                loading={activeAction === "shareable"}
                disabled={isActionBusy}
              />
              <Button
                title={item.is_lendable ? "Odunc Kapat" : "Odunc Verilebilir"}
                variant="ghost"
                onPress={() => void handleLendableToggle()}
                loading={activeAction === "lendable"}
                disabled={isActionBusy}
              />
            </View>
          </Card>

          <View style={styles.actions}>
            <Button title="Bugun Giydim" onPress={handleMarkWorn} loading={activeAction === "worn"} disabled={isActionBusy} />
            <Button title="Sil" variant="secondary" onPress={handleDelete} loading={activeAction === "delete"} disabled={isActionBusy} />
          </View>
        </>
      ) : (
        <EmptyState icon="shirt-outline" title="Kiyafet bulunamadi" body="Silinmis olabilir veya dolabina ait olmayabilir." />
      )}
    </ScrollView>
  );
}

function StatusPill({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <View style={[styles.statusPill, enabled ? styles.statusPillActive : styles.statusPillMuted]}>
      <Text variant="caption" color={enabled ? "inverse" : "secondary"}>
        {label}: {enabled ? "Acik" : "Kapali"}
      </Text>
    </View>
  );
}

function CareCard({ recommendations }: { recommendations: CareRecommendation[] }) {
  return (
    <Card style={styles.meta}>
      <View style={styles.careHeader}>
        <Text variant="h3">Bakim onerileri</Text>
        <Ionicons name="sparkles-outline" size={22} color={COLORS.primary} />
      </View>
      {recommendations.map((recommendation) => (
        <View key={recommendation.title} style={styles.careRow}>
          <View style={[styles.careDot, recommendation.priority === "important" && styles.careDotImportant]} />
          <View style={styles.careCopy}>
            <Text variant="label">{recommendation.title}</Text>
            <Text variant="body" color="secondary">
              {recommendation.body}
            </Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

function SustainabilityCard({ insight }: { insight: SustainabilityInsight | null }) {
  if (!insight) {
    return null;
  }

  return (
    <Card style={styles.meta}>
      <View style={styles.sustainabilityHeader}>
        <View>
          <Text variant="caption" color="muted">
            Surdurulebilirlik skoru
          </Text>
          <Text variant="h3">{insight.title}</Text>
        </View>
        <View style={[styles.scoreBadge, getScoreBadgeStyle(insight.status)]}>
          <Text variant="label">{insight.score}</Text>
        </View>
      </View>
      <View style={styles.scoreTrack}>
        <View style={[styles.scoreFill, { width: `${insight.score}%` }]} />
      </View>
      <Text variant="body" color="secondary">
        {insight.body}
      </Text>
      <View style={styles.signalWrap}>
        {insight.signals.map((signal) => (
          <View key={signal} style={styles.signalPill}>
            <Text variant="caption" color="secondary">
              {signal}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function getScoreBadgeStyle(status: SustainabilityInsight["status"]) {
  if (status === "excellent" || status === "good") {
    return styles.scoreBadgeGood;
  }

  if (status === "needs_use") {
    return styles.scoreBadgeWarning;
  }

  return styles.scoreBadgeRisk;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  content: {
    gap: SPACING.md,
    padding: SPACING.lg,
    paddingTop: 56,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerSpacer: {
    width: 72,
  },
  heroImage: {
    aspectRatio: 4 / 5,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    width: "100%",
  },
  summary: {
    gap: SPACING.xs,
  },
  editCard: {
    gap: SPACING.md,
  },
  stats: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
    gap: SPACING.xs,
  },
  costCard: {
    gap: SPACING.sm,
  },
  costHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  meta: {
    gap: SPACING.sm,
  },
  careHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  careRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  careDot: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: 10,
    marginTop: 6,
    width: 10,
  },
  careDotImportant: {
    backgroundColor: COLORS.warning,
  },
  careCopy: {
    flex: 1,
    gap: 2,
  },
  sustainabilityHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  scoreBadge: {
    alignItems: "center",
    borderRadius: 999,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  scoreBadgeGood: {
    backgroundColor: COLORS.primarySoft,
  },
  scoreBadgeWarning: {
    backgroundColor: "#F7E6C8",
  },
  scoreBadgeRisk: {
    backgroundColor: "#F5D3D0",
  },
  scoreTrack: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 999,
    height: 8,
    overflow: "hidden",
  },
  scoreFill: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: "100%",
  },
  signalWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  signalPill: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  actions: {
    gap: SPACING.sm,
    paddingBottom: SPACING.xl,
  },
  inlineActions: {
    gap: SPACING.sm,
  },
  statusPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  statusPillActive: {
    backgroundColor: COLORS.primary,
  },
  statusPillMuted: {
    backgroundColor: COLORS.surfaceMuted,
  },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  chipButton: {
    minHeight: 40,
    paddingHorizontal: SPACING.md,
  },
});
