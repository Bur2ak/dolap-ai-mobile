import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import * as WebBrowser from "expo-web-browser";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { createPublicAppLink } from "@/lib/links";
import { captureError, captureEvent } from "@/lib/observability";
import { useAuthStore } from "@/stores/authStore";
import { formatDate, formatDateOnly } from "@/utils/formatters";
import { isValidUsername, normalizeUsername } from "@/utils/validation";

const maxBioLength = 160;

export default function AccountSettingsScreen() {
  const { profile, updatePassword, updateProfile } = useAuthStore();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isUpdatingDeletion, setIsUpdatingDeletion] = useState(false);
  const deletionInfoUrl = createPublicAppLink("/delete-account.html");

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setUsername(profile?.username ?? "");
    setBio(profile?.bio ?? "");
  }, [profile]);

  async function handleSave() {
    const normalizedUsername = normalizeUsername(username);
    const trimmedBio = bio.trim();

    if (!fullName.trim()) {
      Alert.alert("Ad Soyad gerekli", "Profilinde gorunecek adini yaz.");
      return;
    }

    if (normalizedUsername && !isValidUsername(normalizedUsername)) {
      Alert.alert("Kullanici adi gecersiz", "Kullanici adi 3-24 karakter olmali; sadece harf, rakam ve alt cizgi kullan.");
      return;
    }

    if (trimmedBio.length > maxBioLength) {
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
      Alert.alert("Kaydedildi", "Hesap bilgilerin guncellendi.");
    } catch (error) {
      Alert.alert("Kaydedilemedi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleChangePassword() {
    if (password.length < 8) {
      Alert.alert("Sifre kisa", "Yeni sifre en az 8 karakter olmali.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Sifreler eslesmiyor", "Iki alana da ayni sifreyi yaz.");
      return;
    }

    try {
      setIsSavingPassword(true);
      await updatePassword(password);
      setPassword("");
      setConfirmPassword("");
      Alert.alert("Sifre yenilendi", "Hesap sifren guncellendi.");
    } catch (error) {
      Alert.alert("Sifre yenilenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setIsSavingPassword(false);
    }
  }

  function handleRequestDeletion() {
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
    try {
      await WebBrowser.openBrowserAsync(deletionInfoUrl);
    } catch (error) {
      captureError(error, { area: "account_deletion_info" });
      Alert.alert("Acilamadi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} />
        <Text variant="h2">Hesap</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Card style={styles.form}>
        <Text variant="h3">Profil bilgileri</Text>
        <Input label="Ad Soyad" value={fullName} onChangeText={setFullName} />
        <Input label="Kullanici adi" value={username} onChangeText={setUsername} autoCapitalize="none" />
        <Text variant="caption" color="muted">
          3-24 karakter; harf, rakam ve alt cizgi kullan.
        </Text>
        <Input label="Bio" value={bio} onChangeText={setBio} multiline />
        <Text variant="caption" color={bio.trim().length > maxBioLength ? "danger" : "muted"}>
          {bio.trim().length}/{maxBioLength}
        </Text>
        <Button title="Kaydet" onPress={handleSave} loading={isSaving} />
      </Card>

      <Card style={styles.form}>
        <Text variant="h3">Guvenlik</Text>
        <Input label="Yeni sifre" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
        <Input label="Yeni sifre tekrar" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" />
        <Text variant="caption" color="muted">
          Sifre en az 8 karakter olmali.
        </Text>
        <Button title="Sifreyi Yenile" variant="secondary" onPress={handleChangePassword} loading={isSavingPassword} />
      </Card>

      <Card style={styles.dangerZone}>
        <Text variant="h3">Hesap silme</Text>
        {profile?.deletion_requested_at ? (
          <>
            <Text variant="body" color="secondary">
              Hesap silme talebin alindi. Planlanan silme tarihi: {profile.deletion_scheduled_for ? formatDate(profile.deletion_scheduled_for) : "30 gun icinde"}.
            </Text>
            <Button title="Hesap Silme Bilgisi" variant="ghost" onPress={() => void openDeletionInfo()} />
            <Button title="Silme Talebini Iptal Et" variant="secondary" onPress={handleCancelDeletion} loading={isUpdatingDeletion} />
          </>
        ) : (
          <>
            <Text variant="body" color="secondary">
              Talep olusturdugunda hesabinin ve iliskili verilerinin kalici silinmesi icin 30 gunluk sure baslar.
            </Text>
            <Button title="Hesap Silme Bilgisi" variant="secondary" onPress={() => void openDeletionInfo()} />
            <Button title="Hesap Silme Talebi Olustur" variant="ghost" onPress={handleRequestDeletion} loading={isUpdatingDeletion} />
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
  dangerZone: {
    borderColor: COLORS.danger,
    gap: SPACING.md,
  },
});
