import { router } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { PremiumGate } from "@/components/shared/PremiumGate";
import { CATEGORIES } from "@/constants/categories";
import { COLORS } from "@/constants/colors";
import { SEASONS } from "@/constants/seasons";
import { SPACING } from "@/constants/spacing";
import { usePriceTracking } from "@/hooks/usePriceTracking";
import { useSubscription } from "@/hooks/useSubscription";
import { useWardrobe } from "@/hooks/useWardrobe";
import { useWardrobeAnalytics } from "@/hooks/useWardrobeAnalytics";
import type { DistributionPoint, MissingWardrobePiece, StyleProfile, UpdateWardrobeItemInput, WardrobeGoal, WardrobeItem } from "@/types";
import { formatCurrency, formatNumber, getCostPerWearLabel } from "@/utils/formatters";

export default function AnalyticsScreen() {
  const { analytics, error, isLoading, isRefetching, refetch } = useWardrobeAnalytics();
  const { markWorn, updateItem, deleteItem, isUpdating } = useWardrobe();
  const { trackings, createTracking, isCreating: isCreatingTracking, canUse: canUsePriceTracking } = usePriceTracking();
  const { checkGate, isLimitReached, limits } = useSubscription();
  const hasBlockingError = Boolean(error && analytics.total_items === 0);
  const topCategory = analytics.category_distribution[0];
  const focusText =
    analytics.total_items === 0
      ? "Ilk parcalari ekledikce dolap dengesi burada netlesir."
      : analytics.inactive_items_count > analytics.total_items / 2
        ? "Dolabin yarisindan fazlasi 90 gundur giyilmemis gorunuyor."
        : analytics.utilization_score >= 70
          ? "Dolap kullanim orani iyi; favori parcalarini takip etmeye devam et."
          : "Kullanim orani yukselebilir; kombin onerileriyle atil parcalari deneyebilirsin.";
  const stats = [
    ["Toplam kiyafet", formatNumber(analytics.total_items)],
    ["Gardrop degeri", formatCurrency(analytics.total_value)],
    ["Ort. maliyet/giyim", formatCurrency(analytics.avg_cost_per_wear)],
    ["Bu ay harcama", formatCurrency(analytics.monthly_spending)],
    ["Kullanim skoru", `%${analytics.utilization_score}`],
    ["Surdurulebilirlik", `%${analytics.sustainability_score}`],
    ["90 gun atil", formatNumber(analytics.inactive_items_count)],
  ];

  async function handleAddMissingPiece(piece: MissingWardrobePiece) {
    if (!canUsePriceTracking) {
      Alert.alert("Giris gerekli", "Eksik parcayi alisveris listesine eklemek icin once giris yapmalisin.");
      return;
    }

    if (isLimitReached("PRICE_TRACKING_ITEMS", trackings.length)) {
      Alert.alert(
        "Takip limiti doldu",
        `Free planda ${formatLimit(limits.PRICE_TRACKING_ITEMS)} fiyat takibi ekleyebilirsin.`,
        [
          { text: "Vazgec", style: "cancel" },
          { text: "Premium'a Gec", onPress: () => router.push("/paywall") },
        ],
      );
      return;
    }

    const productName = `${piece.label} (${piece.suggested_colors.join(", ")})`;
    const alreadyExists = trackings.some((tracking) => tracking.product_name.toLocaleLowerCase("tr-TR") === productName.toLocaleLowerCase("tr-TR"));

    if (alreadyExists) {
      Alert.alert("Zaten listede", "Bu eksik parca fiyat takip listende gorunuyor.");
      return;
    }

    try {
      await createTracking({
        product_name: productName,
        store: "Shipirio alisveris listesi",
        product_url: null,
        current_price: null,
        target_price: null,
      });
      Alert.alert("Listeye eklendi", "Eksik parca fiyat takip listene eklendi.");
    } catch (error) {
      Alert.alert("Eklenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="h1">Analiz</Text>
      <Text variant="body" color="secondary">
        {isLoading ? "Gardrop verileri yukleniyor." : "Kullanim, harcama ve dolap dengesi."}
      </Text>

      {hasBlockingError ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Analiz yuklenemedi"
          body="Dolap verileri alinamadigi icin analiz olusturulamadi."
          actionLabel="Tekrar Dene"
          loading={isRefetching}
          onAction={() => void refetch()}
        />
      ) : (
        <>

      <Card style={styles.insightCard}>
        <Text variant="caption" color="muted">
          DOLAP OZETI
        </Text>
        <Text variant="h3">{focusText}</Text>
        <View style={styles.insightMetaRow}>
          <Text variant="caption" color="muted">
            EN YOGUN KATEGORI: {topCategory ? formatCategory(topCategory.label) : "YOK"}
          </Text>
          <Text variant="caption" color="muted">
            RENK SAYISI: {formatNumber(analytics.color_distribution.length)}
          </Text>
        </View>
      </Card>

      <View style={styles.grid}>
        {stats.map(([label, value]) => (
          <Card key={label} style={styles.stat}>
            <Text variant="caption" color="muted">
              {label}
            </Text>
            <Text variant="h2">{value}</Text>
          </Card>
        ))}
      </View>

      <DistributionCard title="Kategori dagilimi" points={analytics.category_distribution} />
      <DistributionCard title="Renk dagilimi" points={analytics.color_distribution} showSwatch />
      <DistributionCard title="Sezon dagilimi" points={analytics.season_distribution} />
      <DistributionCard title="Marka agirligi" points={analytics.brand_distribution} />
      <StyleProfileCard profile={analytics.style_profile} />
      <WeeklyGoalsCard goals={analytics.weekly_goals} />
      <SustainabilitySummaryCard score={analytics.sustainability_score} items={analytics.sustainability_focus_items} />
      <MissingPiecesCard pieces={analytics.missing_pieces} onAddToTracking={handleAddMissingPiece} isAdding={isCreatingTracking} />
      <ItemList title="En cok giyilenler" items={analytics.most_worn} empty="Henuz giyilme verisi yok." />
      <ItemList title="Hic giyilmeyenler" items={analytics.never_worn} empty="Harika, her sey kullanilmis gorunuyor." />
      {checkGate("ANALYTICS_FULL") ? (
        <>
          <ItemList title="Yuksek degerli atil parcalar" items={analytics.high_value_unused} empty="Yuksek degerli atil parca yok." />
          <DetoxItemList
            title="Dolap detoksu"
            items={analytics.suggestions_to_remove}
            empty="Simdilik aksiyon gerektiren parca yok."
            isUpdating={isUpdating}
            onMarkWorn={markWorn}
            onUpdateItem={updateItem}
            onDeleteItem={deleteItem}
          />
        </>
      ) : (
        <PremiumGate
          title="Gelismis analiz Premium"
          body="Sat veya bagisla onerileri, verimsiz parcalari ve dolap temizleme yardimi Premium ile acilir."
        />
      )}
        </>
      )}
    </ScrollView>
  );
}

function WeeklyGoalsCard({ goals }: { goals: WardrobeGoal[] }) {
  return (
    <Card style={styles.section}>
      <View style={styles.cardHeader}>
        <View>
          <Text variant="caption" color="muted">
            BU HAFTANIN HEDEFLERI
          </Text>
          <Text variant="h3">Dolabi aksiyona cevir</Text>
        </View>
      </View>
      {goals.length > 0 ? (
        goals.map((goal) => {
          const progress = goal.target > 0 ? Math.min((goal.current / goal.target) * 100, 100) : 0;

          return (
            <View key={goal.id} style={styles.goalRow}>
              <View style={[styles.priorityMarker, styles[`priorityMarker${goal.priority}`]]} />
              <View style={styles.goalCopy}>
                <View style={styles.goalTitleRow}>
                  <Text variant="label" style={styles.goalTitle}>
                    {goal.title}
                  </Text>
                  <Text variant="caption" color="muted">
                    {Math.min(goal.current, goal.target)}/{goal.target}
                  </Text>
                </View>
                <Text variant="body" color="secondary">
                  {goal.body}
                </Text>
                <View style={styles.goalTrack}>
                  <View style={[styles.goalFill, { width: `${progress}%` }]} />
                </View>
                <Button title={goal.action_label} variant="secondary" onPress={() => router.push(goal.action_route)} style={styles.goalAction} />
              </View>
            </View>
          );
        })
      ) : (
        <Text variant="body" color="secondary">
          Bu hafta icin acil hedef yok; dolap dengesi iyi gorunuyor.
        </Text>
      )}
    </Card>
  );
}

function SustainabilitySummaryCard({ score, items }: { score: number; items: WardrobeItem[] }) {
  const title =
    score >= 75
      ? "Dolap verimli kullaniliyor"
      : score >= 55
        ? "Dolap dengesi iyi"
        : score >= 35
          ? "Rotasyon artabilir"
          : "Atil parcalar yuksek";

  return (
    <Card style={styles.section}>
      <View style={styles.sustainabilityHeader}>
        <View style={styles.sustainabilityCopy}>
          <Text variant="caption" color="muted">
            SURDURULEBILIRLIK
          </Text>
          <Text variant="h3">{title}</Text>
          <Text variant="body" color="secondary">
            Skor, giyilme sayisi, son kullanim ve kullanim basi maliyeti birlikte okur.
          </Text>
        </View>
        <View style={styles.sustainabilityBadge}>
          <Text variant="label" color="inverse">
            %{score}
          </Text>
        </View>
      </View>
      <View style={styles.scoreTrack}>
        <View style={[styles.scoreFill, { width: `${score}%` }]} />
      </View>
      {items.length > 0 ? (
        <View style={styles.signalList}>
          <Text variant="label">Rotasyona alinabilecekler</Text>
          {items.map((item) => (
            <Pressable key={item.id} style={styles.itemRow} onPress={() => router.push(`/item/${item.id}`)}>
              <View style={[styles.itemDot, { backgroundColor: item.dominant_color_hex ?? COLORS.primarySoft }]} />
              <View style={styles.itemText}>
                <Text variant="label">{item.subcategory ?? formatCategory(item.category)}</Text>
                <Text variant="caption" color="muted">
                  {item.wear_count} giyim
                </Text>
              </View>
              <Text variant="caption" color="muted">
                {item.last_worn ? "Az kullanildi" : "Henuz giyilmedi"}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text variant="body" color="secondary">
          Harika, dolapta acil rotasyon isteyen parca gorunmuyor.
        </Text>
      )}
    </Card>
  );
}

function StyleProfileCard({ profile }: { profile: StyleProfile }) {
  return (
    <Card style={styles.section}>
      <View style={styles.profileHeader}>
        <View>
          <Text variant="caption" color="muted">
            STIL PROFILI
          </Text>
          <Text variant="h2">{profile.label}</Text>
        </View>
        <View style={styles.confidenceBadge}>
          <Text variant="label" color="inverse">
            %{profile.confidence}
          </Text>
        </View>
      </View>
      <Text variant="body" color="secondary">
        {profile.summary}
      </Text>
      <View style={styles.signalList}>
        {profile.signals.map((signal) => (
          <View key={signal} style={styles.signalRow}>
            <View style={styles.signalDot} />
            <Text variant="caption" color="muted" style={styles.signalText}>
              {signal}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function MissingPiecesCard({
  pieces,
  onAddToTracking,
  isAdding,
}: {
  pieces: MissingWardrobePiece[];
  onAddToTracking: (piece: MissingWardrobePiece) => Promise<void>;
  isAdding: boolean;
}) {
  return (
    <Card style={styles.section}>
      <Text variant="h3">Eksik parca analizi</Text>
      {pieces.length > 0 ? (
        pieces.map((piece) => (
          <View key={`${piece.category}-${piece.label}`} style={styles.missingRow}>
            <View style={[styles.priorityPill, styles[`priority${piece.priority}`]]}>
              <Text variant="caption" color="inverse">
                {formatPriority(piece.priority)}
              </Text>
            </View>
            <View style={styles.missingCopy}>
              <Text variant="label">{piece.label}</Text>
              <Text variant="body" color="secondary">
                {piece.reason}
              </Text>
              <Text variant="caption" color="muted">
                Renk onerisi: {piece.suggested_colors.join(", ")}
              </Text>
              <Button
                title="Alisveris Listesine Ekle"
                variant="secondary"
                onPress={() => void onAddToTracking(piece)}
                loading={isAdding}
                style={styles.missingAction}
              />
            </View>
          </View>
        ))
      ) : (
        <Text variant="body" color="secondary">
          Dolabin temel kategorilerde dengeli gorunuyor.
        </Text>
      )}
    </Card>
  );
}

function DetoxItemList({
  title,
  items,
  empty,
  isUpdating,
  onMarkWorn,
  onUpdateItem,
  onDeleteItem,
}: {
  title: string;
  items: WardrobeItem[];
  empty: string;
  isUpdating: boolean;
  onMarkWorn: (item: WardrobeItem) => Promise<WardrobeItem>;
  onUpdateItem: (params: { itemId: string; input: UpdateWardrobeItemInput }) => Promise<WardrobeItem>;
  onDeleteItem: (itemId: string) => Promise<void>;
}) {
  async function handleMarkWorn(item: WardrobeItem) {
    try {
      await onMarkWorn(item);
      Alert.alert("Kaydedildi", "Parca bugun giyildi olarak islendi.");
    } catch (error) {
      Alert.alert("Guncellenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  async function handleLendable(item: WardrobeItem) {
    try {
      await onUpdateItem({ itemId: item.id, input: { is_lendable: true } });
      Alert.alert("Guncellendi", "Parca odunc verilebilir olarak isaretlendi.");
    } catch (error) {
      Alert.alert("Guncellenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  function handleListingDraft(item: WardrobeItem) {
    const title = [item.brand, item.subcategory ?? formatCategory(item.category), item.colors[0]].filter(Boolean).join(" ");
    const priceHint = item.purchase_price ? Math.max(Math.round(item.purchase_price * 0.45), 50) : null;

    Alert.alert(
      "Satis taslagi",
      [
        `Baslik: ${title}`,
        `Aciklama: Temiz kullanildi. ${item.season.length ? `${item.season.join(", ")} sezonu icin uygun.` : "Dolaptan cikarma parcasi."}`,
        priceHint ? `Fiyat onerisi: ${formatCurrency(priceHint)} civariyla baslayabilirsin.` : "Fiyat onerisi icin alis fiyati ekleyebilirsin.",
      ].join("\n\n"),
    );
  }

  function handleDelete(item: WardrobeItem) {
    Alert.alert("Parcayi sil", "Bu parca dolabindan kaldirilacak.", [
      { text: "Vazgec", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          try {
            await onDeleteItem(item.id);
          } catch (error) {
            Alert.alert("Silinemedi", error instanceof Error ? error.message : "Tekrar dene.");
          }
        },
      },
    ]);
  }

  return (
    <Card style={styles.section}>
      <Text variant="h3">{title}</Text>
      <Text variant="body" color="secondary">
        Uzun suredir kullanilmayan parcalar icin hizli aksiyon sec.
      </Text>
      {items.length > 0 ? (
        items.map((item) => (
          <View key={item.id} style={styles.detoxItem}>
            <Pressable style={styles.itemRow} onPress={() => router.push(`/item/${item.id}`)}>
              <View style={[styles.itemDot, { backgroundColor: item.dominant_color_hex ?? COLORS.primarySoft }]} />
              <View style={styles.itemText}>
                <Text variant="label">{item.subcategory ?? item.category}</Text>
                <Text variant="caption" color="muted">
                  {item.wear_count} giyim
                </Text>
              </View>
              <Text variant="caption" color="muted">
                {item.purchase_price ? formatCurrency(item.purchase_price) : ""}
              </Text>
            </Pressable>
            <View style={styles.detoxActions}>
              <Button title="Giydim" variant="secondary" onPress={() => void handleMarkWorn(item)} loading={isUpdating} style={styles.detoxButton} />
              <Button title="Odunc" variant="secondary" onPress={() => void handleLendable(item)} loading={isUpdating} style={styles.detoxButton} />
              <Button title="Satis" variant="ghost" onPress={() => handleListingDraft(item)} style={styles.detoxButton} />
              <Button title="Sil" variant="ghost" onPress={() => handleDelete(item)} loading={isUpdating} style={styles.detoxButton} />
            </View>
          </View>
        ))
      ) : (
        <Text variant="body" color="secondary">
          {empty}
        </Text>
      )}
    </Card>
  );
}

function formatCategory(value: string) {
  return CATEGORIES.find((category) => category.value === value)?.label ?? value.replace("_", " ");
}

function formatPriority(value: MissingWardrobePiece["priority"]) {
  if (value === "high") {
    return "Yuksek";
  }

  if (value === "medium") {
    return "Orta";
  }

  return "Dusuk";
}

function formatLimit(value: number | boolean) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "sinirsiz";
}

function formatDistributionLabel(value: string) {
  return SEASONS.find((season) => season.value === value)?.label ?? formatCategory(value);
}

function DistributionCard({ title, points, showSwatch = false }: { title: string; points: DistributionPoint[]; showSwatch?: boolean }) {
  const max = Math.max(...points.map((point) => point.value), 1);

  return (
    <Card style={styles.section}>
      <Text variant="h3">{title}</Text>
      {points.length > 0 ? (
        points.map((point) => (
          <View key={point.label} style={styles.barRow}>
            {showSwatch ? <View style={[styles.swatch, { backgroundColor: point.color ?? COLORS.primarySoft }]} /> : null}
            <Text variant="label" style={styles.barLabel}>
              {formatDistributionLabel(point.label)}
            </Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${Math.max((point.value / max) * 100, 8)}%` }]} />
            </View>
            <Text variant="caption" color="muted">
              {point.value}
            </Text>
          </View>
        ))
      ) : (
        <Text variant="body" color="secondary">
          Veri yok.
        </Text>
      )}
    </Card>
  );
}

function ItemList({ title, items, empty }: { title: string; items: WardrobeItem[]; empty: string }) {
  return (
    <Card style={styles.section}>
      <Text variant="h3">{title}</Text>
      {items.length > 0 ? (
        items.map((item) => {
          const costPerWear = getCostPerWearLabel(item.purchase_price, item.wear_count);

          return (
            <Pressable key={item.id} style={styles.itemRow} onPress={() => router.push(`/item/${item.id}`)}>
              <View style={[styles.itemDot, { backgroundColor: item.dominant_color_hex ?? COLORS.primarySoft }]} />
              <View style={styles.itemText}>
                <Text variant="label">{item.subcategory ?? item.category}</Text>
                <Text variant="caption" color="muted">
                  {item.wear_count} giyim
                </Text>
              </View>
              <View style={styles.costText}>
                <Text variant="caption" color="muted">
                  {item.purchase_price ? formatCurrency(item.purchase_price) : ""}
                </Text>
                <Text variant="caption" color="muted">
                  {costPerWear.value}
                </Text>
              </View>
            </Pressable>
          );
        })
      ) : (
        <Text variant="body" color="secondary">
          {empty}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    gap: SPACING.md,
    padding: SPACING.lg,
    paddingTop: 64,
    paddingBottom: 120,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
  },
  stat: {
    minHeight: 112,
    width: "47%",
  },
  section: {
    gap: SPACING.md,
  },
  insightCard: {
    gap: SPACING.sm,
  },
  insightMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  barRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  swatch: {
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 18,
    width: 18,
  },
  barLabel: {
    width: 88,
  },
  barTrack: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 999,
    flex: 1,
    height: 10,
    overflow: "hidden",
  },
  barFill: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: "100%",
  },
  itemRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  itemDot: {
    borderRadius: 999,
    height: 28,
    width: 28,
  },
  itemText: {
    flex: 1,
  },
  costText: {
    alignItems: "flex-end",
    gap: 2,
  },
  profileHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
    justifyContent: "space-between",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  goalRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  priorityMarker: {
    borderRadius: 999,
    height: 12,
    marginTop: 5,
    width: 12,
  },
  priorityMarkerhigh: {
    backgroundColor: COLORS.danger,
  },
  priorityMarkermedium: {
    backgroundColor: COLORS.warning,
  },
  priorityMarkerlow: {
    backgroundColor: COLORS.primary,
  },
  goalCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  goalTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
    justifyContent: "space-between",
  },
  goalTitle: {
    flex: 1,
  },
  goalTrack: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 999,
    height: 8,
    overflow: "hidden",
  },
  goalFill: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: "100%",
  },
  goalAction: {
    alignSelf: "flex-start",
    minHeight: 38,
    paddingHorizontal: SPACING.md,
  },
  sustainabilityHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
    justifyContent: "space-between",
  },
  sustainabilityCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  sustainabilityBadge: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: 56,
    justifyContent: "center",
    width: 56,
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
  confidenceBadge: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  signalList: {
    gap: SPACING.xs,
  },
  signalRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.xs,
  },
  signalDot: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  signalText: {
    flex: 1,
  },
  missingRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  missingCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  missingAction: {
    alignSelf: "flex-start",
    minHeight: 38,
    paddingHorizontal: SPACING.md,
  },
  priorityPill: {
    alignItems: "center",
    borderRadius: 999,
    minWidth: 56,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  priorityhigh: {
    backgroundColor: COLORS.danger,
  },
  prioritymedium: {
    backgroundColor: COLORS.warning,
  },
  prioritylow: {
    backgroundColor: COLORS.primary,
  },
  detoxItem: {
    gap: SPACING.sm,
  },
  detoxActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  detoxButton: {
    flex: 1,
    minHeight: 38,
    minWidth: 78,
    paddingHorizontal: SPACING.sm,
  },
});
