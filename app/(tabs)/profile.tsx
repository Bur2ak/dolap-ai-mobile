import { router } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useSubscription } from "@/hooks/useSubscription";
import { captureError, captureEvent } from "@/lib/observability";
import { useAuthStore } from "@/stores/authStore";
import { formatDate } from "@/utils/formatters";

export default function ProfileScreen() {
  const { profile, signOut } = useAuthStore();
  const { premium } = useSubscription();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const profileIncomplete = Boolean(profile && (!profile.username || !profile.onboarding_completed));

  function handleSignOut() {
    Alert.alert("Cikis yap", "Shipirio hesabindan cikis yapmak istiyor musun?", [
      { text: "Vazgec", style: "cancel" },
      {
        text: "Cikis Yap",
        style: "destructive",
        onPress: () => {
          void performSignOut();
        },
      },
    ]);
  }

  async function performSignOut() {
    if (isSigningOut) {
      return;
    }

    try {
      setIsSigningOut(true);
      await signOut();
      captureEvent("profile_signed_out");
      router.replace("/(auth)/onboarding");
    } catch (error) {
      captureError(error, { area: "profile_sign_out" });
      Alert.alert("Cikis yapilamadi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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

      {profile?.deletion_requested_at ? (
        <Card style={styles.deletionNotice}>
          <Text variant="h3">Hesap silme talebi aktif</Text>
          <Text variant="body" color="secondary">
            Planlanan silme tarihi: {profile.deletion_scheduled_for ? formatDate(profile.deletion_scheduled_for) : "30 gun icinde"}. Talebi hesap ayarlarindan iptal edebilirsin.
          </Text>
          <Button title="Talebi Yonet" variant="secondary" onPress={() => router.push("/settings/account")} />
        </Card>
      ) : null}

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

      {profileIncomplete ? (
        <Card style={styles.profileNudge}>
          <Text variant="h3">Profilini tamamla</Text>
          <Text variant="body" color="secondary">
            Kullanici adi ekleyince davet linkin daha okunur olur; sosyal akislarda arkadaslarin seni daha kolay bulur.
          </Text>
          <Button title="Tamamla" variant="secondary" onPress={() => router.push("/settings/account")} />
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
          <Button title="Odunc Takibi" variant="ghost" onPress={() => router.push("/social/loans")} />
        </Card>
        <Card>
          <Button title="Fiyat Takibi" variant="ghost" onPress={() => router.push("/price-tracking")} />
        </Card>
        <Card>
          <Button title="Bildirim Ayarlari" variant="ghost" onPress={() => router.push("/settings/notifications")} />
        </Card>
        <Card>
          <Button title="Bildirim Kutusu" variant="ghost" onPress={() => router.push("/notifications")} />
        </Card>
        <Card>
          <Button title="Sistem Durumu" variant="ghost" onPress={() => router.push("/settings/diagnostics")} />
        </Card>
        <Card>
          <Button title="Destek" variant="ghost" onPress={() => router.push("/settings/support")} />
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

      <Button title="Cikis Yap" variant="secondary" onPress={handleSignOut} loading={isSigningOut} disabled={isSigningOut} style={styles.signOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    gap: SPACING.md,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
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
  profileNudge: {
    gap: SPACING.md,
  },
  deletionNotice: {
    borderColor: COLORS.warning,
    gap: SPACING.md,
  },
  premiumCopy: {
    gap: SPACING.xs,
  },
  signOut: {
    marginTop: SPACING.md,
  },
});
