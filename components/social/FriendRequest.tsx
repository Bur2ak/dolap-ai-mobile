import { StyleSheet, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import type { Profile } from "@/types";

interface FriendRequestProps {
  from: Profile;
  onAccept: () => void;
  onBlock: () => void;
  isAcceptLoading?: boolean;
  isBlockLoading?: boolean;
  disabled?: boolean;
}

export function FriendRequest({ from, onAccept, onBlock, isAcceptLoading, isBlockLoading, disabled }: FriendRequestProps) {
  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <Avatar uri={from.avatar_url} name={from.full_name ?? from.username} size="md" />
        <View style={styles.copy}>
          <Text variant="caption" color="muted">
            ARKADAS ISTEGI
          </Text>
          <Text variant="label">{from.full_name ?? from.username ?? "Biri"}</Text>
          {from.username ? (
            <Text variant="caption" color="muted">
              @{from.username}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.actions}>
        <Button title="Kabul Et" onPress={onAccept} loading={isAcceptLoading} disabled={disabled} style={styles.button} />
        <Button title="Reddet" variant="ghost" onPress={onBlock} loading={isBlockLoading} disabled={disabled} style={styles.button} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: SPACING.md,
    padding: SPACING.md,
  },
  top: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  actions: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  button: {
    flex: 1,
    minHeight: 44,
  },
});
