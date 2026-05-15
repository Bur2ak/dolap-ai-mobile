import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";

interface DividerProps {
  spacing?: "sm" | "md" | "lg";
  style?: StyleProp<ViewStyle>;
}

export function Divider({ spacing = "md", style }: DividerProps) {
  return <View style={[styles.base, styles[spacing], style]} />;
}

const styles = StyleSheet.create({
  base: {
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
  },
  sm: {
    marginVertical: SPACING.sm,
  },
  md: {
    marginVertical: SPACING.md,
  },
  lg: {
    marginVertical: SPACING.lg,
  },
});
