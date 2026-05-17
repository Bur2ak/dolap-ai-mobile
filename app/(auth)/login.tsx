import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

import { Divider } from "@/components/ui/Divider";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/typography";
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
    if (isSubmitting) return;
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) { Alert.alert("Email geçersiz", "Geçerli bir email adresi gir."); return; }
    if (!password) { Alert.alert("Şifre gerekli", "Giriş yapmak için şifreni yaz."); return; }
    try {
      setIsSubmitting(true);
      await signIn(normalizedEmail, password);
      captureEvent("auth_login_completed", { has_return_to: Boolean(returnTo) });
      router.replace(returnTo as Href);
    } catch (error) {
      captureError(error, { area: "auth_login" });
      Alert.alert("Giriş başarısız", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={styles.logoIcon}>
            <Ionicons name="shirt-outline" size={28} color={COLORS.textInverse} />
          </View>
          <Text variant="h2" style={styles.logoText}>Shipirio</Text>
        </View>

        {/* Heading */}
        <View style={styles.headingSection}>
          <Text variant="h1">Tekrar hoş geldin</Text>
          <Text variant="body" color="secondary">Dolabına kaldığın yerden devam et.</Text>
        </View>

        {/* Google button */}
        <TouchableOpacity
          style={[styles.googleBtn, isBusy && styles.disabled]}
          onPress={async () => {
            try {
              await signInWithGoogle();
              router.replace((returnTo as Href) ?? "/(tabs)");
            } catch (error) {
              captureError(error, { area: "login_google" });
              Alert.alert("Google ile giriş başarısız", error instanceof Error ? error.message : "Tekrar dene.");
            }
          }}
          disabled={isBusy}
          activeOpacity={0.85}
        >
          <Ionicons name="logo-google" size={20} color={COLORS.textInverse} />
          <Text variant="label" color="inverse">Google ile Devam Et</Text>
        </TouchableOpacity>

        <Divider spacing="sm" label="veya email ile" />

        {/* Email form */}
        <View style={styles.form}>
          <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" error={getEmailInputError(email)} editable={!isBusy} />
          <PasswordInput label="Şifre" value={password} onChangeText={setPassword} autoCapitalize="none" textContentType="password" editable={!isBusy} />

          <TouchableOpacity
            style={[styles.primaryBtn, isBusy && styles.disabled]}
            onPress={() => void handleSubmit()}
            disabled={isBusy}
            activeOpacity={0.85}
          >
            <Text variant="label" color="inverse">{isSubmitting ? "Giriş yapılıyor..." : "Giriş Yap"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkBtn} onPress={() => router.push("/(auth)/forgot-password")} disabled={isBusy}>
            <Text variant="label" color="secondary">Şifremi unuttum</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text variant="body" color="muted">Hesabın yok mu?</Text>
          <TouchableOpacity onPress={() => router.push({ pathname: "/(auth)/register", params: returnTo ? { returnTo } : undefined })} disabled={isBusy}>
            <Text variant="label" style={styles.footerLink}>Kayıt ol</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: COLORS.background, flex: 1 },
  container: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", padding: SPACING.lg, gap: SPACING.lg },

  logoSection: { alignItems: "center", flexDirection: "row", gap: SPACING.sm, justifyContent: "center" },
  logoIcon: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  logoText: { letterSpacing: 0.5 },

  headingSection: { gap: SPACING.xs },

  googleBtn: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    flexDirection: "row",
    gap: SPACING.sm,
    justifyContent: "center",
    minHeight: 54,
  },

  form: { gap: SPACING.md },

  primaryBtn: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    justifyContent: "center",
    minHeight: 54,
  },

  linkBtn: { alignItems: "center", paddingVertical: SPACING.xs },

  footer: { alignItems: "center", flexDirection: "row", gap: SPACING.xs, justifyContent: "center" },
  footerLink: { color: COLORS.primary, fontFamily: FONTS.sansBold },

  disabled: { opacity: 0.45 },
});
