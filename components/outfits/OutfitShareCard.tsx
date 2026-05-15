import { Canvas, LinearGradient, Rect, RoundedRect, vec } from "@shopify/react-native-skia";
import { forwardRef } from "react";
import { StyleSheet, View } from "react-native";

import { CachedImage } from "@/components/ui/CachedImage";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import type { OutfitVoteValue, SharedOutfit, WardrobeItem } from "@/types";

const CARD_WIDTH = 360;
const CARD_HEIGHT = 500;

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
    <View ref={ref} collapsable={false} style={styles.wrapper}>
      {/* Skia canvas: gradient arka plan + dekoratif elementler */}
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Ana gradient */}
        <Rect x={0} y={0} width={CARD_WIDTH} height={CARD_HEIGHT}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(CARD_WIDTH, CARD_HEIGHT)}
            colors={["#12312B", "#1C4A3A", "#0D2620"]}
          />
        </Rect>
        {/* Dekoratif accent daire — sag ust */}
        <RoundedRect x={CARD_WIDTH - 80} y={-40} width={120} height={120} r={60} color="rgba(255,255,255,0.05)" />
        {/* Dekoratif accent daire — sol alt */}
        <RoundedRect x={-30} y={CARD_HEIGHT - 80} width={100} height={100} r={50} color="rgba(255,255,255,0.04)" />
        {/* Alt parlama */}
        <Rect x={0} y={CARD_HEIGHT - 80} width={CARD_WIDTH} height={80}>
          <LinearGradient
            start={vec(0, CARD_HEIGHT - 80)}
            end={vec(0, CARD_HEIGHT)}
            colors={["transparent", "rgba(0,0,0,0.3)"]}
          />
        </Rect>
      </Canvas>

      {/* İçerik katmanı */}
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text variant="caption" color="inverse" style={styles.eyebrow}>
              {eyebrow.toUpperCase()}
            </Text>
            <Text variant="h2" color="inverse" numberOfLines={2}>
              {sharedOutfit.outfit.name ?? "Paylasilan kombin"}
            </Text>
          </View>
          <View style={styles.brandMark}>
            <Text variant="h3" color="inverse">S</Text>
          </View>
        </View>

        <View style={styles.itemGrid}>
          {previewItems.length > 0
            ? previewItems.map((item) => <PreviewTile key={item.id} item={item} />)
            : <View style={styles.emptyPreview} />}
        </View>

        <View style={styles.footer}>
          <Text variant="body" color="inverse" style={styles.reason} numberOfLines={2}>
            {sharedOutfit.outfit.ai_reasoning ?? "Bu kombin icin fikrin isteniyor."}
          </Text>
          <View style={styles.metaRow}>
            <MetaPill label={`${sharedOutfit.items.length} parca`} />
            <MetaPill label={`${sharedOutfit.votes.length} oy`} />
            {topVote ? <MetaPill label={`${voteLabels[topVote.vote]}: ${topVote.count}`} /> : null}
          </View>
          <Text variant="caption" color="inverse" style={styles.brandLine}>
            shipirio.com
          </Text>
        </View>
      </View>
    </View>
  );
});

function PreviewTile({ item }: { item: WardrobeItem }) {
  return (
    <View style={styles.previewTile}>
      <CachedImage
        accessibilityLabel={item.subcategory ?? item.category}
        fallbackColor={item.dominant_color_hex}
        sourceUri={item.thumbnail_url ?? item.image_url}
        style={styles.previewImage}
        priority="high"
      />
    </View>
  );
}

function MetaPill({ label }: { label: string }) {
  return (
    <View style={styles.metaPill}>
      <Text variant="caption" color="inverse">{label}</Text>
    </View>
  );
}

function getTopVote(sharedOutfit: SharedOutfit) {
  const counts: Array<{ vote: OutfitVoteValue; count: number }> = [
    { vote: "love", count: sharedOutfit.votes.filter((v) => v.vote === "love").length },
    { vote: "yes", count: sharedOutfit.votes.filter((v) => v.vote === "yes").length },
    { vote: "no", count: sharedOutfit.votes.filter((v) => v.vote === "no").length },
  ];
  const [top] = counts.sort((a, b) => b.count - a.count);
  return top && top.count > 0 ? top : null;
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 16,
    height: CARD_HEIGHT,
    overflow: "hidden",
    width: CARD_WIDTH,
  },
  content: {
    flex: 1,
    gap: SPACING.md,
    padding: SPACING.lg,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: SPACING.md,
    justifyContent: "space-between",
  },
  headerCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  eyebrow: {
    letterSpacing: 1.2,
    opacity: 0.7,
  },
  brandMark: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 10,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  itemGrid: {
    flex: 1,
    flexDirection: "row",
    gap: SPACING.sm,
  },
  previewTile: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    flex: 1,
    overflow: "hidden",
  },
  previewImage: {
    height: "100%",
    width: "100%",
  },
  emptyPreview: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    flex: 1,
  },
  footer: {
    gap: SPACING.sm,
  },
  reason: {
    opacity: 0.88,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  metaPill: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  brandLine: {
    opacity: 0.4,
  },
});
