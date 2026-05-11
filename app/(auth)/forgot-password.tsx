import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { captureError, captureEvent } from "@/lib/observability";
import { useAuthStore } from "@/stores/authStore";
import { getEmailInputError, isValidEmail, normalizeEmail } from "@/utils/validation";

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuthStore();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    captureEvent("auth_forgot_password_screen_viewed");
  }, []);

  async function handleSubmit() {
    if (isSubmitting) {
      captureEvent("auth_password_reset_request_blocked", { reason: "busy" });
      return;
    }

    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail)) {
      captureEvent("auth_password_reset_request_blocked", { reason: "invalid_email" });
      Alert.alert("Email gecersiz", "Sifre sifirlama linki icin gecerli bir email adresi gir.");
      return;
    }

    try {
      setIsSubmitting(true);
      await resetPassword(normalizedEmail, Linking.createURL("/(auth)/reset-password"));
      captureEvent("auth_password_reset_requested");
      Alert.alert("Email gonderildi", "Sifre sifirlama linki email adresine gonderildi.");
      router.replace("/(auth)/login");
    } catch (error) {
      captureError(error, { area: "auth_password_reset_request" });
      Alert.alert("Gonderilemedi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function openLogin() {
    if (isSubmitting) {
      captureEvent("auth_password_reset_navigation_blocked", { reason: "busy", target: "login" });
      return;
    }

    captureEvent("auth_password_reset_navigation_opened", { target: "login" });
    router.back();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text variant="h1">Sifreni sifirla</Text>
      <Text variant="body" color="secondary">
        Email adresini yaz, sana sifre yenileme linki gonderelim.
      </Text>

      <View style={styles.form}>
        <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" error={getEmailInputError(email)} editable={!isSubmitting} />
        <Button title="Link Gonder" onPress={handleSubmit} loading={isSubmitting} disabled={isSubmitting} />
        <Button title="Giris ekranina don" variant="ghost" onPress={openLogin} disabled={isSubmitting} />
      </View>
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
    gap: SPACING.sm,
    justifyContent: "center",
    padding: SPACING.lg,
  },
  form: {
    gap: SPACING.md,
    marginTop: SPACING.xl,
  },
});
