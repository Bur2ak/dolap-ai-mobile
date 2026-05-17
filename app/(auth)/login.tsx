import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Divider } from "@/components/ui/Divider";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useGoogleAuth } from "@/hooks/useGoogleAuth";
import { captureError, captureEvent } from "@/lib/observability";
import { getSafeInternalReturnTo } from "@/lib/routeParams";
import { useAuthStore } from "@/stores/authStore";
import { getEmailInputError, isValidEmail, normalizeEmail } from "@/utils/validation";

export default function LoginScreen() {
  const { returnTo: returnToParam } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const returnTo = getSafeInternalReturnTo(returnToParam);
  const { signIn } = useAuthStore();
  const { signInWithGoogle, isLoading: isGoogleLoading } = useGoogleAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isBusy = isSubmitting || isGoogleLoading;

  useEffect(() => {
    captureEvent("auth_login_screen_viewed", { has_return_to: Boolean(returnTo) });
  }, [returnTo]);

  async function handleSubmit() {
    if (isSubmitting) {
      return;
    }

    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail)) {
      Alert.alert("Email gecersiz", "Gecerli bir email adresi gir.");
      return;
    }

    if (!password) {
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
      return;
    }

    captureEvent("auth_login_navigation_opened", { target: "forgot_password" });
    router.push("/(auth)/forgot-password");
  }

  function openRegister() {
    if (isSubmitting) {
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
        {/* Primary CTA: Google — one tap, no typing */}
        <Pressable
          style={[styles.googleButton, isBusy && styles.disabled]}
          onPress={async () => {
            try {
              await signInWithGoogle();
              router.replace(returnTo as Href ?? "/(tabs)");
            } catch (error) {
              captureError(error, { area: "login_google" });
              Alert.alert("Google ile giris basarisiz", error instanceof Error ? error.message : "Tekrar dene.");
            }
          }}
          disabled={isBusy}
        >
          <Ionicons name="logo-google" size={22} color={COLORS.surface} />
          <Text variant="label" color="inverse">Google ile Devam Et</Text>
        </Pressable>

        <Divider spacing="sm" label="veya email ile" />

        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoFocus={false}
          error={getEmailInputError(email)}
          editable={!isBusy}
        />
        <PasswordInput label="Sifre" value={password} onChangeText={setPassword} autoCapitalize="none" textContentType="password" editable={!isBusy} />
        <Button title="Giris Yap" onPress={handleSubmit} loading={isSubmitting} disabled={isBusy} />
        <Button title="Sifremi unuttum" variant="ghost" onPress={openForgotPassword} disabled={isBusy} />
        <Button title="Hesabin yok mu? Kayit ol" variant="ghost" onPress={openRegister} disabled={isBusy} />
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
  googleButton: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    flexDirection: "row",
    gap: SPACING.sm,
    justifyContent: "center",
    minHeight: 56,
  },
  disabled: {
    opacity: 0.52,
  },
});
