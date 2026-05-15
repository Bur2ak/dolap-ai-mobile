import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { EVENT_TYPES } from "@/constants/events";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";

interface EventSelectorProps {
  value: string;
  onChange: (event: string) => void;
  maxItems?: number;
  disabled?: boolean;
}

export function EventSelector({ value, onChange, maxItems, disabled }: EventSelectorProps) {
  const options = maxItems ? EVENT_TYPES.slice(0, maxItems) : EVENT_TYPES;

  return (
    <View style={styles.wrap}>
      {options.map((event) => {
        const active = event.value === value;
        return (
          <Pressable
            key={event.value}
            style={[styles.chip, active && styles.activeChip]}
            onPress={() => onChange(event.value)}
            disabled={disabled}
          >
            <Text variant="label" color={active ? "inverse" : "secondary"}>
              {event.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
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
