import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { Alert, Share, StyleSheet, View } from "react-native";

import { PremiumGate } from "@/components/shared/PremiumGate";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuthStore } from "@/stores/authStore";

export default function InviteScreen() {
  const { premium } = useSubscription();
  const profile = useAuthStore((state) => state.profile);
  const inviteCode = profile?.username ?? profile?.id ?? "dolap-ai";
  const inviteUrl = Linking.createURL("/social/friends", {
    queryParams: {
      invite: inviteCode,
    },
  });

  async function handleShare() {
    try {
      await Share.share({
        title: "Dolap AI daveti",
        message: `Dolap AI'da arkadas olalim: ${inviteUrl}`,
        url: inviteUrl,
      });
    } catch (error) {
      Alert.alert("Paylasilamadi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} />
        <Text variant="h2">Davet</Text>
        <View style={styles.headerSpacer} />
      </View>

      {!premium ? (
        <PremiumGate title="Davet linki Premium" body="Arkadas davetleri ve sosyal akislari Premium planda acilir." />
      ) : (
        <Card style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="person-add-outline" size={36} color={COLORS.surface} />
          </View>
          <Text variant="h2" style={styles.centerText}>
            Arkadasini davet et
          </Text>
          <Text variant="body" color="secondary" style={styles.centerText}>
            Bu linki paylasinca arkadasin Dolap AI'da seni bulup istek gonderebilir.
          </Text>
          <Card style={styles.linkCard}>
            <Text variant="caption" color="muted">
              Davet linki
            </Text>
            <Text variant="body" style={styles.linkText}>
              {inviteUrl}
            </Text>
          </Card>
          <Button title="Paylas" onPress={handleShare} />
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    flex: 1,
    gap: SPACING.md,
    padding: SPACING.lg,
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
  card: {
    alignItems: "center",
    gap: SPACING.md,
  },
  iconWrap: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: 72,
    justifyContent: "center",
    width: 72,
  },
  linkCard: {
    gap: SPACING.xs,
    width: "100%",
  },
  linkText: {
    textAlign: "center",
  },
  centerText: {
    textAlign: "center",
  },
});
