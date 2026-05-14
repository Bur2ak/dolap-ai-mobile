import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { captureEvent } from "@/lib/observability";

const settingsRoutes = [
  {
    icon: "person-outline" as const,
    title: "Hesap",
    body: "Ad, kullanici adi ve bio bilgilerini duzenle.",
    route: "/settings/account" as const,
  },
  {
    icon: "lock-closed-outline" as const,
    title: "Gizlilik",
    body: "Arkadas istekleri ve paylasilan dolap ayarlarini yonet.",
    route: "/settings/privacy" as const,
  },
  {
    icon: "notifications-outline" as const,
    title: "Bildirimler",
    body: "Kombin, fiyat ve sosyal bildirim tercihlerini guncelle.",
    route: "/settings/notifications" as const,
  },
  {
    icon: "mail-unread-outline" as const,
    title: "Bildirim Kutusu",
    body: "Fiyat dususleri, arkadas istekleri ve kombin oylarini gor.",
    route: "/notifications" as const,
  },
  {
    icon: "swap-horizontal-outline" as const,
    title: "Odunc Takibi",
    body: "Gelen ve gonderilen odunc isteklerini yonet.",
    route: "/social/loans" as const,
  },
  {
    icon: "card-outline" as const,
    title: "Abonelik",
    body: "Plan durumunu ve freemium limitlerini gor.",
    route: "/settings/subscription" as const,
  },
  {
    icon: "pulse-outline" as const,
    title: "Sistem Durumu",
    body: "Env ve entegrasyon ayarlarinin hazir olup olmadigini kontrol et.",
    route: "/settings/diagnostics" as const,
  },
  {
    icon: "help-circle-outline" as const,
    title: "Destek",
    body: "Iletisim, destek ve store URL bilgilerini gor.",
    route: "/settings/support" as const,
  },
  {
    icon: "document-text-outline" as const,
    title: "KVKK Aydinlatma Metni",
    body: "Kisisel verilerin islenme kapsamlarini incele.",
    route: "/legal/kvkk" as const,
  },
  {
    icon: "document-text-outline" as const,
    title: "Gizlilik Politikasi",
    body: "Shipirio'nun veri ve gizlilik notlarini incele.",
    route: "/legal/privacy" as const,
  },
  {
    icon: "reader-outline" as const,
    title: "Kullanim Sartlari",
    body: "Uygulama kullanim kosullarini gor.",
    route: "/legal/terms" as const,
  },
];

const reviewChecks = [
  {
    label: "Gizlilik",
    route: "/settings/privacy" as const,
  },
  {
    label: "Yasal",
    route: "/legal/terms" as const,
  },
  {
    label: "Abonelik",
    route: "/settings/subscription" as const,
  },
  {
    label: "Destek",
    route: "/settings/support" as const,
  },
  {
    label: "Sistem",
    route: "/settings/diagnostics" as const,
  },
];

export default function SettingsScreen() {
  useEffect(() => {
    captureEvent("settings_screen_viewed", { route_count: settingsRoutes.length });
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} />
        <Text variant="h2">Ayarlar</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Card style={styles.reviewCard}>
        <Text variant="caption" color="muted">
          APP REVIEW
        </Text>
        <Text variant="h3">Yayin oncesi merkez</Text>
        <Text variant="body" color="secondary">
          Store incelemesinde sorulabilecek destek, gizlilik, abonelik ve sistem durumlarini buradan dogrula.
        </Text>
        <View style={styles.reviewActions}>
          {reviewChecks.map((item) => (
            <Button
              key={item.route}
              title={item.label}
              variant="secondary"
              onPress={() => {
                captureEvent("settings_review_shortcut_opened", { route: item.route, label: item.label });
                router.push(item.route);
              }}
              style={styles.reviewButton}
            />
          ))}
        </View>
      </Card>

      <View style={styles.list}>
        {settingsRoutes.map((item) => (
          <Card key={item.route} style={styles.row}>
            <View style={styles.iconWrap}>
              <Ionicons name={item.icon} size={22} color={COLORS.primary} />
            </View>
            <View style={styles.copy}>
              <Text variant="label">{item.title}</Text>
              <Text variant="body" color="secondary">
                {item.body}
              </Text>
            </View>
            <Button
              title="Ac"
              variant="ghost"
              onPress={() => {
                captureEvent("settings_route_opened", { route: item.route, title: item.title });
                router.push(item.route);
              }}
            />
          </Card>
        ))}
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
    paddingTop: 56,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerSpacer: {
    width: 72,
  },
  list: {
    gap: SPACING.md,
  },
  reviewCard: {
    gap: SPACING.md,
  },
  reviewActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  reviewButton: {
    flex: 1,
    minHeight: 40,
    minWidth: "30%",
    paddingHorizontal: SPACING.sm,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
  },
  iconWrap: {
    alignItems: "center",
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  copy: {
    flex: 1,
    gap: SPACING.xs,
  },
});
