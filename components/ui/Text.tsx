import { Text as RNText, type TextProps as RNTextProps, StyleSheet } from "react-native";

import { COLORS } from "@/constants/colors";
import { FONTS, FONT_SIZE, LINE_HEIGHT } from "@/constants/typography";

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
  return <RNText style={[styles[variant], { color: colorMap[color] }, style]} {...props} />;
}

const styles = StyleSheet.create({
  display: {
    fontFamily: FONTS.displayBold,
    fontSize: FONT_SIZE.display,
    lineHeight: LINE_HEIGHT.display,
    letterSpacing: -0.5,
  },
  h1: {
    fontFamily: FONTS.displayBold,
    fontSize: FONT_SIZE.h1,
    lineHeight: LINE_HEIGHT.h1,
    letterSpacing: -0.3,
  },
  h2: {
    fontFamily: FONTS.sansBold,
    fontSize: FONT_SIZE.h2,
    lineHeight: LINE_HEIGHT.h2,
    letterSpacing: -0.2,
  },
  h3: {
    fontFamily: FONTS.sansBold,
    fontSize: FONT_SIZE.h3,
    lineHeight: LINE_HEIGHT.h3,
    letterSpacing: -0.1,
  },
  body: {
    fontFamily: FONTS.sansRegular,
    fontSize: FONT_SIZE.body,
    lineHeight: LINE_HEIGHT.body,
    letterSpacing: 0,
  },
  label: {
    fontFamily: FONTS.sansMedium,
    fontSize: FONT_SIZE.label,
    lineHeight: LINE_HEIGHT.label,
    letterSpacing: 0,
  },
  caption: {
    fontFamily: FONTS.sansMedium,
    fontSize: FONT_SIZE.caption,
    lineHeight: LINE_HEIGHT.caption,
    letterSpacing: 0.3,
  },
});
