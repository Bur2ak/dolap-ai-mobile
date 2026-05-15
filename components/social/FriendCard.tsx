import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { captureEvent } from "@/lib/observability";
import type { Profile } from "@/types";

interface FriendCardProps {
  profile: Profile;
  onBlock?: () => void;
  onDelete?: () => void;
  isBlockLoading?: boolean;
  isDeleteLoading?: boolean;
  disabled?: boolean;
}

export function FriendCard({ profile, onBlock, onDelete, isBlockLoading, isDeleteLoading, disabled }: FriendCardProps) {
  return (
    <View style={styles.container}>
      <Pressable
        style={styles.info}
        onPress={() => {
          captureEvent("friend_card_profile_opened", { user_id: profile.id });
          router.push(`/social/${profile.id}`);
        }}
        disabled={disabled}
      >
        <Avatar uri={profile.avatar_url} name={profile.full_name ?? profile.username} size="md" />
        <View style={styles.copy}>
          <Text variant="label">{profile.full_name ?? profile.username ?? "Arkadas"}</Text>
          {profile.username ? (
            <Text variant="caption" color="muted">
              @{profile.username}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {(onBlock || onDelete) && (
        <View style={styles.actions}>
          {onBlock ? (
            <Button title="Engelle" variant="ghost" onPress={onBlock} loading={isBlockLoading} disabled={disabled} style={styles.actionButton} />
          ) : null}
          {onDelete ? (
            <Button title="Kaldir" variant="ghost" onPress={onDelete} loading={isDeleteLoading} disabled={disabled} style={styles.actionButton} />
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACING.sm,
    justifyContent: "space-between",
    padding: SPACING.md,
  },
  info: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: SPACING.md,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  actions: {
    flexDirection: "row",
    gap: SPACING.xs,
  },
  actionButton: {
    minHeight: 38,
    paddingHorizontal: SPACING.sm,
  },
});
