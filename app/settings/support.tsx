import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { createPublicAppLink } from "@/lib/links";

const supportEmail = "hello@shipirio.com";
const supportTopics = [
  "Hesap ve giris sorunlari",
  "Premium abonelik ve geri yukleme",
  "Veri silme veya KVKK talepleri",
  "Fiyat takibi, bildirimler ve teknik hatalar",
];

export default function SupportScreen() {
  const supportUrl = createPublicAppLink("/support.html");
  const privacyUrl = createPublicAppLink("/privacy.html");
  const deleteAccountUrl = createPublicAppLink("/delete-account.html");

  async function openUrl(url: string) {
    try {
      if (url.startsWith("http")) {
        await WebBrowser.openBrowserAsync(url);
        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      Alert.alert("Acilamadi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} />
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
        <Button title="E-posta Gonder" onPress={() => void openUrl(`mailto:${supportEmail}?subject=Shipirio%20Destek`)} />
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
        <Text variant="h3">Web sayfalari</Text>
        <Button title="Destek Sayfasini Ac" variant="secondary" onPress={() => void openUrl(supportUrl)} />
        <Button title="Gizlilik Sayfasini Ac" variant="secondary" onPress={() => void openUrl(privacyUrl)} />
        <Button title="Hesap Silme Bilgisini Ac" variant="secondary" onPress={() => void openUrl(deleteAccountUrl)} />
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
});
