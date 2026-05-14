import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";

const sections = [
  {
    title: "Topladigimiz bilgiler",
    body: "Hesap bilgileri, kiyafet metadata'lari, yuklenen gorseller, tercihlerin ve uygulama ici aksiyonlar Shipirio deneyimini sunmak icin saklanir.",
  },
  {
    title: "Nasil kullaniriz?",
    body: "Bu veriler dolap yonetimi, kombin onerisi, fiyat takibi, bildirimler, sosyal paylasim ve abonelik durumunu yurutmek icin kullanilir.",
  },
  {
    title: "Paylasim ve ucuncu taraflar",
    body: "Supabase, RevenueCat, Expo Notifications ve AI servisleri gibi altyapi saglayicilariyla yalnizca gerekli teknik kapsamda veri islenir.",
  },
  {
    title: "Kontrol sende",
    body: "Profil, bildirim ve gizlilik tercihlerini ayarlardan degistirebilir; paylasilan dolap ve arkadaslik isteklerini kapatabilirsin.",
  },
];

const controls = [
  {
    title: "Gizlilik tercihleri",
    body: "Dolap gorunurlugu ve arkadaslik isteklerini yonet.",
    action: "Tercihlere Git",
    route: "/settings/privacy",
  },
  {
    title: "Hesap ve silme",
    body: "Profil bilgilerini, sifreni ve hesap silme talebini yonet.",
    action: "Hesaba Git",
    route: "/settings/account",
  },
  {
    title: "Destek",
    body: "Veri veya gizlilik talebi icin destek kanalini ac.",
    action: "Destek Al",
    route: "/settings/support",
  },
] as const;

export default function PrivacyPolicyScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} />
        <Text variant="h2">Gizlilik</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Card style={styles.hero}>
        <Text variant="h1">Shipirio Gizlilik Politikasi</Text>
        <Text variant="body" color="secondary">
          Son guncelleme: 2026-05-04. Bu ekran uygulama icindeki gizlilik ozetidir; public metin shipirio.com/privacy.html adresinde yayinlanir.
        </Text>
      </Card>

      {sections.map((section) => (
        <Card key={section.title} style={styles.section}>
          <Text variant="h3">{section.title}</Text>
          <Text variant="body" color="secondary">
            {section.body}
          </Text>
        </Card>
      ))}

      <Card style={styles.section}>
        <Text variant="h3">Kontrol yollari</Text>
        <Text variant="body" color="secondary">
          Gizlilik ve veri yonetimi ayarlarini uygulama icinden asagidaki ekranlardan kontrol edebilirsin.
        </Text>
        {controls.map((control) => (
          <View key={control.title} style={styles.controlRow}>
            <View style={styles.controlText}>
              <Text variant="label">{control.title}</Text>
              <Text variant="body" color="secondary">
                {control.body}
              </Text>
            </View>
            <Button title={control.action} variant="secondary" onPress={() => router.push(control.route)} style={styles.controlButton} />
          </View>
        ))}
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
    gap: SPACING.sm,
  },
  section: {
    gap: SPACING.sm,
  },
  controlButton: {
    alignSelf: "stretch",
  },
  controlRow: {
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  controlText: {
    gap: SPACING.xs,
  },
});
