import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";

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
const dataCategories = [
  {
    body: "Email, ad, kullanici adi, bio ve abonelik durumu.",
    title: "Hesap bilgileri",
  },
  {
    body: "Kiyafet fotograflari, kategori, renk, sezon, marka ve kullanim sinyalleri.",
    title: "Dolap verileri",
  },
  {
    body: "Kombin onerileri, Almali Miyim gecmisi, etkinlik planlari ve fiyat takipleri.",
    title: "Uygulama verileri",
  },
  {
    body: "Bildirim token'i, hata/performans sinyalleri ve urun analitigi olaylari.",
    title: "Teknik veriler",
  },
];
const privacyActions = [
  {
    body: "Hesap silme talebini baslat veya bekleyen talebi iptal et.",
    label: "account_deletion",
    route: "/settings/account" as const,
    title: "Hesap silme",
  },
  {
    body: "Push, fiyat, sosyal ve odunc bildirim tercihlerini yonet.",
    label: "notifications",
    route: "/settings/notifications" as const,
    title: "Bildirim tercihleri",
  },
  {
    body: "KVKK, gizlilik politikasi ve kullanim sartlarini uygulama icinde incele.",
    label: "legal",
    route: "/legal/kvkk" as const,
    title: "Yasal metinler",
  },
];

export default function PrivacySettingsScreen() {
  const { profile, updateProfile } = useAuthStore();
  const [updatingKey, setUpdatingKey] = useState<keyof PrivacySettings | null>(null);
  const [isSharingSummary, setIsSharingSummary] = useState(false);
  const privacy = profile?.privacy_settings ?? defaultPrivacy;
  const isBusy = Boolean(updatingKey) || isSharingSummary;

  useEffect(() => {
    captureEvent("privacy_settings_screen_viewed", {
      wardrobe_visible: privacy.wardrobe_visible,
      allow_friend_requests: privacy.allow_friend_requests,
    });
  }, [privacy.allow_friend_requests, privacy.wardrobe_visible]);

  async function toggle(key: keyof PrivacySettings) {
    if (isBusy) {
      return;
    }

    if (!profile) {
      Alert.alert("Giris gerekli", "Gizlilik ayarlarini degistirmek icin tekrar giris yapmalisin.");
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

  function openRoute(route: Parameters<typeof router.push>[0], label: string) {
    if (isBusy) {
      return;
    }

    captureEvent("privacy_route_opened", { label });
    router.push(route);
  }

  async function handleSharePrivacySummary() {
    if (isBusy) {
      return;
    }

    setIsSharingSummary(true);
    try {
      const result = await Share.share({
        title: "Shipirio gizlilik ozeti",
        message: buildPrivacySummary({
          allowFriendRequests: privacy.allow_friend_requests,
          userEmail: profile?.username ?? profile?.full_name ?? "Shipirio kullanicisi",
          wardrobeVisible: privacy.wardrobe_visible,
        }),
      });
      captureEvent("privacy_summary_shared", { completed: result.action === Share.sharedAction });
    } catch (error) {
      captureError(error, { area: "privacy_summary_share" });
      Alert.alert("Paylasilamadi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setIsSharingSummary(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} disabled={isBusy} />
        <Text variant="h2">Gizlilik</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Card style={styles.section}>
        <Text variant="h3">Gizlilik merkezi</Text>
        <Text variant="body" color="secondary">
          Shipirio dolap, kombin, fiyat ve sosyal ozellikleri calistirmak icin sadece gerekli verileri kullanir. Paylasim kontrolleri sende kalir.
        </Text>
        <Button title="Gizlilik Ozetini Paylas" variant="secondary" onPress={() => void handleSharePrivacySummary()} loading={isSharingSummary} disabled={isBusy} />
      </Card>

      <Card style={styles.section}>
        <Text variant="h3">Paylasim tercihleri</Text>
        <View style={styles.summaryRow}>
          <StatusPill label="Dolap" enabled={privacy.wardrobe_visible} />
          <StatusPill label="Istekler" enabled={privacy.allow_friend_requests} />
        </View>
        {rows.map((row) => {
          const enabled = privacy[row.key];
          const disabled = isBusy || !profile;
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

      <Card style={styles.section}>
        <Text variant="h3">Veri kategorileri</Text>
        {dataCategories.map((category) => (
          <View key={category.title} style={styles.dataRow}>
            <View style={styles.dataDot} />
            <View style={styles.dataCopy}>
              <Text variant="label">{category.title}</Text>
              <Text variant="body" color="secondary">
                {category.body}
              </Text>
            </View>
          </View>
        ))}
      </Card>

      <Card style={styles.section}>
        <Text variant="h3">Kontroller</Text>
        {privacyActions.map((action) => (
          <View key={action.label} style={styles.actionRow}>
            <View style={styles.actionCopy}>
              <Text variant="label">{action.title}</Text>
              <Text variant="caption" color="secondary">
                {action.body}
              </Text>
            </View>
            <Button title="Ac" variant="ghost" onPress={() => openRoute(action.route, action.label)} disabled={isBusy} style={styles.actionButton} />
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

function buildPrivacySummary({
  allowFriendRequests,
  userEmail,
  wardrobeVisible,
}: {
  allowFriendRequests: boolean;
  userEmail: string;
  wardrobeVisible: boolean;
}) {
  return [
    "Shipirio gizlilik ozeti",
    `Kullanici: ${userEmail}`,
    "",
    "Paylasim tercihleri:",
    `- Arkadaslar dolabi gorebilir: ${wardrobeVisible ? "Acik" : "Kapali"}`,
    `- Arkadaslik istekleri: ${allowFriendRequests ? "Acik" : "Kapali"}`,
    "",
    "Veri kategorileri:",
    ...dataCategories.map((category) => `- ${category.title}: ${category.body}`),
    "",
    "Hesap silme ve yasal metinler Profil > Ayarlar > Gizlilik / Hesap altindan yonetilebilir.",
  ].join("\n");
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
    paddingBottom: SPACING.xl,
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
  dataRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  dataDot: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: 10,
    marginTop: 7,
    width: 10,
  },
  dataCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  actionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
  },
  actionCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  actionButton: {
    minHeight: 40,
    paddingHorizontal: SPACING.sm,
  },
});
