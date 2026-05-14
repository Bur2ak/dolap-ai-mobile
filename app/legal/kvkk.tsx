import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";

const sections = [
  {
    title: "Veri sorumlusu",
    body: "Shipirio, hesabini ve uygulama icindeki stil deneyimini sunmak icin gerekli kisisel verileri isler. Yayin oncesinde resmi sirket ve iletisim bilgileri bu alana eklenmelidir.",
  },
  {
    title: "Islenen veri kategorileri",
    body: "Kimlik ve iletisim bilgileri, dolap gorselleri, kiyafet etiketleri, uygulama tercihleri, bildirim token'i, abonelik durumu ve uygulama kullanim olaylari islenebilir.",
  },
  {
    title: "Isleme amaclari",
    body: "Hesap olusturma, dijital dolap yonetimi, AI analiz ve kombin onerisi, fiyat takibi, sosyal paylasim, bildirim, abonelik ve guvenlik surecleri icin veri islenir.",
  },
  {
    title: "Aktarim ve saklama",
    body: "Veriler Supabase, Expo, RevenueCat, Sentry/PostHog ve AI servisleri gibi teknik tedarikcilere yalnizca hizmetin gerektirdigi kapsamda aktarilabilir. Hesap silme talebinden sonra 30 gunluk bekleme suresi uygulanir.",
  },
  {
    title: "Haklarin",
    body: "Verilerine erisme, duzeltme, silme, islemeyi kisitlama ve itiraz haklarini kullanabilirsin. Uygulama icinde profil, gizlilik, bildirim ve hesap silme ayarlari bu kontrollerin temelini olusturur.",
  },
];

const rightsActions = [
  {
    title: "Gizlilik ayarlari",
    body: "Dolap paylasimi ve arkadaslik istekleri gibi tercihleri degistir.",
    action: "Ayarlari Ac",
    route: "/settings/privacy",
  },
  {
    title: "Hesap silme",
    body: "30 gunluk bekleme sureli hesap silme talebini baslat veya iptal et.",
    action: "Hesaba Git",
    route: "/settings/account",
  },
  {
    title: "KVKK talebi",
    body: "Erisim, duzeltme veya silme talepleri icin destek ekranini kullan.",
    action: "Destek Al",
    route: "/settings/support",
  },
] as const;

export default function KvkkScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} />
        <Text variant="h2">KVKK</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Card style={styles.hero}>
        <Text variant="h1">KVKK Aydinlatma Metni</Text>
        <Text variant="body" color="secondary">
          Son guncelleme: 2026-05-08. Bu ekran uygulama icindeki KVKK ozetidir; public metin shipirio.com/kvkk.html adresinde yayinlanir.
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
        <Text variant="h3">Hak kullanimi</Text>
        <Text variant="body" color="secondary">
          Veri haklarini kullanmak ve hesap durumunu yonetmek icin bu uygulama ici yollar hazir tutulur.
        </Text>
        {rightsActions.map((item) => (
          <View key={item.title} style={styles.rightRow}>
            <View style={styles.rightText}>
              <Text variant="label">{item.title}</Text>
              <Text variant="body" color="secondary">
                {item.body}
              </Text>
            </View>
            <Button title={item.action} variant="secondary" onPress={() => router.push(item.route)} style={styles.rightButton} />
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
  rightButton: {
    alignSelf: "stretch",
  },
  rightRow: {
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  rightText: {
    gap: SPACING.xs,
  },
});
