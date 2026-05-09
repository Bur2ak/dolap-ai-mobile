import { router, useLocalSearchParams, type Href } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { getSafeInternalReturnTo } from "@/lib/routeParams";
import { useAuthStore } from "@/stores/authStore";
import { isValidEmail, normalizeEmail } from "@/utils/validation";

export default function LoginScreen() {
  const { returnTo: returnToParam } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const returnTo = getSafeInternalReturnTo(returnToParam);
  const { signIn } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
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
      router.replace(returnTo as Href);
    } catch (error) {
      Alert.alert("Giris basarisiz", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text variant="h1">Tekrar hos geldin</Text>
      <Text variant="body" color="secondary">
        Dolabina kaldigin yerden devam et.
      </Text>

      <View style={styles.form}>
        <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Input label="Sifre" value={password} onChangeText={setPassword} secureTextEntry />
        <Button title="Giris Yap" onPress={handleSubmit} loading={isSubmitting} />
        <Button title="Sifremi unuttum" variant="ghost" onPress={() => router.push("/(auth)/forgot-password")} />
        <Button
          title="Hesabin yok mu? Kayit ol"
          variant="ghost"
          onPress={() =>
            router.push({
              pathname: "/(auth)/register",
              params: returnTo ? { returnTo } : undefined,
            })
          }
        />
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
});
