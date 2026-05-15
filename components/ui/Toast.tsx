import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { Text } from "./Text";

type ToastVariant = "default" | "success" | "error";

interface ToastMessage {
  id: string;
  message: string;
  variant?: ToastVariant;
}

let showToastFn: ((message: string, variant?: ToastVariant) => void) | null = null;

export function showToast(message: string, variant: ToastVariant = "default") {
  showToastFn?.(message, variant);
}

export function ToastProvider() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    showToastFn = (message, variant = "default") => {
      const id = String(Date.now());
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3000);
    };
    return () => {
      showToastFn = null;
    };
  }, []);

  return (
    <View style={[styles.container, { top: insets.top + SPACING.sm }]} pointerEvents="none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </View>
  );
}

function ToastItem({ toast }: { toast: ToastMessage }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2400),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [opacity]);

  return (
    <Animated.View style={[styles.toast, styles[toast.variant ?? "default"], { opacity }]}>
      <Text variant="body" color="inverse" style={styles.message}>
        {toast.message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    left: SPACING.lg,
    position: "absolute",
    right: SPACING.lg,
    zIndex: 9999,
    gap: SPACING.sm,
  },
  toast: {
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    width: "100%",
  },
  message: {
    textAlign: "center",
  },
  default: {
    backgroundColor: COLORS.primary,
  },
  success: {
    backgroundColor: COLORS.success,
  },
  error: {
    backgroundColor: COLORS.danger,
  },
});
