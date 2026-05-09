import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";

import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { Button } from "./Button";
import { Card } from "./Card";
import { Text } from "./Text";

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  actionLabel?: string;
  loading?: boolean;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({ icon, title, body, actionLabel, loading = false, onAction, style }: EmptyStateProps) {
  return (
    <Card style={[styles.empty, style]}>
      <Ionicons name={icon} size={42} color={COLORS.primary} />
      <Text variant="h3" style={styles.centerText}>
        {title}
      </Text>
      <Text variant="body" color="secondary" style={styles.centerText}>
        {body}
      </Text>
      {actionLabel && onAction ? (
        <Button title={actionLabel} variant="secondary" loading={loading} onPress={onAction} style={styles.action} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  action: {
    marginTop: SPACING.xs,
    minWidth: 144,
  },
  centerText: {
    textAlign: "center",
  },
  empty: {
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: 40,
  },
});
