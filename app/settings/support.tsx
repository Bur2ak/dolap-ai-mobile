import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Alert, ScrollView, Share, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { createPublicAppLink } from "@/lib/links";
import { captureError, captureEvent } from "@/lib/observability";
import { useAuthStore } from "@/stores/authStore";

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
  const { profile, session } = useAuthStore();
  const [openingLink, setOpeningLink] = useState<string | null>(null);
  const [isSharingContext, setIsSharingContext] = useState(false);
  const supportUrl = createPublicAppLink("/support.html");
  const privacyUrl = createPublicAppLink("/privacy.html");
  const deleteAccountUrl = createPublicAppLink("/delete-account.html");
  const termsUrl = createPublicAppLink("/terms.html");
  const kvkkUrl = createPublicAppLink("/kvkk.html");
  const appVersion = Constants.expoConfig?.version ?? "Bilinmiyor";
  const iosBuildNumber = Constants.expoConfig?.ios?.buildNumber ?? "Bilinmiyor";
  const androidVersionCode = Constants.expoConfig?.android?.versionCode ?? "Bilinmiyor";
  const isBusy = Boolean(openingLink) || isSharingContext;

  useEffect(() => {
    captureEvent("support_screen_viewed");
  }, []);

  async function openUrl(url: string, label: string) {
    if (isBusy) {
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
    if (isBusy) {
      return;
    }

    captureEvent("support_route_opened", { label });
    router.push(route);
  }

  function getSupportMailto(template: (typeof emailTemplates)[number]) {
    const subject = encodeURIComponent(`Shipirio Destek - ${template.title}`);
    return `mailto:${supportEmail}?subject=${subject}&body=${template.body}`;
  }

  async function handleShareSupportContext() {
    if (isBusy) {
      return;
    }

    try {
      setIsSharingContext(true);
      const result = await Share.share({
        title: "Shipirio destek baglami",
        message: buildSupportContext({
          androidVersionCode,
          appVersion,
          email: session?.user.email ?? null,
          iosBuildNumber,
          profileName: profile?.full_name ?? null,
          username: profile?.username ?? null,
        }),
      });
      captureEvent("support_context_shared", {
        completed: result.action === Share.sharedAction,
        has_profile: Boolean(profile),
      });
    } catch (error) {
      captureError(error, { area: "support_context_share" });
      Alert.alert("Paylasilamadi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setIsSharingContext(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} disabled={isBusy} />
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
          disabled={isBusy}
        />
        <Button
          title="Sistem Raporu Hazirla"
          variant="secondary"
          onPress={() => {
            if (isBusy) {
              return;
            }

            captureEvent("support_diagnostics_route_opened");
            router.push("/settings/diagnostics");
          }}
          disabled={isBusy}
        />
      </Card>

      <Card style={styles.section}>
        <Text variant="h3">Destek baglami</Text>
        <Text variant="body" color="secondary">
          Hesap ve cihaz bilgilerini hassas anahtar olmadan tek metinde paylas; hata bildirirken hiz kazandirir.
        </Text>
        <View style={styles.contextGrid}>
          <StatusBox label="Hesap" value={session?.user.email ? "Bagli" : "Eksik"} />
          <StatusBox label="Surum" value={appVersion} />
          <StatusBox label="iOS" value={String(iosBuildNumber)} />
          <StatusBox label="Android" value={String(androidVersionCode)} />
        </View>
        <Button title="Destek Baglamini Paylas" variant="secondary" onPress={() => void handleShareSupportContext()} loading={isSharingContext} disabled={isBusy} />
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
            <Button title="Ac" variant="ghost" onPress={() => openRoute(action.route, action.label)} disabled={isBusy} style={styles.actionButton} />
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
            disabled={isBusy}
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
          disabled={isBusy}
        />
        <Button
          title="Gizlilik Sayfasini Ac"
          variant="secondary"
          onPress={() => void openUrl(privacyUrl, "privacy")}
          loading={openingLink === "privacy"}
          disabled={isBusy}
        />
        <Button
          title="Hesap Silme Bilgisini Ac"
          variant="secondary"
          onPress={() => void openUrl(deleteAccountUrl, "delete_account")}
          loading={openingLink === "delete_account"}
          disabled={isBusy}
        />
        <Button
          title="Kullanim Sartlarini Ac"
          variant="secondary"
          onPress={() => void openUrl(termsUrl, "terms")}
          loading={openingLink === "terms"}
          disabled={isBusy}
        />
        <Button
          title="KVKK Sayfasini Ac"
          variant="secondary"
          onPress={() => void openUrl(kvkkUrl, "kvkk")}
          loading={openingLink === "kvkk"}
          disabled={isBusy}
        />
      </Card>
    </ScrollView>
  );
}

function StatusBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statusBox}>
      <Text variant="caption" color="muted">
        {label}
      </Text>
      <Text variant="label">{value}</Text>
    </View>
  );
}

function buildSupportContext({
  androidVersionCode,
  appVersion,
  email,
  iosBuildNumber,
  profileName,
  username,
}: {
  androidVersionCode: string | number;
  appVersion: string;
  email: string | null;
  iosBuildNumber: string | number;
  profileName: string | null;
  username: string | null;
}) {
  return [
    "Shipirio destek baglami",
    "",
    `E-posta: ${email ?? "Yok"}`,
    `Ad Soyad: ${profileName ?? "Yok"}`,
    `Kullanici adi: ${username ?? "Yok"}`,
    "",
    `App: ${appVersion}`,
    `iOS build: ${iosBuildNumber}`,
    `Android code: ${androidVersionCode}`,
    "",
    `Destek: ${createPublicAppLink("/support.html")}`,
    `Gizlilik: ${createPublicAppLink("/privacy.html")}`,
    `Hesap silme: ${createPublicAppLink("/delete-account.html")}`,
    `Sartlar: ${createPublicAppLink("/terms.html")}`,
    `KVKK: ${createPublicAppLink("/kvkk.html")}`,
  ].join("\n");
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
  contextGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  statusBox: {
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    gap: SPACING.xs,
    minWidth: "45%",
    padding: SPACING.sm,
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
