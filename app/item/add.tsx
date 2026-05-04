import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
import type { ClothingAnalysisResult, ClothingCategory, Season } from "@/types";
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const selectedCategoryLabel = useMemo(() => {
    return CATEGORIES.find((category) => category.value === analysis.category)?.label ?? "Ust";
  }, [analysis.category]);

  async function handleImageSelected(uri: string | null) {
    if (!uri) {
      return;
    }

    try {
      setIsAnalyzing(true);
      const optimizedUri = await optimizeImage(uri);
      const nextThumbnailUri = await createThumbnail(optimizedUri);
      setImageUri(optimizedUri);
      setThumbnailUri(nextThumbnailUri);

      try {
        const result = await analyzeClothingImage(optimizedUri);
        setAnalysis(result);
      } catch {
        setAnalysis(fallbackClothingAnalysis);
      }

      setStep("metadata");
    } catch (error) {
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

    try {
      await createItem({
        image_url: imageUri,
        thumbnail_url: thumbnailUri,
        category: analysis.category,
        subcategory: analysis.subcategory,
        colors: analysis.colors,
        dominant_color_hex: analysis.dominant_color_hex,
        season: analysis.season,
        brand: brand.trim() || null,
        purchase_price: price.trim() ? Number(price.replace(",", ".")) : null,
      });

      router.replace("/(tabs)");
    } catch (error) {
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
                await handleImageSelected(await takePhoto());
              }}
              loading={isPicking || isAnalyzing}
            />
            <Button
              title="Galeriden Sec"
              variant="secondary"
              onPress={async () => {
                await handleImageSelected(await pickFromLibrary());
              }}
              loading={isPicking || isAnalyzing}
            />
          </View>
        </Card>
      ) : (
        <View style={styles.form}>
          {imageUri ? <Image source={{ uri: imageUri }} style={styles.preview} /> : null}

          <Card style={styles.analysisCard}>
            <Text variant="caption" color="muted">
              AI tahmini
            </Text>
            <Text variant="h3">{selectedCategoryLabel}</Text>
            <Text variant="body" color="secondary">
              {analysis.subcategory}
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
          <Input label="Fiyat" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />

          <Button title="Dolaba Ekle" onPress={handleSave} loading={isCreating} />
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
