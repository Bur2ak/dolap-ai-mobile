import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { usePriceTracking } from "@/hooks/usePriceTracking";
import { useSubscription } from "@/hooks/useSubscription";
import { useWardrobeAnalytics } from "@/hooks/useWardrobeAnalytics";
import { captureError, captureEvent } from "@/lib/observability";
import type { MissingWardrobePiece, PriceTracking } from "@/types";
import { formatCurrency, getCurrencyInputError, parseCurrencyInput } from "@/utils/formatters";
import { buildBudgetRecommendations, buildPriceInsight, buildShoppingPlacements, buildShoppingSearchTargets } from "@/utils/shoppingAdvisor";
import { getOptionalHttpUrlError, normalizeOptionalHttpUrl } from "@/utils/validation";

export default function PriceTrackingScreen() {
  const {
    trackings,
    error,
    isLoading,
    isRefetching,
    refetch,
    createTracking,
    updateTracking,
    deleteTracking,
    checkPrices,
    isCreating,
    isUpdating,
    isDeleting,
    isChecking,
    canUse,
  } = usePriceTracking();
  const { analytics } = useWardrobeAnalytics();
  const { isLimitReached } = useSubscription();
  const [productName, setProductName] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [store, setStore] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [activeSmartPieceKey, setActiveSmartPieceKey] = useState<string | null>(null);
  const [activeDeleteId, setActiveDeleteId] = useState<string | null>(null);
  const [isSharingSummary, setIsSharingSummary] = useState(false);
  const isBusy = isCreating || isUpdating || isDeleting || isChecking;
  const isActionBusy = isBusy || Boolean(activeSmartPieceKey) || Boolean(activeDeleteId) || isSharingSummary;
  const targetReadyCount = trackings.filter((tracking) => tracking.current_price !== null && tracking.target_price !== null && tracking.current_price <= tracking.target_price).length;
  const trackedUrlCount = trackings.filter((tracking) => Boolean(tracking.product_url)).length;

  useEffect(() => {
    captureEvent("price_tracking_screen_viewed", {
      target_ready_count: targetReadyCount,
      tracked_url_count: trackedUrlCount,
      tracking_count: trackings.length,
    });
  }, [targetReadyCount, trackedUrlCount, trackings.length]);

  async function handleCreate() {
    if (isActionBusy) {
      captureEvent("price_tracking_create_blocked", { reason: "busy" });
      return;
    }

    if (!canUse) {
      captureEvent("price_tracking_create_blocked", { reason: "auth" });
      Alert.alert("Giris gerekli", "Fiyat takibi icin once giris yapmalisin.");
      return;
    }

    if (isLimitReached("PRICE_TRACKING_ITEMS", trackings.length)) {
      captureEvent("price_tracking_create_blocked", { reason: "limit", tracking_count: trackings.length });
      router.push("/paywall");
      return;
    }

    if (!productName.trim()) {
      captureEvent("price_tracking_create_blocked", { reason: "missing_name" });
      Alert.alert("Urun adi gerekli", "Takip edecegin urune bir ad ver.");
      return;
    }

    const normalizedProductName = productName.trim().toLocaleLowerCase("tr-TR");
    const alreadyExists = trackings.some((tracking) => tracking.product_name.toLocaleLowerCase("tr-TR") === normalizedProductName);
    if (alreadyExists) {
      captureEvent("price_tracking_create_blocked", { reason: "duplicate_name" });
      Alert.alert("Zaten listede", "Bu urun fiyat takip listende zaten var.");
      return;
    }

    const inputError = getPriceTrackingInputError(productUrl, currentPrice, targetPrice);
    if (inputError) {
      captureEvent("price_tracking_create_blocked", { reason: "input" });
      Alert.alert(inputError.title, inputError.message);
      return;
    }

    try {
      const parsedCurrentPrice = parseCurrencyInput(currentPrice);
      const parsedTargetPrice = parseCurrencyInput(targetPrice);

      await createTracking({
        product_name: productName.trim(),
        product_url: normalizeOptionalHttpUrl(productUrl),
        store: store.trim() || null,
        current_price: parsedCurrentPrice,
        target_price: parsedTargetPrice,
      });
      setProductName("");
      setProductUrl("");
      setStore("");
      setCurrentPrice("");
      setTargetPrice("");
    } catch (error) {
      captureError(error, { area: "price_tracking_create_action", has_url: Boolean(productUrl.trim()) });
      Alert.alert("Takip eklenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  async function handleAddSmartSuggestion(piece: MissingWardrobePiece) {
    const pieceKey = getSmartPieceKey(piece);
    if (isActionBusy) {
      captureEvent("price_tracking_smart_suggestion_blocked", { category: piece.category, priority: piece.priority, reason: "busy" });
      return;
    }

    if (!canUse) {
      captureEvent("price_tracking_smart_suggestion_blocked", { reason: "auth", category: piece.category, priority: piece.priority });
      Alert.alert("Giris gerekli", "Alisveris onerilerini takibe eklemek icin once giris yapmalisin.");
      return;
    }

    if (isLimitReached("PRICE_TRACKING_ITEMS", trackings.length)) {
      captureEvent("price_tracking_smart_suggestion_blocked", { reason: "limit", category: piece.category, priority: piece.priority });
      router.push("/paywall");
      return;
    }

    const productName = `${piece.label} (${piece.suggested_colors.join(", ")})`;
    const alreadyExists = trackings.some((tracking) => tracking.product_name.toLocaleLowerCase("tr-TR") === productName.toLocaleLowerCase("tr-TR"));

    if (alreadyExists) {
      captureEvent("price_tracking_smart_suggestion_blocked", { reason: "duplicate", category: piece.category, priority: piece.priority });
      Alert.alert("Zaten listede", "Bu eksik parca fiyat takip listende zaten var.");
      return;
    }

    setActiveSmartPieceKey(pieceKey);
    try {
      await createTracking({
        product_name: productName,
        product_url: null,
        store: "Shipirio akilli liste",
        current_price: null,
        target_price: null,
      });
      captureEvent("price_tracking_smart_suggestion_added", { category: piece.category, priority: piece.priority });
      Alert.alert("Listeye eklendi", "Eksik parca fiyat takip listene eklendi.");
    } catch (error) {
      captureError(error, { area: "price_tracking_smart_suggestion_action", category: piece.category, priority: piece.priority });
      Alert.alert("Eklenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setActiveSmartPieceKey(null);
    }
  }

  async function handleDelete(id: string) {
    if (isActionBusy) {
      captureEvent("price_tracking_delete_blocked", { reason: "busy", tracking_id: id });
      return;
    }

    captureEvent("price_tracking_delete_prompt_opened", { tracking_id: id });
    Alert.alert("Takibi sil", "Bu fiyat takibi listenden kaldirilacak.", [
      { text: "Vazgec", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          setActiveDeleteId(id);
          try {
            await deleteTracking(id);
          } catch (error) {
            captureError(error, { area: "price_tracking_delete_action", tracking_id: id });
            Alert.alert("Silinemedi", error instanceof Error ? error.message : "Tekrar dene.");
          } finally {
            setActiveDeleteId(null);
          }
        },
      },
    ]);
  }

  async function handleCheckPrices() {
    if (isActionBusy) {
      captureEvent("price_tracking_check_blocked", { reason: "busy" });
      return;
    }

    if (!canUse) {
      captureEvent("price_tracking_check_blocked", { reason: "auth" });
      Alert.alert("Giris gerekli", "Fiyatlari kontrol etmek icin once giris yapmalisin.");
      return;
    }

    try {
      const result = await checkPrices();
      const undetected = result.results.filter((item) => item.reason === "price_not_detected").length;
      const pushSent = result.results.filter((item) => item.push_sent).length;
      Alert.alert(
        "Kontrol tamam",
        `${result.checked} urun kontrol edildi, ${result.updated} fiyat guncellendi, ${result.notified} bildirim olustu.${pushSent > 0 ? ` ${pushSent} push gonderildi.` : ""}${undetected > 0 ? ` ${undetected} urunde fiyat bulunamadi.` : ""}`,
      );
    } catch (error) {
      captureError(error, { area: "price_tracking_check_action" });
      Alert.alert("Kontrol edilemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  async function handleShareTrackingSummary() {
    if (isActionBusy) {
      captureEvent("price_tracking_summary_share_blocked", { reason: "busy" });
      return;
    }

    setIsSharingSummary(true);
    try {
      const result = await Share.share({
        message: buildPriceTrackingSummary(trackings, targetReadyCount, trackedUrlCount),
        title: "Shipirio fiyat takibi ozeti",
      });
      captureEvent("price_tracking_summary_shared", { action: result.action, tracking_count: trackings.length });
    } catch (error) {
      captureError(error, { area: "price_tracking_summary_share" });
      Alert.alert("Paylasilamadi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setIsSharingSummary(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} disabled={isActionBusy} />
        <Text variant="h2">Fiyat Takibi</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Card style={styles.form}>
        <Text variant="h3">Yeni takip</Text>
        <Input label="Urun adi" value={productName} onChangeText={setProductName} editable={!isActionBusy} />
        <Input label="Magaza" value={store} onChangeText={setStore} editable={!isActionBusy} />
        <Input label="Urun linki" value={productUrl} onChangeText={setProductUrl} autoCapitalize="none" autoCorrect={false} error={getOptionalHttpUrlError(productUrl)} editable={!isActionBusy} />
        <Input label="Mevcut fiyat" value={currentPrice} onChangeText={setCurrentPrice} keyboardType="decimal-pad" error={getCurrencyInputError(currentPrice)} editable={!isActionBusy} />
        <Input label="Hedef fiyat" value={targetPrice} onChangeText={setTargetPrice} keyboardType="decimal-pad" error={getCurrencyInputError(targetPrice)} editable={!isActionBusy} />
        <Button title="Takibe Ekle" onPress={handleCreate} loading={isCreating} disabled={isActionBusy} />
      </Card>

      <SmartShoppingListCard
        pieces={analytics.missing_pieces}
        trackings={trackings}
        onAdd={handleAddSmartSuggestion}
        activePieceKey={activeSmartPieceKey}
        isAdding={isCreating}
        disabled={isActionBusy}
      />

      <View style={styles.list}>
        <View style={styles.listHeader}>
          <Text variant="h3">Takip listesi</Text>
          <View style={styles.listHeaderActions}>
            <Button title="Ozet" variant="ghost" onPress={() => void handleShareTrackingSummary()} loading={isSharingSummary} disabled={trackings.length === 0 || isActionBusy} />
            <Button title="Kontrol Et" variant="secondary" onPress={handleCheckPrices} loading={isChecking} disabled={trackings.length === 0 || isActionBusy} />
          </View>
        </View>
        {trackings.length > 0 ? (
          <View style={styles.summaryGrid}>
            <View style={styles.summaryPill}>
              <Text variant="caption" color="muted">
                AKTIF
              </Text>
              <Text variant="h3">{trackings.length}</Text>
            </View>
            <View style={styles.summaryPill}>
              <Text variant="caption" color="muted">
                HEDEFTE
              </Text>
              <Text variant="h3">{targetReadyCount}</Text>
            </View>
            <View style={styles.summaryPill}>
              <Text variant="caption" color="muted">
                LINKLI
              </Text>
              <Text variant="h3">{trackedUrlCount}</Text>
            </View>
          </View>
        ) : null}
        {isLoading ? (
          <EmptyState icon="sync-outline" title="Takipler yukleniyor" body="Fiyat takip listen hazirlaniyor." />
        ) : error ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Takip listesi yuklenemedi"
            body="Baglanti veya Supabase tarafinda gecici bir sorun olabilir."
            actionLabel="Tekrar Dene"
            loading={isRefetching}
            onAction={() => {
              if (isActionBusy) {
                captureEvent("price_tracking_refetch_blocked", { reason: "busy" });
                return;
              }

              captureEvent("price_tracking_refetch_requested");
              void refetch();
            }}
          />
        ) : trackings.length > 0 ? (
          trackings.map((tracking) => (
            <TrackingCard
              key={tracking.id}
              tracking={tracking}
              trackings={trackings}
              onDelete={handleDelete}
              onUpdate={updateTracking}
              isDeleting={isDeleting}
              isUpdating={isUpdating}
              isBusy={isActionBusy}
              activeDeleteId={activeDeleteId}
            />
          ))
        ) : (
          <EmptyState icon="pricetag-outline" title="Takip yok" body="Henuz takip edilen urun yok." />
        )}
      </View>
    </ScrollView>
  );
}

function SmartShoppingListCard({
  pieces,
  trackings,
  onAdd,
  activePieceKey,
  isAdding,
  disabled,
}: {
  pieces: MissingWardrobePiece[];
  trackings: PriceTracking[];
  onAdd: (piece: MissingWardrobePiece) => Promise<void>;
  activePieceKey: string | null;
  isAdding: boolean;
  disabled: boolean;
}) {
  const visiblePieces = pieces.slice(0, 4);

  return (
    <Card style={styles.smartList}>
      <View style={styles.smartHeader}>
        <View style={styles.trackingCopy}>
          <Text variant="caption" color="muted">
            AKILLI ALISVERIS LISTESI
          </Text>
          <Text variant="h3">Dolabina gore eksikler</Text>
        </View>
        <Ionicons name="sparkles-outline" size={24} color={COLORS.primary} />
      </View>
      {visiblePieces.length > 0 ? (
        visiblePieces.map((piece) => {
          const productName = `${piece.label} (${piece.suggested_colors.join(", ")})`;
          const added = trackings.some((tracking) => tracking.product_name.toLocaleLowerCase("tr-TR") === productName.toLocaleLowerCase("tr-TR"));
          const pieceKey = getSmartPieceKey(piece);
          const isAddingThis = activePieceKey === pieceKey;

          return (
            <View key={`${piece.category}-${piece.label}`} style={styles.smartRow}>
              <View style={[styles.priorityDot, styles[`priority${piece.priority}`]]} />
              <View style={styles.smartCopy}>
                <Text variant="label">{piece.label}</Text>
                <Text variant="body" color="secondary">
                  {piece.reason}
                </Text>
                <Text variant="caption" color="muted">
                  Renk onerisi: {piece.suggested_colors.join(", ")}
                </Text>
                <View style={styles.budgetGrid}>
                  {buildBudgetRecommendations(piece).map((recommendation) => (
                    <View key={recommendation.label} style={styles.budgetPill}>
                      <Text variant="caption" color="muted">
                        {recommendation.label}
                      </Text>
                      <Text variant="label">{recommendation.range}</Text>
                    </View>
                  ))}
                </View>
                <Button
                  title={added ? "Listede" : "Fiyat Takibine Ekle"}
                  variant="secondary"
                  onPress={() => void onAdd(piece)}
                  loading={isAddingThis}
                  disabled={added || disabled || (isAdding && !isAddingThis)}
                  style={styles.smartAction}
                />
                <Button
                  title="Ikinci El / Alternatif Ara"
                  variant="ghost"
                  onPress={() => {
                    const targets = buildShoppingSearchTargets(productName);
                    captureEvent("price_tracking_missing_piece_search_opened", { category: piece.category, target_count: targets.length });
                    void openSearchTarget(targets.at(-1)?.url ?? targets[0]?.url, "Eksik parca alternatif aramasi acilamadi.");
                  }}
                  disabled={disabled}
                  style={styles.smartAction}
                />
              </View>
            </View>
          );
        })
      ) : (
        <Text variant="body" color="secondary">
          Dolabin temel kategorilerde dengeli gorunuyor. Yeni urun eklemek sart degil.
        </Text>
      )}
    </Card>
  );
}

function TrackingCard({
  tracking,
  trackings,
  onDelete,
  onUpdate,
  isDeleting,
  isUpdating,
  isBusy,
  activeDeleteId,
}: {
  tracking: PriceTracking;
  trackings: PriceTracking[];
  onDelete: (id: string) => Promise<void>;
  onUpdate: ReturnType<typeof usePriceTracking>["updateTracking"];
  isDeleting: boolean;
  isUpdating: boolean;
  isBusy: boolean;
  activeDeleteId: string | null;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(tracking.product_name);
  const [store, setStore] = useState(tracking.store ?? "");
  const [url, setUrl] = useState(tracking.product_url ?? "");
  const [currentPrice, setCurrentPrice] = useState(tracking.current_price ? String(tracking.current_price) : "");
  const [targetPrice, setTargetPrice] = useState(tracking.target_price ? String(tracking.target_price) : "");
  const history = getPriceHistory(tracking);
  const latestPrice = tracking.current_price ?? history.at(-1)?.price ?? null;
  const targetProgress = getTargetProgress(latestPrice, tracking.initial_price, tracking.target_price);
  const priceInsight = buildPriceInsight(tracking, history);
  const alternativeTargets = buildShoppingSearchTargets(tracking.product_name);
  const shoppingPlacements = buildShoppingPlacements(tracking.product_name);
  const isDeletingThis = activeDeleteId === tracking.id;

  useEffect(() => {
    setName(tracking.product_name);
    setStore(tracking.store ?? "");
    setUrl(tracking.product_url ?? "");
    setCurrentPrice(tracking.current_price ? String(tracking.current_price) : "");
    setTargetPrice(tracking.target_price ? String(tracking.target_price) : "");
  }, [tracking]);

  async function handleSave() {
    if (isBusy) {
      captureEvent("price_tracking_update_blocked", { reason: "busy", tracking_id: tracking.id });
      return;
    }

    if (!name.trim()) {
      captureEvent("price_tracking_update_blocked", { reason: "missing_name", tracking_id: tracking.id });
      Alert.alert("Urun adi gerekli", "Takip kaydi icin urun adi bos olamaz.");
      return;
    }

    const normalizedName = name.trim().toLocaleLowerCase("tr-TR");
    const alreadyExists = trackings.some((item) => item.id !== tracking.id && item.product_name.toLocaleLowerCase("tr-TR") === normalizedName);
    if (alreadyExists) {
      captureEvent("price_tracking_update_blocked", { reason: "duplicate_name", tracking_id: tracking.id });
      Alert.alert("Zaten listede", "Bu urun fiyat takip listende zaten var.");
      return;
    }

    const inputError = getPriceTrackingInputError(url, currentPrice, targetPrice);
    if (inputError) {
      captureEvent("price_tracking_update_blocked", { reason: "input", tracking_id: tracking.id });
      Alert.alert(inputError.title, inputError.message);
      return;
    }

    try {
      const parsedCurrentPrice = parseCurrencyInput(currentPrice);
      const parsedTargetPrice = parseCurrencyInput(targetPrice);

      await onUpdate({
        trackingId: tracking.id,
        input: {
          current_price: parsedCurrentPrice,
          product_name: name.trim(),
          product_url: normalizeOptionalHttpUrl(url),
          store: store.trim() || null,
          target_price: parsedTargetPrice,
        },
      });
      captureEvent("price_tracking_updated", { tracking_id: tracking.id, has_url: Boolean(url.trim()) });
      setIsEditing(false);
    } catch (error) {
      captureError(error, { area: "price_tracking_update_action", tracking_id: tracking.id, has_url: Boolean(url.trim()) });
      Alert.alert("Guncellenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  return (
    <Card style={styles.trackingCard}>
      <View style={styles.trackingHeader}>
        <View style={styles.trackingCopy}>
          <Text variant="h3">{tracking.product_name}</Text>
          <Text variant="body" color="secondary">
            {tracking.store ?? "Magaza belirtilmedi"}
          </Text>
        </View>
        <View style={styles.cardActions}>
          <Pressable
            style={styles.iconButton}
            onPress={() => {
              if (isBusy) {
                captureEvent("price_tracking_edit_blocked", { reason: "busy", tracking_id: tracking.id });
                return;
              }

              const nextValue = !isEditing;
              captureEvent("price_tracking_edit_toggled", { tracking_id: tracking.id, is_editing: nextValue });
              setIsEditing(nextValue);
            }}
            disabled={isBusy}
          >
            <Ionicons name={isEditing ? "close-outline" : "create-outline"} size={20} color={COLORS.primary} />
          </Pressable>
          <Pressable style={[styles.iconButton, isDeletingThis ? styles.iconButtonBusy : null]} onPress={() => void onDelete(tracking.id)} disabled={isDeleting || isBusy || isDeletingThis}>
            <Ionicons name={isDeletingThis ? "hourglass-outline" : "trash-outline"} size={20} color={COLORS.danger} />
          </Pressable>
        </View>
      </View>

      {isEditing ? (
        <View style={styles.editForm}>
          <Input label="Urun adi" value={name} onChangeText={setName} editable={!isBusy} />
          <Input label="Magaza" value={store} onChangeText={setStore} editable={!isBusy} />
          <Input label="Urun linki" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} error={getOptionalHttpUrlError(url)} editable={!isBusy} />
          <Input label="Mevcut fiyat" value={currentPrice} onChangeText={setCurrentPrice} keyboardType="decimal-pad" error={getCurrencyInputError(currentPrice)} editable={!isBusy} />
          <Input label="Hedef fiyat" value={targetPrice} onChangeText={setTargetPrice} keyboardType="decimal-pad" error={getCurrencyInputError(targetPrice)} editable={!isBusy} />
          <Button title="Degisiklikleri Kaydet" onPress={handleSave} loading={isUpdating} disabled={isBusy} />
        </View>
      ) : (
        <>
          <View style={styles.priceRow}>
            <View style={styles.pricePill}>
              <Text variant="caption" color="muted">
                MEVCUT
              </Text>
              <Text variant="label">{latestPrice ? formatCurrency(latestPrice) : "Yok"}</Text>
            </View>
            <View style={styles.pricePill}>
              <Text variant="caption" color="muted">
                HEDEF
              </Text>
              <Text variant="label">{tracking.target_price ? formatCurrency(tracking.target_price) : "Yok"}</Text>
            </View>
          </View>
          <PriceTrend history={history} />
          {priceInsight ? (
            <View style={[styles.insightBox, styles[`insight${priceInsight.status}`]]}>
              <View style={styles.targetHeader}>
                <Text variant="label">{priceInsight.title}</Text>
                <Text variant="caption" color="muted">
                  {priceInsight.discount_percent_from_initial !== null ? `%${priceInsight.discount_percent_from_initial}` : "Trend"}
                </Text>
              </View>
              <Text variant="body" color="secondary">
                {priceInsight.body}
              </Text>
              {priceInsight.lowest_price_30d ? (
                <Text variant="caption" color="muted">
                  Son 30 gun dip: {formatCurrency(priceInsight.lowest_price_30d)}
                </Text>
              ) : null}
              {priceInsight.price_drop_count_30d > 0 ? (
                <Text variant="caption" color="muted">
                  Son 30 gun indirim sinyali: {priceInsight.price_drop_count_30d}
                </Text>
              ) : null}
            </View>
          ) : null}
          {targetProgress ? (
            <View style={styles.targetBox}>
              <View style={styles.targetHeader}>
                <Text variant="caption" color="muted">
                  HEDEFE YAKINLIK
                </Text>
                <Text variant="caption" color="muted">
                  %{targetProgress.percent}
                </Text>
              </View>
              <View style={styles.targetTrack}>
                <View style={[styles.targetFill, { width: `${targetProgress.percent}%` }]} />
              </View>
              <Text variant="caption" color="muted" style={targetProgress.reached ? styles.successText : null}>
                {targetProgress.reached ? "Hedef fiyat yakalandi." : targetProgress.label}
              </Text>
            </View>
          ) : null}
          <Text variant="caption" color="muted">
            {tracking.last_checked ? `Son kontrol: ${formatPriceCheckDate(tracking.last_checked)}` : "Henuz otomatik kontrol yapilmadi."}
          </Text>
          {tracking.product_url ? (
            <Button
              title="Urun Linkini Ac"
              variant="ghost"
              onPress={() => {
                if (isBusy) {
                  captureEvent("price_tracking_product_url_blocked", { reason: "busy", tracking_id: tracking.id });
                  return;
                }

                void openProductUrl(tracking);
              }}
              disabled={isBusy}
            />
          ) : null}
          {alternativeTargets.length > 0 ? (
            <View style={styles.alternativeBox}>
              <Text variant="caption" color="muted">
                DAHA UYGUN ALTERNATIF
              </Text>
              <View style={styles.alternativeActions}>
                {alternativeTargets.slice(0, 3).map((target) => (
                  <Pressable
                    key={target.label}
                    style={styles.searchChip}
                    onPress={() => {
                      if (isBusy) {
                        captureEvent("price_tracking_alternative_search_blocked", { reason: "busy", tracking_id: tracking.id });
                        return;
                      }

                      captureEvent("price_tracking_alternative_search_opened", { target: target.label, tracking_id: tracking.id });
                      void openSearchTarget(target.url, "Alternatif arama acilamadi.");
                    }}
                    disabled={isBusy}
                  >
                    <Text variant="caption" color="secondary">
                      {target.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {shoppingPlacements.length > 0 ? (
                <View style={styles.placementList}>
                  {shoppingPlacements.slice(0, 2).map((placement) => (
                    <Pressable
                      key={placement.target.label}
                      accessibilityRole="button"
                      style={styles.placementRow}
                      onPress={() => {
                        if (isBusy) {
                          captureEvent("price_tracking_shopping_placement_blocked", { reason: "busy", tracking_id: tracking.id });
                          return;
                        }

                        captureEvent("price_tracking_shopping_placement_opened", {
                          disclosure: placement.disclosure,
                          target: placement.target.label,
                          tracking_id: tracking.id,
                        });
                        void openSearchTarget(placement.target.url, "Alisveris kanali acilamadi.");
                      }}
                      disabled={isBusy}
                    >
                      <View style={styles.placementCopy}>
                        <Text variant="caption" color="muted">
                          {placement.disclosure}
                        </Text>
                        <Text variant="label">{placement.target.label}</Text>
                        <Text variant="caption" color="secondary">
                          {placement.note}
                        </Text>
                      </View>
                      <View style={styles.placementCta}>
                        <Text variant="caption" color="secondary">
                          {placement.cta}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </>
      )}
    </Card>
  );
}

function PriceTrend({ history }: { history: Array<{ price: number; date: string }> }) {
  if (history.length < 2) {
    return (
      <View style={styles.trendEmpty}>
        <Text variant="caption" color="muted">
          Fiyat gecmisi olusunca trend burada gorunecek.
        </Text>
      </View>
    );
  }

  const visibleHistory = history.slice(-8);
  const prices = visibleHistory.map((entry) => entry.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = Math.max(max - min, 1);
  const first = prices[0];
  const last = prices[prices.length - 1];
  const change = first ? ((last - first) / first) * 100 : 0;

  return (
    <View style={styles.trendBox}>
      <View style={styles.trendHeader}>
        <Text variant="caption" color="muted">
          FIYAT TRENDI
        </Text>
        <Text variant="caption" color={change <= 0 ? "muted" : "danger"} style={change <= 0 ? styles.successText : null}>
          {change <= 0 ? "" : "+"}
          {Math.round(change)}%
        </Text>
      </View>
      <View style={styles.sparkline}>
        {visibleHistory.map((entry, index) => {
          const heightPercent = 24 + ((entry.price - min) / range) * 76;
          return (
            <View key={`${entry.date}-${index}`} style={styles.sparkColumn}>
              <View style={[styles.sparkBar, { height: `${heightPercent}%` }]} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

function getPriceHistory(tracking: PriceTracking) {
  const history = Array.isArray(tracking.price_history) ? tracking.price_history : [];
  const normalized = history
    .filter((entry) => Number.isFinite(entry.price) && typeof entry.date === "string")
    .map((entry) => ({ price: Number(entry.price), date: entry.date }));

  if (normalized.length === 0 && tracking.current_price) {
    return [{ price: tracking.current_price, date: tracking.created_at }];
  }

  return normalized;
}

function getSmartPieceKey(piece: MissingWardrobePiece) {
  return `${piece.category}-${piece.label}-${piece.priority}`;
}

function getTargetProgress(currentPrice: number | null, initialPrice: number | null, targetPrice: number | null) {
  if (!currentPrice || !initialPrice || !targetPrice || initialPrice <= targetPrice) {
    return null;
  }

  const reached = currentPrice <= targetPrice;
  const percent = reached ? 100 : Math.max(0, Math.min(100, Math.round(((initialPrice - currentPrice) / (initialPrice - targetPrice)) * 100)));
  const remaining = Math.max(currentPrice - targetPrice, 0);

  return {
    label: `${formatCurrency(remaining)} daha dusmeli.`,
    percent,
    reached,
  };
}

function buildPriceTrackingSummary(trackings: PriceTracking[], targetReadyCount: number, trackedUrlCount: number) {
  const latestItems = trackings.slice(0, 5).map((tracking) => {
    const latestPrice = tracking.current_price ?? getPriceHistory(tracking).at(-1)?.price ?? null;
    const target = tracking.target_price ? ` hedef ${formatCurrency(tracking.target_price)}` : " hedef yok";
    return `- ${tracking.product_name}: ${latestPrice ? formatCurrency(latestPrice) : "fiyat yok"} /${target}`;
  });

  return [
    "Shipirio fiyat takibi ozeti",
    `Aktif takip: ${trackings.length}`,
    `Hedef fiyat yakalayan: ${targetReadyCount}`,
    `Linkli takip: ${trackedUrlCount}`,
    latestItems.length > 0 ? "Urunler:" : null,
    ...latestItems,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatPriceCheckDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "Tarih yok";
  }

  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
}

function getPriceTrackingInputError(productUrl: string, currentPrice: string, targetPrice: string) {
  const urlError = getOptionalHttpUrlError(productUrl);
  if (urlError) {
    return { message: urlError, title: "Link gecersiz" };
  }

  const currentPriceError = getCurrencyInputError(currentPrice);
  if (currentPriceError) {
    return { message: currentPriceError, title: "Fiyat gecersiz" };
  }

  const targetPriceError = getCurrencyInputError(targetPrice);
  if (targetPriceError) {
    return { message: targetPriceError, title: "Hedef fiyat gecersiz" };
  }

  const parsedCurrentPrice = parseCurrencyInput(currentPrice);
  const parsedTargetPrice = parseCurrencyInput(targetPrice);
  if (parsedCurrentPrice !== null && parsedTargetPrice !== null && parsedTargetPrice >= parsedCurrentPrice) {
    return { message: "Hedef fiyat mevcut fiyattan dusuk olmali.", title: "Hedef fiyat gecersiz" };
  }

  return null;
}

async function openProductUrl(tracking: PriceTracking) {
  const url = normalizeOptionalHttpUrl(tracking.product_url ?? "");
  if (!url) {
    captureEvent("price_tracking_product_url_blocked", { reason: "missing_url", tracking_id: tracking.id });
    return;
  }

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      captureEvent("price_tracking_product_url_blocked", { reason: "unsupported_url", tracking_id: tracking.id });
      Alert.alert("Link acilamadi", "Urun linki bu cihazda desteklenmiyor.");
      return;
    }

    await Linking.openURL(url);
    captureEvent("price_tracking_product_url_opened", { tracking_id: tracking.id });
  } catch (error) {
    captureError(error, { area: "price_tracking_product_url_open", tracking_id: tracking.id });
    Alert.alert("Link acilamadi", "Urun linki bu cihazda acilamadi.");
  }
}

async function openSearchTarget(url: string | undefined, errorMessage: string) {
  if (!url) {
    Alert.alert("Link yok", errorMessage);
    return;
  }

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert("Link acilamadi", errorMessage);
      return;
    }

    await Linking.openURL(url);
  } catch (error) {
    captureError(error, { area: "shopping_search_open" });
    Alert.alert("Link acilamadi", errorMessage);
  }
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
    paddingBottom: SPACING.xl,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerSpacer: {
    width: 72,
  },
  form: {
    gap: SPACING.md,
  },
  smartList: {
    gap: SPACING.md,
  },
  smartHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
    justifyContent: "space-between",
  },
  smartRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  priorityDot: {
    borderRadius: 999,
    height: 12,
    marginTop: 6,
    width: 12,
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
  smartCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  smartAction: {
    alignSelf: "flex-start",
    minHeight: 38,
    paddingHorizontal: SPACING.md,
  },
  budgetGrid: {
    flexDirection: "row",
    gap: SPACING.xs,
  },
  budgetPill: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    padding: SPACING.xs,
  },
  list: {
    gap: SPACING.sm,
  },
  listHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
    justifyContent: "space-between",
  },
  listHeaderActions: {
    flexDirection: "row",
    gap: SPACING.xs,
  },
  summaryGrid: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  summaryPill: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    flex: 1,
    gap: 2,
    padding: SPACING.sm,
  },
  trackingCard: {
    gap: SPACING.md,
  },
  trackingHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
    justifyContent: "space-between",
  },
  trackingCopy: {
    flex: 1,
  },
  cardActions: {
    flexDirection: "row",
    gap: SPACING.xs,
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  iconButtonBusy: {
    opacity: 0.6,
  },
  priceRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  pricePill: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    flex: 1,
    gap: 2,
    padding: SPACING.sm,
  },
  trendBox: {
    gap: SPACING.xs,
  },
  trendHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sparkline: {
    alignItems: "flex-end",
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    flexDirection: "row",
    gap: 3,
    height: 72,
    padding: SPACING.sm,
  },
  sparkColumn: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
  },
  sparkBar: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    minHeight: 6,
    width: "100%",
  },
  trendEmpty: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    padding: SPACING.sm,
  },
  targetBox: {
    gap: SPACING.xs,
  },
  insightBox: {
    borderRadius: 8,
    gap: SPACING.xs,
    padding: SPACING.sm,
  },
  insightbuy: {
    backgroundColor: COLORS.primarySoft,
  },
  insightwait: {
    backgroundColor: COLORS.warningSoft,
  },
  insightwatch: {
    backgroundColor: COLORS.surfaceMuted,
  },
  targetHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  targetTrack: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 999,
    height: 8,
    overflow: "hidden",
  },
  targetFill: {
    backgroundColor: COLORS.success,
    borderRadius: 999,
    height: "100%",
  },
  successText: {
    color: COLORS.success,
  },
  alternativeBox: {
    gap: SPACING.xs,
  },
  alternativeActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  placementList: {
    gap: SPACING.xs,
  },
  placementRow: {
    alignItems: "center",
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    flexDirection: "row",
    gap: SPACING.sm,
    justifyContent: "space-between",
    padding: SPACING.sm,
  },
  placementCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  placementCta: {
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  searchChip: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  editForm: {
    gap: SPACING.sm,
  },
});
