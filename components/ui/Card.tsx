import { StyleSheet, View, type ViewProps } from "react-native";

import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";

export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    padding: SPACING.md,
  },
});
