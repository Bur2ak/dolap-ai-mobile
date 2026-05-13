import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { createPublicAppLink } from "@/lib/links";
import { captureError, captureEvent } from "@/lib/observability";

const supportEmail = "hello@shipirio.com";
const supportTopics = [
  "Hesap ve giris sorunlari",
  "Premium abonelik ve geri yukleme",
  "Veri silme veya KVKK talepleri",
  "Fiyat takibi, bildirimler ve teknik hatalar",
];
const quickActions = [
  {
    body: "Abonelik geri yukleme, aktif plan ve limit durumunu kontrol et.",
    icon: "card-outline" as const,
    label: "subscription",
    route: "/settings/subscription" as const,
    title: "Abonelik kontrolu",
  },
  {
    body: "Cihaz, push, RevenueCat ve public env durumunu raporla.",
    icon: "pulse-outline" as const,
    label: "diagnostics",
    route: "/settings/diagnostics" as const,
    title: "Sistem raporu",
  },
  {
    body: "Hesap silme talebini baslat, iptal et veya 30 gunluk sureci incele.",
    icon: "person-remove-outline" as const,
    label: "account",
    route: "/settings/account" as const,
    title: "Hesap ve veri",
  },
];
const emailTemplates = [
  {
    body: "Merhaba Shipirio ekibi,%0A%0AHesabimla ilgili yardima ihtiyacim var.%0A%0AHesap emaili:%0ASorun:%0A",
    label: "account_help",
    title: "Hesap yardimi",
  },
  {
    body: "Merhaba Shipirio ekibi,%0A%0APremium abonelik veya geri yukleme konusunda yardima ihtiyacim var.%0A%0AHesap emaili:%0APlatform: iOS / Android%0ASorun:%0A",
    label: "subscription_help",
    title: "Abonelik yardimi",
  },
  {
    body: "Merhaba Shipirio ekibi,%0A%0AKVKK veya hesap silme talebim icin yaziyorum.%0A%0AHesap emaili:%0ATalep:%0A",
    label: "privacy_help",
    title: "KVKK / silme talebi",
  },
  {
    body: "Merhaba Shipirio ekibi,%0A%0ATeknik bir sorun bildirmek istiyorum.%0A%0AEkran:%0AAdimlar:%0ABeklenen sonuc:%0AGerceklesen sonuc:%0A",
    label: "bug_report",
    title: "Teknik hata bildir",
  },
];
const helpNotes = [
  {
    body: "Premium satin alma ve geri yukleme islemleri App Store veya Google Play kurallariyla yonetilir.",
    title: "Abonelik",
  },
  {
    body: "AI onerileri tavsiye niteligindedir; kiyafet, fiyat ve satin alma kararinda son secim kullanicidadir.",
    title: "AI onerileri",
  },
  {
    body: "Hesap silme talebi uygulama icinden baslatilir ve 30 gunluk bekleme suresinden sonra islenir.",
    title: "Veri silme",
  },
];

export default function SupportScreen() {
  const [openingLink, setOpeningLink] = useState<string | null>(null);
  const supportUrl = createPublicAppLink("/support.html");
  const privacyUrl = createPublicAppLink("/privacy.html");
  const deleteAccountUrl = createPublicAppLink("/delete-account.html");

  useEffect(() => {
    captureEvent("support_screen_viewed");
  }, []);

  async function openUrl(url: string, label: string) {
    if (openingLink) {
      captureEvent("support_link_open_blocked", { label, reason: "busy" });
      return;
    }

    setOpeningLink(label);
    try {
      if (url.startsWith("http")) {
        await WebBrowser.openBrowserAsync(url);
        captureEvent("support_link_opened", { label, type: "web" });
        return;
      }

      await Linking.openURL(url);
      captureEvent("support_link_opened", { label, type: "mailto" });
    } catch (error) {
      captureError(error, { area: "support_link_open", label, url_type: url.startsWith("http") ? "web" : "mailto" });
      Alert.alert("Acilamadi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setOpeningLink(null);
    }
  }

  function openRoute(route: Parameters<typeof router.push>[0], label: string) {
    if (openingLink) {
      captureEvent("support_route_open_blocked", { label, reason: "busy" });
      return;
    }

    captureEvent("support_route_opened", { label });
    router.push(route);
  }

  function getSupportMailto(template: (typeof emailTemplates)[number]) {
    const subject = encodeURIComponent(`Shipirio Destek - ${template.title}`);
    return `mailto:${supportEmail}?subject=${subject}&body=${template.body}`;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} disabled={Boolean(openingLink)} />
        <Text variant="h2">Destek</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Card style={styles.hero}>
        <View style={styles.iconWrap}>
          <Ionicons name="chatbubble-ellipses-outline" size={28} color={COLORS.primary} />
        </View>
        <Text variant="h3">Yardim lazimsa buradayiz</Text>
        <Text variant="body" color="secondary">
          Shipirio hesap, abonelik, bildirim veya veri talepleri icin destek kanallarini kullanabilirsin.
        </Text>
      </Card>

      <Card style={styles.section}>
        <Text variant="h3">Iletisim</Text>
        <Text variant="body" color="secondary">
          {supportEmail}
        </Text>
        <Button
          title="E-posta Gonder"
          onPress={() => void openUrl(`mailto:${supportEmail}?subject=Shipirio%20Destek`, "email")}
          loading={openingLink === "email"}
          disabled={Boolean(openingLink)}
        />
        <Button
          title="Sistem Raporu Hazirla"
          variant="secondary"
          onPress={() => {
            if (openingLink) {
              captureEvent("support_diagnostics_route_blocked", { reason: "busy" });
              return;
            }

            captureEvent("support_diagnostics_route_opened");
            router.push("/settings/diagnostics");
          }}
          disabled={Boolean(openingLink)}
        />
      </Card>

      <Card style={styles.section}>
        <Text variant="h3">Hizli aksiyonlar</Text>
        {quickActions.map((action) => (
          <View key={action.label} style={styles.actionRow}>
            <View style={styles.actionIcon}>
              <Ionicons name={action.icon} size={20} color={COLORS.primary} />
            </View>
            <View style={styles.actionCopy}>
              <Text variant="label">{action.title}</Text>
              <Text variant="caption" color="secondary">
                {action.body}
              </Text>
            </View>
            <Button title="Ac" variant="ghost" onPress={() => openRoute(action.route, action.label)} disabled={Boolean(openingLink)} style={styles.actionButton} />
          </View>
        ))}
      </Card>

      <Card style={styles.section}>
        <Text variant="h3">Hazir e-posta konulari</Text>
        {emailTemplates.map((template) => (
          <Button
            key={template.label}
            title={template.title}
            variant="secondary"
            onPress={() => void openUrl(getSupportMailto(template), template.label)}
            loading={openingLink === template.label}
            disabled={Boolean(openingLink)}
          />
        ))}
      </Card>

      <Card style={styles.section}>
        <Text variant="h3">Destek konulari</Text>
        {supportTopics.map((topic) => (
          <View key={topic} style={styles.topicRow}>
            <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.primary} />
            <Text variant="body" color="secondary" style={styles.topicText}>
              {topic}
            </Text>
          </View>
        ))}
      </Card>

      <Card style={styles.section}>
        <Text variant="h3">Kisa notlar</Text>
        {helpNotes.map((note) => (
          <View key={note.title} style={styles.noteRow}>
            <Text variant="label">{note.title}</Text>
            <Text variant="body" color="secondary" style={styles.noteText}>
              {note.body}
            </Text>
          </View>
        ))}
      </Card>

      <Card style={styles.section}>
        <Text variant="h3">Web sayfalari</Text>
        <Button
          title="Destek Sayfasini Ac"
          variant="secondary"
          onPress={() => void openUrl(supportUrl, "support")}
          loading={openingLink === "support"}
          disabled={Boolean(openingLink)}
        />
        <Button
          title="Gizlilik Sayfasini Ac"
          variant="secondary"
          onPress={() => void openUrl(privacyUrl, "privacy")}
          loading={openingLink === "privacy"}
          disabled={Boolean(openingLink)}
        />
        <Button
          title="Hesap Silme Bilgisini Ac"
          variant="secondary"
          onPress={() => void openUrl(deleteAccountUrl, "delete_account")}
          loading={openingLink === "delete_account"}
          disabled={Boolean(openingLink)}
        />
      </Card>
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
  hero: {
    gap: SPACING.md,
  },
  iconWrap: {
    alignItems: "center",
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  section: {
    gap: SPACING.md,
  },
  topicRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  topicText: {
    flex: 1,
  },
  actionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  actionIcon: {
    alignItems: "center",
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  actionCopy: {
    flex: 1,
    gap: 2,
  },
  actionButton: {
    minHeight: 40,
    paddingHorizontal: SPACING.sm,
  },
  noteRow: {
    gap: SPACING.xs,
  },
  noteText: {
    flexShrink: 1,
  },
});
