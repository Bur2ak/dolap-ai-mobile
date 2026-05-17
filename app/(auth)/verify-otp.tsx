import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { captureError, captureEvent } from "@/lib/observability";
import { getSafeInternalReturnTo } from "@/lib/routeParams";
import { supabase } from "@/lib/supabase";

export default function VerifyOtpScreen() {
  const { email: emailParam, returnTo: returnToParam } = useLocalSearchParams<{ email?: string; returnTo?: string }>();
  const email = typeof emailParam === "string" ? emailParam.trim() : "";
  const returnTo = getSafeInternalReturnTo(returnToParam);

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    captureEvent("auth_verify_otp_viewed", { has_email: Boolean(email) });
    setTimeout(() => inputRefs.current[0]?.focus(), 300);
  }, [email]);

  function handleCodeChange(value: string, index: number) {
    const digit = value.replace(/[^0-9]/g, "").slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newCode.every((d) => d !== "") && digit) {
      void handleVerify(newCode.join(""));
    }
  }

  function handleKeyPress(e: { nativeEvent: { key: string } }, index: number) {
    if (e.nativeEvent.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleVerify(fullCode?: string) {
    const token = fullCode ?? code.join("");
    if (token.length < 6) {
      Alert.alert("Kod eksik", "6 haneli dogrulama kodunu gir.");
      return;
    }

    if (!email) {
      Alert.alert("Hata", "Email bulunamadi. Kayit ekranina don.");
      return;
    }

    setIsVerifying(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "signup",
      });

      if (error) throw error;

      captureEvent("auth_otp_verified");
      router.replace(returnTo ?? "/(tabs)");
    } catch (error) {
      captureError(error, { area: "auth_otp_verify" });
      Alert.alert("Kod yanlis", "Dogrulama kodu hatali veya suresi dolmus. Tekrar dene.");
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResend() {
    if (!email || isResending) return;
    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) throw error;
      captureEvent("auth_otp_resent");
      Alert.alert("Gonderildi", "Yeni dogrulama kodu emailine gonderildi.");
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (error) {
      captureError(error, { area: "auth_otp_resend" });
      Alert.alert("Gonderilemedi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} disabled={isVerifying} />
        <Text variant="h2">Dogrulama</Text>
        <View style={styles.spacer} />
      </View>

      <View style={styles.hero}>
        <Text variant="h1">Emailini dogrula</Text>
        <Text variant="body" color="secondary">
          <Text variant="body">{email}</Text> adresine 6 haneli kod gonderdik.
        </Text>
      </View>

      <View style={styles.codeRow}>
        {code.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => { inputRefs.current[index] = ref; }}
            style={[styles.codeInput, digit ? styles.codeInputFilled : null]}
            value={digit}
            onChangeText={(value) => handleCodeChange(value, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
            editable={!isVerifying}
          />
        ))}
      </View>

      <Button
        title="Dogrula"
        onPress={() => void handleVerify()}
        loading={isVerifying}
        disabled={isVerifying || code.some((d) => !d)}
        style={styles.primaryButton}
      />

      <Button
        title="Kodu tekrar gonder"
        variant="ghost"
        onPress={() => void handleResend()}
        loading={isResending}
        disabled={isVerifying || isResending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    flex: 1,
    gap: SPACING.lg,
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
  },
  codeRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    justifyContent: "center",
    marginVertical: SPACING.md,
  },
  codeInput: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "700",
    height: 64,
    textAlign: "center",
    width: 48,
  },
  codeInputFilled: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
  },
});
