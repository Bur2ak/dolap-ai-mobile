import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { Text } from "./Text";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "muted";

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: StyleProp<ViewStyle>;
}

export function Badge({ label, variant = "default", style }: BadgeProps) {
  return (
    <View style={[styles.base, styles[variant], style]}>
      <Text variant="caption" color="inverse" style={styles.text}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  text: {
    textTransform: "uppercase",
  },
  default: {
    backgroundColor: COLORS.primary,
  },
  success: {
    backgroundColor: COLORS.success,
  },
  warning: {
    backgroundColor: COLORS.warning,
  },
  danger: {
    backgroundColor: COLORS.danger,
  },
  muted: {
    backgroundColor: COLORS.textMuted,
  },
});
