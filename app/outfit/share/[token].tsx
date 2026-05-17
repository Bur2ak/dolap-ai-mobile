import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, View } from "react-native";

import { OutfitShareCard } from "@/components/outfits/OutfitShareCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CachedImage } from "@/components/ui/CachedImage";
import { EmptyState } from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { CATEGORIES } from "@/constants/categories";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { usePublicSharedOutfit } from "@/hooks/useOutfitRecommendation";
import { captureError, captureEvent } from "@/lib/observability";
import type { OutfitVoteValue, WardrobeItem } from "@/types";

const voteOptions: Array<{ value: OutfitVoteValue; label: string }> = [
  { value: "love", label: "Bayildim" },
  { value: "yes", label: "Olur" },
  { value: "no", label: "Baska dene" },
];

export default function PublicSharedOutfitScreen() {
  const { token: tokenParam, pendingVote } = useLocalSearchParams<{ token: string | string[]; pendingVote?: OutfitVoteValue }>();
  const token = normalizeToken(tokenParam);
  const { userId, sharedOutfit, isLoading, isRefetching, error, refetch, vote, isVoting, canVote } = usePublicSharedOutfit(token);
  const [handledPendingVote, setHandledPendingVote] = useState<string | null>(null);
  const [activeVote, setActiveVote] = useState<OutfitVoteValue | null>(null);
  const [isApplyingPendingVote, setIsApplyingPendingVote] = useState(false);
  const myVote = sharedOutfit?.votes.find((item) => item.voter_id === userId)?.vote;
  const voteCounts = voteOptions.map((option) => ({
    ...option,
    count: sharedOutfit?.votes.filter((item) => item.vote === option.value).length ?? 0,
  }));
  const isBusy = isVoting || Boolean(activeVote) || isApplyingPendingVote;

  useEffect(() => {
    captureEvent("public_outfit_screen_viewed", {
      token: token ?? "missing",
      logged_in: Boolean(userId),
      has_pending_vote: Boolean(pendingVote),
    });
  }, [pendingVote, token, userId]);

  async function handleVote(value: OutfitVoteValue) {
    if (isBusy) {
      return;
    }

    if (!userId) {
      captureEvent("public_outfit_vote_login_required", { token, vote: value });
      router.push({
        pathname: "/(auth)/login",
        params: {
          returnTo: `/outfit/share/${token}?pendingVote=${value}`,
        },
      });
      return;
    }

    setActiveVote(value);
    try {
      await vote(value);
      captureEvent("public_outfit_vote_submitted", { outfit_id: sharedOutfit?.outfit.id, vote: value });
    } catch (voteError) {
      captureError(voteError, { area: "public_outfit_vote", token, vote: value });
      Alert.alert("Oy verilemedi", voteError instanceof Error ? voteError.message : "Tekrar dene.");
    } finally {
      setActiveVote(null);
    }
  }

  useEffect(() => {
    const voteValue = normalizeVote(pendingVote);
    if (!userId || !voteValue || !canVote || myVote === voteValue || handledPendingVote === voteValue || isVoting) {
      return;
    }

    setHandledPendingVote(voteValue);
    setIsApplyingPendingVote(true);
    void vote(voteValue)
      .then(() => {
        captureEvent("public_outfit_vote_submitted", { outfit_id: sharedOutfit?.outfit.id, vote: voteValue, pending_vote: true });
        router.replace(`/outfit/share/${token}`);
      })
      .catch((voteError) => {
        captureError(voteError, { area: "public_outfit_pending_vote", token, vote: voteValue });
        Alert.alert("Oy verilemedi", voteError instanceof Error ? voteError.message : "Tekrar dene.");
      })
      .finally(() => {
        setIsApplyingPendingVote(false);
      });
  }, [canVote, handledPendingVote, isVoting, myVote, pendingVote, sharedOutfit?.outfit.id, token, userId, vote]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} disabled={isBusy} />
        <Text variant="h2">Shipirio Kombini</Text>
        <View style={styles.headerSpacer} />
      </View>

      {!token ? (
        <EmptyState icon="alert-circle-outline" title="Link gecersiz" body="Bu kombin linki eksik veya bozuk gorunuyor." style={styles.emptyState} />
      ) : error ? (
        <EmptyState
          icon="link-outline"
          title="Link acilamadi"
          body="Bu kombin linki kaldirilmis veya artik paylasilmiyor olabilir."
          actionLabel="Tekrar Dene"
          loading={isRefetching}
          onAction={() => {
            captureEvent("public_outfit_refetch_requested", { token });
            void refetch();
          }}
          style={styles.emptyState}
        />
      ) : isLoading ? (
        <EmptyState icon="sync-outline" title="Kombin yukleniyor" body="Paylasilan kombin hazirlaniyor." style={styles.emptyState} />
      ) : sharedOutfit ? (
        <FlatList
          data={sharedOutfit.items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          ListHeaderComponent={
            <View style={styles.top}>
              <OutfitShareCard sharedOutfit={sharedOutfit} eyebrow="Paylasilan kombin" />

              <Card style={styles.votes}>
                <Text variant="h3">{userId ? "Oy ver" : "Oy vermek icin giris yap"}</Text>
                <View style={styles.voteRow}>
                  {voteOptions.map((option) => (
                    <Pressable
                      key={option.value}
                      style={[styles.voteButton, myVote === option.value && styles.voteButtonActive, userId && !canVote && styles.voteDisabled]}
                      onPress={() => void handleVote(option.value)}
                      disabled={isBusy || Boolean(userId && !canVote)}
                    >
                      <Text variant="label" color={myVote === option.value ? "inverse" : "primary"} style={styles.centerText}>
                        {activeVote === option.value ? "Kaydediliyor" : option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.counts}>
                  {voteCounts.map((option) => (
                    <Text key={option.value} variant="caption" color="muted">
                      {option.label}: {option.count}
                    </Text>
                  ))}
                </View>
              </Card>
            </View>
          }
          ListEmptyComponent={<EmptyItems />}
          columnWrapperStyle={sharedOutfit.items.length > 0 ? styles.gridRow : undefined}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => <OutfitItem item={item} outfitId={sharedOutfit.outfit.id} />}
        />
      ) : null}
    </View>
  );
}

function normalizeVote(value?: string | string[]): OutfitVoteValue | null {
  const normalized = Array.isArray(value) ? value[0] : value;
  return normalized === "love" || normalized === "yes" || normalized === "no" ? normalized : null;
}

function normalizeToken(value?: string | string[]) {
  const token = Array.isArray(value) ? value[0] : value;
  const normalizedToken = token?.trim();
  return normalizedToken && /^[A-Za-z0-9_-]{8,64}$/.test(normalizedToken) ? normalizedToken : undefined;
}

function OutfitItem({ item, outfitId }: { item: WardrobeItem; outfitId: string }) {
  const categoryLabel = CATEGORIES.find((category) => category.value === item.category)?.label ?? item.category;

  return (
    <View style={styles.itemWrap}>
      <Pressable
        onPress={() => {
          captureEvent("public_outfit_item_opened", { outfit_id: outfitId, item_id: item.id });
          router.push(`/item/${item.id}`);
        }}
      >
        <Card style={styles.itemCard}>
          <CachedImage
            accessibilityLabel={item.subcategory ?? categoryLabel}
            fallbackColor={item.dominant_color_hex}
            sourceUri={item.thumbnail_url ?? item.image_url}
            style={styles.itemImage}
          />
          <Text variant="label">{item.subcategory ?? categoryLabel}</Text>
          <Text variant="caption" color="muted">
            {item.brand ?? categoryLabel}
          </Text>
        </Card>
      </Pressable>
    </View>
  );
}

function EmptyItems() {
  return (
    <EmptyState icon="shirt-outline" title="Kiyafet yok" body="Bu kombinde goruntulenebilir kiyafet yok." style={styles.emptyState} />
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    flex: 1,
    padding: SPACING.lg,
    paddingTop: 56,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
  },
  headerSpacer: {
    width: 72,
  },
  top: {
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  votes: {
    gap: SPACING.md,
  },
  voteRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  voteButton: {
    alignItems: "center",
    backgroundColor: COLORS.primarySoft,
    borderRadius: 8,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: SPACING.sm,
  },
  voteButtonActive: {
    backgroundColor: COLORS.primary,
  },
  voteDisabled: {
    opacity: 0.58,
  },
  counts: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  grid: {
    gap: SPACING.md,
    paddingBottom: 120,
  },
  gridRow: {
    gap: SPACING.md,
  },
  itemWrap: {
    flex: 1,
  },
  itemCard: {
    flex: 1,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    minHeight: 176,
  },
  itemImage: {
    aspectRatio: 4 / 5,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    width: "100%",
  },
  colorBlock: {
    borderRadius: 8,
    height: 104,
    width: "100%",
  },
  emptyState: {
    marginTop: SPACING.md,
  },
  centerText: {
    textAlign: "center",
  },
});
