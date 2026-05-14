import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";

import { COLORS } from "@/constants/colors";
import { Input, type InputProps } from "./Input";

type PasswordInputProps = Omit<InputProps, "rightElement" | "secureTextEntry">;

export function PasswordInput(props: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);
  const disabled = props.editable === false;

  return (
    <Input
      {...props}
      secureTextEntry={!isVisible}
      rightElement={
        <Pressable
          accessibilityLabel={isVisible ? "Sifreyi gizle" : "Sifreyi goster"}
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => setIsVisible((value) => !value)}
          disabled={disabled}
          style={[styles.toggle, disabled ? styles.disabled : null]}
        >
          <Ionicons name={isVisible ? "eye-off-outline" : "eye-outline"} size={22} color={COLORS.textSecondary} />
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  toggle: {
    alignItems: "center",
    borderRadius: 999,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  disabled: {
    opacity: 0.5,
  },
});
