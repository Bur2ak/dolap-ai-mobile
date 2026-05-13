import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useNotificationInbox } from "@/hooks/useNotificationInbox";
import { useSubscription } from "@/hooks/useSubscription";
import { captureError, captureEvent } from "@/lib/observability";
import { useAuthStore } from "@/stores/authStore";
import { formatDate } from "@/utils/formatters";

export default function ProfileScreen() {
  const { profile, signOut } = useAuthStore();
  const { premium } = useSubscription();
  const { unreadCount } = useNotificationInbox();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const profileIncomplete = Boolean(profile && (!profile.username || !profile.onboarding_completed));

  useEffect(() => {
    captureEvent("profile_screen_viewed", {
      premium,
      profile_incomplete: profileIncomplete,
      deletion_requested: Boolean(profile?.deletion_requested_at),
    });
  }, [premium, profile?.deletion_requested_at, profileIncomplete]);

  function openRoute(route: Parameters<typeof router.push>[0], label: string) {
    if (isSigningOut) {
      captureEvent("profile_route_blocked", { label, reason: "signing_out" });
      return;
    }

    captureEvent("profile_route_opened", { label });
    router.push(route);
  }

  function handleSignOut() {
    if (isSigningOut) {
      captureEvent("profile_sign_out_blocked", { reason: "busy" });
      return;
    }

    captureEvent("profile_sign_out_prompt_opened");
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

  const routeDisabled = isSigningOut;

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
          <Button title="Talebi Yonet" variant="secondary" onPress={() => openRoute("/settings/account", "deletion_account")} disabled={routeDisabled} />
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
          <Button title="Incele" onPress={() => openRoute("/paywall", "paywall")} disabled={routeDisabled} />
        </Card>
      ) : null}

      {profileIncomplete ? (
        <Card style={styles.profileNudge}>
          <Text variant="h3">Profilini tamamla</Text>
          <Text variant="body" color="secondary">
            Kullanici adi ekleyince davet linkin daha okunur olur; sosyal akislarda arkadaslarin seni daha kolay bulur.
          </Text>
          <Button title="Tamamla" variant="secondary" onPress={() => openRoute("/settings/account", "complete_profile")} disabled={routeDisabled} />
        </Card>
      ) : null}

      {unreadCount > 0 ? (
        <Card style={styles.notificationNudge}>
          <View style={styles.notificationCopy}>
            <Text variant="h3">{unreadCount} yeni bildirim</Text>
            <Text variant="body" color="secondary">
              Fiyat, sosyal ve kombin aksiyonlarini kacirmadan kontrol et.
            </Text>
          </View>
          <Button title="Ac" variant="secondary" onPress={() => openRoute("/notifications", "notification_nudge")} disabled={routeDisabled} />
        </Card>
      ) : null}

      <View style={styles.menu}>
        <Card>
          <Button title="Ayarlar" variant="ghost" onPress={() => openRoute("/settings", "settings")} disabled={routeDisabled} />
        </Card>
        <Card>
          <Button title="Hesap Ayarlari" variant="ghost" onPress={() => openRoute("/settings/account", "account")} disabled={routeDisabled} />
        </Card>
        <Card>
          <Button title="Gizlilik" variant="ghost" onPress={() => openRoute("/settings/privacy", "privacy")} disabled={routeDisabled} />
        </Card>
        <Card>
          <Button title="Arkadaslarim" variant="ghost" onPress={() => openRoute("/social/friends", "friends")} disabled={routeDisabled} />
        </Card>
        <Card>
          <Button title="Stil Panosu" variant="ghost" onPress={() => openRoute("/social/feed", "style_feed")} disabled={routeDisabled} />
        </Card>
        <Card>
          <Button title="Odunc Takibi" variant="ghost" onPress={() => openRoute("/social/loans", "loans")} disabled={routeDisabled} />
        </Card>
        <Card>
          <Button title="Fiyat Takibi" variant="ghost" onPress={() => openRoute("/price-tracking", "price_tracking")} disabled={routeDisabled} />
        </Card>
        <Card>
          <Button title="Bildirim Ayarlari" variant="ghost" onPress={() => openRoute("/settings/notifications", "notification_settings")} disabled={routeDisabled} />
        </Card>
        <Card>
          <Button title={unreadCount > 0 ? `Bildirim Kutusu (${unreadCount})` : "Bildirim Kutusu"} variant="ghost" onPress={() => openRoute("/notifications", "notification_inbox")} disabled={routeDisabled} />
        </Card>
        <Card>
          <Button title="Sistem Durumu" variant="ghost" onPress={() => openRoute("/settings/diagnostics", "diagnostics")} disabled={routeDisabled} />
        </Card>
        <Card>
          <Button title="Destek" variant="ghost" onPress={() => openRoute("/settings/support", "support")} disabled={routeDisabled} />
        </Card>
        <Card>
          <Button title="Aboneligim" variant="ghost" onPress={() => openRoute("/settings/subscription", "subscription")} disabled={routeDisabled} />
        </Card>
        <Card>
          <Button title="Almali Miyim?" variant="ghost" onPress={() => openRoute("/buy-decision", "buy_decision")} disabled={routeDisabled} />
        </Card>
        <Card>
          <Button title="Suraya Gidiyorum" variant="ghost" onPress={() => openRoute("/event", "event")} disabled={routeDisabled} />
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
  notificationNudge: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
  },
  notificationCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  premiumCopy: {
    gap: SPACING.xs,
  },
  signOut: {
    marginTop: SPACING.md,
  },
});
