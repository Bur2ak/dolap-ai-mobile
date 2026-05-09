import { Image as ExpoImage, type ImageProps } from "expo-image";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { COLORS } from "@/constants/colors";

type CachedImageProps = {
  fallbackColor?: null | string;
  sourceUri?: null | string;
  style?: ImageProps["style"];
} & Pick<ImageProps, "accessibilityLabel" | "contentFit">;

export function CachedImage({ accessibilityLabel, contentFit = "cover", fallbackColor, sourceUri, style }: CachedImageProps) {
  if (!sourceUri) {
    return <View accessibilityLabel={accessibilityLabel} style={[style as StyleProp<ViewStyle>, styles.fallback, { backgroundColor: fallbackColor ?? COLORS.primarySoft }]} />;
  }

  return (
    <ExpoImage
      accessibilityLabel={accessibilityLabel}
      cachePolicy="memory-disk"
      contentFit={contentFit}
      source={{ uri: sourceUri }}
      style={style}
      transition={160}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    overflow: "hidden",
  },
});
