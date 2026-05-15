import { FlatList, Pressable, StyleSheet } from "react-native";

import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import type { Season } from "@/types";

type SeasonValue = Season | "all";

const seasonOptions: Array<{ label: string; value: SeasonValue }> = [
  { label: "Tum sezonlar", value: "all" },
  { label: "Ilkbahar", value: "ilkbahar" },
  { label: "Yaz", value: "yaz" },
  { label: "Sonbahar", value: "sonbahar" },
  { label: "Kis", value: "kis" },
];

interface SeasonFilterProps {
  value: SeasonValue;
  onChange: (value: SeasonValue) => void;
  disabled?: boolean;
}

export function SeasonFilter({ value, onChange, disabled }: SeasonFilterProps) {
  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={seasonOptions}
      keyExtractor={(item) => item.value}
      contentContainerStyle={styles.strip}
      renderItem={({ item }) => {
        const active = item.value === value;
        return (
          <Pressable
            style={[styles.chip, active && styles.activeChip]}
            onPress={() => onChange(item.value)}
            disabled={disabled}
          >
            <Text variant="caption" color={active ? "inverse" : "secondary"}>
              {item.label}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  strip: {
    gap: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  chip: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  activeChip: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
});
