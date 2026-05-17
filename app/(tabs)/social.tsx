import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

import { CachedImage } from "@/components/ui/CachedImage";
import { EmptyState } from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { fetchPublicOutfitFeed } from "@/lib/api/outfits";
import { captureEvent } from "@/lib/observability";
import type { SharedOutfit } from "@/types";

type FeedTab = "kesfet" | "takipci" | "populer" | "ilham";

const FEED_TABS: Array<{ value: FeedTab; label: string }> = [
  { value: "kesfet", label: "Keşfet" },
  { value: "takipci", label: "Takipçi" },
  { value: "populer", label: "Popüler" },
  { value: "ilham", label: "İlham" },
];

export default function SocialScreen() {
  const [activeTab, setActiveTab] = useState<FeedTab>("kesfet");

  const feedQuery = useQuery({
    queryKey: ["public-outfit-feed"],
    queryFn: fetchPublicOutfitFeed,
    staleTime: 1000 * 60 * 3,
  });

  const feed = feedQuery.data ?? [];

  useEffect(() => {
    captureEvent("social_tab_viewed", { feed_count: feed.length, tab: activeTab });
  }, [activeTab, feed.length]);

  const sortedFeed = [...feed].sort((a, b) => {
    if (activeTab === "populer") return b.votes.length - a.votes.length;
    return new Date(b.outfit.created_at).getTime() - new Date(a.outfit.created_at).getTime();
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="h1">Sosyal</Text>
        <TouchableOpacity
          style={styles.friendsButton}
          onPress={() => router.push("/social/friends")}
        >
          <Ionicons name="people-outline" size={18} color={COLORS.primary} />
          <Text variant="label" color="primary">Arkadaşlar</Text>
        </TouchableOpacity>
      </View>

      {/* Sub tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
      >
        {FEED_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.value}
            style={[styles.feedTab, activeTab === tab.value && styles.feedTabActive]}
            onPress={() => setActiveTab(tab.value)}
            activeOpacity={0.7}
          >
            <Text
              variant="label"
              color={activeTab === tab.value ? "inverse" : "secondary"}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Feed */}
      <ScrollView
        style={styles.feed}
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
      >
        {feedQuery.isLoading ? (
          <EmptyState icon="sync-outline" title="Yükleniyor" body="" />
        ) : sortedFeed.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="Henüz paylaşım yok"
            body="Arkadaşlarını bul ve onların kombinlerini keşfet."
            actionLabel="Arkadaş Bul"
            onAction={() => router.push("/social/friends")}
          />
        ) : (
          sortedFeed.map((outfit) => (
            <OutfitFeedCard key={outfit.outfit.id} outfit={outfit} />
          ))
        )}

        {/* Arkadaş keşfet butonu */}
        <TouchableOpacity
          style={styles.discoverButton}
          onPress={() => router.push("/social/friends")}
          activeOpacity={0.8}
        >
          <Ionicons name="person-add-outline" size={18} color={COLORS.primary} />
          <Text variant="label" color="primary">Arkadaş Bul</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function OutfitFeedCard({ outfit }: { outfit: SharedOutfit }) {
  const loveCount = outfit.votes.filter((v) => v.vote === "love" || v.vote === "yes").length;
  const ownerName = outfit.owner?.full_name ?? outfit.owner?.username ?? "Kullanıcı";
  const firstItem = outfit.items[0];

  return (
    <Pressable
      style={styles.postCard}
      onPress={() => router.push(`/outfit/${outfit.outfit.id}`)}
    >
      {/* User header */}
      <View style={styles.postHeader}>
        <View style={styles.postAvatar}>
          <Ionicons name="person" size={16} color={COLORS.textMuted} />
        </View>
        <View style={styles.postUserInfo}>
          <Text variant="label">{ownerName}</Text>
          <Text variant="caption" color="muted">
            {new Date(outfit.outfit.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}
          </Text>
        </View>
        <Ionicons name="ellipsis-horizontal" size={16} color={COLORS.textMuted} />
      </View>

      {/* Outfit image */}
      {firstItem?.image_url ? (
        <CachedImage
          accessibilityLabel="Kombin görseli"
          sourceUri={firstItem.image_url}
          style={styles.postImage}
          fallbackColor={firstItem.dominant_color_hex}
        />
      ) : (
        <View style={[styles.postImage, styles.postImagePlaceholder]}>
          <Ionicons name="shirt-outline" size={40} color={COLORS.textMuted} />
        </View>
      )}

      {/* Event/mood tags */}
      {(outfit.outfit.event_type || outfit.outfit.mood) && (
        <View style={styles.postTags}>
          {outfit.outfit.event_type && (
            <View style={styles.postTag}>
              <Text variant="caption" color="muted">{outfit.outfit.event_type}</Text>
            </View>
          )}
          {outfit.outfit.mood && (
            <View style={styles.postTag}>
              <Text variant="caption" color="muted">{outfit.outfit.mood}</Text>
            </View>
          )}
        </View>
      )}

      {/* Actions */}
      <View style={styles.postActions}>
        <View style={styles.postAction}>
          <Ionicons name="heart-outline" size={18} color={COLORS.textMuted} />
          <Text variant="caption" color="muted">{loveCount}</Text>
        </View>
        <View style={styles.postAction}>
          <Ionicons name="chatbubble-outline" size={18} color={COLORS.textMuted} />
          <Text variant="caption" color="muted">0</Text>
        </View>
        <View style={styles.postAction}>
          <Ionicons name="bookmark-outline" size={18} color={COLORS.textMuted} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.background, flex: 1 },

  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingTop: 56,
    paddingBottom: SPACING.md,
  },
  friendsButton: {
    alignItems: "center",
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
  },

  // Sub tabs
  tabsRow: { gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md },
  feedTab: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
  },
  feedTabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },

  // Feed
  feed: { flex: 1 },
  feedContent: { gap: SPACING.md, paddingHorizontal: SPACING.lg, paddingBottom: 100 },

  // Post card
  postCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  postHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
    padding: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  postAvatar: {
    alignItems: "center",
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 999,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  postUserInfo: { flex: 1, gap: 1 },
  postImage: {
    aspectRatio: 4 / 3,
    backgroundColor: COLORS.surfaceMuted,
    width: "100%",
  },
  postImagePlaceholder: { alignItems: "center", justifyContent: "center" },
  postTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
    padding: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  postTag: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  postActions: {
    flexDirection: "row",
    gap: SPACING.md,
    padding: SPACING.md,
    paddingTop: SPACING.sm,
  },
  postAction: { alignItems: "center", flexDirection: "row", gap: 4 },

  discoverButton: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACING.sm,
    justifyContent: "center",
    marginTop: SPACING.sm,
    padding: SPACING.md,
  },
});
