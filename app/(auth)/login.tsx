import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useAuthStore } from "@/stores/authStore";

export default function LoginScreen() {
  const { signIn } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    try {
      setIsSubmitting(true);
      await signIn(email.trim(), password);
      router.replace("/(tabs)");
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
        <Button title="Hesabin yok mu? Kayit ol" variant="ghost" onPress={() => router.push("/(auth)/register")} />
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
