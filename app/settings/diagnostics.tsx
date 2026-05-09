import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { getPublicEnvWarnings, publicEnv } from "@/lib/env";

const checks = [
  {
    body: "Auth, database ve storage baglantisi icin gerekli.",
    configured: Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey),
    title: "Supabase",
  },
  {
    body: "Paylasim ve davet linklerinin dogru domaine gitmesi icin gerekli.",
    configured: publicEnv.siteUrlConfigured,
    title: "Site URL",
  },
  {
    body: "Kombin onerilerinde hava verisini etkinlestirir.",
    configured: Boolean(publicEnv.openWeatherApiKey),
    title: "OpenWeather",
  },
  {
    body: "Gercek abonelik teklifleri ve satin alma akislari icin gerekli.",
    configured: Boolean(publicEnv.revenueCatIosKey && publicEnv.revenueCatAndroidKey),
    title: "RevenueCat",
  },
  {
    body: "Gercek cihaz push token uretimi icin gerekli.",
    configured: Boolean(publicEnv.easProjectId),
    title: "EAS Project ID",
  },
  {
    body: "Runtime hata takibi icin kullanilir.",
    configured: Boolean(publicEnv.sentryDsn),
    title: "Sentry DSN",
  },
  {
    body: "Urun analitigi ve event takibi icin kullanilir.",
    configured: Boolean(publicEnv.posthogApiKey),
    title: "PostHog",
  },
];

export default function DiagnosticsScreen() {
  const warnings = getPublicEnvWarnings();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} />
        <Text variant="h2">Sistem Durumu</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Card style={styles.summary}>
        <Text variant="h3">{warnings.length === 0 ? "Temel ayarlar hazir" : `${warnings.length} uyari var`}</Text>
        <Text variant="body" color="secondary">
          Bu ekran sadece public app ayarlarini kontrol eder; gizli Supabase Edge Function secret degerlerini gostermez.
        </Text>
      </Card>

      <View style={styles.list}>
        {checks.map((check) => (
          <Card key={check.title} style={styles.row}>
            <View style={[styles.statusIcon, check.configured ? styles.statusReady : styles.statusMissing]}>
              <Ionicons name={check.configured ? "checkmark" : "alert"} size={18} color={check.configured ? COLORS.primary : COLORS.danger} />
            </View>
            <View style={styles.copy}>
              <Text variant="label">{check.title}</Text>
              <Text variant="body" color="secondary">
                {check.body}
              </Text>
              <Text variant="caption" color={check.configured ? "muted" : "secondary"}>
                {check.configured ? "Ayarlanmis" : "Eksik veya placeholder"}
              </Text>
            </View>
          </Card>
        ))}
      </View>

      {warnings.length > 0 ? (
        <Card style={styles.warningCard}>
          <Text variant="h3">Uyarilar</Text>
          {warnings.map((warning) => (
            <View key={warning} style={styles.warningRow}>
              <Ionicons name="information-circle-outline" size={18} color={COLORS.warning} />
              <Text variant="body" color="secondary" style={styles.warningText}>
                {warning}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}
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
  summary: {
    gap: SPACING.sm,
  },
  list: {
    gap: SPACING.md,
  },
  row: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: SPACING.md,
  },
  statusIcon: {
    alignItems: "center",
    borderRadius: 999,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  statusReady: {
    backgroundColor: COLORS.primarySoft,
  },
  statusMissing: {
    backgroundColor: "#F5D3D0",
  },
  copy: {
    flex: 1,
    gap: SPACING.xs,
  },
  warningCard: {
    gap: SPACING.sm,
  },
  warningRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  warningText: {
    flex: 1,
  },
});
