import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { EVENT_TYPES } from "@/constants/events";
import { SPACING } from "@/constants/spacing";

const moods = ["Rahat", "Sik", "Dikkat cekici", "Minimal", "Enerjik"];

export default function OutfitScreen() {
  return (
    <View style={styles.container}>
      <Text variant="h1">Kombin</Text>
      <Text variant="body" color="secondary">
        Hava, etkinlik ve ruh haline gore dolabindan oneriler.
      </Text>

      <Card style={styles.weather}>
        <Ionicons name="partly-sunny-outline" size={28} color={COLORS.primary} />
        <View>
          <Text variant="h3">Hava durumu hazir degil</Text>
          <Text variant="body" color="secondary">
            Konum izni sonraki adimda baglanacak.
          </Text>
        </View>
      </Card>

      <Text variant="h3">Nereye gidiyorsun?</Text>
      <View style={styles.wrap}>
        {EVENT_TYPES.slice(0, 6).map((event) => (
          <View key={event.value} style={styles.chip}>
            <Text variant="label" color="secondary">
              {event.label}
            </Text>
          </View>
        ))}
      </View>

      <Text variant="h3">Ruh halin nasil?</Text>
      <View style={styles.wrap}>
        {moods.map((mood) => (
          <View key={mood} style={styles.chip}>
            <Text variant="label" color="secondary">
              {mood}
            </Text>
          </View>
        ))}
      </View>

      <Button title="Kombin Oner" onPress={() => undefined} style={styles.cta} />
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
  cta: {
    marginTop: "auto",
  },
});
