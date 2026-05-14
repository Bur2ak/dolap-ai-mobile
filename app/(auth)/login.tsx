import { router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { captureError, captureEvent } from "@/lib/observability";
import { getSafeInternalReturnTo } from "@/lib/routeParams";
import { useAuthStore } from "@/stores/authStore";
import { getEmailInputError, isValidEmail, normalizeEmail } from "@/utils/validation";

export default function LoginScreen() {
  const { returnTo: returnToParam } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const returnTo = getSafeInternalReturnTo(returnToParam);
  const { signIn } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    captureEvent("auth_login_screen_viewed", { has_return_to: Boolean(returnTo) });
  }, [returnTo]);

  async function handleSubmit() {
    if (isSubmitting) {
      captureEvent("auth_login_blocked", { reason: "busy" });
      return;
    }

    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail)) {
      captureEvent("auth_login_blocked", { reason: "invalid_email" });
      Alert.alert("Email gecersiz", "Gecerli bir email adresi gir.");
      return;
    }

    if (!password) {
      captureEvent("auth_login_blocked", { reason: "missing_password" });
      Alert.alert("Sifre gerekli", "Giris yapmak icin sifreni yaz.");
      return;
    }

    try {
      setIsSubmitting(true);
      await signIn(normalizedEmail, password);
      captureEvent("auth_login_completed", { has_return_to: Boolean(returnTo) });
      router.replace(returnTo as Href);
    } catch (error) {
      captureError(error, { area: "auth_login" });
      Alert.alert("Giris basarisiz", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function openForgotPassword() {
    if (isSubmitting) {
      captureEvent("auth_login_navigation_blocked", { reason: "busy", target: "forgot_password" });
      return;
    }

    captureEvent("auth_login_navigation_opened", { target: "forgot_password" });
    router.push("/(auth)/forgot-password");
  }

  function openRegister() {
    if (isSubmitting) {
      captureEvent("auth_login_navigation_blocked", { reason: "busy", target: "register" });
      return;
    }

    captureEvent("auth_login_navigation_opened", { has_return_to: Boolean(returnTo), target: "register" });
    router.push({
      pathname: "/(auth)/register",
      params: returnTo ? { returnTo } : undefined,
    });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text variant="h1">Tekrar hos geldin</Text>
      <Text variant="body" color="secondary">
        Dolabina kaldigin yerden devam et.
      </Text>

      <View style={styles.form}>
        <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" error={getEmailInputError(email)} editable={!isSubmitting} />
        <PasswordInput label="Sifre" value={password} onChangeText={setPassword} autoCapitalize="none" textContentType="password" editable={!isSubmitting} />
        <Button title="Giris Yap" onPress={handleSubmit} loading={isSubmitting} disabled={isSubmitting} />
        <Button title="Sifremi unuttum" variant="ghost" onPress={openForgotPassword} disabled={isSubmitting} />
        <Button title="Hesabin yok mu? Kayit ol" variant="ghost" onPress={openRegister} disabled={isSubmitting} />
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
    justifyContent: "center",
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  form: {
    gap: SPACING.md,
    marginTop: SPACING.xl,
  },
});
