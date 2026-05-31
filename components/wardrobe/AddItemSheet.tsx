import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/typography";
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
        <Text variant="h3" style={styles.title}>Kıyafet Ekle</Text>
        <Text variant="body" color="secondary" style={styles.subtitle}>
          En hızlı yol: birden fazla parçayı tek fotoğrafta ekle.
        </Text>

        {/* Önerilen: Akıllı Tarama */}
        <TouchableOpacity
          style={[styles.primaryOption, disabled && styles.disabled]}
          onPress={() => { onClose(); router.push("/item/smart-scan"); }}
          disabled={disabled}
          activeOpacity={0.85}
        >
          <View style={styles.primaryIcon}>
            <Ionicons name="scan-outline" size={22} color={COLORS.textInverse} />
          </View>
          <View style={styles.optionCopy}>
            <View style={styles.titleRow}>
              <Text variant="label" color="inverse">Akıllı Tarama</Text>
              <View style={styles.badge}><Text variant="caption" style={styles.badgeText}>ÖNERİLEN</Text></View>
            </View>
            <Text variant="caption" style={styles.primarySubtext}>Tek fotoğrafla birden fazla parça</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>

        {/* Galeriden toplu */}
        <TouchableOpacity
          style={[styles.option, disabled && styles.disabled]}
          onPress={() => { onClose(); onLibrary(); }}
          disabled={disabled}
          activeOpacity={0.85}
        >
          <View style={styles.optionIcon}>
            <Ionicons name="images-outline" size={20} color={COLORS.accentText} />
          </View>
          <View style={styles.optionCopy}>
            <Text variant="label">Galeriden Seç</Text>
            <Text variant="caption" color="muted">Var olan fotoğraflarından içe aktar</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>

        {/* Tek tek kamera */}
        <TouchableOpacity
          style={[styles.option, disabled && styles.disabled]}
          onPress={() => { onClose(); onCamera(); }}
          disabled={disabled}
          activeOpacity={0.85}
        >
          <View style={styles.optionIcon}>
            <Ionicons name="camera-outline" size={20} color={COLORS.accentText} />
          </View>
          <View style={styles.optionCopy}>
            <Text variant="label">Fotoğraf Çek</Text>
            <Text variant="caption" color="muted">Tek parça için</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: SPACING.sm },
  title: { textAlign: "center" },
  subtitle: { textAlign: "center", marginBottom: SPACING.xs },

  primaryOption: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    flexDirection: "row",
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  primaryIcon: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  primarySubtext: { color: "rgba(255,255,255,0.7)" },
  titleRow: { alignItems: "center", flexDirection: "row", gap: SPACING.xs },
  badge: { backgroundColor: COLORS.accent, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText: { color: COLORS.textInverse, fontFamily: FONTS.sansBold, fontSize: 8, letterSpacing: 0.5 },

  option: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  optionIcon: {
    alignItems: "center",
    backgroundColor: COLORS.accentSoft,
    borderRadius: 12,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  optionCopy: { flex: 1, gap: 2 },
  disabled: { opacity: 0.5 },
});
