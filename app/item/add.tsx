import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
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
import { getWardrobeMetadataInputError, parseColorList } from "@/utils/wardrobeValidation";
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
  const [price, setPrice] = useState("");
  const [isShareable, setIsShareable] = useState(false);
  const [isLendable, setIsLendable] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const isBusy = isPicking || isAnalyzing || isCreating;

  const selectedCategoryLabel = useMemo(() => {
    return CATEGORIES.find((category) => category.value === analysis.category)?.label ?? "Ust";
  }, [analysis.category]);

  function resetDraft() {
    setStep("select");
    setImageUri(null);
    setThumbnailUri(null);
    setAnalysis(fallbackClothingAnalysis);
    setBrand("");
    setPrice("");
    setIsShareable(false);
    setIsLendable(false);
    captureEvent("wardrobe_add_draft_reset");
  }

  function guardCanStartAdding() {
    if (!canCreate) {
      Alert.alert("Giris gerekli", "Kiyafeti dolaba eklemek icin once giris yapmalisin.");
      return false;
    }

    if (isLimitReached("MAX_WARDROBE_ITEMS", items.length)) {
      Alert.alert("Dolap limiti doldu", "Free plandaki kiyafet limitine ulastin. Daha fazla kiyafet eklemek icin Premium'a gecebilirsin.", [
        { text: "Vazgec", style: "cancel" },
        { text: "Premium'a Gec", onPress: () => router.push("/paywall") },
      ]);
      return false;
    }

    return true;
  }

  async function handleImageSelected(uri: string | null) {
    if (!uri) {
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
    } catch (error) {
      captureError(error, { area: "wardrobe_image_prepare" });
      Alert.alert("Gorsel hazirlanamadi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function updateCategory(category: ClothingCategory) {
    setAnalysis((current) => ({ ...current, category }));
  }

  function toggleSeason(season: Season) {
    setAnalysis((current) => {
      const hasSeason = current.season.includes(season);
      return {
        ...current,
        season: hasSeason ? current.season.filter((item) => item !== season) : [...current.season, season],
      };
    });
  }

  function toggleShareable() {
    setIsShareable((current) => {
      const nextValue = !current;
      if (!nextValue) {
        setIsLendable(false);
      }
      return nextValue;
    });
  }

  function toggleLendable() {
    setIsLendable((current) => {
      const nextValue = !current;
      if (nextValue) {
        setIsShareable(true);
      }
      return nextValue;
    });
  }

  async function handleSave() {
    if (!imageUri) {
      return;
    }

    if (!canCreate) {
      Alert.alert("Giris gerekli", "Kiyafeti dolaba eklemek icin once giris yapmalisin.");
      return;
    }

    if (isLimitReached("MAX_WARDROBE_ITEMS", items.length)) {
      router.push("/paywall");
      return;
    }

    const metadataError = getWardrobeMetadataInputError({
      colorsText: analysis.colors.join(", "),
      price,
      seasons: analysis.season,
      subcategory: analysis.subcategory,
    });
    if (metadataError) {
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
        <Button title="Geri" variant="ghost" onPress={() => router.back()} />
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
              {analysis.colors.length} renk · {analysis.season.length} sezon
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
            onChangeText={(value) => setAnalysis((current) => ({ ...current, subcategory: value }))}
          />
          <Input
            label="Renkler"
            value={analysis.colors.join(", ")}
            onChangeText={(value) =>
              setAnalysis((current) => ({
                ...current,
                colors: value
                  .split(",")
                  .map((color) => color.trim())
                  .filter(Boolean),
              }))
            }
          />
          <Input label="Marka" value={brand} onChangeText={setBrand} />
          <Input label="Fiyat" value={price} onChangeText={setPrice} keyboardType="decimal-pad" error={getCurrencyInputError(price)} />

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
