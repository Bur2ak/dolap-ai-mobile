import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { captureError, captureEvent } from "@/lib/observability";
import { useAuthStore } from "@/stores/authStore";

export default function ResetPasswordScreen() {
  const { session, updatePassword } = useAuthStore();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
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

  return (
    <View style={styles.container}>
      <Text variant="h1">Yeni sifre belirle</Text>
      <Text variant="body" color="secondary">
        Emailindeki sifirlama linkinden geldiysen hesabina yeni bir sifre tanimlayabilirsin.
      </Text>

      {!session ? (
        <View style={styles.notice}>
          <Text variant="body" color="secondary">
            Sifre yenilemek icin emailindeki guncel sifirlama linkini acmalisin.
          </Text>
          <Button title="Yeni Link Iste" variant="secondary" onPress={() => router.replace("/(auth)/forgot-password")} disabled={isSubmitting} />
        </View>
      ) : (
        <View style={styles.form}>
          <Input label="Yeni sifre" value={password} onChangeText={setPassword} secureTextEntry />
          <Input label="Yeni sifre tekrar" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
          <Button title="Sifreyi Yenile" onPress={handleSubmit} loading={isSubmitting} disabled={isSubmitting} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    flex: 1,
    gap: SPACING.sm,
    justifyContent: "center",
    padding: SPACING.lg,
  },
  form: {
    gap: SPACING.md,
    marginTop: SPACING.xl,
  },
  notice: {
    gap: SPACING.md,
    marginTop: SPACING.xl,
  },
});
