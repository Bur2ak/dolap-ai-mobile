import { ActivityIndicator, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

import { COLORS } from "@/constants/colors";
import { FONTS, FONT_SIZE } from "@/constants/typography";
import { SPACING } from "@/constants/spacing";
import { Text } from "./Text";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends PressableProps {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ title, variant = "primary", loading = false, disabled, style, ...props }: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === "primary" ? COLORS.textInverse : COLORS.primary} />
      ) : (
        <Text
          variant="label"
          color={variant === "primary" ? "inverse" : "primary"}
          style={[styles.title, variant === "ghost" && styles.ghostTitle]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: SPACING.lg,
  },
  title: {
    flexShrink: 1,
    textAlign: "center",
  },
  ghostTitle: {
    fontFamily: FONTS.sansMedium,
    fontSize: FONT_SIZE.label,
  },
  primary: {
    backgroundColor: COLORS.primary,
  },
  secondary: {
    backgroundColor: COLORS.primarySoft,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.45,
  },
});
