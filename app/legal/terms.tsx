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

const reviewActions = [
  {
    title: "Abonelik yonetimi",
    body: "Premium durumunu, restore akisini ve magazaza yonlendirmelerini kontrol et.",
    action: "Abonelige Git",
    route: "/settings/subscription",
  },
  {
    title: "Destek ve itiraz",
    body: "Hesap, odeme veya kullanim sartlari icin destek ekranini ac.",
    action: "Destek Al",
    route: "/settings/support",
  },
] as const;

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
          Son guncelleme: 2026-05-04. Bu ekran uygulama icindeki sartlar ozetidir; public metin shipirio.com/terms.html adresinde yayinlanir.
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
        <Text variant="h3">Abonelik ve destek</Text>
        <Text variant="body" color="secondary">
          Satin alma, geri yukleme ve destek adimlari uygulama icinde kullanicinin kontrol edebilecegi ekranlara baglidir.
        </Text>
        {reviewActions.map((item) => (
          <View key={item.title} style={styles.actionRow}>
            <View style={styles.actionText}>
              <Text variant="label">{item.title}</Text>
              <Text variant="body" color="secondary">
                {item.body}
              </Text>
            </View>
            <Button title={item.action} variant="secondary" onPress={() => router.push(item.route)} style={styles.actionButton} />
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
  actionButton: {
    alignSelf: "stretch",
  },
  actionRow: {
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  actionText: {
    gap: SPACING.xs,
  },
});
