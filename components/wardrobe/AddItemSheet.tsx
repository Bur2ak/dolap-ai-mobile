import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";

interface AddItemSheetProps {
  visible: boolean;
  onClose: () => void;
  onCamera: () => void;
  onLibrary: () => void;
  disabled?: boolean;
}

export function AddItemSheet({ visible, onClose, onCamera, onLibrary, disabled }: AddItemSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.content}>
        <Text variant="h3" style={styles.title}>
          Kıyafet Ekle
        </Text>
        <Text variant="body" color="secondary" style={styles.subtitle}>
          Fotoğraf çek veya galerinden seç. AI arka planı otomatik kaldırıp analiz edecek.
        </Text>
        <View style={styles.options}>
          <Button
            title="Fotoğraf Çek"
            onPress={() => { onClose(); onCamera(); }}
            disabled={disabled}
          />
          <Button
            title="Galeriden Seç"
            variant="secondary"
            onPress={() => { onClose(); onLibrary(); }}
            disabled={disabled}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: SPACING.md,
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
  },
  options: {
    gap: SPACING.sm,
    paddingTop: SPACING.sm,
  },
});
