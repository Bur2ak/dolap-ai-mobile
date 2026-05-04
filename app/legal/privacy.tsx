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
          Son guncelleme: 2026-05-04. Bu ekran, uygulama ici MVP gizlilik metnidir; yayin oncesi hukuki metinle netlestirilmelidir.
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
});
