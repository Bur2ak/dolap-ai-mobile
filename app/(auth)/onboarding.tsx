import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { captureEvent } from "@/lib/observability";
import { getSafeInternalReturnTo } from "@/lib/routeParams";

const slides = [
  {
    title: "Dolabini dijitallestir",
    body: "Kiyafetlerini fotografla, AI kategori, renk ve sezon bilgilerini otomatik cikarsin.",
    icon: "shirt-outline" as const,
  },
  {
    title: "Her gun kombin bul",
    body: "Hava durumu, etkinlik ve ruh haline gore gardirobundan uygulanabilir oneriler al.",
    icon: "sparkles-outline" as const,
  },
  {
    title: "Alisverisini zekice yonet",
    body: "Yeni bir parca almadan once dolabindaki benzerleri ve kombin potansiyelini gor.",
    icon: "pricetag-outline" as const,
  },
];

const permissionNotes = [
  {
    body: "Sadece kiyafet eklerken veya foto secmek istediginde kullanilir.",
    icon: "camera-outline" as const,
    title: "Kamera ve galeri",
  },
  {
    body: "Kombin onerilerini hava durumuna gore iyilestirmek icin istenir.",
    icon: "partly-sunny-outline" as const,
    title: "Konum",
  },
  {
    body: "Fiyat dususu, sabah kombin ve sosyal aksiyonlar icin kullanilir.",
    icon: "notifications-outline" as const,
    title: "Bildirimler",
  },
];

export default function OnboardingScreen() {
  const { returnTo: returnToParam } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const returnTo = getSafeInternalReturnTo(returnToParam);

  useEffect(() => {
    captureEvent("onboarding_screen_viewed", { has_return_to: Boolean(returnTo) });
  }, [returnTo]);

  function openRegister() {
    captureEvent("onboarding_register_pressed", { has_return_to: Boolean(returnTo) });
    router.push({
      pathname: "/(auth)/register",
      params: returnTo ? { returnTo } : undefined,
    });
  }

  function openLogin() {
    captureEvent("onboarding_login_pressed", { has_return_to: Boolean(returnTo) });
    router.push({
      pathname: "/(auth)/login",
      params: returnTo ? { returnTo } : undefined,
    });
  }

  function openLegal(route: "/legal/kvkk" | "/legal/privacy" | "/legal/terms", target: string) {
    captureEvent("onboarding_legal_link_opened", { target });
    router.push(route);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.brandMark}>
          <Ionicons name="cube-outline" size={28} color={COLORS.textInverse} />
        </View>
        <Text variant="display">Shipirio</Text>
        <Text variant="body" color="secondary" style={styles.subtitle}>
          Gardirobunu anlayan, kombinleyen ve satin alma kararlarini sadelestiren mobil stil asistani.
        </Text>
        <View style={styles.heroStats}>
          <View style={styles.statPill}>
            <Text variant="caption" color="primary">
              AI analiz
            </Text>
          </View>
          <View style={styles.statPill}>
            <Text variant="caption" color="primary">
              Kombin onerisi
            </Text>
          </View>
          <View style={styles.statPill}>
            <Text variant="caption" color="primary">
              Fiyat takibi
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.slides}>
        {slides.map((slide, index) => (
          <Card key={slide.title} style={styles.slide}>
            <View style={styles.slideIcon}>
              <Ionicons name={slide.icon} size={22} color={COLORS.primary} />
            </View>
            <View style={styles.slideCopy}>
              <Text variant="caption" color="muted">
                0{index + 1}
              </Text>
              <Text variant="h3">{slide.title}</Text>
              <Text variant="body" color="secondary">
                {slide.body}
              </Text>
            </View>
          </Card>
        ))}
      </View>

      <Card style={styles.trustCard}>
        <Text variant="h3">Izinleri ihtiyac aninda isteriz</Text>
        {permissionNotes.map((note) => (
          <View key={note.title} style={styles.permissionRow}>
            <Ionicons name={note.icon} size={20} color={COLORS.primary} />
            <View style={styles.permissionCopy}>
              <Text variant="label">{note.title}</Text>
              <Text variant="caption" color="secondary">
                {note.body}
              </Text>
            </View>
          </View>
        ))}
      </Card>

      <Card style={styles.privacyCard}>
        <Ionicons name="shield-checkmark-outline" size={22} color={COLORS.success} />
        <View style={styles.privacyCopy}>
          <Text variant="label">Gizlilik ve KVKK hazirligi</Text>
          <Text variant="caption" color="secondary">
            Hesap verilerini ayarlardan indirebilir, destek raporu olusturabilir ve hesap silme talebi baslatabilirsin.
          </Text>
        </View>
      </Card>

      <View style={styles.actions}>
        <Button title="Kayit Ol" onPress={openRegister} />
        <Button title="Giris Yap" variant="secondary" onPress={openLogin} />
        <View style={styles.legalLinks}>
          <Button title="KVKK" variant="ghost" onPress={() => openLegal("/legal/kvkk", "kvkk")} style={styles.legalButton} />
          <Button title="Gizlilik" variant="ghost" onPress={() => openLegal("/legal/privacy", "privacy")} style={styles.legalButton} />
          <Button title="Sartlar" variant="ghost" onPress={() => openLegal("/legal/terms", "terms")} style={styles.legalButton} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  content: {
    gap: SPACING.md,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
    paddingTop: 72,
  },
  hero: {
    gap: SPACING.md,
  },
  brandMark: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  subtitle: {
    maxWidth: 340,
  },
  heroStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  statPill: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  slides: {
    gap: SPACING.md,
  },
  slide: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: SPACING.md,
  },
  slideIcon: {
    alignItems: "center",
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  slideCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  trustCard: {
    gap: SPACING.md,
  },
  permissionRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  permissionCopy: {
    flex: 1,
    gap: 2,
  },
  privacyCard: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  privacyCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  actions: {
    gap: SPACING.sm,
  },
  legalLinks: {
    flexDirection: "row",
    gap: SPACING.xs,
  },
  legalButton: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: SPACING.sm,
  },
});
