import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, Share, StyleSheet, View } from "react-native";

import { PremiumGate } from "@/components/shared/PremiumGate";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useReferralRewards } from "@/hooks/useSocial";
import { useSubscription } from "@/hooks/useSubscription";
import { createPublicAppLink } from "@/lib/links";
import { captureError, captureEvent } from "@/lib/observability";
import { useAuthStore } from "@/stores/authStore";
import type { ReferralReward } from "@/types";
import { formatDate } from "@/utils/formatters";

export default function InviteScreen() {
  const { premium } = useSubscription();
  const { rewards, error, isLoading, isRefetching, refetch, userId } = useReferralRewards();
  const profile = useAuthStore((state) => state.profile);
  const inviteCode = profile?.username ?? profile?.id ?? "shipirio";
  const totalRewardDays = rewards.reduce((total, reward) => total + reward.reward_days, 0);
  const inviteUrl = createPublicAppLink("/social/friends", { invite: inviteCode });
  const [isSharing, setIsSharing] = useState(false);
  const isBusy = isSharing || isRefetching;

  useEffect(() => {
    captureEvent("invite_screen_viewed", {
      premium,
      reward_count: rewards.length,
      total_reward_days: totalRewardDays,
      has_username_invite_code: Boolean(profile?.username),
    });
  }, [premium, profile?.username, rewards.length, totalRewardDays]);

  function handleRefetchRewards() {
    if (isBusy) {
      captureEvent("invite_rewards_refetch_blocked", { reason: "busy" });
      return;
    }

    captureEvent("invite_rewards_refetch_requested");
    void refetch();
  }

  async function handleShare() {
    if (isBusy) {
      captureEvent("invite_share_blocked", { reason: "busy" });
      return;
    }

    try {
      setIsSharing(true);
      const result = await Share.share({
        title: "Shipirio daveti",
        message: `Shipirio'da arkadas olalim. Davet linkim: ${inviteUrl}`,
        url: inviteUrl,
      });
      captureEvent("invite_link_shared", { completed: result.action === Share.sharedAction });
    } catch (error) {
      captureError(error, { area: "invite_share" });
      Alert.alert("Paylasilamadi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} disabled={isBusy} />
        <Text variant="h2">Davet</Text>
        <View style={styles.headerSpacer} />
      </View>

      {!premium ? (
        <PremiumGate title="Davet linki Premium" body="Arkadas davetleri ve sosyal akislari Premium planda acilir." />
      ) : (
        <>
          <Card style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name="person-add-outline" size={36} color={COLORS.surface} />
            </View>
            <Text variant="h2" style={styles.centerText}>
              Arkadasini davet et
            </Text>
            <Text variant="body" color="secondary" style={styles.centerText}>
              Bu linkle gelen arkadaslik kabul edilince iki hesaba da 30 gun Premium eklenir.
            </Text>
            <Card style={styles.linkCard}>
              <Text variant="caption" color="muted">
                Davet linki
              </Text>
              <Text variant="body" style={styles.linkText}>
                {inviteUrl}
              </Text>
            </Card>
            <Button title="Paylas" onPress={handleShare} loading={isSharing} disabled={isBusy} />
          </Card>

          <Card style={styles.rewardCard}>
            <View style={styles.rewardHeader}>
              <Ionicons name="gift-outline" size={24} color={COLORS.primary} />
              <View style={styles.rewardCopy}>
                <Text variant="h3">{totalRewardDays} gun kazanildi</Text>
                <Text variant="body" color="secondary">
                  Kabul edilen davetlerden gelen Premium odulleri.
                </Text>
              </View>
            </View>
            {isLoading ? (
              <EmptyState icon="sync-outline" title="Oduller yukleniyor" body="Davet odullerin hazirlaniyor." />
            ) : error ? (
              <EmptyState
                icon="cloud-offline-outline"
                title="Oduller yuklenemedi"
                body="Baglanti veya Supabase tarafinda gecici bir sorun olabilir."
                actionLabel="Tekrar Dene"
                loading={isRefetching}
                onAction={handleRefetchRewards}
              />
            ) : rewards.length > 0 ? (
              rewards.slice(0, 4).map((reward) => <RewardRow key={reward.id} reward={reward} userId={userId} />)
            ) : (
              <Text variant="body" color="secondary">
                Henuz davet odulu yok.
              </Text>
            )}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function RewardRow({ reward, userId }: { reward: ReferralReward; userId?: string }) {
  const friend = reward.referrer_id === userId ? reward.referred : reward.referrer;

  return (
    <View style={styles.rewardRow}>
      <View style={styles.rewardBadge}>
        <Text variant="label" color="inverse">
          +{reward.reward_days}
        </Text>
      </View>
      <View style={styles.rewardCopy}>
        <Text variant="label">{friend?.full_name ?? friend?.username ?? "Arkadas"}</Text>
        <Text variant="caption" color="muted">
          {formatDate(reward.created_at)}
        </Text>
      </View>
    </View>
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
  rewardCard: {
    gap: SPACING.md,
  },
  rewardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  rewardRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  rewardBadge: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  rewardCopy: {
    flex: 1,
    gap: 2,
  },
  centerText: {
    textAlign: "center",
  },
});
