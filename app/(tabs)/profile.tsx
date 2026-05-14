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
import { useWardrobe } from "@/hooks/useWardrobe";
import { captureError, captureEvent } from "@/lib/observability";
import { useAuthStore } from "@/stores/authStore";
import { formatDate } from "@/utils/formatters";

export default function ProfileScreen() {
  const { profile, signOut } = useAuthStore();
  const { premium } = useSubscription();
  const { unreadCount } = useNotificationInbox();
  const { items } = useWardrobe();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const profileIncomplete = Boolean(profile && (!profile.username || !profile.onboarding_completed));
  const quickStartSteps = [
    {
      body: items.length > 0 ? `${items.length} kiyafet dolabinda.` : "Ilk parcani ekleyip AI analizini baslat.",
      done: items.length > 0,
      label: "Dolap",
      route: items.length > 0 ? ("/" as const) : ("/item/add" as const),
      title: items.length > 0 ? "Dolap kuruldu" : "Ilk kiyafeti ekle",
    },
    {
      body: profileIncomplete ? "Kullanici adi ve profil bilgilerini tamamla." : "Sosyal ve destek akislari icin profil hazir.",
      done: !profileIncomplete,
      label: "Profil",
      route: "/settings/account" as const,
      title: profileIncomplete ? "Profilini tamamla" : "Profil hazir",
    },
    {
      body: premium ? "Premium limitler aktif gorunuyor." : "Premium ozellikleri ve limitleri incele.",
      done: premium,
      label: "Plan",
      route: "/settings/subscription" as const,
      title: premium ? "Premium aktif" : "Planini kontrol et",
    },
  ];
  const completedQuickStartSteps = quickStartSteps.filter((step) => step.done).length;
  const readinessSteps = [
    {
      body: "Env, push, analytics ve crash ayarlari.",
      label: "Sistem",
      route: "/settings/diagnostics" as const,
      title: "Sistem durumunu kontrol et",
    },
    {
      body: "Gizlilik, destek ve hesap silme yollarini dogrula.",
      label: "Review",
      route: "/settings" as const,
      title: "Store review akislarini ac",
    },
    {
      body: "Premium teklifleri, restore ve limit ekranlarini test et.",
      label: "Premium",
      route: "/settings/subscription" as const,
      title: "Abonelik hazirligini incele",
    },
    {
      body: "Destek baglami, public yasal linkler ve e-posta sablonlari.",
      label: "Destek",
      route: "/settings/support" as const,
      title: "Destek merkezini kontrol et",
    },
  ];

  useEffect(() => {
    captureEvent("profile_screen_viewed", {
      premium,
      profile_incomplete: profileIncomplete,
      deletion_requested: Boolean(profile?.deletion_requested_at),
      quick_start_completed: completedQuickStartSteps,
      wardrobe_count: items.length,
    });
  }, [completedQuickStartSteps, items.length, premium, profile?.deletion_requested_at, profileIncomplete]);

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

      <Card style={styles.quickStartCard}>
        <View style={styles.quickStartHeader}>
          <View style={styles.quickStartCopy}>
            <Text variant="h3">Baslangic kontrolu</Text>
            <Text variant="body" color="secondary">
              {completedQuickStartSteps}/{quickStartSteps.length} adim tamam. Shipirio'yu gunluk kullanima hazirlayan ana aksiyonlar.
            </Text>
          </View>
          <View style={styles.quickStartBadge}>
            <Text variant="caption" color="primary">
              {completedQuickStartSteps}/{quickStartSteps.length}
            </Text>
          </View>
        </View>
        {quickStartSteps.map((step) => (
          <View key={step.label} style={styles.quickStartRow}>
            <View style={[styles.stepDot, step.done && styles.stepDotDone]} />
            <View style={styles.quickStartStepCopy}>
              <Text variant="label">{step.title}</Text>
              <Text variant="caption" color="secondary">
                {step.body}
              </Text>
            </View>
            <Button title={step.done ? "Ac" : "Basla"} variant="ghost" onPress={() => openRoute(step.route, `quick_start_${step.label}`)} disabled={routeDisabled} style={styles.quickStartButton} />
          </View>
        ))}
      </Card>

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

      <Card style={styles.releaseCard}>
        <Text variant="caption" color="muted">
          YAYIN HAZIRLIK MERKEZI
        </Text>
        <Text variant="h3">Store oncesi hizli kontrol</Text>
        <Text variant="body" color="secondary">
          App review'a girmeden once en kritik ayar, gizlilik ve abonelik yuzeylerini buradan ac.
        </Text>
        {readinessSteps.map((step) => (
          <View key={step.label} style={styles.releaseRow}>
            <View style={styles.releaseBadge}>
              <Text variant="caption" color="primary">
                {step.label}
              </Text>
            </View>
            <View style={styles.releaseCopy}>
              <Text variant="label">{step.title}</Text>
              <Text variant="caption" color="secondary">
                {step.body}
              </Text>
            </View>
            <Button title="Ac" variant="ghost" onPress={() => openRoute(step.route, `release_${step.label}`)} disabled={routeDisabled} style={styles.releaseButton} />
          </View>
        ))}
      </Card>

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
  quickStartCard: {
    gap: SPACING.md,
  },
  quickStartHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
  },
  quickStartCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  quickStartBadge: {
    alignItems: "center",
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  quickStartRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  quickStartStepCopy: {
    flex: 1,
    gap: 2,
  },
  quickStartButton: {
    minHeight: 40,
    paddingHorizontal: SPACING.sm,
  },
  stepDot: {
    backgroundColor: COLORS.surfaceMuted,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 14,
    width: 14,
  },
  stepDotDone: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
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
  releaseCard: {
    gap: SPACING.md,
  },
  releaseRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  releaseBadge: {
    alignItems: "center",
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    justifyContent: "center",
    minWidth: 70,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  releaseCopy: {
    flex: 1,
    gap: 2,
  },
  releaseButton: {
    minHeight: 40,
    paddingHorizontal: SPACING.sm,
  },
  premiumCopy: {
    gap: SPACING.xs,
  },
  signOut: {
    marginTop: SPACING.md,
  },
});
