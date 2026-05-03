import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useAuthStore } from "@/stores/authStore";

export default function RegisterScreen() {
  const { signUp } = useAuthStore();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    try {
      setIsSubmitting(true);
      await signUp(email.trim(), password, fullName.trim());
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
});
