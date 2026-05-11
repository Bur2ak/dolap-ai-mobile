import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CachedImage } from "@/components/ui/CachedImage";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useBuyDecision } from "@/hooks/useBuyDecision";
import { useImagePicker } from "@/hooks/useImagePicker";
import { useSubscription } from "@/hooks/useSubscription";
import { useWardrobe } from "@/hooks/useWardrobe";
import { captureError, captureEvent } from "@/lib/observability";
import { getMonthlyBuyDecisionCount, incrementMonthlyBuyDecisionCount } from "@/lib/usageLimits";
import type { BuyDecisionRecord, WardrobeItem } from "@/types";
import { getCurrencyInputError, parseCurrencyInput } from "@/utils/formatters";
import { optimizeImage } from "@/utils/imageUtils";
import { buildSimilarWardrobeSummary } from "@/utils/similarWardrobe";

function formatDecisionDate(value: string) {
  return new Date(value).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function BuyDecisionScreen() {
  const { items } = useWardrobe();
  const { pickFromLibrary, takePhoto, isPicking } = useImagePicker();
  const {
    userId,
    decide,
    result,
    isDeciding,
    saveResult,
    deleteDecision,
    isSaving,
    canSave,
    history,
    historyError,
    isLoadingHistory,
    isRefetchingHistory,
    refetchHistory,
  } = useBuyDecision();
  const { premium, limits, isLimitReached } = useSubscription();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [monthlyUsage, setMonthlyUsage] = useState<number | null>(null);
  const [activeImageSource, setActiveImageSource] = useState<"camera" | "library" | null>(null);
  const [activeDeleteId, setActiveDeleteId] = useState<string | null>(null);
  const isBusy = isPicking || isDeciding || isSaving;
  const isActionBusy = isBusy || Boolean(activeImageSource) || Boolean(activeDeleteId);

  useEffect(() => {
    captureEvent("buy_decision_screen_viewed", {
      history_count: history.length,
      has_image: Boolean(imageUri),
      has_result: Boolean(result),
      monthly_usage: monthlyUsage,
      premium,
      wardrobe_count: items.length,
    });
  }, [history.length, imageUri, items.length, monthlyUsage, premium, result]);

  async function handleImageSelected(uri: string | null) {
    if (!uri) {
      captureEvent("buy_decision_image_selection_cancelled");
      return;
    }

    try {
      setImageUri(await optimizeImage(uri));
      captureEvent("buy_decision_image_selected");
    } catch (error) {
      captureError(error, { area: "buy_decision_image_prepare" });
      Alert.alert("Gorsel hazirlanamadi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  function resetDraft() {
    if (isActionBusy) {
      return;
    }

    setImageUri(null);
    setPrice("");
    captureEvent("buy_decision_draft_reset");
  }

  async function handleAnalyze() {
    if (isActionBusy) {
      return;
    }

    if (!imageUri) {
      captureEvent("buy_decision_analyze_blocked", { reason: "missing_image" });
      Alert.alert("Fotograf gerekli", "Karar motoru icin once fotograf secmelisin.");
      return;
    }

    if (!userId) {
      captureEvent("buy_decision_analyze_blocked", { reason: "auth" });
      Alert.alert("Giris gerekli", "Karar motorunu kullanmak icin once giris yapmalisin.");
      return;
    }

    const priceError = getCurrencyInputError(price);
    if (priceError) {
      captureEvent("buy_decision_analyze_blocked", { reason: "price" });
      Alert.alert("Fiyat gecersiz", priceError);
      return;
    }

    try {
      if (!premium) {
        const currentUsage = await getMonthlyBuyDecisionCount(userId);
        setMonthlyUsage(currentUsage);
        if (isLimitReached("BUY_DECISIONS_PER_MONTH", currentUsage)) {
          captureEvent("buy_decision_analyze_blocked", { reason: "monthly_limit", usage: currentUsage });
          Alert.alert(
            "Aylik limit doldu",
            `Free planda ayda ${formatLimit(limits.BUY_DECISIONS_PER_MONTH)} karar analizi kullanabilirsin.`,
            [
              { text: "Vazgec", style: "cancel" },
              { text: "Premium'a Gec", onPress: () => router.push("/paywall") },
            ],
          );
          return;
        }
      }

      const numericPrice = parseCurrencyInput(price);

      await decide({
        imageUri,
        price: numericPrice,
        wardrobe: items,
      });
      if (!premium) {
        const nextUsage = await incrementMonthlyBuyDecisionCount(userId);
        setMonthlyUsage(nextUsage);
      }
    } catch (error) {
      captureError(error, { area: "buy_decision_analyze_action", has_price: Boolean(price.trim()) });
      Alert.alert("Analiz edilemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  async function handleSave() {
    if (isActionBusy) {
      return;
    }

    if (!result) {
      captureEvent("buy_decision_save_blocked", { reason: "missing_result" });
      return;
    }

    if (!canSave) {
      captureEvent("buy_decision_save_blocked", { reason: "auth" });
      Alert.alert("Giris gerekli", "Karari kaydetmek icin once giris yapmalisin.");
      return;
    }

    const priceError = getCurrencyInputError(price);
    if (priceError) {
      captureEvent("buy_decision_save_blocked", { reason: "price" });
      Alert.alert("Fiyat gecersiz", priceError);
      return;
    }

    try {
      await saveResult({ result, imageUri, price: parseCurrencyInput(price) });
      captureEvent("buy_decision_saved_from_screen", { decision: result.decision });
      Alert.alert("Kaydedildi", "Karar gecmisine eklendi.");
    } catch (error) {
      captureError(error, { area: "buy_decision_save_action", decision: result.decision });
      Alert.alert("Kaydedilemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} disabled={isActionBusy} />
        <Text variant="h2">Almali Miyim?</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Card style={styles.selectCard}>
        {imageUri ? (
          <CachedImage accessibilityLabel="Almayi dusundugun parca" sourceUri={imageUri} style={styles.preview} />
        ) : (
          <>
            <Ionicons name="bag-handle-outline" size={48} color={COLORS.primary} />
            <Text variant="h3" style={styles.centerText}>
              Almayi dusundugun parcayi ekle
            </Text>
            <Text variant="body" color="secondary" style={styles.centerText}>
              AI dolabindaki benzerleri, kombin potansiyelini ve fiyat mantigini yorumlayacak.
            </Text>
          </>
        )}

        <View style={styles.actions}>
          <Button
            title="Kamera"
            onPress={async () => {
              captureEvent("buy_decision_image_source_selected", { source: "camera" });
              setActiveImageSource("camera");
              try {
                await handleImageSelected(await takePhoto());
              } finally {
                setActiveImageSource(null);
              }
            }}
            loading={activeImageSource === "camera"}
            disabled={isActionBusy}
          />
          <Button
            title="Galeriden Sec"
            variant="secondary"
            onPress={async () => {
              captureEvent("buy_decision_image_source_selected", { source: "library" });
              setActiveImageSource("library");
              try {
                await handleImageSelected(await pickFromLibrary());
              } finally {
                setActiveImageSource(null);
              }
            }}
            loading={activeImageSource === "library"}
            disabled={isActionBusy}
          />
          {imageUri ? <Button title="Secimi Temizle" variant="ghost" onPress={resetDraft} disabled={isActionBusy} /> : null}
        </View>
      </Card>

      {!premium ? (
        <Card style={styles.limitCard}>
          <Text variant="caption" color="muted">
            FREE LIMIT
          </Text>
          <Text variant="body" color="secondary">
            Aylik karar hakki: {monthlyUsage ?? 0}/{formatLimit(limits.BUY_DECISIONS_PER_MONTH)}
          </Text>
        </Card>
      ) : null}

      <Input label="Fiyat" value={price} onChangeText={setPrice} keyboardType="decimal-pad" error={getCurrencyInputError(price)} />
      <Button title="Analiz Et" onPress={handleAnalyze} loading={isDeciding} disabled={!imageUri || isActionBusy} />

      {result ? (
        <Card style={styles.resultCard}>
          {(() => {
            const similarSummary = buildSimilarWardrobeSummary(result.similar_items_in_wardrobe, items);

            return (
              <View style={styles.similarSection}>
                <Text variant="h3">{similarSummary.title}</Text>
                <Text variant="body" color="secondary">
                  {similarSummary.body}
                </Text>
                {similarSummary.matches.length > 0 ? (
                  <View style={styles.similarGrid}>
                    {similarSummary.matches.map((match) => (
                      <View key={match.item.id} style={styles.similarItem}>
                        <CachedImage
                          accessibilityLabel={match.item.subcategory ?? match.item.category}
                          fallbackColor={match.item.dominant_color_hex}
                          sourceUri={match.item.thumbnail_url ?? match.item.image_url}
                          style={styles.similarImage}
                        />
                        <Text variant="caption" color="secondary" numberOfLines={1} style={styles.similarLabel}>
                          {match.item.subcategory ?? match.item.category}
                        </Text>
                        <Text variant="caption" color="muted" style={styles.similarLabel}>
                          %{match.score}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {similarSummary.matches[0]?.reasons.length ? (
                  <View style={styles.reasonPills}>
                    {similarSummary.matches[0].reasons.slice(0, 3).map((reason) => (
                      <View key={reason} style={styles.reasonPill}>
                        <Text variant="caption" color="secondary">
                          {reason}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })()}
          <View style={[styles.decisionBadge, styles[`decision${result.decision}`]]}>
            <Text variant="h2" color="inverse">
              {result.decision}
            </Text>
          </View>
          <Text variant="caption" color="muted">
            Guven: %{Math.round(result.confidence * 100)}
          </Text>
          <Text variant="h3">{result.main_reason}</Text>
          <Text variant="body" color="secondary">
            {result.details}
          </Text>
          <Text variant="body" color="secondary">
            {result.combination_count} farkli kombin potansiyeli
          </Text>
          <Text variant="body" color="secondary">
            {result.cost_per_wear_suggestion}
          </Text>
          {result.discount_advice ? (
            <Text variant="body" color="secondary">
              {result.discount_advice}
            </Text>
          ) : null}
          <Button title="Karari Kaydet" variant="secondary" onPress={handleSave} loading={isSaving} disabled={isActionBusy} />
        </Card>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text variant="h3">Karar gecmisi</Text>
        <Text variant="caption" color="muted">
          SON 20
        </Text>
      </View>

      {isLoadingHistory ? (
        <EmptyState icon="sync-outline" title="Gecmis yukleniyor" body="Karar gecmisin hazirlaniyor." />
      ) : historyError ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Gecmis yuklenemedi"
          body="Baglanti veya Supabase tarafinda gecici bir sorun olabilir."
          actionLabel="Tekrar Dene"
          loading={isRefetchingHistory}
          onAction={() => {
            captureEvent("buy_decision_history_refetch_requested");
            void refetchHistory();
          }}
        />
      ) : history.length ? (
        history.map((decision) => (
          <DecisionHistoryCard
            key={decision.id}
            decision={decision}
            onDelete={deleteDecision}
            activeDeleteId={activeDeleteId}
            isBusy={isActionBusy}
            setActiveDeleteId={setActiveDeleteId}
          />
        ))
      ) : (
        <EmptyState icon="bag-handle-outline" title="Kayitli karar yok" body="Analiz sonucunu kaydettiginde burada gorunecek." />
      )}
    </ScrollView>
  );
}

function DecisionHistoryCard({
  decision,
  onDelete,
  activeDeleteId,
  isBusy,
  setActiveDeleteId,
}: {
  decision: BuyDecisionRecord;
  onDelete: (decisionId: string) => Promise<void>;
  activeDeleteId: string | null;
  isBusy: boolean;
  setActiveDeleteId: (decisionId: string | null) => void;
}) {
  const isDeletingThis = activeDeleteId === decision.id;

  function handleDelete() {
    if (isBusy) {
      return;
    }

    captureEvent("buy_decision_delete_prompt_opened", { decision_id: decision.id, decision: decision.decision });
    Alert.alert("Karari sil", "Bu karar gecmisinden kaldirilacak.", [
      { text: "Vazgec", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          setActiveDeleteId(decision.id);
          try {
            await onDelete(decision.id);
            captureEvent("buy_decision_deleted_from_screen", { decision: decision.decision });
          } catch (error) {
            captureError(error, { area: "buy_decision_delete_action", decision_id: decision.id });
            Alert.alert("Silinemedi", error instanceof Error ? error.message : "Tekrar dene.");
          } finally {
            setActiveDeleteId(null);
          }
        },
      },
    ]);
  }

  return (
    <Card style={styles.historyCard}>
      {decision.product_image_url ? <CachedImage accessibilityLabel="Kayitli karar gorseli" sourceUri={decision.product_image_url} style={styles.historyImage} /> : null}
      <View style={styles.historyTopRow}>
        <View style={[styles.historyBadge, styles[`decision${decision.decision}`]]}>
          <Text variant="label" color="inverse">
            {decision.decision}
          </Text>
        </View>
        <Text variant="caption" color="muted">
          {formatDecisionDate(decision.created_at)}
        </Text>
      </View>

      <Text variant="body" color="secondary" numberOfLines={2}>
        {decision.ai_reasoning}
      </Text>

      <View style={styles.historyMetaRow}>
        <Text variant="caption" color="muted">
          GUVEN %{Math.round(decision.confidence * 100)}
        </Text>
        <Text variant="caption" color="muted">
          {decision.combination_count} KOMBIN
        </Text>
        {decision.price ? (
          <Text variant="caption" color="muted">
            {decision.price} TL
          </Text>
        ) : null}
      </View>
      <Button title="Sil" variant="ghost" onPress={handleDelete} loading={isDeletingThis} disabled={isBusy && !isDeletingThis} />
    </Card>
  );
}

function formatLimit(value: number | boolean) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "sinirsiz";
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
  selectCard: {
    alignItems: "center",
    gap: SPACING.md,
    paddingVertical: 32,
  },
  preview: {
    aspectRatio: 4 / 5,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    width: "72%",
  },
  centerText: {
    textAlign: "center",
  },
  actions: {
    gap: SPACING.sm,
    width: "100%",
  },
  resultCard: {
    gap: SPACING.md,
  },
  limitCard: {
    gap: SPACING.xs,
  },
  similarSection: {
    gap: SPACING.sm,
  },
  similarGrid: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  similarItem: {
    flex: 1,
    gap: SPACING.xs,
    minWidth: 0,
  },
  similarImage: {
    aspectRatio: 4 / 5,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    width: "100%",
  },
  similarLabel: {
    textAlign: "center",
  },
  reasonPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  reasonPill: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: SPACING.sm,
  },
  decisionBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 8,
    justifyContent: "center",
    minWidth: 112,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  decisionAL: {
    backgroundColor: COLORS.success,
  },
  decisionBEKLEME: {
    backgroundColor: COLORS.warning,
  },
  decisionALMA: {
    backgroundColor: COLORS.danger,
  },
  historyCard: {
    gap: SPACING.sm,
  },
  historyImage: {
    aspectRatio: 4 / 3,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    width: "100%",
  },
  historyTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  historyBadge: {
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    minWidth: 72,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  historyMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
});
