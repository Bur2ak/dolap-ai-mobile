import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { Text } from "@/components/ui/Text";

interface HeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Header({ title, showBack = false, onBack, right, style }: HeaderProps) {
  const insets = useSafeAreaInsets();

  function handleBack() {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + SPACING.sm }, style]}>
      <View style={styles.left}>
        {showBack ? (
          <Pressable style={styles.iconButton} onPress={handleBack} accessibilityRole="button" accessibilityLabel="Geri">
            <Ionicons name="arrow-back-outline" size={24} color={COLORS.primary} />
          </Pressable>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>
      <Text variant="h3" style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.right}>{right ?? <View style={styles.placeholder} />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  left: {
    width: 44,
  },
  right: {
    alignItems: "flex-end",
    width: 44,
  },
  title: {
    flex: 1,
    textAlign: "center",
  },
  iconButton: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  placeholder: {
    height: 40,
    width: 40,
  },
});
