import { router, useLocalSearchParams } from "expo-router";
import { Alert, ScrollView, Share, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { CachedImage } from "@/components/ui/CachedImage";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useBuyDecision } from "@/hooks/useBuyDecision";
import { useWardrobe } from "@/hooks/useWardrobe";
import { captureError, captureEvent } from "@/lib/observability";
import type { BuyDecisionResult } from "@/types";
import { buildSimilarWardrobeSummary } from "@/utils/similarWardrobe";
import { useState } from "react";

export default function BuyDecisionResultScreen() {
  const { resultJson, imageUri: imageUriParam, price: priceParam } = useLocalSearchParams<{
    resultJson?: string;
    imageUri?: string;
    price?: string;
  }>();

  const { items } = useWardrobe();
  const { saveResult, isSaving, canSave } = useBuyDecision();
  const [isSharingResult, setIsSharingResult] = useState(false);
  const isBusy = isSaving || isSharingResult;

  const result: BuyDecisionResult | null = (() => {
    try { return resultJson ? JSON.parse(resultJson) : null; } catch { return null; }
  })();
  const imageUri = imageUriParam ?? null;
  const price = priceParam ?? "";

  if (!result) {
    return (
      <View style={styles.container}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} />
        <Text variant="body" color="secondary" style={styles.errorText}>Sonuc yuklenemedi.</Text>
      </View>
    );
  }

  const similarSummary = buildSimilarWardrobeSummary(result?.similar_items_in_wardrobe ?? [], items);

  async function handleSave() {
    if (isBusy || !canSave || !result) return;
    try {
      await saveResult({ result, imageUri, price: price ? parseFloat(price) : null });
      captureEvent("buy_decision_saved_from_result", { decision: result.decision });
      Alert.alert("Kaydedildi", "Karar gecmisine eklendi.");
    } catch (error) {
      captureError(error, { area: "buy_decision_result_save" });
      Alert.alert("Kaydedilemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  async function handleShare() {
    if (!result) return;
    setIsSharingResult(true);
    try {
      await Share.share({
        title: "Shipirio Almali Miyim ozeti",
        message: `Karar: ${result.decision}\nGuven: %${Math.round(result.confidence * 100)}\n${result.main_reason}`,
      });
      captureEvent("buy_decision_result_shared", { decision: result.decision });
    } catch (error) {
      captureError(error, { area: "buy_decision_result_share" });
    } finally {
      setIsSharingResult(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} disabled={isBusy} />
        <Text variant="h2">Karar</Text>
        <View style={styles.spacer} />
      </View>

      {imageUri ? (
        <CachedImage accessibilityLabel="Analiz edilen gorsel" sourceUri={imageUri} style={styles.preview} />
      ) : null}

      {result ? (
        <>
          <View style={[styles.decisionBadge, styles[`decision${result.decision}`]]}>
            <Text variant="h1" color="inverse" style={styles.decisionText}>{result.decision}</Text>
            <Text variant="body" color="inverse" style={styles.decisionText}>
              %{Math.round(result.confidence * 100)} güven
            </Text>
          </View>

          <Card style={styles.card}>
            <Text variant="h3">{result.main_reason}</Text>
            <Text variant="body" color="secondary">{result.details}</Text>
            <Text variant="body" color="secondary">{result.combination_count} farklı kombin potansiyeli</Text>
            <Text variant="body" color="secondary">{result.cost_per_wear_suggestion}</Text>
            {result.discount_advice ? (
              <Text variant="body" color="secondary">{result.discount_advice}</Text>
            ) : null}
          </Card>
        </>
      ) : null}

      {similarSummary.matches.length > 0 ? (
        <Card style={styles.card}>
          <Text variant="h3">{similarSummary.title}</Text>
          <Text variant="body" color="secondary">{similarSummary.body}</Text>
          <View style={styles.similarGrid}>
            {similarSummary.matches.map((match) => (
              <View key={match.item.id} style={styles.similarItem}>
                <CachedImage
                  accessibilityLabel={match.item.subcategory ?? match.item.category}
                  fallbackColor={match.item.dominant_color_hex}
                  sourceUri={match.item.thumbnail_url ?? match.item.image_url}
                  style={styles.similarImage}
                />
                <Text variant="caption" color="secondary" numberOfLines={1} style={styles.centerText}>
                  {match.item.subcategory ?? match.item.category}
                </Text>
                <Text variant="caption" color="muted" style={styles.centerText}>%{match.score}</Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      <View style={styles.actions}>
        <Button title="Karari Kaydet" variant="secondary" onPress={() => void handleSave()} loading={isSaving} disabled={isBusy} />
        <Button title="Paylas" variant="ghost" onPress={() => void handleShare()} loading={isSharingResult} disabled={isBusy} />
        <Button title="Kapat" variant="ghost" onPress={() => router.back()} disabled={isBusy} />
      </View>
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
    paddingBottom: 100,
    paddingTop: 56,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  spacer: {
    width: 72,
  },
  errorText: {
    padding: SPACING.lg,
  },
  preview: {
    alignSelf: "center",
    aspectRatio: 4 / 5,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 12,
    width: "72%",
  },
  decisionBadge: {
    alignItems: "center",
    borderRadius: 12,
    gap: SPACING.xs,
    paddingVertical: SPACING.lg,
  },
  decisionText: {
    textAlign: "center",
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
  card: {
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
  centerText: {
    textAlign: "center",
  },
  actions: {
    gap: SPACING.sm,
  },
});
