import { forwardRef } from "react";
import { Image, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import type { OutfitVoteValue, SharedOutfit, WardrobeItem } from "@/types";

const voteLabels: Record<OutfitVoteValue, string> = {
  love: "Bayildim",
  yes: "Olur",
  no: "Baska dene",
};

interface OutfitShareCardProps {
  sharedOutfit: SharedOutfit;
  eyebrow?: string;
}

export const OutfitShareCard = forwardRef<View, OutfitShareCardProps>(function OutfitShareCard(
  { sharedOutfit, eyebrow = "Shipirio kombini" },
  ref,
) {
  const previewItems = sharedOutfit.items.slice(0, 4);
  const topVote = getTopVote(sharedOutfit);

  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text variant="caption" color="inverse">
            {eyebrow}
          </Text>
          <Text variant="h2" color="inverse">
            {sharedOutfit.outfit.name ?? "Paylasilan kombin"}
          </Text>
        </View>
        <View style={styles.brandMark}>
          <Text variant="label" color="inverse">
            S
          </Text>
        </View>
      </View>

      <View style={styles.itemGrid}>
        {previewItems.length > 0 ? previewItems.map((item) => <PreviewTile key={item.id} item={item} />) : <View style={styles.emptyPreview} />}
      </View>

      <View style={styles.footer}>
        <Text variant="body" color="inverse" style={styles.reason} numberOfLines={2}>
          {sharedOutfit.outfit.ai_reasoning ?? "Bu kombin icin fikrin isteniyor."}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.metaPill}>
            <Text variant="caption" color="inverse">
              {sharedOutfit.items.length} parca
            </Text>
          </View>
          <View style={styles.metaPill}>
            <Text variant="caption" color="inverse">
              {sharedOutfit.votes.length} oy
            </Text>
          </View>
          {topVote ? (
            <View style={styles.metaPill}>
              <Text variant="caption" color="inverse">
                {voteLabels[topVote.vote]}: {topVote.count}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
});

function PreviewTile({ item }: { item: WardrobeItem }) {
  return (
    <View style={styles.previewTile}>
      {item.thumbnail_url || item.image_url ? (
        <Image source={{ uri: item.thumbnail_url ?? item.image_url }} style={styles.previewImage} />
      ) : (
        <View style={[styles.previewColor, { backgroundColor: item.dominant_color_hex ?? COLORS.primarySoft }]} />
      )}
    </View>
  );
}

function getTopVote(sharedOutfit: SharedOutfit) {
  const counts: Array<{ vote: OutfitVoteValue; count: number }> = [
    { vote: "love", count: sharedOutfit.votes.filter((vote) => vote.vote === "love").length },
    { vote: "yes", count: sharedOutfit.votes.filter((vote) => vote.vote === "yes").length },
    { vote: "no", count: sharedOutfit.votes.filter((vote) => vote.vote === "no").length },
  ];
  const [topVote] = counts.sort((first, second) => second.count - first.count);
  return topVote && topVote.count > 0 ? topVote : null;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    gap: SPACING.md,
    overflow: "hidden",
    padding: SPACING.md,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: SPACING.md,
    justifyContent: "space-between",
  },
  brandMark: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderColor: "rgba(255,255,255,0.28)",
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  itemGrid: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  previewTile: {
    aspectRatio: 4 / 5,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    flex: 1,
    overflow: "hidden",
  },
  previewImage: {
    height: "100%",
    width: "100%",
  },
  previewColor: {
    height: "100%",
    width: "100%",
  },
  emptyPreview: {
    aspectRatio: 16 / 9,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 8,
    flex: 1,
  },
  footer: {
    gap: SPACING.sm,
  },
  reason: {
    opacity: 0.9,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  metaPill: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
});
