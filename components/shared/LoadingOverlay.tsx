import { ActivityIndicator, Modal, StyleSheet, View } from "react-native";

import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { Text } from "@/components/ui/Text";

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export function LoadingOverlay({ visible, message }: LoadingOverlayProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          {message ? (
            <Text variant="body" color="secondary" style={styles.message}>
              {message}
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.48)",
    flex: 1,
    justifyContent: "center",
  },
  card: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    gap: SPACING.md,
    padding: SPACING.xl,
  },
  message: {
    maxWidth: 220,
    textAlign: "center",
  },
});
