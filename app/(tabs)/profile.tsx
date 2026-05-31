import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActionSheetIOS, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useNotificationInbox } from "@/hooks/useNotificationInbox";
import { useImagePicker } from "@/hooks/useImagePicker";
import { useSubscription } from "@/hooks/useSubscription";
import { useWardrobe } from "@/hooks/useWardrobe";
import { useOutfitDiary } from "@/hooks/useOutfitDiary";
import { captureError, captureEvent } from "@/lib/observability";
import { uploadAvatarImage } from "@/lib/storage/avatar";
import { useAuthStore } from "@/stores/authStore";
import { formatDate } from "@/utils/formatters";

const STYLE_TAGS = ["Minimal", "Zarif", "Dengeli", "Modern", "Doğal"];

export default function ProfileScreen() {
  const { profile, signOut, updateProfile } = useAuthStore();
  const { premium } = useSubscription();
  const { unreadCount } = useNotificationInbox();
  const { items } = useWardrobe();
  const { entries } = useOutfitDiary();
  const { pickFromLibrary, takePhoto } = useImagePicker();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const isProfileBusy = isSigningOut || isUploadingAvatar;

  const profileIncomplete = Boolean(profile && (!profile.username || !profile.onboarding_completed));
  const legalConsentIncomplete = Boolean(profile && (!profile.kvkk_consent_at || !profile.terms_accepted_at));

  // Style score calculation
  const wornCount = items.filter((i) => i.wear_count > 0).length;
  const styleScore = items.length > 0
    ? Math.min(99, Math.round((wornCount / items.length) * 100 * 0.6 + 40))
    : 0;

  const styleLabel =
    styleScore >= 85 ? "Zamansız Minimal" :
    styleScore >= 70 ? "Dengeli Zarif" :
    styleScore >= 55 ? "Gelişen Stil" :
    "Başlangıç";

  const displayName = profile?.full_name ?? profile?.username ?? "Shipirio";
  const initials = displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  useEffect(() => {
    captureEvent("profile_screen_viewed", {
      premium,
      profile_incomplete: profileIncomplete,
      wardrobe_count: items.length,
    });
  }, [items.length, premium, profileIncomplete]);

  function handleAvatarPress() {
    if (isProfileBusy) return;
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Vazgeç", "Fotoğraf Çek", "Galeriden Seç"], cancelButtonIndex: 0 },
        async (index) => {
          if (index === 1) await pickAndUploadAvatar("camera");
          if (index === 2) await pickAndUploadAvatar("library");
        },
      );
    } else {
      Alert.alert("Profil Fotoğrafı", "Fotoğraf kaynağını seç", [
        { text: "Vazgeç", style: "cancel" },
        { text: "Fotoğraf Çek", onPress: () => void pickAndUploadAvatar("camera") },
        { text: "Galeriden Seç", onPress: () => void pickAndUploadAvatar("library") },
      ]);
    }
  }

  async function pickAndUploadAvatar(source: "camera" | "library") {
    if (!profile?.id) return;
    try {
      const uri = source === "camera" ? await takePhoto() : await pickFromLibrary();
      if (!uri) return;
      setIsUploadingAvatar(true);
      const publicUrl = await uploadAvatarImage(profile.id, uri);
      await updateProfile({ avatar_url: publicUrl });
      captureEvent("profile_avatar_updated", { source });
    } catch (err) {
      captureError(err, { area: "profile_avatar_upload" });
      Alert.alert("Yüklenemedi", err instanceof Error ? err.message : "Tekrar dene.");
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  function openRoute(route: Parameters<typeof router.push>[0], label: string) {
    if (isProfileBusy) return;
    captureEvent("profile_route_opened", { label });
    router.push(route);
  }

  function handleSignOut() {
    if (isProfileBusy) return;
    Alert.alert("Çıkış yap", "Shipirio hesabından çıkış yapmak istiyor musun?", [
      { text: "Vazgeç", style: "cancel" },
      { text: "Çıkış Yap", style: "destructive", onPress: () => void performSignOut() },
    ]);
  }

  async function performSignOut() {
    try {
      setIsSigningOut(true);
      await signOut();
      captureEvent("profile_signed_out");
      router.replace("/(auth)/onboarding");
    } catch (error) {
      captureError(error, { area: "profile_sign_out" });
      Alert.alert("Çıkış yapılamadı", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* === Hero profil kartı === */}
      <View style={styles.heroCard}>
        {/* Avatar — tappable for photo upload */}
        <TouchableOpacity style={styles.avatarWrap} onPress={handleAvatarPress} disabled={isProfileBusy} activeOpacity={0.8}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatar}>
              <Text variant="h2" color="inverse">{initials}</Text>
            </View>
          )}
          <View style={styles.cameraOverlay}>
            <Ionicons name={isUploadingAvatar ? "sync-outline" : "camera"} size={14} color={COLORS.textInverse} />
          </View>
          {premium && (
            <View style={styles.premiumBadge}>
              <Ionicons name="star" size={10} color={COLORS.textInverse} />
            </View>
          )}
        </TouchableOpacity>

        <Text variant="h1" style={styles.displayName}>{displayName}</Text>
        <Text variant="body" color="secondary">
          {premium ? "✨ Premium üye" : "Free plan · Premium'a geç"}
        </Text>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCell label="Analiz" value={entries.length} />
          <View style={styles.statDivider} />
          <StatCell label="Parça" value={items.length} />
          <View style={styles.statDivider} />
          <StatCell label="Giyildi" value={wornCount} />
          <View style={styles.statDivider} />
          <StatCell label="Kayıtlı" value={entries.length} />
        </View>
      </View>

      {/* === Stil skoru === */}
      {items.length > 0 && (
        <View style={styles.scoreCard}>
          <View style={styles.scoreCircle}>
            <Text variant="h2" color="inverse">%{styleScore}</Text>
          </View>
          <View style={styles.scoreCopy}>
            <Text variant="caption" color="muted">STİL SKORU</Text>
            <Text variant="h2">{styleLabel}</Text>
            <Text variant="body" color="secondary">
              {wornCount} parça aktif kullanımda, dolap dengen iyi.
            </Text>
            <View style={styles.styleTags}>
              {STYLE_TAGS.slice(0, 4).map((tag) => (
                <View key={tag} style={styles.styleTag}>
                  <Text variant="caption" color="muted">{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* === Uyarılar === */}
      {profile?.deletion_requested_at && (
        <View style={styles.alertBanner}>
          <Ionicons name="warning-outline" size={18} color={COLORS.warning} />
          <Text variant="label" style={{ color: COLORS.warning, flex: 1 }}>
            Hesap silme talebi aktif. Silme tarihi: {profile.deletion_scheduled_for ? formatDate(profile.deletion_scheduled_for) : "30 gün içinde"}
          </Text>
          <Button title="Yönet" variant="ghost" onPress={() => openRoute("/settings/account", "deletion")} style={styles.alertBtn} />
        </View>
      )}

      {legalConsentIncomplete && (
        <Pressable style={styles.alertBanner} onPress={() => openRoute("/settings/account", "legal_consent")}>
          <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
          <Text variant="label" style={{ flex: 1 }}>Yasal onayları tamamla (KVKK/Kullanım Şartları)</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
        </Pressable>
      )}

      {!premium && (
        <TouchableOpacity
          style={styles.premiumBannerCard}
          onPress={() => openRoute("/paywall", "paywall")}
          activeOpacity={0.85}
        >
          <View style={styles.premiumLeft}>
            <Text variant="h3">Premium'a Geç ✨</Text>
            <Text variant="body" color="secondary">
              Sınırsız dolap, etkinlik planlayıcı ve gelişmiş analizler.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      )}

      {/* === Sosyal menü === */}
      <MenuGroup label="SOSYAL">
        <MenuRow icon="people-outline" label="Arkadaşlarım" onPress={() => openRoute("/social/friends", "friends")} disabled={isProfileBusy} />
        <MenuRow icon="grid-outline" label="Stil Panosu" onPress={() => openRoute("/social/feed", "style_feed")} disabled={isProfileBusy} />
        <MenuRow icon="repeat-outline" label="Ödünç Takibi" onPress={() => openRoute("/social/loans", "loans")} disabled={isProfileBusy} />
      </MenuGroup>

      {/* === Araçlar === */}
      <MenuGroup label="ARAÇLAR">
        <MenuRow icon="chatbubble-ellipses-outline" label="Style Asistanı ✨" onPress={() => openRoute("/style-chat", "style_chat")} disabled={isProfileBusy} />
        <MenuRow icon="color-palette-outline" label="Renk DNA ✨" onPress={() => openRoute("/color-dna", "color_dna")} disabled={isProfileBusy} />
        <MenuRow icon="share-social-outline" label="Stil DNA Kartım" onPress={() => openRoute("/style-dna-card", "style_dna_card")} disabled={isProfileBusy} />
        <MenuRow icon="book-outline" label="Giyim Günlüğü" onPress={() => openRoute("/outfit-diary", "outfit_diary")} disabled={isProfileBusy} />
        <MenuRow icon="heart-outline" label="Marka Takibi" onPress={() => openRoute("/brand-wishlist", "brand_wishlist")} disabled={isProfileBusy} />
        <MenuRow icon="trending-down-outline" label="Fiyat Takibi" onPress={() => openRoute("/price-tracking", "price_tracking")} disabled={isProfileBusy} />
        <MenuRow icon="bag-check-outline" label="Almalı Mıyım?" onPress={() => openRoute("/buy-decision", "buy_decision")} disabled={isProfileBusy} />
        <MenuRow icon="calendar-outline" label="Etkinlik Planlayıcı" onPress={() => openRoute("/event", "event")} disabled={isProfileBusy} />
      </MenuGroup>

      {/* === Hesap === */}
      <MenuGroup label="HESAP & AYARLAR">
        <MenuRow
          icon="notifications-outline"
          label={unreadCount > 0 ? `Bildirimler  (${unreadCount})` : "Bildirimler"}
          onPress={() => openRoute("/notifications", "notifications")}
          disabled={isProfileBusy}
          badge={unreadCount > 0}
        />
        <MenuRow icon="star-outline" label="Aboneliğim" onPress={() => openRoute("/settings/subscription", "subscription")} disabled={isProfileBusy} />
        <MenuRow icon="person-outline" label="Hesap Ayarları" onPress={() => openRoute("/settings/account", "account")} disabled={isProfileBusy} />
        <MenuRow icon="shield-outline" label="Gizlilik" onPress={() => openRoute("/settings/privacy", "privacy")} disabled={isProfileBusy} />
        <MenuRow icon="help-circle-outline" label="Destek" onPress={() => openRoute("/settings/support", "support")} disabled={isProfileBusy} />
      </MenuGroup>

      <TouchableOpacity style={styles.signOutRow} onPress={handleSignOut} disabled={isSigningOut}>
        <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
        <Text variant="label" style={{ color: COLORS.danger }}>
          {isSigningOut ? "Çıkış yapılıyor..." : "Çıkış Yap"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCell}>
      <Text variant="h2">{value}</Text>
      <Text variant="caption" color="muted">{label}</Text>
    </View>
  );
}

function MenuGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card style={styles.menuGroup}>
      <Text variant="caption" color="muted" style={styles.menuGroupLabel}>{label}</Text>
      {children}
    </Card>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
  disabled,
  badge,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  disabled?: boolean;
  badge?: boolean;
}) {
  return (
    <Pressable style={styles.menuRow} onPress={onPress} disabled={disabled}>
      <View style={styles.menuIconWrap}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
      </View>
      <Text variant="body" style={styles.menuRowLabel}>{label}</Text>
      {badge && <View style={styles.badgeDot} />}
      <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.background, flex: 1 },
  content: { gap: SPACING.md, paddingBottom: 100 },

  // Hero card
  heroCard: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
    gap: SPACING.sm,
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingTop: 56,
  },
  avatarWrap: { position: "relative" },
  avatar: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: 80,
    justifyContent: "center",
    width: 80,
  },
  avatarImg: {
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 2,
    height: 80,
    width: 80,
  },
  cameraOverlay: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderColor: COLORS.surface,
    borderRadius: 999,
    borderWidth: 2,
    bottom: 0,
    height: 26,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    width: 26,
  },
  premiumBadge: {
    alignItems: "center",
    backgroundColor: "#C9A84C",
    borderRadius: 999,
    bottom: 0,
    height: 22,
    justifyContent: "center",
    position: "absolute",
    right: 0,
    width: 22,
  },
  displayName: { marginTop: SPACING.xs },

  // Stats
  statsRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginTop: SPACING.sm,
  },
  statCell: { alignItems: "center", gap: 2, paddingHorizontal: SPACING.lg },
  statDivider: {
    backgroundColor: COLORS.border,
    height: 32,
    width: 1,
  },

  // Score
  scoreCard: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACING.md,
    marginHorizontal: SPACING.lg,
    padding: SPACING.md,
  },
  scoreCircle: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: 80,
    justifyContent: "center",
    width: 80,
  },
  scoreCopy: { flex: 1, gap: SPACING.xs },
  styleTags: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs, marginTop: SPACING.xs },
  styleTag: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },

  // Alerts
  alertBanner: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    padding: SPACING.md,
  },
  alertBtn: { minHeight: 36, paddingHorizontal: SPACING.sm },

  premiumBannerCard: {
    alignItems: "center",
    backgroundColor: COLORS.primarySoft,
    borderRadius: 16,
    flexDirection: "row",
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    padding: SPACING.md,
  },
  premiumLeft: { flex: 1, gap: 3 },

  // Menu groups
  menuGroup: {
    gap: 0,
    marginHorizontal: SPACING.lg,
    overflow: "hidden",
    padding: 0,
  },
  menuGroupLabel: {
    paddingBottom: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  menuRow: {
    alignItems: "center",
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  menuIconWrap: {
    alignItems: "center",
    backgroundColor: COLORS.primarySoft,
    borderRadius: 8,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  menuRowLabel: { flex: 1 },
  badgeDot: {
    backgroundColor: COLORS.danger,
    borderRadius: 999,
    height: 8,
    width: 8,
  },

  signOutRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
    justifyContent: "center",
    marginHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
});
