import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { captureError, captureEvent } from "@/lib/observability";
import { useAuthStore } from "@/stores/authStore";
import type { PrivacySettings } from "@/types";

const defaultPrivacy: PrivacySettings = {
  wardrobe_visible: false,
  allow_friend_requests: true,
};

const rows: Array<{ key: keyof PrivacySettings; title: string; body: string }> = [
  {
    key: "wardrobe_visible",
    title: "Arkadaslar dolabimi gorebilir",
    body: "Paylasilabilir isaretlenen kiyafetler sosyal ekranda gorunebilir.",
  },
  {
    key: "allow_friend_requests",
    title: "Arkadaslik isteklerine izin ver",
    body: "Kullanici adi ile seni bulanlar istek gonderebilir.",
  },
];

export default function PrivacySettingsScreen() {
  const { profile, updateProfile } = useAuthStore();
  const [updatingKey, setUpdatingKey] = useState<keyof PrivacySettings | null>(null);
  const privacy = profile?.privacy_settings ?? defaultPrivacy;

  useEffect(() => {
    captureEvent("privacy_settings_screen_viewed", {
      wardrobe_visible: privacy.wardrobe_visible,
      allow_friend_requests: privacy.allow_friend_requests,
    });
  }, [privacy.allow_friend_requests, privacy.wardrobe_visible]);

  async function toggle(key: keyof PrivacySettings) {
    if (updatingKey) {
      return;
    }

    try {
      setUpdatingKey(key);
      await updateProfile({
        privacy_settings: {
          ...privacy,
          [key]: !privacy[key],
        },
      });
      captureEvent("privacy_setting_toggled", { enabled: !privacy[key], setting: key });
    } catch (error) {
      captureError(error, { area: "privacy_setting_toggle", setting: key });
      Alert.alert("Guncellenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setUpdatingKey(null);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} />
        <Text variant="h2">Gizlilik</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Card style={styles.section}>
        <Text variant="h3">Paylasim tercihleri</Text>
        <View style={styles.summaryRow}>
          <StatusPill label="Dolap" enabled={privacy.wardrobe_visible} />
          <StatusPill label="Istekler" enabled={privacy.allow_friend_requests} />
        </View>
        {rows.map((row) => {
          const enabled = privacy[row.key];
          const disabled = Boolean(updatingKey);
          return (
            <Pressable key={row.key} style={[styles.row, disabled && styles.rowDisabled]} onPress={() => void toggle(row.key)} disabled={disabled}>
              <View style={styles.rowCopy}>
                <Text variant="label">{row.title}</Text>
                <Text variant="body" color="secondary">
                  {row.body}
                </Text>
              </View>
              <View style={[styles.toggle, enabled && styles.toggleActive, updatingKey === row.key && styles.toggleUpdating]}>
                <View style={[styles.knob, enabled && styles.knobActive]} />
              </View>
            </Pressable>
          );
        })}
      </Card>
    </ScrollView>
  );
}

function StatusPill({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <View style={[styles.statusPill, enabled ? styles.statusPillActive : styles.statusPillMuted]}>
      <Text variant="caption" color={enabled ? "inverse" : "secondary"}>
        {label}: {enabled ? "Acik" : "Kapali"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  content: {
    gap: SPACING.md,
    padding: SPACING.lg,
    paddingTop: 56,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerSpacer: {
    width: 72,
  },
  section: {
    gap: SPACING.md,
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  statusPillActive: {
    backgroundColor: COLORS.primary,
  },
  statusPillMuted: {
    backgroundColor: COLORS.surfaceMuted,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
  },
  rowDisabled: {
    opacity: 0.72,
  },
  rowCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  toggle: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 999,
    height: 30,
    justifyContent: "center",
    paddingHorizontal: 3,
    width: 54,
  },
  toggleActive: {
    backgroundColor: COLORS.primary,
  },
  toggleUpdating: {
    borderColor: COLORS.warning,
    borderWidth: 1,
  },
  knob: {
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    height: 24,
    width: 24,
  },
  knobActive: {
    transform: [{ translateX: 24 }],
  },
});
