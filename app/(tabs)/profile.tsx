import { router } from "expo-router";
import { Alert, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuthStore } from "@/stores/authStore";

export default function ProfileScreen() {
  const { profile, signOut } = useAuthStore();
  const { premium } = useSubscription();

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
          <Text variant="h3">{profile?.full_name ?? "Shipirio kullanicisi"}</Text>
          <Text variant="body" color="secondary">
            {premium ? "premium plan" : `${profile?.subscription_tier ?? "free"} plan`}
          </Text>
        </View>
      </Card>

      {!premium ? (
        <Card style={styles.premiumBanner}>
          <View style={styles.premiumCopy}>
            <Text variant="h3">Premium'a Gec</Text>
            <Text variant="body" color="secondary">
              Sinirsiz dolap, etkinlik planlayici ve gelismis analizleri ac.
            </Text>
          </View>
          <Button title="Incele" onPress={() => router.push("/paywall")} />
        </Card>
      ) : null}

      <View style={styles.menu}>
        <Card>
          <Button title="Ayarlar" variant="ghost" onPress={() => router.push("/settings")} />
        </Card>
        <Card>
          <Button title="Hesap Ayarlari" variant="ghost" onPress={() => router.push("/settings/account")} />
        </Card>
        <Card>
          <Button title="Gizlilik" variant="ghost" onPress={() => router.push("/settings/privacy")} />
        </Card>
        <Card>
          <Button title="Arkadaslarim" variant="ghost" onPress={() => router.push("/social/friends")} />
        </Card>
        <Card>
          <Button title="Fiyat Takibi" variant="ghost" onPress={() => router.push("/price-tracking")} />
        </Card>
        <Card>
          <Button title="Bildirim Ayarlari" variant="ghost" onPress={() => router.push("/settings/notifications")} />
        </Card>
        <Card>
          <Button title="Aboneligim" variant="ghost" onPress={() => router.push("/settings/subscription")} />
        </Card>
        <Card>
          <Button title="Almali Miyim?" variant="ghost" onPress={() => router.push("/buy-decision")} />
        </Card>
        <Card>
          <Button title="Suraya Gidiyorum" variant="ghost" onPress={() => router.push("/event")} />
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
  premiumBanner: {
    gap: SPACING.md,
  },
  premiumCopy: {
    gap: SPACING.xs,
  },
  signOut: {
    marginTop: "auto",
  },
});
