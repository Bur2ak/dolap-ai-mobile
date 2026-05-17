import type { ReactNode } from "react";
import { StyleSheet, TextInput, type TextInputProps, View } from "react-native";

import { COLORS } from "@/constants/colors";
import { FONTS, FONT_SIZE } from "@/constants/typography";
import { SPACING } from "@/constants/spacing";
import { Text } from "./Text";

export interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  rightElement?: ReactNode;
}

export function Input({ label, error, rightElement, style, ...props }: InputProps) {
  return (
    <View style={styles.container}>
      <Text variant="label">{label}</Text>
      <View style={styles.inputShell}>
        <TextInput
          placeholderTextColor={COLORS.textMuted}
          style={[
            styles.input,
            rightElement ? styles.inputWithRightElement : null,
            error ? styles.inputError : null,
            style,
          ]}
          {...props}
        />
        {rightElement ? <View style={styles.rightElement}>{rightElement}</View> : null}
      </View>
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.xs,
  },
  inputShell: {
    justifyContent: "center",
  },
  input: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    color: COLORS.text,
    fontFamily: FONTS.sansRegular,
    fontSize: FONT_SIZE.body,
    minHeight: 50,
    paddingHorizontal: SPACING.md,
  },
  inputWithRightElement: {
    paddingRight: 52,
  },
  inputError: {
    borderColor: COLORS.danger,
  },
  rightElement: {
    position: "absolute",
    right: SPACING.sm,
    top: 8,
  },
});
