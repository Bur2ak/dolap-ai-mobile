import { Ionicons } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, FlatList, Pressable, Share, StyleSheet, View } from "react-native";
import { captureRef } from "react-native-view-shot";

import { OutfitShareCard } from "@/components/outfits/OutfitShareCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CachedImage } from "@/components/ui/CachedImage";
import { EmptyState } from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { CATEGORIES } from "@/constants/categories";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useSharedOutfit } from "@/hooks/useOutfitRecommendation";
import { createPublicAppLink } from "@/lib/links";
import { captureError, captureEvent } from "@/lib/observability";
import { getUuidParam } from "@/lib/routeParams";
import type { OutfitVoteValue, WardrobeItem } from "@/types";

const voteOptions: Array<{ value: OutfitVoteValue; label: string }> = [
  { value: "love", label: "Bayildim" },
  { value: "yes", label: "Olur" },
  { value: "no", label: "Baska dene" },
];

const voteIcons: Record<OutfitVoteValue, keyof typeof Ionicons.glyphMap> = {
  love: "heart",
  yes: "checkmark-circle",
  no: "refresh-circle",
};

export default function SharedOutfitScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string | string[] }>();
  const id = getUuidParam(idParam);
  const shareCardRef = useRef<View>(null);
  const {
    userId,
    sharedOutfit,
    isLoading,
    isRefetching,
    error,
    refetch,
    vote,
    markWorn,
    toggleFavorite,
    shareOutfit,
    askFriendsToVote,
    deleteOutfit,
    isVoting,
    isMarkingWorn,
    isTogglingFavorite,
    isSharingOutfit,
    isAskingFriends,
    isDeletingOutfit,
    canVote,
    canMarkWorn,
    canToggleFavorite,
    canShareOutfit,
    canDeleteOutfit,
  } = useSharedOutfit(id);
  const isOwner = Boolean(userId && sharedOutfit?.outfit.user_id === userId);
  const [activeVote, setActiveVote] = useState<OutfitVoteValue | null>(null);
  const myVote = sharedOutfit?.votes.find((item) => item.voter_id === userId)?.vote;
  const friendVotes = sharedOutfit?.votes.filter((item) => item.voter_id !== sharedOutfit.outfit.user_id) ?? [];
  const voteCounts = voteOptions.map((option) => ({
    ...option,
    count: friendVotes.filter((item) => item.vote === option.value).length,
  }));
  const isBusy = isVoting || isMarkingWorn || isTogglingFavorite || isSharingOutfit || isAskingFriends || isDeletingOutfit;

  useEffect(() => {
    if (id) {
      captureEvent("shared_outfit_detail_viewed", { outfit_id: id });
    }
  }, [id]);

  async function handleVote(value: OutfitVoteValue) {
    if (isBusy || !canVote) {
      captureEvent("outfit_vote_blocked", { outfit_id: id ?? "invalid", reason: canVote ? "busy" : "not_allowed", vote: value });
      return;
    }

    setActiveVote(value);
    try {
      await vote(value);
      captureEvent("outfit_vote_submitted", { outfit_id: id ?? "invalid", vote: value, surface: isOwner ? "owner_detail" : "friend_detail" });
    } catch (voteError) {
      captureError(voteError, { area: "outfit_vote", outfit_id: id ?? "invalid", vote: value });
      Alert.alert("Oy verilemedi", voteError instanceof Error ? voteError.message : "Tekrar dene.");
    } finally {
      setActiveVote(null);
    }
  }

  async function handleMarkWorn() {
    if (isBusy) {
      return;
    }

    try {
      await markWorn();
      Alert.alert("Guncellendi", "Kombin ve parcalar bugun giyildi olarak islendi.");
    } catch (wornError) {
      captureError(wornError, { area: "shared_outfit_mark_worn_action", outfit_id: id ?? "invalid" });
      Alert.alert("Guncellenemedi", wornError instanceof Error ? wornError.message : "Tekrar dene.");
    }
  }

  async function handleToggleFavorite() {
    if (isBusy) {
      return;
    }

    try {
      await toggleFavorite();
      captureEvent("shared_outfit_favorite_action", { outfit_id: id ?? "invalid", favorite: !sharedOutfit?.outfit.is_favorite });
    } catch (favoriteError) {
      captureError(favoriteError, { area: "shared_outfit_favorite_action", outfit_id: id ?? "invalid" });
      Alert.alert("Guncellenemedi", favoriteError instanceof Error ? favoriteError.message : "Tekrar dene.");
    }
  }

  async function handleShareOutfit() {
    if (isBusy) {
      return;
    }

    try {
      const outfit = await shareOutfit();
      const shareUrl = createPublicAppLink(`/outfit/share/${outfit.share_token ?? outfit.id}`);
      const cardUri = shareCardRef.current
        ? await captureRef(shareCardRef, {
            format: "png",
            quality: 0.95,
          })
        : null;

      if (cardUri && (await Sharing.isAvailableAsync())) {
        await Share.share({
          title: "Shipirio kombini",
          message: `${outfit.name ?? "Shipirio kombinim"} icin fikrini alabilir miyim? ${shareUrl}`,
          url: cardUri,
        });
        captureEvent("outfit_shared", { outfit_id: outfit.id, share_type: "image" });
        return;
      }

      await Share.share({
        title: "Shipirio kombini",
        message: `${outfit.name ?? "Shipirio kombinim"} icin fikrini alabilir miyim? ${shareUrl}`,
        url: shareUrl,
      });
      captureEvent("outfit_shared", { outfit_id: outfit.id, share_type: "link" });
    } catch (shareError) {
      captureError(shareError, { area: "outfit_share", outfit_id: id ?? "invalid" });
      Alert.alert("Paylasilamadi", shareError instanceof Error ? shareError.message : "Tekrar dene.");
    }
  }

  async function handleAskFriends() {
    if (isBusy) {
      return;
    }

    try {
      const { notifiedFriendsCount } = await askFriendsToVote();
      captureEvent("outfit_friend_vote_requested", { outfit_id: id ?? "invalid", notified_friends_count: notifiedFriendsCount });
      if (notifiedFriendsCount > 0) {
        Alert.alert("Arkadaslara gonderildi", `${notifiedFriendsCount} arkadasina kombin oyu bildirimi gonderildi.`);
        return;
      }

      Alert.alert("Arkadas yok", "Henuz kabul edilmis arkadasin yok. Linkle paylasabilirsin.");
    } catch (askError) {
      captureError(askError, { area: "outfit_friend_vote_request", outfit_id: id ?? "invalid" });
      Alert.alert("Gonderilemedi", askError instanceof Error ? askError.message : "Tekrar dene.");
    }
  }

  function handleDeleteOutfit() {
    if (isBusy) {
      return;
    }

    captureEvent("shared_outfit_delete_prompt_opened", { outfit_id: id ?? "invalid" });
    Alert.alert("Kombini sil", "Bu kombin kayitli kombinlerinden kaldirilacak.", [
      { text: "Vazgec", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteOutfit();
            captureEvent("shared_outfit_delete_confirmed", { outfit_id: id ?? "invalid" });
            router.replace("/(tabs)/outfit");
          } catch (deleteError) {
            captureError(deleteError, { area: "shared_outfit_delete_action", outfit_id: id ?? "invalid" });
            Alert.alert("Silinemedi", deleteError instanceof Error ? deleteError.message : "Tekrar dene.");
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} disabled={isBusy} />
        <Text variant="h2">Kombin Detayi</Text>
        <View style={styles.headerSpacer} />
      </View>

      {!id ? (
        <EmptyState icon="alert-circle-outline" title="Kombin linki gecersiz" body="Bu kombin linki eksik veya bozuk gorunuyor." style={styles.emptyState} />
      ) : error ? (
        <EmptyState
          icon="lock-closed-outline"
          title="Kombin acilamadi"
          body="Bu kombin yalnizca kabul edilmis arkadaslara acik olabilir."
          actionLabel="Tekrar Dene"
          loading={isRefetching}
          onAction={() => {
            captureEvent("shared_outfit_refetch_requested", { outfit_id: id ?? "invalid" });
            void refetch();
          }}
          style={styles.emptyState}
        />
      ) : isLoading ? (
        <EmptyState icon="sync-outline" title="Kombin yukleniyor" body="Kombin detaylari hazirlaniyor." style={styles.emptyState} />
      ) : sharedOutfit ? (
        <FlatList
          data={sharedOutfit.items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          ListHeaderComponent={
            <View style={styles.top}>
              <OutfitShareCard ref={shareCardRef} sharedOutfit={sharedOutfit} eyebrow={sharedOutfit.outfit.event_type ?? "Shipirio kombini"} />

              <Card style={styles.summary}>
                {sharedOutfit.outfit.worn_at ? (
                  <Text variant="caption" color="muted">
                    Son giyilme: {sharedOutfit.outfit.worn_at}
                  </Text>
                ) : null}
                <View style={styles.summaryStats}>
                  <View style={styles.summaryStat}>
                    <Text variant="caption" color="muted">
                      PARCA
                    </Text>
                    <Text variant="label">{sharedOutfit.items.length}</Text>
                  </View>
                  <View style={styles.summaryStat}>
                    <Text variant="caption" color="muted">
                      ARKADAS OYU
                    </Text>
                    <Text variant="label">{friendVotes.length}</Text>
                  </View>
                  <View style={styles.summaryStat}>
                    <Text variant="caption" color="muted">
                      PAYLASIM
                    </Text>
                    <Text variant="label">{sharedOutfit.outfit.share_token ? "Acik" : "Kapali"}</Text>
                  </View>
                </View>
                {canMarkWorn ? <Button title="Bugun Giydim" variant="secondary" onPress={handleMarkWorn} loading={isMarkingWorn} disabled={isBusy} /> : null}
                {canToggleFavorite ? (
                  <Button
                    title={sharedOutfit.outfit.is_favorite ? "Favoriden Cikar" : "Favori Yap"}
                    variant="ghost"
                    onPress={handleToggleFavorite}
                    loading={isTogglingFavorite}
                    disabled={isBusy}
                  />
                ) : null}
                {canShareOutfit ? (
                  <View style={styles.shareActions}>
                    <Button title="Paylas" variant="secondary" onPress={() => void handleShareOutfit()} loading={isSharingOutfit} disabled={isBusy} />
                    <Button title="Arkadaslara Sor" variant="ghost" onPress={() => void handleAskFriends()} loading={isAskingFriends} disabled={isBusy} />
                  </View>
                ) : null}
                {canDeleteOutfit ? (
                  <Button title="Kombini Sil" variant="ghost" onPress={handleDeleteOutfit} loading={isDeletingOutfit} disabled={isBusy} />
                ) : null}
              </Card>

              <Card style={styles.votes}>
                <Text variant="h3">{isOwner ? "Kisisel puanin" : canVote ? "Oy ver" : "Arkadas oylari"}</Text>
                {isOwner ? (
                  <Text variant="body" color="secondary">
                    Kombini sonradan hatirlamak icin kendi hissini kaydet. Arkadas oylarindan ayri tutulur.
                  </Text>
                ) : null}
                <View style={styles.voteRow}>
                  {voteOptions.map((option) => (
                    <Pressable
                      key={option.value}
                      style={[styles.voteButton, myVote === option.value && styles.voteButtonActive, !canVote && styles.voteDisabled]}
                      onPress={() => void handleVote(option.value)}
                      disabled={!canVote || isBusy}
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
                      Arkadas {option.label}: {option.count}
                    </Text>
                  ))}
                </View>
                {friendVotes.length > 0 ? (
                  <View style={styles.voterList}>
                    {friendVotes.map((item) => {
                      const voterName = item.voter?.full_name ?? item.voter?.username ?? "Arkadas";
                      const voteLabel = voteOptions.find((option) => option.value === item.vote)?.label ?? item.vote;

                      return (
                        <View key={item.id} style={styles.voterRow}>
                          <View style={styles.voterIcon}>
                            <Ionicons name={voteIcons[item.vote]} size={18} color={COLORS.primary} />
                          </View>
                          <View style={styles.voterCopy}>
                            <Text variant="label">{voterName}</Text>
                            <Text variant="caption" color="muted">
                              {voteLabel}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text variant="body" color="secondary">
                    Henuz arkadas oyu yok. Arkadaslarina sordugunda cevaplar burada gorunecek.
                  </Text>
                )}
              </Card>
            </View>
          }
          ListEmptyComponent={<EmptyItems />}
          columnWrapperStyle={sharedOutfit.items.length > 0 ? styles.gridRow : undefined}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => <OutfitItem item={item} outfitId={id} />}
        />
      ) : null}
    </View>
  );
}

function OutfitItem({ item, outfitId }: { item: WardrobeItem; outfitId?: string }) {
  const categoryLabel = CATEGORIES.find((category) => category.value === item.category)?.label ?? item.category;

  return (
    <View style={styles.itemWrap}>
      <Pressable
        onPress={() => {
          captureEvent("shared_outfit_item_opened", { outfit_id: outfitId ?? "invalid", item_id: item.id });
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
  summary: {
    gap: SPACING.sm,
  },
  summaryStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  summaryStat: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    flex: 1,
    minWidth: 92,
    padding: SPACING.sm,
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
  voterList: {
    gap: SPACING.sm,
  },
  voterRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  voterIcon: {
    alignItems: "center",
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  voterCopy: {
    flex: 1,
    gap: 2,
  },
  shareActions: {
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
