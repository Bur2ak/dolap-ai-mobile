import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

import { CachedImage } from "@/components/ui/CachedImage";
import { EmptyState } from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { FONTS, FONT_SIZE } from "@/constants/typography";
import { SPACING } from "@/constants/spacing";
import { useSocial } from "@/hooks/useSocial";
import { fetchPublicOutfitFeed } from "@/lib/api/outfits";
import { captureEvent } from "@/lib/observability";
import type { Friendship, SharedOutfit } from "@/types";

type FeedTab = "kesfet" | "takipte" | "populer" | "ilham";

const FEED_TABS: Array<{ value: FeedTab; label: string }> = [
  { value: "kesfet", label: "Keşfet" },
  { value: "takipte", label: "Takipte" },
  { value: "populer", label: "Popüler" },
  { value: "ilham", label: "İlham" },
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "Az önce";
  if (h < 24) return `${h} saat önce`;
  const d = Math.floor(h / 24);
  return `${d} gün önce`;
}

export default function SocialScreen() {
  const [activeTab, setActiveTab] = useState<FeedTab>("kesfet");
  const { friendships } = useSocial();

  const acceptedFriends = friendships.filter(f => f.status === "accepted").slice(0, 6);

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

  function handleStoryPress() {
    Alert.alert("Hikayeler", "Hikaye özelliği yakında geliyor! 🚀");
  }

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text variant="h1">Sosyal</Text>
        <TouchableOpacity
          style={styles.friendsBtn}
          onPress={() => router.push("/social/friends")}
          activeOpacity={0.7}
        >
          <Ionicons name="people-outline" size={16} color={COLORS.primary} />
          <Text variant="label">Arkadaşlar</Text>
        </TouchableOpacity>
      </View>

      {/* ── Sub tabs — lavender active ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
        style={styles.tabsScroll}
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
              style={activeTab === tab.value ? styles.tabTextActive : styles.tabText}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.feed}
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hikayeler satırı ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesRow}>
          {/* Senin Hikayen */}
          <TouchableOpacity style={styles.storyItem} onPress={handleStoryPress} activeOpacity={0.8}>
            <View style={styles.storyOwn}>
              <Ionicons name="sparkles-outline" size={22} color={COLORS.accentText} />
              <View style={styles.storyPlusBtn}>
                <Ionicons name="add" size={12} color={COLORS.textInverse} />
              </View>
            </View>
            <Text variant="caption" color="muted" style={styles.storyName} numberOfLines={1}>
              Senin Hikayen
            </Text>
          </TouchableOpacity>

          {/* Arkadaş avatarları */}
          {acceptedFriends.map((f) => {
            const friend = f.requester_id === f.addressee_id ? null : f;
            const name = (f as unknown as { friend?: { username?: string; full_name?: string } })?.friend?.username ?? "Arkadaş";
            const initials = name.slice(0, 2).toUpperCase();
            return (
              <TouchableOpacity
                key={f.id}
                style={styles.storyItem}
                onPress={() => router.push(`/social/${f.id}`)}
                activeOpacity={0.8}
              >
                <View style={styles.storyAvatar}>
                  <Text variant="label" color="inverse" style={styles.storyInitials}>{initials}</Text>
                </View>
                <Text variant="caption" color="muted" style={styles.storyName} numberOfLines={1}>
                  {name}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Arkadaş ekle */}
          <TouchableOpacity
            style={styles.storyItem}
            onPress={() => router.push("/social/friends")}
            activeOpacity={0.8}
          >
            <View style={[styles.storyAvatar, styles.storyAddBtn]}>
              <Ionicons name="person-add-outline" size={18} color={COLORS.primary} />
            </View>
            <Text variant="caption" color="muted" style={styles.storyName} numberOfLines={1}>
              Arkadaş Ekle
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* ── Feed ── */}
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
            <PostCard key={outfit.outfit.id} outfit={outfit} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function PostCard({ outfit }: { outfit: SharedOutfit }) {
  const loveCount = outfit.votes.filter((v) => v.vote === "love" || v.vote === "yes").length;
  const ownerName = outfit.owner?.full_name ?? outfit.owner?.username ?? "Kullanıcı";
  const ownerInitials = ownerName.slice(0, 2).toUpperCase();
  const firstItem = outfit.items[0];
  const styleTagsRaw = [outfit.outfit.event_type, outfit.outfit.mood].filter(Boolean) as string[];
  const styleTags = styleTagsRaw.length > 0 ? styleTagsRaw : ["Minimal", "Zarif"];

  return (
    <View style={styles.postCard}>
      {/* User header */}
      <View style={styles.postHeader}>
        <View style={styles.postAvatar}>
          <Text variant="label" color="inverse" style={styles.postAvatarText}>{ownerInitials}</Text>
        </View>
        <View style={styles.postUserInfo}>
          <Text variant="label">{ownerName}</Text>
          <View style={styles.postMeta}>
            <Text variant="caption" color="muted">{timeAgo(outfit.outfit.created_at)}</Text>
            {outfit.owner?.username && (
              <>
                <View style={styles.metaDot} />
                <Ionicons name="location-outline" size={11} color={COLORS.textMuted} />
                <Text variant="caption" color="muted">İstanbul</Text>
              </>
            )}
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push(`/outfit/${outfit.outfit.id}`)} activeOpacity={0.7}>
          <Ionicons name="ellipsis-horizontal" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Content: left photo + right text */}
      <Pressable
        style={styles.postContent}
        onPress={() => router.push(`/outfit/${outfit.outfit.id}`)}
      >
        {/* Left: big outfit photo */}
        <View style={styles.postPhotoWrap}>
          {firstItem?.image_url ? (
            <CachedImage
              accessibilityLabel="Kombin"
              sourceUri={firstItem.thumbnail_url ?? firstItem.image_url}
              fallbackColor={firstItem.dominant_color_hex}
              style={styles.postPhoto}
            />
          ) : (
            <View style={[styles.postPhoto, styles.postPhotoPlaceholder]}>
              <Ionicons name="shirt-outline" size={28} color={COLORS.textMuted} />
            </View>
          )}
        </View>

        {/* Right: text + tags + item grid */}
        <View style={styles.postRight}>
          <Text variant="h3" numberOfLines={2} style={styles.postTitle}>
            {outfit.outfit.name ?? "Kombin"}
          </Text>
          {outfit.outfit.ai_reasoning ? (
            <Text variant="caption" color="secondary" numberOfLines={3} style={styles.postDesc}>
              {outfit.outfit.ai_reasoning}
            </Text>
          ) : null}

          {/* Style tags */}
          <View style={styles.postTags}>
            {styleTags.slice(0, 3).map((tag) => (
              <View key={tag} style={styles.postTag}>
                <Text variant="caption" color="secondary">{tag}</Text>
              </View>
            ))}
          </View>

          {/* Item thumbnails */}
          <View style={styles.postThumbs}>
            {outfit.items.slice(0, 4).map((item) => (
              item.thumbnail_url || item.image_url ? (
                <CachedImage
                  key={item.id}
                  accessibilityLabel=""
                  sourceUri={item.thumbnail_url ?? item.image_url}
                  fallbackColor={item.dominant_color_hex}
                  style={styles.postThumb}
                />
              ) : (
                <View
                  key={item.id}
                  style={[styles.postThumb, { backgroundColor: item.dominant_color_hex ?? COLORS.surfaceMuted }]}
                />
              )
            ))}
          </View>
        </View>
      </Pressable>

      {/* Action bar */}
      <View style={styles.postActions}>
        <TouchableOpacity style={styles.postAction} activeOpacity={0.7}>
          <Ionicons name="heart-outline" size={18} color={COLORS.textMuted} />
          <Text variant="caption" color="muted">{loveCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.postAction} activeOpacity={0.7}>
          <Ionicons name="chatbubble-outline" size={18} color={COLORS.textMuted} />
          <Text variant="caption" color="muted">0</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.postAction} activeOpacity={0.7}>
          <Ionicons name="share-outline" size={18} color={COLORS.textMuted} />
          <Text variant="caption" color="muted">{outfit.votes.length}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.background, flex: 1 },

  // Header
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingTop: 60,
    paddingBottom: SPACING.sm,
  },
  friendsBtn: {
    alignItems: "center",
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
  },

  // Sub tabs — lavender active
  tabsScroll: { flexGrow: 0 },
  tabsRow: {
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  feedTab: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
  },
  feedTabActive: {
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.accent,
  },
  tabText: { color: COLORS.textSecondary, fontFamily: FONTS.sansMedium, fontSize: FONT_SIZE.label },
  tabTextActive: { color: COLORS.accentText, fontFamily: FONTS.sansBold, fontSize: FONT_SIZE.label },

  // Feed
  feed: { flex: 1 },
  feedContent: { gap: SPACING.md, paddingHorizontal: SPACING.lg, paddingBottom: 100 },

  // Stories
  storiesRow: { gap: SPACING.md, paddingVertical: SPACING.sm },
  storyItem: { alignItems: "center", gap: 5, width: 64 },
  storyOwn: {
    alignItems: "center",
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.accent,
    borderRadius: 999,
    borderWidth: 2,
    height: 56,
    justifyContent: "center",
    position: "relative",
    width: 56,
  },
  storyPlusBtn: {
    alignItems: "center",
    backgroundColor: COLORS.cta,
    borderColor: COLORS.surface,
    borderRadius: 999,
    borderWidth: 1.5,
    bottom: -2,
    height: 18,
    justifyContent: "center",
    position: "absolute",
    right: -2,
    width: 18,
  },
  storyAvatar: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderColor: COLORS.accent,
    borderRadius: 999,
    borderWidth: 2.5,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  storyAddBtn: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderStyle: "dashed",
  },
  storyInitials: { fontFamily: FONTS.sansBold, fontSize: 16 },
  storyName: {
    fontFamily: FONTS.sansRegular,
    fontSize: 10,
    textAlign: "center",
    width: "100%",
  },

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
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  postAvatarText: { fontFamily: FONTS.sansBold, fontSize: 14 },
  postUserInfo: { flex: 1, gap: 2 },
  postMeta: { alignItems: "center", flexDirection: "row", gap: 4 },
  metaDot: { backgroundColor: COLORS.textMuted, borderRadius: 999, height: 3, width: 3 },

  // Content split layout
  postContent: { flexDirection: "row", minHeight: 160 },
  postPhotoWrap: { width: "42%" },
  postPhoto: { height: "100%", minHeight: 160, width: "100%" },
  postPhotoPlaceholder: {
    alignItems: "center",
    backgroundColor: COLORS.surfaceMuted,
    justifyContent: "center",
  },
  postRight: {
    flex: 1,
    gap: SPACING.xs,
    justifyContent: "center",
    padding: SPACING.sm,
  },
  postTitle: { fontFamily: FONTS.displayBold, fontSize: 16, letterSpacing: -0.2 },
  postDesc: { fontFamily: FONTS.sansRegular, fontSize: 11, lineHeight: 15 },
  postTags: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  postTag: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  postThumbs: { flexDirection: "row", gap: 3, marginTop: 2 },
  postThumb: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 6,
    height: 36,
    width: 28,
  },

  // Actions
  postActions: {
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: SPACING.lg,
    padding: SPACING.md,
    paddingTop: SPACING.sm,
  },
  postAction: { alignItems: "center", flexDirection: "row", gap: 5 },
});
