import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect } from "react";
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

export default function StyleFeedScreen() {
  const feedQuery = useQuery({
    queryKey: ["public-outfit-feed"],
    queryFn: fetchPublicOutfitFeed,
  });
  const feed = feedQuery.data ?? [];

  useEffect(() => {
    captureEvent("style_feed_screen_viewed", {
      feed_count: feed.length,
      is_loading: feedQuery.isLoading,
    });
  }, [feed.length, feedQuery.isLoading]);

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
              Paylasima acik kombinler burada Pinterest tarzinda hizli ilham panosuna dusuyor.
            </Text>
          </View>
          <Ionicons name="albums-outline" size={28} color={COLORS.primary} />
        </View>
      </Card>

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
      ) : feed.length > 0 ? (
        <View style={styles.feedGrid}>
          {feed.map((sharedOutfit) => (
            <FeedCard key={sharedOutfit.outfit.id} sharedOutfit={sharedOutfit} />
          ))}
        </View>
      ) : (
        <EmptyState icon="sparkles-outline" title="Paylasilan kombin yok" body="Paylasima acik kombinler olustukca burada gorunecek." />
      )}
    </ScrollView>
  );
}

function FeedCard({ sharedOutfit }: { sharedOutfit: SharedOutfit }) {
  const previewItems = sharedOutfit.items.slice(0, 4);
  const loveCount = sharedOutfit.votes.filter((vote) => vote.vote === "love").length;

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
        <Text variant="caption" color="muted">
          {sharedOutfit.items.length} parca - {sharedOutfit.votes.length} oy - {loveCount} favori oy
        </Text>
      </Card>
    </Pressable>
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
    minHeight: 236,
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
});
