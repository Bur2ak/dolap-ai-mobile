import { useEffect, useRef } from "react";
import { Animated, Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function BottomSheet({ visible, onClose, children, style }: BottomSheetProps) {
  const translateY = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : 300,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [translateY, visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }, style]}>
          <View style={styles.handle} />
          <Pressable onPress={() => undefined}>{children}</Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.48)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: SPACING.lg,
    paddingBottom: 40,
  },
  handle: {
    alignSelf: "center",
    backgroundColor: COLORS.border,
    borderRadius: 999,
    height: 4,
    marginBottom: SPACING.md,
    width: 40,
  },
});
