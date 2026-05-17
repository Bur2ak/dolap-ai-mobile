import { router, useLocalSearchParams } from "expo-router";
import { Alert, ScrollView, Share, StyleSheet, View } from "react-native";

import { OutfitCard } from "@/components/outfit/OutfitCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useOutfitRecommendation } from "@/hooks/useOutfitRecommendation";
import { useWardrobe } from "@/hooks/useWardrobe";
import { captureError, captureEvent } from "@/lib/observability";
import { createPublicAppLink } from "@/lib/links";
import { useOutfitStore } from "@/stores/outfitStore";
import type { OutfitSuggestion } from "@/types";
import { useState } from "react";

export default function OutfitResultScreen() {
  const { event, mood } = useLocalSearchParams<{ event?: string; mood?: string }>();
  const { items } = useWardrobe();
  const { suggestions, saveOutfit, askFriendsToVote, isSavingOutfit, recommend, isRecommending, userId } = useOutfitRecommendation();
  const { selectedEvent, selectedMood, lastWeather } = useOutfitStore();
  const [activeSuggestionAction, setActiveSuggestionAction] = useState<{ name: string; action: "save" | "share" } | null>(null);
  const isBusy = isRecommending || isSavingOutfit || Boolean(activeSuggestionAction);
  const eventLabel = event ?? selectedEvent;
  const moodLabel = mood ?? selectedMood;

  async function handleRefresh() {
    if (isBusy || !userId) return;
    try {
      await recommend({ event: eventLabel, mood: moodLabel, weather: lastWeather, wardrobe: items });
      captureEvent("outfit_result_refreshed");
    } catch (error) {
      captureError(error, { area: "outfit_result_refresh" });
      Alert.alert("Yenilenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  async function handleSave(suggestion: OutfitSuggestion) {
    if (isBusy || !userId) return;
    setActiveSuggestionAction({ name: suggestion.name, action: "save" });
    try {
      await saveOutfit({ input: { event: eventLabel, mood: moodLabel, weather: lastWeather, wardrobe: items }, suggestion });
      captureEvent("outfit_recommendation_saved_from_result", { item_count: suggestion.items.length });
      Alert.alert("Kaydedildi", "Kombin kayitli kombinlerine eklendi.");
    } catch (error) {
      captureError(error, { area: "outfit_result_save" });
      Alert.alert("Kaydedilemedi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setActiveSuggestionAction(null);
    }
  }

  async function handleAskFriend(suggestion: OutfitSuggestion) {
    if (isBusy || !userId) return;
    setActiveSuggestionAction({ name: suggestion.name, action: "share" });
    try {
      const { outfit, notifiedFriendsCount } = await askFriendsToVote({ input: { event: eventLabel, mood: moodLabel, weather: lastWeather, wardrobe: items }, suggestion });
      const shareUrl = createPublicAppLink(`/outfit/share/${outfit.share_token ?? outfit.id}`);
      if (notifiedFriendsCount > 0) {
        Alert.alert("Arkadaslara gonderildi", `${notifiedFriendsCount} arkadasina kombin oyu bildirimi gonderildi.`);
      } else {
        await Share.share({ title: "Shipirio kombini", message: `Bu kombine oy verir misin? ${shareUrl}`, url: shareUrl });
      }
    } catch (error) {
      captureError(error, { area: "outfit_result_share" });
      Alert.alert("Paylasilamadi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setActiveSuggestionAction(null);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} disabled={isBusy} />
        <Text variant="h2">Kombin Onerileri</Text>
        <View style={styles.spacer} />
      </View>

      <View style={styles.meta}>
        <Text variant="caption" color="muted">{eventLabel} · {moodLabel}</Text>
      </View>

      {suggestions.length === 0 ? (
        <EmptyState icon="sparkles-outline" title="Kombin yok" body="Henuz oneri olusturulmamis." />
      ) : (
        suggestions.map((suggestion) => (
          <OutfitCard
            key={suggestion.name}
            suggestion={suggestion}
            items={items}
            actions={
              <View style={styles.actions}>
                <Button
                  title="Kaydet"
                  variant="secondary"
                  onPress={() => void handleSave(suggestion)}
                  loading={activeSuggestionAction?.name === suggestion.name && activeSuggestionAction.action === "save"}
                  disabled={isBusy}
                />
                <Button
                  title="Arkadasa Sor"
                  variant="ghost"
                  onPress={() => void handleAskFriend(suggestion)}
                  loading={activeSuggestionAction?.name === suggestion.name && activeSuggestionAction.action === "share"}
                  disabled={isBusy}
                />
              </View>
            }
          />
        ))
      )}

      <Button title="Baska Oner" variant="secondary" onPress={() => void handleRefresh()} loading={isRecommending} disabled={isBusy} />
      <Button title="Kombinlerime Git" variant="ghost" onPress={() => router.replace("/(tabs)/outfit")} disabled={isBusy} />
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
  meta: {
    alignItems: "center",
  },
  actions: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
});
