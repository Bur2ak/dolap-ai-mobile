import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";

import { COLORS } from "@/constants/colors";
import { Text } from "./Text";

type AvatarSize = "sm" | "md" | "lg";

interface AvatarProps {
  uri?: string | null;
  name?: string | null;
  size?: AvatarSize;
  style?: StyleProp<ViewStyle>;
}

const sizeMap: Record<AvatarSize, number> = {
  sm: 32,
  md: 44,
  lg: 64,
};

export function Avatar({ uri, name, size = "md", style }: AvatarProps) {
  const dimension = sizeMap[size];
  const initials = getInitials(name);

  return (
    <View style={[styles.base, { width: dimension, height: dimension, borderRadius: dimension / 2 }, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: dimension, height: dimension, borderRadius: dimension / 2 }}
          contentFit="cover"
          accessibilityLabel={name ?? "avatar"}
        />
      ) : (
        <Text variant={size === "lg" ? "h3" : "label"} color="inverse">
          {initials}
        </Text>
      )}
    </View>
  );
}

function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    overflow: "hidden",
  },
});
