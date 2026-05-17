import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { captureError, captureEvent } from "@/lib/observability";
import { useAuthStore } from "@/stores/authStore";
import { getConfirmPasswordInputError, getPasswordInputError } from "@/utils/validation";

export default function ResetPasswordScreen() {
  const { session, updatePassword } = useAuthStore();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    captureEvent("auth_reset_password_screen_viewed", { has_session: Boolean(session) });
  }, [session]);

  async function handleSubmit() {
    if (isSubmitting) {
      return;
    }

    if (!session) {
      Alert.alert("Link gerekli", "Sifre yenilemek icin emailindeki guncel sifirlama linkini acmalisin.");
      return;
    }

    if (password.length < 8) {
      Alert.alert("Sifre kisa", "Yeni sifre en az 8 karakter olmali.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Sifreler eslesmiyor", "Iki alana da ayni sifreyi yaz.");
      return;
    }

    try {
      setIsSubmitting(true);
      await updatePassword(password);
      captureEvent("auth_password_reset_completed");
      Alert.alert("Sifre yenilendi", "Yeni sifrenle devam edebilirsin.");
      router.replace("/(tabs)");
    } catch (error) {
      captureError(error, { area: "auth_password_reset_complete" });
      Alert.alert("Sifre yenilenemedi", error instanceof Error ? error.message : "Link suresi dolmus olabilir. Tekrar sifirlama maili iste.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function requestNewLink() {
    if (isSubmitting) {
      return;
    }

    captureEvent("auth_password_reset_navigation_opened", { target: "forgot_password" });
    router.replace("/(auth)/forgot-password");
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={requestNewLink} disabled={isSubmitting} />
        <Text variant="h2">Yeni Sifre</Text>
        <View style={styles.spacer} />
      </View>

      <View style={styles.hero}>
        <Text variant="h1">Yeni sifre belirle</Text>
        <Text variant="body" color="secondary">
          Emailindeki sifirlama linkinden geldiysen hesabina yeni bir sifre tanimlayabilirsin.
        </Text>
      </View>

      {!session ? (
        <View style={styles.notice}>
          <Text variant="body" color="secondary">
            Sifre yenilemek icin emailindeki guncel sifirlama linkini acmalisin.
          </Text>
          <Button title="Yeni Link Iste" variant="secondary" onPress={requestNewLink} disabled={isSubmitting} />
        </View>
      ) : (
        <View style={styles.form}>
          <PasswordInput
            label="Yeni sifre"
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            textContentType="newPassword"
            error={getPasswordInputError(password)}
            editable={!isSubmitting}
          />
          <PasswordInput
            label="Yeni sifre tekrar"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            autoCapitalize="none"
            textContentType="newPassword"
            error={getConfirmPasswordInputError(password, confirmPassword)}
            editable={!isSubmitting}
          />
          <Button title="Sifreyi Yenile" onPress={handleSubmit} loading={isSubmitting} disabled={isSubmitting} style={styles.primaryButton} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  content: {
    flexGrow: 1,
    gap: SPACING.md,
    padding: SPACING.lg,
    paddingTop: 56,
    paddingBottom: 100,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  spacer: {
    width: 72,
  },
  hero: {
    gap: SPACING.sm,
    marginTop: SPACING.xl,
  },
  form: {
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  notice: {
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
  },
});
