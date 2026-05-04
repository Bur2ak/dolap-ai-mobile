import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, FlatList, Image, Pressable, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { CATEGORIES } from "@/constants/categories";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useSharedOutfit } from "@/hooks/useOutfitRecommendation";
import type { OutfitVoteValue, WardrobeItem } from "@/types";

const voteOptions: Array<{ value: OutfitVoteValue; label: string }> = [
  { value: "love", label: "Bayildim" },
  { value: "yes", label: "Olur" },
  { value: "no", label: "Baska dene" },
];

export default function SharedOutfitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId, sharedOutfit, isLoading, error, vote, isVoting, canVote } = useSharedOutfit(id);
  const myVote = sharedOutfit?.votes.find((item) => item.voter_id === userId)?.vote;
  const voteCounts = voteOptions.map((option) => ({
    ...option,
    count: sharedOutfit?.votes.filter((item) => item.vote === option.value).length ?? 0,
  }));

  async function handleVote(value: OutfitVoteValue) {
    try {
      await vote(value);
    } catch (voteError) {
      Alert.alert("Oy verilemedi", voteError instanceof Error ? voteError.message : "Tekrar dene.");
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} />
        <Text variant="h2">Kombin Oyu</Text>
        <View style={styles.headerSpacer} />
      </View>

      {error ? (
        <Card style={styles.empty}>
          <Ionicons name="lock-closed-outline" size={40} color={COLORS.primary} />
          <Text variant="h3">Kombin acilamadi</Text>
          <Text variant="body" color="secondary" style={styles.centerText}>
            Bu kombin yalnizca kabul edilmis arkadaslara acik olabilir.
          </Text>
        </Card>
      ) : isLoading ? (
        <Card style={styles.empty}>
          <Ionicons name="sync-outline" size={40} color={COLORS.primary} />
          <Text variant="h3">Kombin yukleniyor</Text>
        </Card>
      ) : sharedOutfit ? (
        <FlatList
          data={sharedOutfit.items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          ListHeaderComponent={
            <View style={styles.top}>
              <Card style={styles.summary}>
                <Text variant="caption" color="muted">
                  {sharedOutfit.outfit.event_type ?? "Kombin"}
                </Text>
                <Text variant="h1">{sharedOutfit.outfit.name ?? "Paylasilan kombin"}</Text>
                <Text variant="body" color="secondary">
                  {sharedOutfit.outfit.ai_reasoning ?? "Arkadasin bu kombine fikrini istiyor."}
                </Text>
              </Card>

              <Card style={styles.votes}>
                <Text variant="h3">Oy ver</Text>
                <View style={styles.voteRow}>
                  {voteOptions.map((option) => (
                    <Pressable
                      key={option.value}
                      style={[styles.voteButton, myVote === option.value && styles.voteButtonActive, !canVote && styles.voteDisabled]}
                      onPress={() => void handleVote(option.value)}
                      disabled={!canVote || isVoting}
                    >
                      <Text variant="label" color={myVote === option.value ? "inverse" : "primary"} style={styles.centerText}>
                        {option.label}
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
          renderItem={({ item }) => <OutfitItem item={item} />}
        />
      ) : null}
    </View>
  );
}

function OutfitItem({ item }: { item: WardrobeItem }) {
  const categoryLabel = CATEGORIES.find((category) => category.value === item.category)?.label ?? item.category;

  return (
    <View style={styles.itemWrap}>
      <Card style={styles.itemCard}>
        {item.thumbnail_url || item.image_url ? (
          <Image source={{ uri: item.thumbnail_url ?? item.image_url }} style={styles.itemImage} />
        ) : (
          <View style={[styles.colorBlock, { backgroundColor: item.dominant_color_hex ?? COLORS.primarySoft }]} />
        )}
        <Text variant="label">{item.subcategory ?? categoryLabel}</Text>
        <Text variant="caption" color="muted">
          {item.brand ?? categoryLabel}
        </Text>
      </Card>
    </View>
  );
}

function EmptyItems() {
  return (
    <Card style={styles.empty}>
      <Ionicons name="shirt-outline" size={40} color={COLORS.primary} />
      <Text variant="body" color="secondary" style={styles.centerText}>
        Bu kombinde goruntulenebilir kiyafet yok.
      </Text>
    </Card>
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
  empty: {
    alignItems: "center",
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingVertical: 40,
  },
  centerText: {
    textAlign: "center",
  },
});
