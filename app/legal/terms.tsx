import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";

const sections = [
  {
    title: "Hizmet kapsami",
    body: "Shipirio, dijital dolap, AI kombin onerisi, satin alma karar destegi, fiyat takibi ve sosyal stil paylasimi sunan bir mobil asistandir.",
  },
  {
    title: "AI onerileri",
    body: "AI ciktilari tavsiye niteligindedir. Satin alma, stil, fiyat ve etkinlik kararlarinda son karar kullaniciya aittir.",
  },
  {
    title: "Abonelik",
    body: "Premium ozellikler RevenueCat uzerinden yonetilecek aboneliklerle acilir. Iptal, yenileme ve geri yukleme islemleri ilgili uygulama magazasi kurallarina tabidir.",
  },
  {
    title: "Kabul edilebilir kullanim",
    body: "Baskalarina ait haklari ihlal eden gorsel, metin veya paylasimlar yuklenmemeli; sosyal ozellikler taciz veya spam amaciyla kullanilmamalidir.",
  },
];

export default function TermsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} />
        <Text variant="h2">Sartlar</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Card style={styles.hero}>
        <Text variant="h1">Shipirio Kullanim Sartlari</Text>
        <Text variant="body" color="secondary">
          Son guncelleme: 2026-05-04. Bu ekran, yayin oncesi hukuki gozden gecirme icin uygulama ici taslak metindir.
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
