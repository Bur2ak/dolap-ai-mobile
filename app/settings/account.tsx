import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, Share, StyleSheet, View } from "react-native";
import * as WebBrowser from "expo-web-browser";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { createPublicAppLink } from "@/lib/links";
import { captureError, captureEvent } from "@/lib/observability";
import { useAuthStore } from "@/stores/authStore";
import type { Profile } from "@/types";
import { formatDate, formatDateOnly } from "@/utils/formatters";
import { getConfirmPasswordInputError, getPasswordInputError, getUsernameInputError, isValidUsername, normalizeUsername } from "@/utils/validation";

const maxBioLength = 160;

export default function AccountSettingsScreen() {
  const { profile, session, updatePassword, updateProfile } = useAuthStore();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isUpdatingDeletion, setIsUpdatingDeletion] = useState(false);
  const [isOpeningDeletionInfo, setIsOpeningDeletionInfo] = useState(false);
  const [isSharingAccountSummary, setIsSharingAccountSummary] = useState(false);
  const isBusy = isSaving || isSavingPassword || isUpdatingDeletion || isOpeningDeletionInfo || isSharingAccountSummary;
  const deletionInfoUrl = createPublicAppLink("/delete-account.html");

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setUsername(profile?.username ?? "");
    setBio(profile?.bio ?? "");
  }, [profile]);

  useEffect(() => {
    captureEvent("account_settings_screen_viewed", {
      has_username: Boolean(profile?.username),
      has_bio: Boolean(profile?.bio),
      deletion_requested: Boolean(profile?.deletion_requested_at),
    });
  }, [profile?.bio, profile?.deletion_requested_at, profile?.username]);

  async function handleSave() {
    if (isBusy) {
      captureEvent("account_profile_save_blocked", { reason: "busy" });
      return;
    }

    if (!profile) {
      captureEvent("account_profile_save_blocked", { reason: "missing_profile" });
      Alert.alert("Giris gerekli", "Profil bilgilerini guncellemek icin tekrar giris yapmalisin.");
      return;
    }

    const normalizedUsername = normalizeUsername(username);
    const trimmedBio = bio.trim();

    if (!fullName.trim()) {
      captureEvent("account_profile_save_blocked", { reason: "missing_name" });
      Alert.alert("Ad Soyad gerekli", "Profilinde gorunecek adini yaz.");
      return;
    }

    if (normalizedUsername && !isValidUsername(normalizedUsername)) {
      captureEvent("account_profile_save_blocked", { reason: "invalid_username" });
      Alert.alert("Kullanici adi gecersiz", "Kullanici adi 3-24 karakter olmali; sadece harf, rakam ve alt cizgi kullan.");
      return;
    }

    if (trimmedBio.length > maxBioLength) {
      captureEvent("account_profile_save_blocked", { reason: "bio_too_long" });
      Alert.alert("Bio uzun", `Bio en fazla ${maxBioLength} karakter olabilir.`);
      return;
    }

    try {
      setIsSaving(true);
      await updateProfile({
        full_name: fullName.trim() || null,
        username: normalizedUsername || null,
        bio: trimmedBio || null,
        onboarding_completed: true,
      });
      captureEvent("account_profile_saved", {
        has_bio: Boolean(trimmedBio),
        has_username: Boolean(normalizedUsername),
      });
      Alert.alert("Kaydedildi", "Hesap bilgilerin guncellendi.");
    } catch (error) {
      captureError(error, { area: "account_profile_save" });
      Alert.alert("Kaydedilemedi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleChangePassword() {
    if (isBusy) {
      captureEvent("account_password_change_blocked", { reason: "busy" });
      return;
    }

    if (!session) {
      captureEvent("account_password_change_blocked", { reason: "missing_session" });
      Alert.alert("Giris gerekli", "Sifreni degistirmek icin tekrar giris yapmalisin.");
      return;
    }

    if (password.length < 8) {
      captureEvent("account_password_change_blocked", { reason: "short_password" });
      Alert.alert("Sifre kisa", "Yeni sifre en az 8 karakter olmali.");
      return;
    }

    if (password !== confirmPassword) {
      captureEvent("account_password_change_blocked", { reason: "password_mismatch" });
      Alert.alert("Sifreler eslesmiyor", "Iki alana da ayni sifreyi yaz.");
      return;
    }

    try {
      setIsSavingPassword(true);
      await updatePassword(password);
      setPassword("");
      setConfirmPassword("");
      captureEvent("account_password_changed");
      Alert.alert("Sifre yenilendi", "Hesap sifren guncellendi.");
    } catch (error) {
      captureError(error, { area: "account_password_change" });
      Alert.alert("Sifre yenilenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setIsSavingPassword(false);
    }
  }

  function handleRequestDeletion() {
    if (isBusy) {
      captureEvent("account_deletion_request_blocked", { reason: "busy" });
      return;
    }

    if (!profile) {
      captureEvent("account_deletion_request_blocked", { reason: "missing_profile" });
      Alert.alert("Giris gerekli", "Hesap silme talebi icin tekrar giris yapmalisin.");
      return;
    }

    captureEvent("account_deletion_request_prompt_opened");
    Alert.alert(
      "Hesap silme talebi",
      "Hesabin 30 gun sonra kalici silinmek uzere isaretlenecek. Bu sure icinde talebi iptal edebilirsin.",
      [
        { text: "Vazgec", style: "cancel" },
        {
          text: "Talep Olustur",
          style: "destructive",
          onPress: () => {
            void updateDeletionRequest(true);
          },
        },
      ],
    );
  }

  function handleCancelDeletion() {
    if (isBusy) {
      captureEvent("account_deletion_cancel_blocked", { reason: "busy" });
      return;
    }

    if (!profile) {
      captureEvent("account_deletion_cancel_blocked", { reason: "missing_profile" });
      Alert.alert("Giris gerekli", "Hesap silme talebini yonetmek icin tekrar giris yapmalisin.");
      return;
    }

    captureEvent("account_deletion_cancel_prompt_opened");
    Alert.alert("Silme talebini iptal et", "Hesabin silinmek uzere isaretlenmeyecek.", [
      { text: "Vazgec", style: "cancel" },
      {
        text: "Iptal Et",
        onPress: () => {
          void updateDeletionRequest(false);
        },
      },
    ]);
  }

  async function updateDeletionRequest(requested: boolean) {
    if (!profile) {
      captureEvent(requested ? "account_deletion_request_blocked" : "account_deletion_cancel_blocked", { reason: "missing_profile" });
      Alert.alert("Giris gerekli", "Hesap silme talebini yonetmek icin tekrar giris yapmalisin.");
      return;
    }

    const requestedAt = requested ? new Date() : null;
    const scheduledFor = requestedAt ? new Date(requestedAt) : null;
    scheduledFor?.setDate(scheduledFor.getDate() + 30);

    try {
      setIsUpdatingDeletion(true);
      await updateProfile({
        deletion_requested_at: requestedAt?.toISOString() ?? null,
        deletion_scheduled_for: scheduledFor ? formatDateOnly(scheduledFor) : null,
      });
      captureEvent(requested ? "account_deletion_requested" : "account_deletion_cancelled", {
        scheduled_for: scheduledFor ? formatDateOnly(scheduledFor) : null,
      });
      Alert.alert(requested ? "Talep alindi" : "Talep iptal edildi", requested ? "Hesabin 30 gunluk bekleme surecine alindi." : "Hesap silme talebin iptal edildi.");
    } catch (error) {
      captureError(error, { area: "account_deletion_request", requested });
      Alert.alert("Guncellenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setIsUpdatingDeletion(false);
    }
  }

  async function openDeletionInfo() {
    if (isBusy) {
      captureEvent("account_deletion_info_blocked", { reason: "busy" });
      return;
    }

    try {
      setIsOpeningDeletionInfo(true);
      await WebBrowser.openBrowserAsync(deletionInfoUrl);
      captureEvent("account_deletion_info_opened");
    } catch (error) {
      captureError(error, { area: "account_deletion_info" });
      Alert.alert("Acilamadi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setIsOpeningDeletionInfo(false);
    }
  }

  async function handleShareAccountSummary() {
    if (isBusy) {
      captureEvent("account_summary_share_blocked", { reason: "busy" });
      return;
    }

    try {
      setIsSharingAccountSummary(true);
      await Share.share({
        title: "Shipirio hesap kontrol ozeti",
        message: buildAccountControlSummary(profile, session?.user.email ?? null),
      });
      captureEvent("account_summary_shared", {
        has_profile: Boolean(profile),
        deletion_requested: Boolean(profile?.deletion_requested_at),
      });
    } catch (error) {
      captureError(error, { area: "account_summary_share" });
      Alert.alert("Paylasilamadi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setIsSharingAccountSummary(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} disabled={isBusy} />
        <Text variant="h2">Hesap</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Card style={styles.form}>
        <Text variant="h3">Profil bilgileri</Text>
        <Input label="Ad Soyad" value={fullName} onChangeText={setFullName} editable={!isBusy} />
        <Input label="Kullanici adi" value={username} onChangeText={setUsername} autoCapitalize="none" error={getUsernameInputError(username)} editable={!isBusy} />
        <Text variant="caption" color="muted">
          3-24 karakter; harf, rakam ve alt cizgi kullan.
        </Text>
        <Input label="Bio" value={bio} onChangeText={setBio} multiline editable={!isBusy} />
        <Text variant="caption" color={bio.trim().length > maxBioLength ? "danger" : "muted"}>
          {bio.trim().length}/{maxBioLength}
        </Text>
        <Button title="Kaydet" onPress={handleSave} loading={isSaving} disabled={isBusy} />
      </Card>

      <Card style={styles.form}>
        <Text variant="h3">Hesap kontrol ozeti</Text>
        <Text variant="body" color="secondary">
          Profil, sozlesme ve silme durumunu destek veya store review icin tek metinde paylas.
        </Text>
        <View style={styles.statusGrid}>
          {getAccountReadiness(profile, session?.user.email ?? null).map((item) => (
            <View key={item.label} style={[styles.statusPill, item.ready ? styles.statusPillReady : styles.statusPillWarn]}>
              <Text variant="caption" color={item.ready ? "primary" : "secondary"}>
                {item.label}
              </Text>
              <Text variant="label">{item.value}</Text>
            </View>
          ))}
        </View>
        <Button title="Hesap Ozetini Paylas" variant="secondary" onPress={handleShareAccountSummary} loading={isSharingAccountSummary} disabled={isBusy} />
      </Card>

      <Card style={styles.form}>
        <Text variant="h3">Guvenlik</Text>
        <PasswordInput
          label="Yeni sifre"
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          textContentType="newPassword"
          error={getPasswordInputError(password)}
          editable={!isBusy}
        />
        <PasswordInput
          label="Yeni sifre tekrar"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          autoCapitalize="none"
          textContentType="newPassword"
          error={getConfirmPasswordInputError(password, confirmPassword)}
          editable={!isBusy}
        />
        <Text variant="caption" color="muted">
          Sifre en az 8 karakter olmali.
        </Text>
        <Button title="Sifreyi Yenile" variant="secondary" onPress={handleChangePassword} loading={isSavingPassword} disabled={isBusy} />
      </Card>

      <Card style={styles.dangerZone}>
        <Text variant="h3">Hesap silme</Text>
        {profile?.deletion_requested_at ? (
          <>
            <Text variant="body" color="secondary">
              Hesap silme talebin alindi. Planlanan silme tarihi: {profile.deletion_scheduled_for ? formatDate(profile.deletion_scheduled_for) : "30 gun icinde"}.
            </Text>
            <Button title="Hesap Silme Bilgisi" variant="ghost" onPress={() => void openDeletionInfo()} loading={isOpeningDeletionInfo} disabled={isBusy} />
            <Button title="Silme Talebini Iptal Et" variant="secondary" onPress={handleCancelDeletion} loading={isUpdatingDeletion} disabled={isBusy} />
          </>
        ) : (
          <>
            <Text variant="body" color="secondary">
              Talep olusturdugunda hesabinin ve iliskili verilerinin kalici silinmesi icin 30 gunluk sure baslar.
            </Text>
            <Button title="Hesap Silme Bilgisi" variant="secondary" onPress={() => void openDeletionInfo()} loading={isOpeningDeletionInfo} disabled={isBusy} />
            <Button title="Hesap Silme Talebi Olustur" variant="ghost" onPress={handleRequestDeletion} loading={isUpdatingDeletion} disabled={isBusy} />
          </>
        )}
      </Card>
    </ScrollView>
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
  form: {
    gap: SPACING.md,
  },
  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  statusPill: {
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    gap: SPACING.xs,
    minWidth: "45%",
    padding: SPACING.sm,
  },
  statusPillReady: {
    backgroundColor: COLORS.primarySoft,
  },
  statusPillWarn: {
    backgroundColor: COLORS.surface,
  },
  dangerZone: {
    borderColor: COLORS.danger,
    gap: SPACING.md,
  },
});

function getAccountReadiness(profile: Profile | null, email: string | null) {
  return [
    {
      label: "E-posta",
      value: email ? "Bagli" : "Eksik",
      ready: Boolean(email),
    },
    {
      label: "Profil",
      value: profile?.full_name ? "Hazir" : "Eksik",
      ready: Boolean(profile?.full_name),
    },
    {
      label: "Onboarding",
      value: profile?.onboarding_completed ? "Tamam" : "Devam",
      ready: Boolean(profile?.onboarding_completed),
    },
    {
      label: "Silme talebi",
      value: profile?.deletion_requested_at ? "Beklemede" : "Yok",
      ready: !profile?.deletion_requested_at,
    },
  ];
}

function buildAccountControlSummary(profile: Profile | null, email: string | null) {
  const rows = getAccountReadiness(profile, email).map((item) => `- ${item.label}: ${item.value}`);
  const deletionLine = profile?.deletion_requested_at
    ? `Hesap silme talebi: ${formatDate(profile.deletion_requested_at)} tarihinde alindi. Planlanan silme: ${profile.deletion_scheduled_for ? formatDate(profile.deletion_scheduled_for) : "30 gun icinde"}.`
    : "Hesap silme talebi: aktif talep yok.";

  return [
    "Shipirio hesap kontrol ozeti",
    "",
    `E-posta: ${email ?? "Yok"}`,
    `Kullanici adi: ${profile?.username ?? "Yok"}`,
    `Ad Soyad: ${profile?.full_name ?? "Yok"}`,
    `Uyelik: ${profile?.subscription_tier ?? "Bilinmiyor"}`,
    "",
    "Durum:",
    ...rows,
    "",
    deletionLine,
    `Hesap silme bilgisi: ${createPublicAppLink("/delete-account.html")}`,
    `Gizlilik: ${createPublicAppLink("/privacy.html")}`,
    `Destek: ${createPublicAppLink("/support.html")}`,
  ].join("\n");
}
