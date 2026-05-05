import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Image, Pressable, ScrollView, Share } from "react-native";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { EVENT_TYPES } from "@/constants/events";
import { SPACING } from "@/constants/spacing";
import { useOutfitRecommendation } from "@/hooks/useOutfitRecommendation";
import { useWardrobe } from "@/hooks/useWardrobe";
import { useWeather } from "@/hooks/useWeather";
import type { OutfitRecommendationInput, OutfitSuggestion, WardrobeItem } from "@/types";

const moods = ["Rahat", "Sik", "Dikkat cekici", "Minimal", "Enerjik"];

export default function OutfitScreen() {
  const { items } = useWardrobe();
  const { weather, isLoading: isWeatherLoading } = useWeather();
  const {
    userId,
    savedOutfits,
    isLoadingSavedOutfits,
    recommend,
    suggestions,
    isRecommending,
    saveOutfit,
    saveSharedOutfit,
    isSavingOutfit,
  } = useOutfitRecommendation();
  const [selectedEvent, setSelectedEvent] = useState<string>(EVENT_TYPES[0].value);
  const [selectedMood, setSelectedMood] = useState(moods[0]);

  const recommendationInput: OutfitRecommendationInput = {
    event: selectedEvent,
    mood: selectedMood,
    weather,
    wardrobe: items,
  };

  async function handleRecommend() {
    if (items.length < 2) {
      Alert.alert("Dolap bos", "Kombin onermek icin once en az iki kiyafet eklemelisin.");
      return;
    }

    try {
      await recommend({
        ...recommendationInput,
      });
    } catch (error) {
      Alert.alert("Kombin onerilemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  async function handleAskFriend(suggestion: OutfitSuggestion) {
    if (!userId) {
      Alert.alert("Giris gerekli", "Kombini paylasmak icin once giris yapmalisin.");
      return;
    }

    try {
      const outfit = await saveSharedOutfit({
        input: recommendationInput,
        suggestion,
      });
      const shareUrl = Linking.createURL(`/outfit/${outfit.id}`);
      await Share.share({
        title: "Shipirio kombini",
        message: `Bu kombine oy verir misin? ${shareUrl}`,
        url: shareUrl,
      });
    } catch (error) {
      Alert.alert("Paylasilamadi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  async function handleSaveOutfit(suggestion: OutfitSuggestion) {
    if (!userId) {
      Alert.alert("Giris gerekli", "Kombini kaydetmek icin once giris yapmalisin.");
      return;
    }

    try {
      await saveOutfit({
        input: recommendationInput,
        suggestion,
      });
      Alert.alert("Kaydedildi", "Kombin kayitli kombinlerine eklendi.");
    } catch (error) {
      Alert.alert("Kaydedilemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="h1">Kombin</Text>
      <Text variant="body" color="secondary">
        Hava, etkinlik ve ruh haline gore dolabindan oneriler.
      </Text>

      <Card style={styles.weather}>
        <Ionicons name="partly-sunny-outline" size={28} color={COLORS.primary} />
        <View>
          <Text variant="h3">{weather ? `${weather.temp} C, ${weather.city}` : "Hava durumu hazir degil"}</Text>
          <Text variant="body" color="secondary">
            {weather ? weather.description : isWeatherLoading ? "Konum ve hava bilgisi aliniyor." : "OpenWeather anahtari veya konum izni gerekebilir."}
          </Text>
        </View>
      </Card>

      <Text variant="h3">Nereye gidiyorsun?</Text>
      <View style={styles.wrap}>
        {EVENT_TYPES.slice(0, 6).map((event) => (
          <Pressable
            key={event.value}
            style={[styles.chip, selectedEvent === event.value && styles.activeChip]}
            onPress={() => setSelectedEvent(event.value)}
          >
            <Text variant="label" color={selectedEvent === event.value ? "inverse" : "secondary"}>
              {event.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text variant="h3">Ruh halin nasil?</Text>
      <View style={styles.wrap}>
        {moods.map((mood) => (
          <Pressable
            key={mood}
            style={[styles.chip, selectedMood === mood && styles.activeChip]}
            onPress={() => setSelectedMood(mood)}
          >
            <Text variant="label" color={selectedMood === mood ? "inverse" : "secondary"}>
              {mood}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.results}>
        {suggestions.map((suggestion) => {
          const suggestionItems = suggestion.items
            .map((itemId) => items.find((wardrobeItem) => wardrobeItem.id === itemId))
            .filter((item): item is WardrobeItem => Boolean(item));

          return (
            <Card key={suggestion.name} style={styles.suggestion}>
              <Text variant="h3">{suggestion.name}</Text>
              <Text variant="body" color="secondary">
                {suggestion.reason}
              </Text>
              <Text variant="caption" color="muted">
                {suggestion.items.length} parca
              </Text>
              {suggestionItems.length > 0 ? (
                <View style={styles.suggestionItems}>
                  {suggestionItems.map((item) => (
                    <View key={item.id} style={styles.suggestionItem}>
                      {item.thumbnail_url || item.image_url ? (
                        <Image source={{ uri: item.thumbnail_url ?? item.image_url }} style={styles.suggestionImage} />
                      ) : (
                        <View style={[styles.suggestionColorBlock, { backgroundColor: item.dominant_color_hex ?? COLORS.primarySoft }]} />
                      )}
                      <Text variant="caption" color="secondary" style={styles.suggestionItemLabel}>
                        {item.subcategory ?? item.category}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={styles.suggestionActions}>
                <Button title="Kaydet" variant="secondary" onPress={() => void handleSaveOutfit(suggestion)} loading={isSavingOutfit} />
                <Button title="Arkadasa Sor" variant="ghost" onPress={() => void handleAskFriend(suggestion)} loading={isSavingOutfit} />
              </View>
            </Card>
          );
        })}
      </View>

      <Button title="Kombin Oner" onPress={handleRecommend} loading={isRecommending} style={styles.cta} />

      <View style={styles.results}>
        <Text variant="h3">Kayitli kombinler</Text>
        {isLoadingSavedOutfits ? (
          <Card style={styles.suggestion}>
            <Text variant="body" color="secondary">
              Kombinler yukleniyor.
            </Text>
          </Card>
        ) : savedOutfits.length > 0 ? (
          savedOutfits.map((saved) => (
            <Pressable key={saved.outfit.id} onPress={() => router.push(`/outfit/${saved.outfit.id}`)}>
              <Card style={styles.suggestion}>
                <Text variant="h3">{saved.outfit.name ?? "Kayitli kombin"}</Text>
                <Text variant="body" color="secondary">
                  {saved.outfit.ai_reasoning ?? "Kaydedilen kombin"}
                </Text>
                <Text variant="caption" color="muted">
                  {saved.outfit.is_favorite ? "Favori - " : ""}
                  {saved.items.length} parca - {saved.votes.length} oy
                </Text>
                {saved.items.length > 0 ? (
                  <View style={styles.suggestionItems}>
                    {saved.items.slice(0, 4).map((item) => (
                      <View key={item.id} style={styles.suggestionItem}>
                        {item.thumbnail_url || item.image_url ? (
                          <Image source={{ uri: item.thumbnail_url ?? item.image_url }} style={styles.suggestionImage} />
                        ) : (
                          <View style={[styles.suggestionColorBlock, { backgroundColor: item.dominant_color_hex ?? COLORS.primarySoft }]} />
                        )}
                      </View>
                    ))}
                  </View>
                ) : null}
              </Card>
            </Pressable>
          ))
        ) : (
          <Card style={styles.suggestion}>
            <Text variant="body" color="secondary">
              Henuz kayitli kombin yok.
            </Text>
          </Card>
        )}
      </View>
    </ScrollView>
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
    paddingBottom: SPACING.xl,
  },
  weather: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
  },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  chip: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  activeChip: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  results: {
    gap: SPACING.sm,
  },
  suggestion: {
    gap: SPACING.xs,
  },
  suggestionItems: {
    flexDirection: "row",
    gap: SPACING.sm,
    paddingTop: SPACING.xs,
  },
  suggestionItem: {
    flex: 1,
    gap: SPACING.xs,
    minWidth: 0,
  },
  suggestionImage: {
    aspectRatio: 4 / 5,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    width: "100%",
  },
  suggestionColorBlock: {
    aspectRatio: 4 / 5,
    borderRadius: 8,
    width: "100%",
  },
  suggestionItemLabel: {
    textAlign: "center",
  },
  suggestionActions: {
    gap: SPACING.sm,
  },
  cta: {
    marginTop: SPACING.sm,
  },
});
