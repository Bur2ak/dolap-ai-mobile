import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { captureError, captureEvent } from "@/lib/observability";
import { getSafeInternalReturnTo } from "@/lib/routeParams";
import { useAuthStore } from "@/stores/authStore";
import { getEmailInputError, getPasswordInputError, isValidEmail, normalizeEmail } from "@/utils/validation";

export default function RegisterScreen() {
  const { returnTo: returnToParam } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const returnTo = getSafeInternalReturnTo(returnToParam);
  const { signUp } = useAuthStore();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    captureEvent("auth_register_screen_viewed", { has_return_to: Boolean(returnTo) });
  }, [returnTo]);

  async function handleSubmit() {
    if (isSubmitting) {
      captureEvent("auth_register_blocked", { reason: "busy" });
      return;
    }

    const normalizedEmail = normalizeEmail(email);

    if (!fullName.trim()) {
      captureEvent("auth_register_blocked", { reason: "missing_name" });
      Alert.alert("Ad Soyad gerekli", "Hesabini olusturmak icin adini yaz.");
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      captureEvent("auth_register_blocked", { reason: "invalid_email" });
      Alert.alert("Email gecersiz", "Gecerli bir email adresi gir.");
      return;
    }

    if (password.length < 8) {
      captureEvent("auth_register_blocked", { reason: "short_password" });
      Alert.alert("Sifre kisa", "Sifre en az 8 karakter olmali.");
      return;
    }

    if (!acceptedLegal) {
      captureEvent("auth_register_blocked", { reason: "legal_not_accepted" });
      Alert.alert("Onay gerekli", "Devam etmek icin KVKK aydinlatma metni, gizlilik politikasi ve kullanim sartlarini onaylamalisin.");
      return;
    }

    try {
      setIsSubmitting(true);
      await signUp(normalizedEmail, password, fullName.trim());
      captureEvent("auth_register_completed", { accepted_legal: acceptedLegal, has_return_to: Boolean(returnTo) });
      router.replace({
        pathname: "/(auth)/verify-otp",
        params: { email: normalizedEmail, ...(returnTo ? { returnTo } : {}) },
      });
    } catch (error) {
      captureError(error, { area: "auth_register" });
      Alert.alert("Kayit basarisiz", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function openLegalLink(target: "kvkk" | "privacy" | "terms") {
    if (isSubmitting) {
      captureEvent("auth_register_legal_link_blocked", { reason: "busy", target });
      return;
    }

    captureEvent("auth_register_legal_link_opened", { target });
    router.push(`/legal/${target}`);
  }

  function openLogin() {
    if (isSubmitting) {
      captureEvent("auth_register_navigation_blocked", { reason: "busy", target: "login" });
      return;
    }

    captureEvent("auth_register_navigation_opened", { has_return_to: Boolean(returnTo), target: "login" });
    router.push({
      pathname: "/(auth)/login",
      params: returnTo ? { returnTo } : undefined,
    });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text variant="h1">Dolabini kur</Text>
      <Text variant="body" color="secondary">
        Ilk kiyafetini eklemeden once hesabini hazirlayalim.
      </Text>

      <View style={styles.form}>
        <Input label="Ad Soyad" value={fullName} onChangeText={setFullName} editable={!isSubmitting} />
        <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" error={getEmailInputError(email)} editable={!isSubmitting} />
        <PasswordInput
          label="Sifre"
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          textContentType="newPassword"
          error={getPasswordInputError(password)}
          editable={!isSubmitting}
        />
        <Pressable
          style={styles.consentRow}
          onPress={() =>
            setAcceptedLegal((value) => {
              if (isSubmitting) {
                captureEvent("auth_register_legal_toggle_blocked", { reason: "busy" });
                return value;
              }

              captureEvent("auth_register_legal_toggled", { accepted: !value });
              return !value;
            })
          }
          disabled={isSubmitting}
        >
          <View style={[styles.checkbox, acceptedLegal && styles.checkboxActive]}>
            {acceptedLegal ? <Ionicons name="checkmark" size={16} color={COLORS.background} /> : null}
          </View>
          <Text variant="caption" color="secondary" style={styles.consentText}>
            KVKK aydinlatma metnini, gizlilik politikasini ve kullanim sartlarini okudum; hesabimin bu kosullarla olusturulmasini kabul ediyorum.
          </Text>
        </Pressable>
        <Button title="Kayit Ol" onPress={handleSubmit} loading={isSubmitting} disabled={isSubmitting} />
        <Text variant="caption" color="muted" style={styles.legalText}>
          Onay zamanin hesap kaydinda saklanir; tercihlerini ayarlardan yonetebilirsin.
        </Text>
        <View style={styles.legalLinks}>
          <Button
            title="KVKK"
            variant="ghost"
            onPress={() => openLegalLink("kvkk")}
            disabled={isSubmitting}
            style={styles.linkButton}
          />
          <Button
            title="Gizlilik"
            variant="ghost"
            onPress={() => openLegalLink("privacy")}
            disabled={isSubmitting}
            style={styles.linkButton}
          />
          <Button
            title="Sartlar"
            variant="ghost"
            onPress={() => openLegalLink("terms")}
            disabled={isSubmitting}
            style={styles.linkButton}
          />
        </View>
        <Button
          title="Zaten hesabim var"
          variant="ghost"
          onPress={openLogin}
          disabled={isSubmitting}
        />
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
  consentRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  checkbox: {
    alignItems: "center",
    borderColor: COLORS.border,
    borderRadius: 6,
    borderWidth: 1,
    height: 24,
    justifyContent: "center",
    marginTop: 2,
    width: 24,
  },
  checkboxActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  consentText: {
    flex: 1,
  },
  legalText: {
    textAlign: "center",
  },
  legalLinks: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  linkButton: {
    flex: 1,
    minHeight: 40,
  },
});
