import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

import { CachedImage } from "@/components/ui/CachedImage";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/typography";
import { SPACING } from "@/constants/spacing";
import { useOutfitRecommendation } from "@/hooks/useOutfitRecommendation";
import { useWardrobe } from "@/hooks/useWardrobe";
import { useWeather } from "@/hooks/useWeather";
import { captureEvent } from "@/lib/observability";
import { useAuthStore } from "@/stores/authStore";

const DESTINATIONS = [
  { label: "Ofis", icon: "briefcase-outline" as const },
  { label: "Kahve", icon: "cafe-outline" as const },
  { label: "Akşam", icon: "wine-outline" as const },
  { label: "Hafta Sonu", icon: "sunny-outline" as const },
  { label: "Spor", icon: "fitness-outline" as const },
] as const;

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Günaydın";
  if (h < 18) return "İyi öğleden sonralar";
  return "İyi akşamlar";
}

export default function HomeScreen() {
  const { profile } = useAuthStore();
  const { items } = useWardrobe();
  const { weather } = useWeather();
  const { savedOutfits } = useOutfitRecommendation();

  const firstName = (profile?.full_name ?? profile?.username ?? "").split(" ")[0] || "Hoş geldin";
  const recentItems = items.slice(0, 6);
  const heroItem = recentItems[0] ?? null;

  // Style score
  const wornCount = items.filter(i => i.wear_count > 0).length;
  const styleScore = items.length > 0 ? Math.min(99, Math.round((wornCount / items.length) * 55 + 40)) : 92;

  useEffect(() => {
    captureEvent("home_screen_viewed", { item_count: items.length });
  }, [items.length]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Ionicons name="shirt-outline" size={22} color={COLORS.primary} />
          <Text variant="h3" style={styles.logoText}>Shipirio</Text>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/notifications")} activeOpacity={0.7}>
            <Ionicons name="notifications-outline" size={20} color={COLORS.primary} />
            {/* red dot — show when unread */}
            <View style={styles.notifDot} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/style-chat")} activeOpacity={0.7}>
            <Ionicons name="sparkles-outline" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Greeting ── */}
      <View style={styles.greetingBlock}>
        <Text variant="h1">{getGreeting()}, {firstName} 💜</Text>
        <Text variant="body" color="secondary">Bugün stilinle ilham ver.</Text>
      </View>

      {/* ── Destination chips ── */}
      <View style={styles.destinationBlock}>
        <Text variant="label" color="secondary" style={styles.destLabel}>Bugün nereye gidiyorsun?</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {DESTINATIONS.map(d => (
            <TouchableOpacity
              key={d.label}
              style={styles.destChip}
              onPress={() => router.push("/(tabs)/outfit")}
              activeOpacity={0.7}
            >
              <Ionicons name={d.icon} size={13} color={COLORS.textSecondary} />
              <Text variant="label" color="secondary">{d.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.destChip, styles.filterChip]} onPress={() => router.push("/(tabs)/outfit")} activeOpacity={0.7}>
            <Ionicons name="options-outline" size={14} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ── Hero card "BUGÜNKÜ ÖNERİN" ── */}
      <TouchableOpacity style={styles.heroCard} onPress={() => router.push("/(tabs)/outfit")} activeOpacity={0.95}>
        {/* Left: outfit photo */}
        <View style={styles.heroPhotoWrap}>
          {heroItem?.image_url ? (
            <CachedImage
              accessibilityLabel="Kombin önerisi"
              fallbackColor={heroItem.dominant_color_hex}
              sourceUri={heroItem.thumbnail_url ?? heroItem.image_url}
              style={styles.heroPhoto}
            />
          ) : (
            <View style={[styles.heroPhoto, styles.heroPhotoPlaceholder]}>
              <Ionicons name="shirt-outline" size={36} color={COLORS.textMuted} />
            </View>
          )}
          {/* AI badge */}
          <View style={styles.heroAiBadge}>
            <Ionicons name="sparkles" size={12} color={COLORS.accentText} />
          </View>
        </View>

        {/* Right: text */}
        <View style={styles.heroText}>
          <Text variant="caption" style={styles.heroLabel}>BUGÜNKÜ ÖNERİN</Text>
          <Text variant="h1" style={styles.heroTitle}>Zamansız{"\n"}Şıklık</Text>

          {/* Weather + city row */}
          <View style={styles.heroMeta}>
            {weather ? (
              <>
                <Ionicons name="partly-sunny-outline" size={13} color={COLORS.textMuted} />
                <Text variant="caption" color="muted">{weather.temp}°</Text>
              </>
            ) : null}
            {weather?.city ? (
              <>
                <View style={styles.metaDot} />
                <Ionicons name="location-outline" size={13} color={COLORS.textMuted} />
                <Text variant="caption" color="muted">{weather.city}</Text>
              </>
            ) : null}
          </View>

          {/* Style tags */}
          <View style={styles.heroTags}>
            {["Minimal", "Zarif", "Dengeli"].map(tag => (
              <View key={tag} style={styles.heroTag}>
                <Text variant="caption" color="secondary">{tag}</Text>
              </View>
            ))}
          </View>

          {/* Arrow CTA */}
          <View style={styles.heroArrow}>
            <Ionicons name="arrow-forward" size={18} color={COLORS.textInverse} />
          </View>
        </View>
      </TouchableOpacity>

      {/* ── Uyum Skoru ── */}
      <View style={styles.scoreCard}>
        <View style={styles.scoreCircleWrap}>
          <View style={styles.scoreCircle}>
            <Text variant="h2" style={styles.scoreValue}>%{styleScore}</Text>
          </View>
        </View>
        <View style={styles.scoreCopy}>
          <Text variant="caption" style={styles.scoreLabel}>UYUM SKORU</Text>
          <Text variant="body" color="secondary">
            {items.length > 0
              ? "Bu kombin senin stil tercihlerinle ve bugünkü hava durumuyla mükemmel uyum sağlıyor."
              : "Dolabına parça ekle, kişisel uyum skorunu hesaplayalım."}
          </Text>
        </View>
        <Ionicons name="sparkles-outline" size={20} color={COLORS.accentText} />
      </View>

      {/* ── Kaydedilen Kombinler ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text variant="h3">Kaydedilen Kombinler</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/outfit")} activeOpacity={0.7}>
            <Text variant="label" style={styles.seeAll}>Tümünü Gör &gt;</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kombinRow}>
          {savedOutfits.length > 0 ? (
            savedOutfits.slice(0, 4).map(saved => (
              <Pressable
                key={saved.outfit.id}
                style={styles.kombinCard}
                onPress={() => router.push(`/outfit/${saved.outfit.id}`)}
              >
                {saved.items[0]?.image_url ? (
                  <CachedImage
                    accessibilityLabel="Kombin"
                    fallbackColor={saved.items[0].dominant_color_hex}
                    sourceUri={saved.items[0].thumbnail_url ?? saved.items[0].image_url}
                    style={styles.kombinPhoto}
                  />
                ) : (
                  <View style={[styles.kombinPhoto, styles.kombinPhotoPlaceholder]}>
                    <Ionicons name="shirt-outline" size={20} color={COLORS.textMuted} />
                  </View>
                )}
                <View style={styles.kombinHeart}>
                  <Ionicons name={saved.outfit.is_favorite ? "heart" : "heart-outline"} size={14} color={saved.outfit.is_favorite ? COLORS.danger : COLORS.textInverse} />
                </View>
                <Text variant="caption" color="secondary" numberOfLines={2} style={styles.kombinName}>
                  {saved.outfit.name ?? "Kombin"}
                </Text>
              </Pressable>
            ))
          ) : (
            // Empty placeholders matching design
            ["Ofis Zarafeti", "Minimal Günler", "Akşam Işıltısı", "Hafta Sonu Rahatlığı"].map(name => (
              <TouchableOpacity
                key={name}
                style={styles.kombinCard}
                onPress={() => router.push("/(tabs)/outfit")}
                activeOpacity={0.8}
              >
                <View style={[styles.kombinPhoto, styles.kombinPhotoPlaceholder]}>
                  <Ionicons name="sparkles-outline" size={18} color={COLORS.textMuted} />
                </View>
                <View style={styles.kombinHeart}>
                  <Ionicons name="heart-outline" size={14} color={COLORS.textInverse} />
                </View>
                <Text variant="caption" color="secondary" numberOfLines={2} style={styles.kombinName}>
                  {name}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>

      {/* ── Stil İlhamın ── */}
      <TouchableOpacity style={styles.inspoCard} onPress={() => router.push("/social/feed")} activeOpacity={0.9}>
        <View style={styles.inspoLeft}>
          <Ionicons name="sparkles-outline" size={22} color={COLORS.accentText} />
          <View style={styles.inspoCopy}>
            <Text variant="h3">Stil İlhamın</Text>
            <Text variant="body" color="secondary">
              Bugün senin için seçtiğimiz stil ilham panosuna göz at.
            </Text>
          </View>
        </View>
        {/* Mini photo grid */}
        <View style={styles.inspoPhotos}>
          {recentItems.slice(0, 4).map((item, i) => (
            item.thumbnail_url || item.image_url ? (
              <CachedImage
                key={item.id}
                accessibilityLabel=""
                fallbackColor={item.dominant_color_hex}
                sourceUri={item.thumbnail_url ?? item.image_url}
                style={[styles.inspoThumb, i === 1 && styles.inspoThumbRight]}
              />
            ) : (
              <View key={item.id} style={[styles.inspoThumb, i === 1 && styles.inspoThumbRight, { backgroundColor: item.dominant_color_hex ?? COLORS.surfaceMuted }]} />
            )
          ))}
        </View>
        <View style={styles.inspoArrow}>
          <Ionicons name="arrow-forward" size={16} color={COLORS.textInverse} />
        </View>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 110 },

  // Header
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingTop: 56,
    paddingBottom: SPACING.md,
  },
  logoRow: { alignItems: "center", flexDirection: "row", gap: 6 },
  logoText: { fontFamily: FONTS.sansBold, letterSpacing: 0.3 },
  headerIcons: { alignItems: "center", flexDirection: "row", gap: SPACING.sm },
  iconBtn: { alignItems: "center", justifyContent: "center", padding: 4, position: "relative" },
  notifDot: {
    backgroundColor: COLORS.danger,
    borderColor: COLORS.background,
    borderRadius: 999,
    borderWidth: 1.5,
    height: 8,
    position: "absolute",
    right: 2,
    top: 2,
    width: 8,
  },

  // Greeting
  greetingBlock: {
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },

  // Destinations
  destinationBlock: { gap: SPACING.sm, paddingBottom: SPACING.md },
  destLabel: { paddingHorizontal: SPACING.lg },
  chipRow: { gap: SPACING.sm, paddingHorizontal: SPACING.lg },
  destChip: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
  },
  filterChip: { paddingHorizontal: 10 },

  // Hero card
  heroCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    marginHorizontal: SPACING.lg,
    overflow: "hidden",
    minHeight: 200,
  },
  heroPhotoWrap: { position: "relative", width: "42%" },
  heroPhoto: { height: "100%", width: "100%" },
  heroPhotoPlaceholder: {
    alignItems: "center",
    backgroundColor: COLORS.surfaceMuted,
    justifyContent: "center",
  },
  heroAiBadge: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    height: 28,
    justifyContent: "center",
    left: SPACING.sm,
    position: "absolute",
    top: SPACING.sm,
    width: 28,
  },
  heroText: {
    flex: 1,
    gap: SPACING.xs,
    justifyContent: "center",
    padding: SPACING.md,
  },
  heroLabel: {
    color: COLORS.accentText,
    fontFamily: FONTS.sansMedium,
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 26,
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  heroMeta: { alignItems: "center", flexDirection: "row", gap: 3 },
  metaDot: { backgroundColor: COLORS.border, borderRadius: 999, height: 3, width: 3 },
  heroTags: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  heroTag: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  heroArrow: {
    alignItems: "center",
    alignSelf: "flex-end",
    backgroundColor: COLORS.cta,
    borderRadius: 999,
    height: 32,
    justifyContent: "center",
    marginTop: SPACING.xs,
    width: 32,
  },

  // Score card
  scoreCard: {
    alignItems: "center",
    backgroundColor: COLORS.accentSoft,
    borderRadius: 20,
    flexDirection: "row",
    gap: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    padding: SPACING.md,
  },
  scoreCircleWrap: { alignItems: "center", justifyContent: "center" },
  scoreCircle: {
    alignItems: "center",
    borderColor: COLORS.accent,
    borderRadius: 999,
    borderStyle: "dashed",
    borderWidth: 2.5,
    height: 64,
    justifyContent: "center",
    width: 64,
  },
  scoreValue: { color: COLORS.accentText, fontFamily: FONTS.sansBold, fontSize: 18 },
  scoreLabel: {
    color: COLORS.accentText,
    fontFamily: FONTS.sansMedium,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  scoreCopy: { flex: 1, gap: 2 },

  // Sections
  section: { gap: SPACING.md, marginTop: SPACING.lg },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
  },
  seeAll: { color: COLORS.primary, fontFamily: FONTS.sansMedium },

  // Saved outfits
  kombinRow: { gap: SPACING.sm, paddingHorizontal: SPACING.lg },
  kombinCard: { gap: SPACING.xs, position: "relative", width: 110 },
  kombinPhoto: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 14,
    height: 130,
    width: 110,
  },
  kombinPhotoPlaceholder: { alignItems: "center", justifyContent: "center" },
  kombinHeart: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
    borderRadius: 999,
    height: 26,
    justifyContent: "center",
    position: "absolute",
    right: 6,
    top: 6,
    width: 26,
  },
  kombinName: { paddingHorizontal: 2, textAlign: "center" },

  // Inspiration card
  inspoCard: {
    alignItems: "center",
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 20,
    flexDirection: "row",
    gap: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    overflow: "hidden",
    padding: SPACING.md,
  },
  inspoLeft: { alignItems: "flex-start", flex: 1, flexDirection: "row", gap: SPACING.sm },
  inspoCopy: { flex: 1, gap: 3 },
  inspoPhotos: { flexDirection: "row", flexWrap: "wrap", gap: 3, width: 70 },
  inspoThumb: { backgroundColor: COLORS.border, borderRadius: 8, height: 32, width: 32 },
  inspoThumbRight: { marginLeft: 3 },
  inspoArrow: {
    alignItems: "center",
    backgroundColor: COLORS.cta,
    borderRadius: 999,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
});
