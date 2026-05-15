import { Modal as RNModal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Modal({ visible, onClose, children, style }: ModalProps) {
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, style]} onPress={() => undefined}>
          {children}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.48)",
    flex: 1,
    justifyContent: "center",
    padding: SPACING.lg,
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.lg,
    width: "100%",
  },
});
