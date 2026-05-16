import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";

interface DividerProps {
  spacing?: "sm" | "md" | "lg";
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export function Divider({ spacing = "md", label, style }: DividerProps) {
  if (label) {
    return (
      <View style={[styles.labeled, styles[spacing], style]}>
        <View style={styles.line} />
        <Text variant="caption" color="muted" style={styles.labelText}>{label}</Text>
        <View style={styles.line} />
      </View>
    );
  }
  return <View style={[styles.base, styles[spacing], style]} />;
}

const styles = StyleSheet.create({
  base: {
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
  },
  labeled: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  line: {
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
    flex: 1,
  },
  labelText: {
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
