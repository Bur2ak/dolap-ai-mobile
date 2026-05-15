import { FlatList, Pressable, StyleSheet } from "react-native";

import { Text } from "@/components/ui/Text";
import { CATEGORIES } from "@/constants/categories";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import type { ClothingCategory } from "@/types";

type CategoryValue = ClothingCategory | "all";

interface CategoryFilterProps {
  value: CategoryValue;
  onChange: (value: CategoryValue) => void;
  disabled?: boolean;
}

const ALL_OPTION = { label: "Tumu", value: "all" as const };

export function CategoryFilter({ value, onChange, disabled }: CategoryFilterProps) {
  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={[ALL_OPTION, ...CATEGORIES]}
      keyExtractor={(item) => item.value}
      contentContainerStyle={styles.strip}
      renderItem={({ item }) => {
        const active = item.value === value;
        return (
          <Pressable
            style={[styles.chip, active && styles.activeChip]}
            onPress={() => onChange(item.value as CategoryValue)}
            disabled={disabled}
          >
            <Text variant="label" color={active ? "inverse" : "secondary"}>
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
    paddingBottom: SPACING.sm,
    paddingTop: SPACING.lg,
  },
  chip: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  activeChip: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
});
