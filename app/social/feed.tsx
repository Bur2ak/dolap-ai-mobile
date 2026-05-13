import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { CachedImage } from "@/components/ui/CachedImage";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { fetchPublicOutfitFeed } from "@/lib/api/outfits";
import { captureEvent } from "@/lib/observability";
import type { SharedOutfit } from "@/types";

type FeedMode = "trend" | "recent" | "loved";

export default function StyleFeedScreen() {
  const [mode, setMode] = useState<FeedMode>("trend");
  const feedQuery = useQuery({
    queryKey: ["public-outfit-feed"],
    queryFn: fetchPublicOutfitFeed,
  });
  const feed = feedQuery.data ?? [];
  const visibleFeed = useMemo(() => sortFeed(feed, mode), [feed, mode]);

  useEffect(() => {
    captureEvent("style_feed_screen_viewed", {
      feed_count: feed.length,
      is_loading: feedQuery.isLoading,
      mode,
    });
  }, [feed.length, feedQuery.isLoading, mode]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} />
        <Text variant="h2">Stil Panosu</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Card style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroCopy}>
            <Text variant="caption" color="muted">
              PAYLASILAN KOMBINLER
            </Text>
            <Text variant="h3">Arkadaslardan ve topluluktan ilham</Text>
            <Text variant="body" color="secondary">
              Paylasima acik kombinler burada ilham panosuna duser; oylar trend siralamasini belirler.
            </Text>
          </View>
          <Ionicons name="albums-outline" size={28} color={COLORS.primary} />
        </View>
      </Card>

      <View style={styles.modeRow}>
        {feedModes.map((item) => {
          const active = item.value === mode;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="button"
              style={[styles.modeButton, active && styles.modeButtonActive]}
              onPress={() => {
                setMode(item.value);
                captureEvent("style_feed_mode_changed", { mode: item.value });
              }}
            >
              <Text variant="label" color={active ? "inverse" : "secondary"}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {feedQuery.isLoading ? (
        <EmptyState icon="sync-outline" title="Pano yukleniyor" body="Paylasilan kombinler hazirlaniyor." />
      ) : feedQuery.error ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Pano acilamadi"
          body="Baglanti veya paylasim izinleri tarafinda gecici bir sorun olabilir."
          actionLabel="Tekrar Dene"
          loading={feedQuery.isRefetching}
          onAction={() => {
            captureEvent("style_feed_refetch_requested");
            void feedQuery.refetch();
          }}
        />
      ) : visibleFeed.length > 0 ? (
        <View style={styles.feedGrid}>
          {visibleFeed.map((sharedOutfit, index) => (
            <FeedCard key={sharedOutfit.outfit.id} rank={index + 1} sharedOutfit={sharedOutfit} />
          ))}
        </View>
      ) : (
        <EmptyState icon="sparkles-outline" title="Paylasilan kombin yok" body="Paylasima acik kombinler olustukca burada gorunecek." />
      )}
    </ScrollView>
  );
}

const feedModes: Array<{ label: string; value: FeedMode }> = [
  { label: "Trend", value: "trend" },
  { label: "Yeni", value: "recent" },
  { label: "Favoriler", value: "loved" },
];

function FeedCard({ rank, sharedOutfit }: { rank: number; sharedOutfit: SharedOutfit }) {
  const previewItems = sharedOutfit.items.slice(0, 4);
  const ownerName = sharedOutfit.owner?.full_name ?? sharedOutfit.owner?.username ?? "Shipirio kullanicisi";
  const loveCount = sharedOutfit.votes.filter((vote) => vote.vote === "love").length;
  const yesCount = sharedOutfit.votes.filter((vote) => vote.vote === "yes").length;
  const trendScore = getTrendScore(sharedOutfit);
  const signals = getFeedSignals(sharedOutfit, trendScore, loveCount);

  return (
    <Pressable
      style={styles.feedItem}
      onPress={() => {
        const token = sharedOutfit.outfit.share_token;
        captureEvent("style_feed_outfit_opened", { outfit_id: sharedOutfit.outfit.id, has_token: Boolean(token) });
        if (token) {
          router.push(`/outfit/share/${token}`);
        }
      }}
      disabled={!sharedOutfit.outfit.share_token}
    >
      <Card style={styles.feedCard}>
        <View style={styles.feedTopRow}>
          <View style={styles.ownerRow}>
            <View style={styles.avatar}>
              <Text variant="caption" color="inverse">
                {ownerName[0]?.toUpperCase() ?? "S"}
              </Text>
            </View>
            <View style={styles.ownerCopy}>
              <Text variant="caption" color="muted">
                @{sharedOutfit.owner?.username ?? "stil"}
              </Text>
              <Text variant="label" numberOfLines={1}>
                {ownerName}
              </Text>
            </View>
          </View>
          <View style={styles.rankPill}>
            <Text variant="caption" color="secondary">
              #{rank}
            </Text>
          </View>
        </View>
        <View style={styles.mosaic}>
          {previewItems.map((item) => (
            <CachedImage
              key={item.id}
              accessibilityLabel={item.subcategory ?? item.category}
              fallbackColor={item.dominant_color_hex}
              sourceUri={item.thumbnail_url ?? item.image_url}
              style={styles.mosaicImage}
            />
          ))}
        </View>
        <Text variant="label">{sharedOutfit.outfit.name ?? "Paylasilan kombin"}</Text>
        {sharedOutfit.outfit.ai_reasoning ? (
          <Text variant="caption" color="secondary" numberOfLines={2}>
            {sharedOutfit.outfit.ai_reasoning}
          </Text>
        ) : null}
        <Text variant="caption" color="muted">
          {sharedOutfit.items.length} parca - {yesCount} olur - {loveCount} favori - trend {trendScore}
        </Text>
        <View style={styles.signalRow}>
          {signals.map((signal) => (
            <View key={signal} style={styles.signalChip}>
              <Text variant="caption" color="secondary" numberOfLines={1}>
                {signal}
              </Text>
            </View>
          ))}
        </View>
      </Card>
    </Pressable>
  );
}

function sortFeed(feed: SharedOutfit[], mode: FeedMode) {
  const copy = [...feed];
  if (mode === "recent") {
    return copy.sort((a, b) => new Date(b.outfit.created_at).getTime() - new Date(a.outfit.created_at).getTime());
  }

  if (mode === "loved") {
    return copy.sort((a, b) => getLoveCount(b) - getLoveCount(a) || getTrendScore(b) - getTrendScore(a));
  }

  return copy.sort((a, b) => getTrendScore(b) - getTrendScore(a) || new Date(b.outfit.created_at).getTime() - new Date(a.outfit.created_at).getTime());
}

function getLoveCount(sharedOutfit: SharedOutfit) {
  return sharedOutfit.votes.filter((vote) => vote.vote === "love").length;
}

function getTrendScore(sharedOutfit: SharedOutfit) {
  return sharedOutfit.votes.reduce((score, vote) => {
    if (vote.vote === "love") {
      return score + 3;
    }
    if (vote.vote === "yes") {
      return score + 2;
    }
    return score - 1;
  }, 0);
}

function getFeedSignals(sharedOutfit: SharedOutfit, trendScore: number, loveCount: number) {
  const categories = getTopValues(sharedOutfit.items.map((item) => item.subcategory ?? item.category));
  const colors = getTopValues(sharedOutfit.items.flatMap((item) => item.colors));
  const contexts = getTopValues(sharedOutfit.items.flatMap((item) => item.usage_context));
  const signals = [
    categories[0] ? `kategori ${categories[0]}` : null,
    colors[0] ? `renk ${colors[0]}` : null,
    contexts[0] ? `ortam ${contexts[0]}` : null,
    loveCount > 0 ? `${loveCount} favori` : null,
    trendScore > 0 ? `trend +${trendScore}` : "yeni pano",
  ];

  return signals.filter(Boolean).slice(0, 4) as string[];
}

function getTopValues(values: Array<string | null | undefined>) {
  const counts = new Map<string, number>();
  values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));

  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([value]) => value);
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  content: {
    gap: SPACING.md,
    padding: SPACING.lg,
    paddingBottom: 120,
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
  heroCard: {
    gap: SPACING.md,
  },
  heroHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: SPACING.md,
    justifyContent: "space-between",
  },
  heroCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  modeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  modeButton: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: SPACING.md,
  },
  modeButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  feedGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
  },
  feedItem: {
    width: "47%",
  },
  feedCard: {
    gap: SPACING.sm,
    minHeight: 368,
  },
  feedTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
    justifyContent: "space-between",
  },
  ownerRow: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: SPACING.xs,
    minWidth: 0,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  ownerCopy: {
    flex: 1,
    minWidth: 0,
  },
  rankPill: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  mosaic: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  mosaicImage: {
    aspectRatio: 1,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    width: "48%",
  },
  signalRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  signalChip: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 999,
    maxWidth: "100%",
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
  },
});
