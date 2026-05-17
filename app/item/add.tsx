import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { AILoadingAnimation } from "@/components/shared/AILoadingAnimation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CachedImage } from "@/components/ui/CachedImage";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { CATEGORIES } from "@/constants/categories";
import { COLORS } from "@/constants/colors";
import { SEASONS } from "@/constants/seasons";
import { SPACING } from "@/constants/spacing";
import { useImagePicker } from "@/hooks/useImagePicker";
import { useSubscription } from "@/hooks/useSubscription";
import { useWardrobe } from "@/hooks/useWardrobe";
import { analyzeClothingImage, fallbackClothingAnalysis } from "@/lib/ai/analyzeClothing";
import { removeImageBackground } from "@/lib/ai/removeBackground";
import { captureError, captureEvent } from "@/lib/observability";
import { getStringParam } from "@/lib/routeParams";
import type { ClothingAnalysisResult, ClothingCategory, Season } from "@/types";
import { getCurrencyInputError, parseCurrencyInput } from "@/utils/formatters";
import { createThumbnail, optimizeImage } from "@/utils/imageUtils";
import {
  getColorListInputError,
  getSubcategoryInputError,
  getUsageContextInputError,
  getWardrobeMetadataInputError,
  parseColorList,
  parseUsageContextList,
} from "@/utils/wardrobeValidation";

type Step = "select" | "removing_bg" | "analyzing" | "metadata";

const bgSubMessages = [
  "Arka plan temizleniyor...",
  "Kıyafet silüeti çıkarılıyor...",
  "Son rötuşlar yapılıyor...",
];
const analyzeSubMessages = [
  "Renk paleti okunuyor...",
  "Kategori tahmin ediliyor...",
  "Mevsim uyumu hesaplanıyor...",
  "Analiz tamamlanıyor...",
];

export default function AddItemScreen() {
  const { imageUri: imageUriParam } = useLocalSearchParams<{ imageUri?: string | string[] }>();
  const preselectedUri = getStringParam(imageUriParam);

  const { pickFromLibrary, pickMultipleFromLibrary, takePhoto, isPicking } = useImagePicker();
  const { createItem, isCreating, canCreate, items } = useWardrobe();
  const { isLimitReached } = useSubscription();

  const [step, setStep] = useState<Step>(preselectedUri ? "removing_bg" : "select");
  const [originalUri, setOriginalUri] = useState<string | null>(preselectedUri ?? null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ClothingAnalysisResult>(fallbackClothingAnalysis);
  const [brand, setBrand] = useState("");
  const [fabric, setFabric] = useState("");
  const [usageContext, setUsageContext] = useState("");
  const [price, setPrice] = useState("");
  const [isShareable, setIsShareable] = useState(false);
  const [isLendable, setIsLendable] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [bulkQueue, setBulkQueue] = useState<string[]>([]);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0, errors: 0 });
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const processedPreselected = useRef(false);
  const isBusy = isPicking || isRemovingBg || isAnalyzing || isCreating || isBulkProcessing;

  const selectedCategoryLabel = useMemo(
    () => CATEGORIES.find((c) => c.value === analysis.category)?.label ?? "Üst",
    [analysis.category],
  );

  useEffect(() => {
    captureEvent("wardrobe_add_screen_viewed", { step, item_count: items.length, can_create: canCreate });
  }, [canCreate, items.length, step]);

  useEffect(() => {
    if (preselectedUri && !processedPreselected.current) {
      processedPreselected.current = true;
      void handleRemoveBg(preselectedUri);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedUri]);

  function resetDraft() {
    if (isBusy) return;
    setStep("select");
    setOriginalUri(null);
    setImageUri(null);
    setThumbnailUri(null);
    setAnalysis(fallbackClothingAnalysis);
    setBrand(""); setFabric(""); setUsageContext(""); setPrice("");
    setIsShareable(false); setIsLendable(false);
    captureEvent("wardrobe_add_draft_reset");
  }

  function guardCanStartAdding() {
    if (!canCreate) {
      Alert.alert("Giris gerekli", "Kiyafeti dolaba eklemek icin once giris yapmalisin.");
      return false;
    }
    if (isLimitReached("MAX_WARDROBE_ITEMS", items.length)) {
      Alert.alert("Dolap limiti doldu", "Free plandaki kiyafet limitine ulastin.", [
        { text: "Vazgec", style: "cancel" },
        { text: "Premium'a Gec", onPress: () => router.push("/paywall") },
      ]);
      return false;
    }
    return true;
  }

  async function handleImagePicked(uri: string | null) {
    if (!uri || isBusy) return;
    if (!guardCanStartAdding()) return;
    try {
      const optimizedUri = await optimizeImage(uri);
      setOriginalUri(optimizedUri);
      setStep("removing_bg");
      void handleRemoveBg(optimizedUri);
    } catch (error) {
      captureError(error, { area: "wardrobe_add_optimize" });
      Alert.alert("Gorsel hazirlanamadi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  async function handleRemoveBg(uri: string) {
    setIsRemovingBg(true);
    try {
      const bgRemovedUri = await removeImageBackground(uri);
      setImageUri(bgRemovedUri);
      setStep("removing_bg");
      captureEvent("wardrobe_add_bg_removed");
    } catch (error) {
      captureError(error, { area: "wardrobe_add_bg_removal" });
      setImageUri(uri);
    } finally {
      setIsRemovingBg(false);
    }
  }

  async function handleAnalyze() {
    if (!imageUri) return;
    setStep("analyzing");
    setIsAnalyzing(true);
    try {
      const [result, thumb] = await Promise.all([
        analyzeClothingImage(imageUri),
        createThumbnail(imageUri),
      ]);
      setAnalysis(result);
      setFabric(result.fabric ?? "");
      setUsageContext(result.usage_context?.join(", ") ?? "");
      setThumbnailUri(thumb);
      captureEvent("wardrobe_image_analyzed", { category: result.category });
    } catch (error) {
      captureError(error, { area: "wardrobe_image_analysis" });
      setAnalysis(fallbackClothingAnalysis);
    } finally {
      setIsAnalyzing(false);
      setStep("metadata");
    }
  }

  async function handleSave() {
    if (isBusy || !imageUri || !canCreate) return;
    if (isLimitReached("MAX_WARDROBE_ITEMS", items.length)) { router.push("/paywall"); return; }

    const metadataError = getWardrobeMetadataInputError({
      colorsText: analysis.colors.join(", "),
      fabric, price, seasons: analysis.season,
      subcategory: analysis.subcategory, usageContextText: usageContext,
    });
    if (metadataError) { Alert.alert(metadataError.title, metadataError.message); return; }

    try {
      await createItem({
        image_url: imageUri,
        thumbnail_url: thumbnailUri,
        category: analysis.category,
        subcategory: analysis.subcategory.trim(),
        colors: parseColorList(analysis.colors.join(", ")),
        dominant_color_hex: analysis.dominant_color_hex,
        season: analysis.season,
        brand: brand.trim() || null,
        fabric: fabric.trim() || null,
        usage_context: parseUsageContextList(usageContext),
        purchase_price: parseCurrencyInput(price),
        is_shareable: isShareable,
        is_lendable: isLendable,
        embedding: analysis.embedding ?? null,
      });
      captureEvent("wardrobe_add_flow_completed", { category: analysis.category });
      router.replace("/(tabs)");
    } catch (error) {
      captureError(error, { area: "wardrobe_add_save" });
      Alert.alert("Kaydedilemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  async function handleBulkAdd() {
    if (isBusy) return;
    if (!guardCanStartAdding()) return;
    const uris = await pickMultipleFromLibrary(10);
    if (uris.length === 0) return;

    setIsBulkProcessing(true);
    setBulkProgress({ done: 0, total: uris.length, errors: 0 });
    let errors = 0;

    for (let i = 0; i < uris.length; i++) {
      try {
        const optimized = await optimizeImage(uris[i]);
        let processed = optimized;
        try {
          processed = await removeImageBackground(optimized);
        } catch {
          // continue with original if bg removal fails
        }
        const [result, thumb] = await Promise.all([
          analyzeClothingImage(processed),
          createThumbnail(processed),
        ]);
        await createItem({
          image_url: processed,
          thumbnail_url: thumb,
          category: result.category,
          subcategory: result.subcategory.trim(),
          colors: result.colors,
          dominant_color_hex: result.dominant_color_hex,
          season: result.season,
          fabric: result.fabric ?? null,
          usage_context: result.usage_context ?? [],
          is_shareable: false,
          is_lendable: false,
          embedding: result.embedding ?? null,
        });
        captureEvent("wardrobe_bulk_add_item_saved", { index: i, category: result.category });
      } catch (error) {
        errors++;
        captureError(error, { area: "wardrobe_bulk_add_item", index: i });
      }
      setBulkProgress({ done: i + 1, total: uris.length, errors });
    }

    setIsBulkProcessing(false);
    const saved = uris.length - errors;
    Alert.alert(
      "Toplu ekleme tamamlandı",
      `${saved} kıyafet eklendi${errors > 0 ? `, ${errors} başarısız` : ""}.`,
      [{ text: "Tamam", onPress: () => router.replace("/(tabs)") }],
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} disabled={isBusy} />
        <Text variant="h2">Kıyafet Ekle</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Adım göstergesi */}
      <StepIndicator current={step} />

      {/* Adım 1: Görsel seç */}
      {step === "select" && (
        <Card style={styles.selectCard}>
          <Ionicons name="camera-outline" size={48} color={COLORS.primary} />
          <Text variant="h3" style={styles.center}>Fotoğraf seç</Text>
          <Text variant="body" color="secondary" style={styles.center}>
            AI arka planı otomatik kaldırıp kıyafeti analiz edecek.
          </Text>
          <View style={styles.actions}>
            <Button
              title="Kamera"
              onPress={async () => { await handleImagePicked(await takePhoto()); }}
              loading={isPicking} disabled={isBusy}
            />
            <Button
              title="Galeriden Seç"
              variant="secondary"
              onPress={async () => { await handleImagePicked(await pickFromLibrary()); }}
              loading={isPicking} disabled={isBusy}
            />
          </View>
          <Button
            title="Toplu Ekle (birden fazla)"
            variant="ghost"
            onPress={() => void handleBulkAdd()}
            loading={isBulkProcessing}
            disabled={isBusy}
          />
          {isBulkProcessing && (
            <Text variant="caption" color="secondary" style={styles.center}>
              İşleniyor: {bulkProgress.done}/{bulkProgress.total} · {bulkProgress.errors > 0 ? `${bulkProgress.errors} hata` : ""}
            </Text>
          )}
        </Card>
      )}

      {/* Adım 2: Arka plan silme */}
      {step === "removing_bg" && (
        <Card style={styles.stepCard}>
          {isRemovingBg ? (
            <AILoadingAnimation message="Arka plan siliniyor" subMessages={bgSubMessages} />
          ) : (
            <>
              <Text variant="h3" style={styles.center}>Arka Plan Kaldırıldı</Text>
              <View style={styles.compareRow}>
                {originalUri && (
                  <View style={styles.compareItem}>
                    <Text variant="caption" color="muted" style={styles.center}>Orijinal</Text>
                    <CachedImage accessibilityLabel="Orijinal gorsel" sourceUri={originalUri} style={styles.compareImage} />
                  </View>
                )}
                {imageUri && (
                  <View style={styles.compareItem}>
                    <Text variant="caption" color="muted" style={styles.center}>İşlenmiş</Text>
                    <CachedImage accessibilityLabel="Arka plani kaldirilmis gorsel" sourceUri={imageUri} style={styles.compareImage} />
                  </View>
                )}
              </View>
              <Button title="Devam Et — AI Analizi Başlat" onPress={() => void handleAnalyze()} disabled={isBusy} />
              <Button title="Yeniden Çek" variant="ghost" onPress={resetDraft} disabled={isBusy} />
            </>
          )}
        </Card>
      )}

      {/* Adım 3: AI analizi */}
      {step === "analyzing" && (
        <Card style={styles.stepCard}>
          <AILoadingAnimation message="Kıyafet analiz ediliyor" subMessages={analyzeSubMessages} />
        </Card>
      )}

      {/* Adım 4: Metadata formu */}
      {step === "metadata" && (
        <View style={styles.form}>
          {imageUri && <CachedImage accessibilityLabel="Kiyafet gorseli" sourceUri={imageUri} style={styles.preview} />}
          <Button title="Fotoğrafı Değiştir" variant="secondary" onPress={resetDraft} disabled={isBusy} />

          <Card style={styles.analysisCard}>
            <Text variant="caption" color="muted">AI TAHMİNİ</Text>
            <Text variant="h3">{selectedCategoryLabel}</Text>
            <Text variant="body" color="secondary">{analysis.subcategory}</Text>
            <Text variant="caption" color="muted">
              {analysis.colors.join(", ")} · {analysis.season.join(", ")}
            </Text>
          </Card>

          <Text variant="h3">Kategori</Text>
          <View style={styles.wrap}>
            {CATEGORIES.map((cat) => (
              <Button
                key={cat.value}
                title={cat.label}
                variant={cat.value === analysis.category ? "primary" : "secondary"}
                onPress={() => !isBusy && setAnalysis((a) => ({ ...a, category: cat.value as ClothingCategory }))}
                disabled={isBusy}
                style={styles.chipButton}
              />
            ))}
          </View>

          <Text variant="h3">Sezon</Text>
          <View style={styles.wrap}>
            {SEASONS.map((s) => (
              <Button
                key={s.value}
                title={s.label}
                variant={analysis.season.includes(s.value) ? "primary" : "secondary"}
                onPress={() => {
                  if (isBusy) return;
                  setAnalysis((a) => ({
                    ...a,
                    season: a.season.includes(s.value)
                      ? a.season.filter((v) => v !== s.value)
                      : [...a.season, s.value as Season],
                  }));
                }}
                disabled={isBusy}
                style={styles.chipButton}
              />
            ))}
          </View>

          {/* Required fields */}
          <Input label="Alt kategori" value={analysis.subcategory}
            onChangeText={(v) => setAnalysis((a) => ({ ...a, subcategory: v }))}
            error={getSubcategoryInputError(analysis.subcategory)} editable={!isBusy} />
          <Input label="Renkler" value={analysis.colors.join(", ")}
            onChangeText={(v) => setAnalysis((a) => ({ ...a, colors: parseColorList(v) }))}
            error={getColorListInputError(analysis.colors.join(", "))} editable={!isBusy} />

          {/* Optional details — collapsed by default to reduce cognitive load */}
          <Pressable
            style={styles.optionalToggle}
            onPress={() => setShowOptional((v) => !v)}
            disabled={isBusy}
          >
            <Ionicons
              name={showOptional ? "chevron-up-outline" : "chevron-down-outline"}
              size={16}
              color={COLORS.textSecondary}
            />
            <Text variant="caption" color="secondary">
              {showOptional ? "Detayları Gizle" : "Detay Ekle (opsiyonel) — Marka, Kumaş, Fiyat…"}
            </Text>
          </Pressable>

          {showOptional && (
            <>
              <Input label="Marka" value={brand} onChangeText={setBrand} editable={!isBusy} />
              <Input label="Kumaş" value={fabric} onChangeText={setFabric} placeholder="pamuk, denim, keten" editable={!isBusy} />
              <Input label="Kullanım alanı" value={usageContext} onChangeText={setUsageContext}
                placeholder="günlük, iş, gece" error={getUsageContextInputError(usageContext)} editable={!isBusy} />
              <Input label="Fiyat" value={price} onChangeText={setPrice} keyboardType="decimal-pad"
                error={getCurrencyInputError(price)} editable={!isBusy} />
              <Card style={styles.socialCard}>
                <Text variant="h3">Sosyal ayarlar</Text>
                <View style={styles.actions}>
                  <Button
                    title={isShareable ? "Arkadaş Dolabında Açık" : "Arkadaş Dolabında Paylaş"}
                    variant={isShareable ? "primary" : "secondary"}
                    onPress={() => { if (!isBusy) { setIsShareable((v) => { if (v) setIsLendable(false); return !v; }); } }}
                    disabled={isBusy}
                  />
                  <Button
                    title={isLendable ? "Ödünç Verilebilir" : "Ödünç Verilebilir Yap"}
                    variant={isLendable ? "primary" : "secondary"}
                    onPress={() => { if (!isBusy) { setIsLendable((v) => { if (!v) setIsShareable(true); return !v; }); } }}
                    disabled={isBusy}
                  />
                </View>
              </Card>
            </>
          )}

          <Button title="Dolaba Ekle" onPress={() => void handleSave()} loading={isCreating} disabled={isBusy} />
        </View>
      )}
    </ScrollView>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const steps: Step[] = ["select", "removing_bg", "analyzing", "metadata"];
  const labels = ["Görsel", "Arka Plan", "Analiz", "Form"];
  const idx = steps.indexOf(current);

  return (
    <View style={indicatorStyles.row}>
      {steps.map((s, i) => (
        <View key={s} style={indicatorStyles.item}>
          <View style={[indicatorStyles.dot, i <= idx && indicatorStyles.dotActive]} />
          <Text variant="caption" color={i <= idx ? "primary" : "muted"} style={indicatorStyles.label}>
            {labels[i]}
          </Text>
        </View>
      ))}
    </View>
  );
}

const indicatorStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: SPACING.sm },
  item: { alignItems: "center", flex: 1, gap: 4 },
  dot: { backgroundColor: COLORS.border, borderRadius: 999, height: 8, width: 8 },
  dotActive: { backgroundColor: COLORS.primary },
  label: { textAlign: "center" },
});

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.background, flex: 1 },
  content: { gap: SPACING.lg, padding: SPACING.lg, paddingBottom: 80, paddingTop: 56 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  headerSpacer: { width: 72 },
  center: { textAlign: "center" },
  selectCard: { alignItems: "center", gap: SPACING.md, marginTop: SPACING.xl, paddingVertical: 40 },
  stepCard: { alignItems: "center", gap: SPACING.md, paddingVertical: SPACING.xl },
  compareRow: { flexDirection: "row", gap: SPACING.md, width: "100%" },
  compareItem: { flex: 1, gap: SPACING.xs },
  compareImage: { aspectRatio: 4 / 5, backgroundColor: COLORS.surfaceMuted, borderRadius: 8, width: "100%" },
  actions: { gap: SPACING.sm, width: "100%" },
  optionalToggle: {
    alignItems: "center",
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACING.xs,
    justifyContent: "center",
    paddingVertical: SPACING.sm,
  },
  form: { gap: SPACING.md },
  preview: { alignSelf: "center", aspectRatio: 4 / 5, backgroundColor: COLORS.surfaceMuted, borderRadius: 8, width: "72%" },
  analysisCard: { gap: SPACING.xs },
  socialCard: { gap: SPACING.md },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  chipButton: { minHeight: 40, paddingHorizontal: SPACING.md },
});
