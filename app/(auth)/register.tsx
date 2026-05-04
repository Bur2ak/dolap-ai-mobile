import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useAuthStore } from "@/stores/authStore";
import { isValidEmail, normalizeEmail } from "@/utils/validation";

export default function RegisterScreen() {
  const { signUp } = useAuthStore();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    const normalizedEmail = normalizeEmail(email);

    if (!fullName.trim()) {
      Alert.alert("Ad Soyad gerekli", "Hesabini olusturmak icin adini yaz.");
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      Alert.alert("Email gecersiz", "Gecerli bir email adresi gir.");
      return;
    }

    if (password.length < 8) {
      Alert.alert("Sifre kisa", "Sifre en az 8 karakter olmali.");
      return;
    }

    try {
      setIsSubmitting(true);
      await signUp(normalizedEmail, password, fullName.trim());
      Alert.alert("Kayit olusturuldu", "Email dogrulama ayarina gore giris yapabilirsin.");
      router.replace("/(auth)/login");
    } catch (error) {
      Alert.alert("Kayit basarisiz", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text variant="h1">Dolabini kur</Text>
      <Text variant="body" color="secondary">
        Ilk kiyafetini eklemeden once hesabini hazirlayalim.
      </Text>

      <View style={styles.form}>
        <Input label="Ad Soyad" value={fullName} onChangeText={setFullName} />
        <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Input label="Sifre" value={password} onChangeText={setPassword} secureTextEntry />
        <Button title="Kayit Ol" onPress={handleSubmit} loading={isSubmitting} />
        <Text variant="caption" color="muted" style={styles.legalText}>
          Kayit olarak Shipirio gizlilik politikasi ve kullanim sartlarini kabul edersin.
        </Text>
        <View style={styles.legalLinks}>
          <Button title="Gizlilik" variant="ghost" onPress={() => router.push("/legal/privacy")} style={styles.linkButton} />
          <Button title="Sartlar" variant="ghost" onPress={() => router.push("/legal/terms")} style={styles.linkButton} />
        </View>
        <Button title="Zaten hesabim var" variant="ghost" onPress={() => router.push("/(auth)/login")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  form: {
    gap: SPACING.md,
    marginTop: SPACING.xl,
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
