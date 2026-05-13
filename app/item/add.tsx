import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

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
import type { ClothingAnalysisResult, ClothingCategory, Season } from "@/types";
import { getCurrencyInputError, parseCurrencyInput } from "@/utils/formatters";
import { getColorListInputError, getSubcategoryInputError, getUsageContextInputError, getWardrobeMetadataInputError, parseColorList, parseUsageContextList } from "@/utils/wardrobeValidation";
import { createThumbnail, optimizeImage } from "@/utils/imageUtils";

type Step = "select" | "metadata";

export default function AddItemScreen() {
  const { pickFromLibrary, takePhoto, isPicking } = useImagePicker();
  const { createItem, isCreating, canCreate, items } = useWardrobe();
  const { isLimitReached } = useSubscription();
  const [step, setStep] = useState<Step>("select");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ClothingAnalysisResult>(fallbackClothingAnalysis);
  const [brand, setBrand] = useState("");
  const [fabric, setFabric] = useState("");
  const [usageContext, setUsageContext] = useState("");
  const [price, setPrice] = useState("");
  const [isShareable, setIsShareable] = useState(false);
  const [isLendable, setIsLendable] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const isBusy = isPicking || isAnalyzing || isCreating;

  const selectedCategoryLabel = useMemo(() => {
    return CATEGORIES.find((category) => category.value === analysis.category)?.label ?? "Ust";
  }, [analysis.category]);

  useEffect(() => {
    captureEvent("wardrobe_add_screen_viewed", {
      step,
      item_count: items.length,
      can_create: canCreate,
    });
  }, [canCreate, items.length, step]);

  function resetDraft() {
    if (isBusy) {
      captureEvent("wardrobe_add_draft_reset_blocked", { reason: "busy" });
      return;
    }

    setStep("select");
    setImageUri(null);
    setThumbnailUri(null);
    setAnalysis(fallbackClothingAnalysis);
    setBrand("");
    setFabric("");
    setUsageContext("");
    setPrice("");
    setIsShareable(false);
    setIsLendable(false);
    captureEvent("wardrobe_add_draft_reset");
  }

  function guardCanStartAdding() {
    if (!canCreate) {
      captureEvent("wardrobe_add_blocked", { reason: "auth" });
      Alert.alert("Giris gerekli", "Kiyafeti dolaba eklemek icin once giris yapmalisin.");
      return false;
    }

    if (isLimitReached("MAX_WARDROBE_ITEMS", items.length)) {
      captureEvent("wardrobe_add_blocked", { reason: "limit", item_count: items.length });
      Alert.alert("Dolap limiti doldu", "Free plandaki kiyafet limitine ulastin. Daha fazla kiyafet eklemek icin Premium'a gecebilirsin.", [
        { text: "Vazgec", style: "cancel" },
        { text: "Premium'a Gec", onPress: () => router.push("/paywall") },
      ]);
      return false;
    }

    return true;
  }

  async function handleImageSelected(uri: string | null) {
    if (isBusy) {
      captureEvent("wardrobe_add_image_selection_blocked", { reason: "busy" });
      return;
    }

    if (!uri) {
      captureEvent("wardrobe_add_image_selection_cancelled");
      return;
    }

    try {
      setIsAnalyzing(true);
      const optimizedUri = await optimizeImage(uri);
      const backgroundRemovedUri = await removeImageBackground(optimizedUri);
      const nextThumbnailUri = await createThumbnail(backgroundRemovedUri);
      setImageUri(backgroundRemovedUri);
      setThumbnailUri(nextThumbnailUri);

      try {
        const result = await analyzeClothingImage(backgroundRemovedUri);
        setAnalysis(result);
        setFabric(result.fabric ?? "");
        setUsageContext(result.usage_context?.join(", ") ?? "");
        captureEvent("wardrobe_image_analyzed", {
          category: result.category,
          season_count: result.season.length,
        });
      } catch (analysisError) {
        captureError(analysisError, { area: "wardrobe_image_analysis" });
        captureEvent("wardrobe_image_analysis_fallback");
        setAnalysis(fallbackClothingAnalysis);
      }

      setStep("metadata");
      captureEvent("wardrobe_add_image_prepared", { background_removed: true });
    } catch (error) {
      captureError(error, { area: "wardrobe_image_prepare" });
      Alert.alert("Gorsel hazirlanamadi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function updateCategory(category: ClothingCategory) {
    if (isBusy) {
      captureEvent("wardrobe_add_category_blocked", { category, reason: "busy" });
      return;
    }

    setAnalysis((current) => ({ ...current, category }));
    captureEvent("wardrobe_add_category_selected", { category });
  }

  function updateSubcategory(value: string) {
    if (isBusy) {
      captureEvent("wardrobe_add_subcategory_blocked", { reason: "busy" });
      return;
    }

    setAnalysis((current) => ({ ...current, subcategory: value }));
  }

  function updateColors(value: string) {
    if (isBusy) {
      captureEvent("wardrobe_add_colors_blocked", { reason: "busy" });
      return;
    }

    setAnalysis((current) => ({
      ...current,
      colors: parseColorList(value),
    }));
  }

  function toggleSeason(season: Season) {
    if (isBusy) {
      captureEvent("wardrobe_add_season_blocked", { reason: "busy", season });
      return;
    }

    setAnalysis((current) => {
      const hasSeason = current.season.includes(season);
      captureEvent("wardrobe_add_season_toggled", { enabled: !hasSeason, season });
      return {
        ...current,
        season: hasSeason ? current.season.filter((item) => item !== season) : [...current.season, season],
      };
    });
  }

  function toggleShareable() {
    if (isBusy) {
      captureEvent("wardrobe_add_shareable_blocked", { reason: "busy" });
      return;
    }

    setIsShareable((current) => {
      const nextValue = !current;
      captureEvent("wardrobe_add_shareable_toggled", { enabled: nextValue });
      if (!nextValue) {
        setIsLendable(false);
      }
      return nextValue;
    });
  }

  function toggleLendable() {
    if (isBusy) {
      captureEvent("wardrobe_add_lendable_blocked", { reason: "busy" });
      return;
    }

    setIsLendable((current) => {
      const nextValue = !current;
      captureEvent("wardrobe_add_lendable_toggled", { enabled: nextValue });
      if (nextValue) {
        setIsShareable(true);
      }
      return nextValue;
    });
  }

  async function handleSave() {
    if (isBusy) {
      captureEvent("wardrobe_add_save_blocked", { reason: "busy" });
      return;
    }

    if (!imageUri) {
      captureEvent("wardrobe_add_save_blocked", { reason: "missing_image" });
      Alert.alert("Fotograf gerekli", "Kiyafeti kaydetmek icin once fotograf secmelisin.");
      return;
    }

    if (!canCreate) {
      captureEvent("wardrobe_add_save_blocked", { reason: "auth" });
      Alert.alert("Giris gerekli", "Kiyafeti dolaba eklemek icin once giris yapmalisin.");
      return;
    }

    if (isLimitReached("MAX_WARDROBE_ITEMS", items.length)) {
      captureEvent("wardrobe_add_save_blocked", { reason: "limit", item_count: items.length });
      router.push("/paywall");
      return;
    }

    const metadataError = getWardrobeMetadataInputError({
      colorsText: analysis.colors.join(", "),
      fabric,
      price,
      seasons: analysis.season,
      subcategory: analysis.subcategory,
      usageContextText: usageContext,
    });
    if (metadataError) {
      captureEvent("wardrobe_add_save_blocked", { reason: "metadata" });
      Alert.alert(metadataError.title, metadataError.message);
      return;
    }

    try {
      const purchasePrice = parseCurrencyInput(price);

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
        purchase_price: purchasePrice,
        is_shareable: isShareable,
        is_lendable: isLendable,
      });

      captureEvent("wardrobe_add_flow_completed", {
        category: analysis.category,
        is_lendable: isLendable,
        is_shareable: isShareable,
        season_count: analysis.season.length,
      });
      router.replace("/(tabs)");
    } catch (error) {
      captureError(error, { area: "wardrobe_add_save", category: analysis.category });
      Alert.alert("Kaydedilemedi", error instanceof Error ? error.message : "Supabase ayarlarini kontrol edip tekrar dene.");
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} disabled={isBusy} />
        <Text variant="h2">Kiyafet Ekle</Text>
        <View style={styles.headerSpacer} />
      </View>

      {step === "select" ? (
        <Card style={styles.selectCard}>
          <Ionicons name="camera-outline" size={48} color={COLORS.primary} />
          <Text variant="h3" style={styles.centerText}>
            Fotograf sec
          </Text>
          <Text variant="body" color="secondary" style={styles.centerText}>
            AI analizi icin net, tek kiyafetin gorundugu bir fotograf en iyi sonucu verir.
          </Text>
          <View style={styles.actions}>
            <Button
              title="Kamera"
              onPress={async () => {
                if (!guardCanStartAdding()) {
                  return;
                }
                captureEvent("wardrobe_add_image_source_selected", { source: "camera" });
                await handleImageSelected(await takePhoto());
              }}
              loading={isPicking || isAnalyzing}
              disabled={isBusy}
            />
            <Button
              title="Galeriden Sec"
              variant="secondary"
              onPress={async () => {
                if (!guardCanStartAdding()) {
                  return;
                }
                captureEvent("wardrobe_add_image_source_selected", { source: "library" });
                await handleImageSelected(await pickFromLibrary());
              }}
              loading={isPicking || isAnalyzing}
              disabled={isBusy}
            />
          </View>
        </Card>
      ) : (
        <View style={styles.form}>
          {imageUri ? <CachedImage accessibilityLabel="Secilen kiyafet gorseli" sourceUri={imageUri} style={styles.preview} /> : null}
          <View style={styles.draftActions}>
            <Button title="Fotografi Degistir" variant="secondary" onPress={resetDraft} disabled={isBusy} />
          </View>

          <Card style={styles.analysisCard}>
            <Text variant="caption" color="muted">
              AI tahmini
            </Text>
            <Text variant="h3">{selectedCategoryLabel}</Text>
            <Text variant="body" color="secondary">
              {analysis.subcategory}
            </Text>
            <Text variant="caption" color="muted">
              {analysis.colors.length} renk - {analysis.season.length} sezon
            </Text>
          </Card>

          <Text variant="h3">Kategori</Text>
          <View style={styles.wrap}>
            {CATEGORIES.map((category) => {
              const active = category.value === analysis.category;
              return (
                <Button
                  key={category.value}
                  title={category.label}
                  variant={active ? "primary" : "secondary"}
                  onPress={() => updateCategory(category.value)}
                  disabled={isBusy}
                  style={styles.chipButton}
                />
              );
            })}
          </View>

          <Text variant="h3">Sezon</Text>
          <View style={styles.wrap}>
            {SEASONS.map((season) => {
              const active = analysis.season.includes(season.value);
              return (
                <Button
                  key={season.value}
                  title={season.label}
                  variant={active ? "primary" : "secondary"}
                  onPress={() => toggleSeason(season.value)}
                  disabled={isBusy}
                  style={styles.chipButton}
                />
              );
            })}
          </View>

          <Input
            label="Alt kategori"
            value={analysis.subcategory}
            onChangeText={updateSubcategory}
            error={getSubcategoryInputError(analysis.subcategory)}
            editable={!isBusy}
          />
          <Input
            label="Renkler"
            value={analysis.colors.join(", ")}
            onChangeText={updateColors}
            error={getColorListInputError(analysis.colors.join(", "))}
            editable={!isBusy}
          />
          <Input label="Marka" value={brand} onChangeText={setBrand} editable={!isBusy} />
          <Input label="Kumas" value={fabric} onChangeText={setFabric} placeholder="Orn. pamuk, denim, keten" editable={!isBusy} />
          <Input
            label="Kullanim alani"
            value={usageContext}
            onChangeText={setUsageContext}
            placeholder="gunluk, is, gece"
            error={getUsageContextInputError(usageContext)}
            editable={!isBusy}
          />
          <Input label="Fiyat" value={price} onChangeText={setPrice} keyboardType="decimal-pad" error={getCurrencyInputError(price)} editable={!isBusy} />

          <Card style={styles.socialCard}>
            <Text variant="h3">Sosyal ayarlar</Text>
            <Text variant="body" color="secondary">
              Paylasilan parcalar arkadas dolabinda gorunur. Odunc verilebilir yapmak paylasimi otomatik acar.
            </Text>
            <View style={styles.actions}>
              <Button
                title={isShareable ? "Arkadas Dolabinda Acik" : "Arkadas Dolabinda Paylas"}
                variant={isShareable ? "primary" : "secondary"}
                onPress={toggleShareable}
                disabled={isBusy}
              />
              <Button
                title={isLendable ? "Odunc Verilebilir" : "Odunc Verilebilir Yap"}
                variant={isLendable ? "primary" : "secondary"}
                onPress={toggleLendable}
                disabled={isBusy}
              />
            </View>
          </Card>

          <Button title="Dolaba Ekle" onPress={handleSave} loading={isCreating} disabled={isBusy} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  content: {
    gap: SPACING.lg,
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
    marginTop: SPACING.xl,
    paddingVertical: 40,
  },
  centerText: {
    textAlign: "center",
  },
  actions: {
    gap: SPACING.sm,
    width: "100%",
  },
  draftActions: {
    gap: SPACING.sm,
  },
  form: {
    gap: SPACING.md,
  },
  preview: {
    alignSelf: "center",
    aspectRatio: 4 / 5,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    width: "72%",
  },
  analysisCard: {
    gap: SPACING.xs,
  },
  socialCard: {
    gap: SPACING.md,
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
