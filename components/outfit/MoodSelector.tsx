import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";

export const MOODS = ["Rahat", "Sik", "Dikkat cekici", "Minimal", "Enerjik"] as const;
export type Mood = (typeof MOODS)[number];

interface MoodSelectorProps {
  value: Mood;
  onChange: (mood: Mood) => void;
  disabled?: boolean;
}

export function MoodSelector({ value, onChange, disabled }: MoodSelectorProps) {
  return (
    <View style={styles.wrap}>
      {MOODS.map((mood) => {
        const active = mood === value;
        return (
          <Pressable
            key={mood}
            style={[styles.chip, active && styles.activeChip]}
            onPress={() => onChange(mood)}
            disabled={disabled}
          >
            <Text variant="label" color={active ? "inverse" : "secondary"}>
              {mood}
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
