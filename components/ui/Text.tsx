import { Text as RNText, type TextProps as RNTextProps, StyleSheet } from "react-native";

import { COLORS } from "@/constants/colors";
import { FONT_SIZE } from "@/constants/typography";

type TextVariant = "display" | "h1" | "h2" | "h3" | "body" | "label" | "caption";
type TextColor = "primary" | "secondary" | "muted" | "inverse" | "danger";

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: TextColor;
}

const colorMap: Record<TextColor, string> = {
  primary: COLORS.text,
  secondary: COLORS.textSecondary,
  muted: COLORS.textMuted,
  inverse: COLORS.textInverse,
  danger: COLORS.danger,
};

export function Text({ variant = "body", color = "primary", style, ...props }: TextProps) {
  return <RNText style={[styles.base, styles[variant], { color: colorMap[color] }, style]} {...props} />;
}

const styles = StyleSheet.create({
  base: {
    letterSpacing: 0,
  },
  display: {
    fontSize: FONT_SIZE.display,
    fontWeight: "800",
    lineHeight: 50,
  },
  h1: {
    fontSize: FONT_SIZE.h1,
    fontWeight: "800",
    lineHeight: 38,
  },
  h2: {
    fontSize: FONT_SIZE.h2,
    fontWeight: "700",
    lineHeight: 30,
  },
  h3: {
    fontSize: FONT_SIZE.h3,
    fontWeight: "700",
    lineHeight: 24,
  },
  body: {
    fontSize: FONT_SIZE.body,
    fontWeight: "400",
    lineHeight: 23,
  },
  label: {
    fontSize: FONT_SIZE.label,
    fontWeight: "700",
    lineHeight: 18,
  },
  caption: {
    fontSize: FONT_SIZE.caption,
    fontWeight: "700",
    lineHeight: 16,
    textTransform: "uppercase",
  },
});
