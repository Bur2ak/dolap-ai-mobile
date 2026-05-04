import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useAuthStore } from "@/stores/authStore";
import { isValidUsername, normalizeUsername } from "@/utils/validation";

const maxBioLength = 160;

export default function AccountSettingsScreen() {
  const { profile, updateProfile } = useAuthStore();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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
      });
      Alert.alert("Kaydedildi", "Hesap bilgilerin guncellendi.");
    } catch (error) {
      Alert.alert("Kaydedilemedi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setIsSaving(false);
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
});
