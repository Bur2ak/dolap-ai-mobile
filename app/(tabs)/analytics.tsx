import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";

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
import { captureError, captureEvent } from "@/lib/observability";
import type { DistributionPoint, MissingWardrobePiece, StyleProfile, UpdateWardrobeItemInput, WardrobeGoal, WardrobeItem } from "@/types";
import { formatCurrency, formatNumber, getCostPerWearLabel } from "@/utils/formatters";
import { buildBudgetRecommendations, buildMissingPieceActionPlan, buildSecondHandListingAdvice, buildShoppingSearchTargets } from "@/utils/shoppingAdvisor";

export default function AnalyticsScreen() {
  const { analytics, error, isLoading, isRefetching, refetch } = useWardrobeAnalytics();
  const { markWorn, updateItem, deleteItem, isUpdating } = useWardrobe();
  const { trackings, createTracking, isCreating: isCreatingTracking, canUse: canUsePriceTracking } = usePriceTracking();
  const { checkGate, isLimitReached, limits } = useSubscription();
  const [activeMissingPieceKey, setActiveMissingPieceKey] = useState<string | null>(null);
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

  useEffect(() => {
    captureEvent("analytics_screen_viewed", {
      total_items: analytics.total_items,
      utilization_score: analytics.utilization_score,
      sustainability_score: analytics.sustainability_score,
      has_blocking_error: hasBlockingError,
    });
  }, [analytics.sustainability_score, analytics.total_items, analytics.utilization_score, hasBlockingError]);

  function handleRefetch() {
    if (activeMissingPieceKey || isCreatingTracking || isUpdating) {
      captureEvent("analytics_refetch_blocked", { reason: "busy", has_blocking_error: hasBlockingError });
      return;
    }

    captureEvent("analytics_refetch_requested", { has_blocking_error: hasBlockingError });
    void refetch();
  }

  async function handleAddMissingPiece(piece: MissingWardrobePiece) {
    const pieceKey = getMissingPieceKey(piece);
    if (activeMissingPieceKey || isCreatingTracking) {
      captureEvent("analytics_missing_piece_track_blocked", { reason: "busy", category: piece.category, priority: piece.priority });
      return;
    }

    if (!canUsePriceTracking) {
      captureEvent("analytics_missing_piece_track_blocked", { reason: "auth", category: piece.category, priority: piece.priority });
      Alert.alert("Giris gerekli", "Eksik parcayi alisveris listesine eklemek icin once giris yapmalisin.");
      return;
    }

    if (isLimitReached("PRICE_TRACKING_ITEMS", trackings.length)) {
      captureEvent("analytics_missing_piece_track_blocked", { reason: "limit", category: piece.category, priority: piece.priority });
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
      captureEvent("analytics_missing_piece_track_blocked", { reason: "duplicate", category: piece.category, priority: piece.priority });
      Alert.alert("Zaten listede", "Bu eksik parca fiyat takip listende gorunuyor.");
      return;
    }

    setActiveMissingPieceKey(pieceKey);
    try {
      await createTracking({
        product_name: productName,
        store: "Shipirio alisveris listesi",
        product_url: null,
        current_price: null,
        target_price: null,
      });
      captureEvent("analytics_missing_piece_tracked", {
        category: piece.category,
        priority: piece.priority,
      });
      Alert.alert("Listeye eklendi", "Eksik parca fiyat takip listene eklendi.");
    } catch (error) {
      captureError(error, { area: "analytics_missing_piece_track", category: piece.category, priority: piece.priority });
      Alert.alert("Eklenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setActiveMissingPieceKey(null);
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
          onAction={handleRefetch}
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
      <DistributionCard title="Kumas dagilimi" points={analytics.fabric_distribution} />
      <DistributionCard title="Kullanim alani" points={analytics.usage_context_distribution} />
      <StyleProfileCard profile={analytics.style_profile} />
      <WeeklyGoalsCard goals={analytics.weekly_goals} />
      <SustainabilitySummaryCard score={analytics.sustainability_score} items={analytics.sustainability_focus_items} />
      <MissingPiecesCard
        pieces={analytics.missing_pieces}
        onAddToTracking={handleAddMissingPiece}
        isAdding={isCreatingTracking}
        activePieceKey={activeMissingPieceKey}
      />
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
                <Button
                  title={goal.action_label}
                  variant="secondary"
                  onPress={() => {
                    captureEvent("analytics_weekly_goal_opened", { goal_id: goal.id, priority: goal.priority, action_route: goal.action_route });
                    router.push(goal.action_route);
                  }}
                  style={styles.goalAction}
                />
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
            <Pressable
              key={item.id}
              style={styles.itemRow}
              onPress={() => {
                captureEvent("analytics_sustainability_item_opened", { item_id: item.id });
                router.push(`/item/${item.id}`);
              }}
            >
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
  activePieceKey,
}: {
  pieces: MissingWardrobePiece[];
  onAddToTracking: (piece: MissingWardrobePiece) => Promise<void>;
  isAdding: boolean;
  activePieceKey: string | null;
}) {
  return (
    <Card style={styles.section}>
      <Text variant="h3">Eksik parca analizi</Text>
      {pieces.length > 0 ? (
        pieces.map((piece) => {
          const pieceKey = getMissingPieceKey(piece);
          const isActive = activePieceKey === pieceKey;

          return (
            <View key={pieceKey} style={styles.missingRow}>
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
                <View style={styles.budgetGuide}>
                  {buildBudgetRecommendations(piece).map((recommendation) => (
                    <View key={recommendation.label} style={styles.budgetCard}>
                      <Text variant="caption" color="muted">
                        {recommendation.label}
                      </Text>
                      <Text variant="label">{recommendation.range}</Text>
                      <Text variant="caption" color="secondary">
                        {recommendation.note}
                      </Text>
                    </View>
                  ))}
                </View>
                <View style={styles.saleTargets}>
                  {buildShoppingSearchTargets(getMissingPieceSearchQuery(piece)).map((target) => (
                    <Pressable
                      key={target.label}
                      accessibilityRole="button"
                      style={styles.saleChip}
                      onPress={() => {
                        captureEvent("analytics_missing_piece_market_search_opened", {
                          category: piece.category,
                          monetization: target.monetization,
                          priority: piece.priority,
                          target: target.label,
                        });
                        void openMarketSearch(target.url);
                      }}
                      disabled={Boolean(activePieceKey) || isAdding}
                    >
                      <Text variant="caption" color="secondary">
                        {target.label}
                      </Text>
                      <Text variant="caption" color="muted">
                        {target.placement_label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.actionPlan}>
                  <Text variant="caption" color="muted">
                    EKSIK PARCA ICIN YOLLAR
                  </Text>
                  {buildMissingPieceActionPlan(piece).map((action) => (
                    <View key={action.kind} style={styles.actionPlanRow}>
                      <Text variant="label">{action.label}</Text>
                      <Text variant="caption" color="muted">
                        {action.note}
                      </Text>
                    </View>
                  ))}
                </View>
                <View style={styles.missingActions}>
                  <Button
                    title="Arkadas Dolabina Bak"
                    variant="ghost"
                    onPress={() => {
                      captureEvent("analytics_missing_piece_friend_route_opened", {
                        category: piece.category,
                        priority: piece.priority,
                      });
                      router.push("/social/friends");
                    }}
                    disabled={Boolean(activePieceKey) || isAdding}
                    style={styles.missingAction}
                  />
                  <Button
                    title="Alternatif Kombin Dene"
                    variant="ghost"
                    onPress={() => {
                      captureEvent("analytics_missing_piece_outfit_route_opened", {
                        category: piece.category,
                        priority: piece.priority,
                      });
                      router.push("/(tabs)/outfit");
                    }}
                    disabled={Boolean(activePieceKey) || isAdding}
                    style={styles.missingAction}
                  />
                </View>
                <Button
                  title="Alisveris Listesine Ekle"
                  variant="secondary"
                  onPress={() => void onAddToTracking(piece)}
                  loading={isActive}
                  disabled={Boolean(activePieceKey) || isAdding}
                  style={styles.missingAction}
                />
              </View>
            </View>
          );
        })
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
  const [activeAction, setActiveAction] = useState<{ itemId: string; action: "worn" | "lendable" | "delete" } | null>(null);

  async function handleMarkWorn(item: WardrobeItem) {
    if (activeAction || isUpdating) {
      captureEvent("analytics_detox_action_blocked", { action: "worn", item_id: item.id, reason: "busy" });
      return;
    }

    setActiveAction({ itemId: item.id, action: "worn" });
    try {
      await onMarkWorn(item);
      captureEvent("analytics_detox_mark_worn", { item_id: item.id, wear_count: item.wear_count });
      Alert.alert("Kaydedildi", "Parca bugun giyildi olarak islendi.");
    } catch (error) {
      captureError(error, { area: "analytics_detox_mark_worn", item_id: item.id });
      Alert.alert("Guncellenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setActiveAction(null);
    }
  }

  async function handleLendable(item: WardrobeItem) {
    if (activeAction || isUpdating) {
      captureEvent("analytics_detox_action_blocked", { action: "lendable", item_id: item.id, reason: "busy" });
      return;
    }

    setActiveAction({ itemId: item.id, action: "lendable" });
    try {
      await onUpdateItem({ itemId: item.id, input: { is_lendable: true, is_shareable: true } });
      captureEvent("analytics_detox_lendable_enabled", { item_id: item.id });
      Alert.alert("Guncellendi", "Parca odunc verilebilir olarak isaretlendi.");
    } catch (error) {
      captureError(error, { area: "analytics_detox_lendable", item_id: item.id });
      Alert.alert("Guncellenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setActiveAction(null);
    }
  }

  function handleListingDraft(item: WardrobeItem) {
    if (activeAction || isUpdating) {
      captureEvent("analytics_detox_action_blocked", { action: "listing", item_id: item.id, reason: "busy" });
      return;
    }

    const advice = buildSecondHandListingAdvice(item);
    captureEvent("analytics_detox_listing_draft_opened", { item_id: item.id, has_price_hint: Boolean(advice.price_low) });

    Alert.alert(
      "Satis taslagi",
      [
        `Baslik: ${advice.title}`,
        `Aciklama: ${advice.description}`,
        advice.price_low && advice.price_high
          ? `Fiyat araligi: ${formatCurrency(advice.price_low)} - ${formatCurrency(advice.price_high)}`
          : "Fiyat araligi icin alis fiyati ekleyebilirsin.",
      ].join("\n\n"),
    );
  }

  function handleDelete(item: WardrobeItem) {
    if (activeAction || isUpdating) {
      captureEvent("analytics_detox_action_blocked", { action: "delete", item_id: item.id, reason: "busy" });
      return;
    }

    captureEvent("analytics_detox_delete_prompt_opened", { item_id: item.id });
    Alert.alert("Parcayi sil", "Bu parca dolabindan kaldirilacak.", [
      { text: "Vazgec", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          setActiveAction({ itemId: item.id, action: "delete" });
          try {
            await onDeleteItem(item.id);
            captureEvent("analytics_detox_item_deleted", { item_id: item.id });
          } catch (error) {
            captureError(error, { area: "analytics_detox_delete", item_id: item.id });
            Alert.alert("Silinemedi", error instanceof Error ? error.message : "Tekrar dene.");
          } finally {
            setActiveAction(null);
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
        items.map((item) => {
          const listingAdvice = buildSecondHandListingAdvice(item);

          return (
            <View key={item.id} style={styles.detoxItem}>
              <Pressable
                style={styles.itemRow}
                onPress={() => {
                  if (activeAction || isUpdating) {
                    captureEvent("analytics_detox_item_open_blocked", { item_id: item.id, reason: "busy" });
                    return;
                  }

                  captureEvent("analytics_detox_item_opened", { item_id: item.id });
                  router.push(`/item/${item.id}`);
                }}
                disabled={Boolean(activeAction) || isUpdating}
              >
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
                <Button
                  title="Giydim"
                  variant="secondary"
                  onPress={() => void handleMarkWorn(item)}
                  loading={activeAction?.itemId === item.id && activeAction.action === "worn"}
                  disabled={Boolean(activeAction) || isUpdating}
                  style={styles.detoxButton}
                />
                <Button
                  title="Odunc"
                  variant="secondary"
                  onPress={() => void handleLendable(item)}
                  loading={activeAction?.itemId === item.id && activeAction.action === "lendable"}
                  disabled={Boolean(activeAction) || isUpdating}
                  style={styles.detoxButton}
                />
                <Button title="Satis" variant="ghost" onPress={() => handleListingDraft(item)} disabled={Boolean(activeAction) || isUpdating} style={styles.detoxButton} />
                <Button
                  title="Sil"
                  variant="ghost"
                  onPress={() => handleDelete(item)}
                  loading={activeAction?.itemId === item.id && activeAction.action === "delete"}
                  disabled={Boolean(activeAction) || isUpdating}
                  style={styles.detoxButton}
                />
              </View>
              <View style={styles.saleGuide}>
                <View style={styles.saleGuideHeader}>
                  <Text variant="caption" color="muted">
                    IKINCI EL HAZIRLIK
                  </Text>
                  <Text variant="caption" color="muted">
                    {listingAdvice.price_low && listingAdvice.price_high
                      ? `${formatCurrency(listingAdvice.price_low)}-${formatCurrency(listingAdvice.price_high)}`
                      : "Fiyat icin alis tutari ekle"}
                  </Text>
                </View>
                <Text variant="caption" color="muted">
                  {listingAdvice.description}
                </Text>
                <Text variant="caption" color="secondary">
                  Baslik: {listingAdvice.title}
                </Text>
                <View style={styles.saleTargets}>
                  {listingAdvice.platform_notes.map((target) => (
                    <Pressable
                      key={target.label}
                      style={styles.saleChip}
                      onPress={() => {
                        if (activeAction || isUpdating) {
                          captureEvent("analytics_detox_market_search_blocked", { item_id: item.id, reason: "busy", target: target.label });
                          return;
                        }

                        captureEvent("analytics_detox_market_search_opened", { item_id: item.id, monetization: target.monetization, target: target.label });
                        void openMarketSearch(target.url);
                      }}
                      disabled={Boolean(activeAction) || isUpdating}
                    >
                      <Text variant="caption" color="secondary">
                        {target.label}
                      </Text>
                      <Text variant="caption" color="muted">
                        {target.placement_label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
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

function getMissingPieceKey(piece: MissingWardrobePiece) {
  return `${piece.category}-${piece.label}-${piece.priority}`;
}

function getMissingPieceSearchQuery(piece: MissingWardrobePiece) {
  return [piece.suggested_colors[0], piece.label, formatCategory(piece.category)].filter(Boolean).join(" ");
}

async function openMarketSearch(url: string) {
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert("Link acilamadi", "Benzer ilan aramasi bu cihazda acilamadi.");
      return;
    }

    await Linking.openURL(url);
  } catch (error) {
    captureError(error, { area: "analytics_detox_market_search_open" });
    Alert.alert("Link acilamadi", "Benzer ilan aramasi acilamadi.");
  }
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
            <Pressable
              key={item.id}
              style={styles.itemRow}
              onPress={() => {
                captureEvent("analytics_item_list_item_opened", { item_id: item.id, list_title: title });
                router.push(`/item/${item.id}`);
              }}
            >
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
  missingActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  missingAction: {
    alignSelf: "flex-start",
    minHeight: 38,
    paddingHorizontal: SPACING.md,
  },
  budgetGuide: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  budgetCard: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    flexGrow: 1,
    flexShrink: 1,
    gap: 2,
    minWidth: 128,
    padding: SPACING.sm,
  },
  actionPlan: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    gap: SPACING.xs,
    padding: SPACING.sm,
  },
  actionPlanRow: {
    gap: 2,
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
  saleGuide: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    gap: SPACING.xs,
    padding: SPACING.sm,
  },
  saleGuideHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  saleTargets: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  saleChip: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
});
