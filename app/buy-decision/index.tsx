import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useBuyDecision } from "@/hooks/useBuyDecision";
import { useImagePicker } from "@/hooks/useImagePicker";
import { useWardrobe } from "@/hooks/useWardrobe";
import { optimizeImage } from "@/utils/imageUtils";

export default function BuyDecisionScreen() {
  const { items } = useWardrobe();
  const { pickFromLibrary, takePhoto, isPicking } = useImagePicker();
  const { decide, result, isDeciding, saveResult, isSaving, canSave } = useBuyDecision();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [price, setPrice] = useState("");

  const numericPrice = price.trim() ? Number(price.replace(",", ".")) : null;

  async function handleImageSelected(uri: string | null) {
    if (!uri) {
      return;
    }

    try {
      setImageUri(await optimizeImage(uri));
    } catch (error) {
      Alert.alert("Gorsel hazirlanamadi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  async function handleAnalyze() {
    if (!imageUri) {
      Alert.alert("Fotograf gerekli", "Karar motoru icin once fotograf secmelisin.");
      return;
    }

    try {
      await decide({
        imageUri,
        price: numericPrice,
        wardrobe: items,
      });
    } catch (error) {
      Alert.alert("Analiz edilemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  async function handleSave() {
    if (!result) {
      return;
    }

    if (!canSave) {
      Alert.alert("Giris gerekli", "Karari kaydetmek icin once giris yapmalisin.");
      return;
    }

    try {
      await saveResult({ result, imageUrl: null, price: numericPrice });
      Alert.alert("Kaydedildi", "Karar gecmisine eklendi.");
    } catch (error) {
      Alert.alert("Kaydedilemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} />
        <Text variant="h2">Almali Miyim?</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Card style={styles.selectCard}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.preview} />
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
              await handleImageSelected(await takePhoto());
            }}
            loading={isPicking}
          />
          <Button
            title="Galeriden Sec"
            variant="secondary"
            onPress={async () => {
              await handleImageSelected(await pickFromLibrary());
            }}
            loading={isPicking}
          />
        </View>
      </Card>

      <Input label="Fiyat" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
      <Button title="Analiz Et" onPress={handleAnalyze} loading={isDeciding} />

      {result ? (
        <Card style={styles.resultCard}>
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
          <Button title="Karari Kaydet" variant="secondary" onPress={handleSave} loading={isSaving} />
        </Card>
      ) : null}
    </ScrollView>
  );
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
});
