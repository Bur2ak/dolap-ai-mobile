import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

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
import { getEmailInputError, getPasswordInputError, isValidEmail, normalizeEmail } from "@/utils/validation";

export default function RegisterScreen() {
  const { returnTo: returnToParam } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const returnTo = getSafeInternalReturnTo(returnToParam);
  const { signUp } = useAuthStore();
  const { signInWithGoogle, isLoading: isGoogleLoading } = useGoogleAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isBusy = isSubmitting || isGoogleLoading;

  useEffect(() => { captureEvent("auth_register_screen_viewed", { has_return_to: Boolean(returnTo) }); }, [returnTo]);

  async function handleSubmit() {
    if (isSubmitting) return;
    if (!fullName.trim()) { Alert.alert("Ad Soyad gerekli", "Hesabını oluşturmak için adını yaz."); return; }
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) { Alert.alert("Email geçersiz", "Geçerli bir email adresi gir."); return; }
    if (password.length < 8) { Alert.alert("Şifre kısa", "Şifre en az 8 karakter olmalı."); return; }
    if (!acceptedLegal) { Alert.alert("Onay gerekli", "KVKK, gizlilik politikası ve kullanım şartlarını onaylamalısın."); return; }
    try {
      setIsSubmitting(true);
      await signUp(normalizedEmail, password, fullName.trim());
      captureEvent("auth_register_completed", { accepted_legal: acceptedLegal });
      router.replace({ pathname: "/(auth)/verify-otp", params: { email: normalizedEmail, ...(returnTo ? { returnTo } : {}) } });
    } catch (error) {
      captureError(error, { area: "auth_register" });
      Alert.alert("Kayıt başarısız", error instanceof Error ? error.message : "Tekrar dene.");
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

        <View style={styles.headingSection}>
          <Text variant="h1">Dolabını kur</Text>
          <Text variant="body" color="secondary">İlk kıyafetini eklemeden önce hesabını hazırlayalım.</Text>
        </View>

        {/* Google */}
        <TouchableOpacity
          style={[styles.googleBtn, isBusy && styles.disabled]}
          onPress={async () => {
            try {
              await signInWithGoogle();
              router.replace((returnTo as Href) ?? "/(tabs)");
            } catch (error) {
              captureError(error, { area: "register_google" });
              Alert.alert("Google ile kayıt başarısız", error instanceof Error ? error.message : "Tekrar dene.");
            }
          }}
          disabled={isBusy}
          activeOpacity={0.85}
        >
          <Ionicons name="logo-google" size={20} color={COLORS.textInverse} />
          <Text variant="label" color="inverse">Google ile Devam Et</Text>
        </TouchableOpacity>

        <Divider spacing="sm" label="veya email ile" />

        <View style={styles.form}>
          <Input label="Ad Soyad" value={fullName} onChangeText={setFullName} editable={!isBusy} />
          <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" error={getEmailInputError(email)} editable={!isBusy} />
          <PasswordInput label="Şifre" value={password} onChangeText={setPassword} autoCapitalize="none" textContentType="newPassword" error={getPasswordInputError(password)} editable={!isBusy} />

          {/* Legal consent */}
          <Pressable
            style={styles.consentRow}
            onPress={() => { if (!isBusy) { captureEvent("auth_register_legal_toggled", { accepted: !acceptedLegal }); setAcceptedLegal(v => !v); } }}
            disabled={isBusy}
          >
            <View style={[styles.checkbox, acceptedLegal && styles.checkboxActive]}>
              {acceptedLegal ? <Ionicons name="checkmark" size={14} color={COLORS.textInverse} /> : null}
            </View>
            <Text variant="caption" color="secondary" style={styles.consentText}>
              KVKK aydınlatma metnini, gizlilik politikasını ve kullanım şartlarını kabul ediyorum.
            </Text>
          </Pressable>
          <View style={styles.legalLinks}>
            {["KVKK", "Gizlilik", "Şartlar"].map((label, i) => (
              <TouchableOpacity key={label} onPress={() => router.push(`/legal/${["kvkk","privacy","terms"][i]}`)} disabled={isBusy}>
                <Text variant="caption" style={styles.legalLink}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={[styles.primaryBtn, isBusy && styles.disabled]} onPress={() => void handleSubmit()} disabled={isBusy} activeOpacity={0.85}>
            <Text variant="label" color="inverse">{isSubmitting ? "Hesap oluşturuluyor..." : "Kayıt Ol"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text variant="body" color="muted">Zaten hesabın var mı?</Text>
          <TouchableOpacity onPress={() => router.push({ pathname: "/(auth)/login", params: returnTo ? { returnTo } : undefined })} disabled={isBusy}>
            <Text variant="label" style={styles.footerLink}>Giriş yap</Text>
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
  logoIcon: { alignItems: "center", backgroundColor: COLORS.primary, borderRadius: 12, height: 48, justifyContent: "center", width: 48 },
  logoText: { letterSpacing: 0.5 },
  headingSection: { gap: SPACING.xs },
  googleBtn: { alignItems: "center", backgroundColor: COLORS.primary, borderRadius: 14, flexDirection: "row", gap: SPACING.sm, justifyContent: "center", minHeight: 54 },
  form: { gap: SPACING.md },
  consentRow: { alignItems: "flex-start", flexDirection: "row", gap: SPACING.sm },
  checkbox: { alignItems: "center", backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 6, borderWidth: 1.5, height: 22, justifyContent: "center", marginTop: 1, width: 22 },
  checkboxActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  consentText: { flex: 1 },
  legalLinks: { flexDirection: "row", gap: SPACING.md },
  legalLink: { color: COLORS.primary, fontFamily: FONTS.sansMedium, textDecorationLine: "underline" },
  primaryBtn: { alignItems: "center", backgroundColor: COLORS.primary, borderRadius: 14, justifyContent: "center", minHeight: 54 },
  footer: { alignItems: "center", flexDirection: "row", gap: SPACING.xs, justifyContent: "center" },
  footerLink: { color: COLORS.primary, fontFamily: FONTS.sansBold },
  disabled: { opacity: 0.45 },
});
