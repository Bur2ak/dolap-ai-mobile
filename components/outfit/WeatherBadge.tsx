import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import type { WeatherData } from "@/types";

interface WeatherBadgeProps {
  weather: WeatherData | null;
  isLoading?: boolean;
}

export function WeatherBadge({ weather, isLoading }: WeatherBadgeProps) {
  return (
    <Card style={styles.card}>
      <Ionicons name="partly-sunny-outline" size={28} color={COLORS.primary} />
      <View style={styles.copy}>
        <Text variant="h3">
          {weather ? `${weather.temp}°C, ${weather.city}` : "Hava durumu hazir degil"}
        </Text>
        <Text variant="body" color="secondary">
          {weather
            ? weather.description
            : isLoading
              ? "Konum ve hava bilgisi aliniyor."
              : "OpenWeather anahtari veya konum izni gerekebilir."}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
  },
  copy: {
    flex: 1,
  },
});
