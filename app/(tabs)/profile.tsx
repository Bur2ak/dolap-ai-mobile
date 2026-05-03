import { router } from "expo-router";
import { Alert, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useAuthStore } from "@/stores/authStore";

export default function ProfileScreen() {
  const { profile, signOut } = useAuthStore();

  async function handleSignOut() {
    try {
      await signOut();
      router.replace("/(auth)/onboarding");
    } catch (error) {
      Alert.alert("Cikis yapilamadi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  return (
    <View style={styles.container}>
      <Text variant="h1">Profil</Text>
      <Card style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text variant="h2" color="inverse">
            {(profile?.full_name?.[0] ?? "D").toUpperCase()}
          </Text>
        </View>
        <View>
          <Text variant="h3">{profile?.full_name ?? "Dolap AI kullanicisi"}</Text>
          <Text variant="body" color="secondary">
            {profile?.subscription_tier ?? "free"} plan
          </Text>
        </View>
      </Card>

      <View style={styles.menu}>
        <Card>
          <Text variant="label">Arkadaslarim</Text>
        </Card>
        <Card>
          <Text variant="label">Fiyat Takibi</Text>
        </Card>
        <Card>
          <Text variant="label">Bildirim Ayarlari</Text>
        </Card>
        <Card>
          <Text variant="label">Aboneligim</Text>
        </Card>
        <Card>
          <Button title="Almali Miyim?" variant="ghost" onPress={() => router.push("/buy-decision")} />
        </Card>
      </View>

      <Button title="Cikis Yap" variant="secondary" onPress={handleSignOut} style={styles.signOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    gap: SPACING.md,
    padding: SPACING.lg,
    paddingTop: 64,
  },
  profileCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  menu: {
    gap: SPACING.sm,
  },
  signOut: {
    marginTop: "auto",
  },
});
