import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";

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
    icon: "card-outline" as const,
    title: "Abonelik",
    body: "Plan durumunu ve freemium limitlerini gor.",
    route: "/settings/subscription" as const,
  },
];

export default function SettingsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} />
        <Text variant="h2">Ayarlar</Text>
        <View style={styles.headerSpacer} />
      </View>

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
            <Button title="Ac" variant="ghost" onPress={() => router.push(item.route)} />
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
