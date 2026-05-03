import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, Pressable } from "react-native";
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

const moods = ["Rahat", "Sik", "Dikkat cekici", "Minimal", "Enerjik"];

export default function OutfitScreen() {
  const { items } = useWardrobe();
  const { weather, isLoading: isWeatherLoading } = useWeather();
  const { recommend, suggestions, isRecommending } = useOutfitRecommendation();
  const [selectedEvent, setSelectedEvent] = useState<string>(EVENT_TYPES[0].value);
  const [selectedMood, setSelectedMood] = useState(moods[0]);

  async function handleRecommend() {
    if (items.length < 2) {
      Alert.alert("Dolap bos", "Kombin onermek icin once en az iki kiyafet eklemelisin.");
      return;
    }

    try {
      await recommend({
        event: selectedEvent,
        mood: selectedMood,
        weather,
        wardrobe: items,
      });
    } catch (error) {
      Alert.alert("Kombin onerilemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  return (
    <View style={styles.container}>
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
        {suggestions.map((suggestion) => (
          <Card key={suggestion.name} style={styles.suggestion}>
            <Text variant="h3">{suggestion.name}</Text>
            <Text variant="body" color="secondary">
              {suggestion.reason}
            </Text>
            <Text variant="caption" color="muted">
              {suggestion.items.length} parca
            </Text>
          </Card>
        ))}
      </View>

      <Button title="Kombin Oner" onPress={handleRecommend} loading={isRecommending} style={styles.cta} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    gap: SPACING.md,
    padding: SPACING.lg,
    paddingTop: 64,
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
  cta: {
    marginTop: "auto",
  },
});
