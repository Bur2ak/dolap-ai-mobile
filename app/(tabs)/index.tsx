import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

import { CachedImage } from "@/components/ui/CachedImage";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useOutfitDiary } from "@/hooks/useOutfitDiary";
import { useWardrobe } from "@/hooks/useWardrobe";
import { captureEvent } from "@/lib/observability";
import { useAuthStore } from "@/stores/authStore";

const DESTINATIONS = [
  { label: "Ofis", icon: "briefcase-outline" },
  { label: "Kahve", icon: "cafe-outline" },
  { label: "Alışveriş", icon: "bag-outline" },
  { label: "Hafta Sonu", icon: "sunny-outline" },
  { label: "Gece", icon: "moon-outline" },
  { label: "Spor", icon: "fitness-outline" },
] as const;

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Günaydın";
  if (hour < 18) return "İyi öğleden sonralar";
  return "İyi akşamlar";
}

export default function HomeScreen() {
  const { profile } = useAuthStore();
  const { items } = useWardrobe();
  const { entries, todayEntry } = useOutfitDiary();

  const firstName = profile?.username?.split(" ")[0] ?? profile?.username ?? "Hoş geldin";
  const recentItems = items.slice(0, 6);
  const recentEntries = entries.slice(0, 3);

  useEffect(() => {
    captureEvent("home_screen_viewed", { item_count: items.length });
  }, [items.length]);

  function handleDestinationTap(label: string) {
    captureEvent("home_destination_tapped", { destination: label });
    router.push("/(tabs)/outfit");
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Ionicons name="shirt-outline" size={20} color={COLORS.primary} />
          <Text variant="h3" style={styles.logoText}>Shipirio</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => router.push("/notifications")}
          >
            <Ionicons name="notifications-outline" size={22} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => router.push("/style-chat")}
          >
            <Ionicons name="sparkles-outline" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Greeting */}
      <View style={styles.greetingSection}>
        <Text variant="h1">{getGreeting()}, {firstName} 💜</Text>
        <Text variant="body" color="secondary">
          {todayEntry ? "Bugünkü kombin kaydedildi." : "Bugün ne giyeceğini birlikte seçelim."}
        </Text>
      </View>

      {/* Destination chips */}
      <View style={styles.destinationSection}>
        <Text variant="label" color="secondary">Bugün nereye gidiyorsun?</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {DESTINATIONS.map((dest) => (
            <TouchableOpacity
              key={dest.label}
              style={styles.destinationChip}
              onPress={() => handleDestinationTap(dest.label)}
              activeOpacity={0.7}
            >
              <Ionicons name={dest.icon} size={14} color={COLORS.textSecondary} />
              <Text variant="label" color="secondary">{dest.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Today's outfit / Hero card */}
      <View style={styles.heroCard}>
        <View style={styles.heroBadge}>
          <Text variant="caption" color="muted" style={styles.heroBadgeText}>
            BUGÜNÜN ÖNERİSİ
          </Text>
        </View>

        <View style={styles.heroContent}>
          {/* Left: outfit image or color swatch */}
          <View style={styles.heroImageWrap}>
            {todayEntry && todayEntry.item_ids.length > 0 ? (
              <View style={styles.heroSwatches}>
                {todayEntry.item_ids.slice(0, 3).map((id, i) => {
                  const item = items.find((it) => it.id === id);
                  return item ? (
                    <CachedImage
                      key={id}
                      accessibilityLabel="Kıyafet"
                      fallbackColor={item.dominant_color_hex}
                      sourceUri={item.thumbnail_url ?? item.image_url}
                      style={[styles.heroItemImg, { marginTop: i * 8, zIndex: 3 - i }]}
                    />
                  ) : null;
                })}
              </View>
            ) : recentItems[0] ? (
              <CachedImage
                accessibilityLabel="Kombin önerisi"
                fallbackColor={recentItems[0].dominant_color_hex}
                sourceUri={recentItems[0].thumbnail_url ?? recentItems[0].image_url}
                style={styles.heroSingleImg}
              />
            ) : (
              <View style={[styles.heroSingleImg, styles.heroPlaceholder]}>
                <Ionicons name="shirt-outline" size={32} color={COLORS.textMuted} />
              </View>
            )}
          </View>

          {/* Right: text info */}
          <View style={styles.heroText}>
            <Text variant="h2" style={styles.heroTitle}>
              {todayEntry?.mood ?? "Zamansız Şıklık"}
            </Text>
            <View style={styles.heroTags}>
              {["Minimalist", "Zarif", "Dengeli"].map((tag) => (
                <View key={tag} style={styles.heroTag}>
                  <Text variant="caption" color="muted">{tag}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={styles.heroButton}
              onPress={() => router.push("/(tabs)/outfit")}
              activeOpacity={0.8}
            >
              <Text variant="label" color="inverse">Kombini Gör</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Uyum skoru */}
      {items.length > 0 && (
        <View style={styles.scoreCard}>
          <View style={styles.scoreCircle}>
            <Text variant="h2" color="inverse">%{Math.round(Math.min(100, (items.filter(i => i.wear_count > 0).length / items.length) * 100 + 40))}</Text>
          </View>
          <View style={styles.scoreCopy}>
            <Text variant="caption" color="muted">UYUM SKORU</Text>
            <Text variant="h3">
              {items.length > 5 ? "Dolabın iyi dengelenmiş" : "Daha fazla parça ekle"}
            </Text>
            <Text variant="body" color="secondary">
              {items.filter(i => i.wear_count > 0).length}/{items.length} parça kullanımda
            </Text>
          </View>
        </View>
      )}

      {/* Kaydedilen kombinler / Son eklenenler */}
      {recentItems.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="h3">Son Eklenenler</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/wardrobe")}>
              <Text variant="label" color="secondary">Tümünü Gör</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.itemsRow}>
            {recentItems.map((item) => (
              <Pressable
                key={item.id}
                style={styles.itemThumb}
                onPress={() => router.push(`/item/${item.id}`)}
              >
                <CachedImage
                  accessibilityLabel={item.subcategory ?? item.category}
                  fallbackColor={item.dominant_color_hex}
                  sourceUri={item.thumbnail_url ?? item.image_url}
                  style={styles.itemThumbImg}
                />
                <Text variant="caption" color="secondary" numberOfLines={1} style={styles.itemThumbLabel}>
                  {item.subcategory ?? item.category}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Günlük aktivite / Stil ilhamın */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text variant="h3">Stil İlhamın</Text>
          <TouchableOpacity onPress={() => router.push("/outfit-diary")}>
            <Text variant="label" color="secondary">Günlük →</Text>
          </TouchableOpacity>
        </View>

        {recentEntries.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {recentEntries.map((entry) => (
              <View key={entry.id} style={styles.inspoCard}>
                <Text variant="label">{entry.worn_at}</Text>
                {entry.mood ? (
                  <Text variant="caption" color="muted">{entry.mood}</Text>
                ) : null}
                {entry.rating ? (
                  <Text variant="caption" color="muted">{"★".repeat(entry.rating)}</Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        ) : (
          <TouchableOpacity
            style={styles.inspoEmpty}
            onPress={() => router.push("/outfit-diary")}
            activeOpacity={0.8}
          >
            <Ionicons name="book-outline" size={24} color={COLORS.textMuted} />
            <Text variant="body" color="muted">Giyim günlüğünü başlat</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Hızlı aksiyonlar */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.qaCard}
          onPress={() => router.push("/item/add")}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle-outline" size={24} color={COLORS.primary} />
          <Text variant="label" color="primary">Parça Ekle</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.qaCard}
          onPress={() => router.push("/style-chat")}
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={24} color={COLORS.primary} />
          <Text variant="label" color="primary">Stil Asistanı</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.qaCard}
          onPress={() => router.push("/outfit-diary")}
          activeOpacity={0.8}
        >
          <Ionicons name="calendar-outline" size={24} color={COLORS.primary} />
          <Text variant="label" color="primary">Günlük</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 100 },

  // Header
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingTop: 56,
    paddingBottom: SPACING.sm,
  },
  logoRow: { alignItems: "center", flexDirection: "row", gap: 6 },
  logoText: { letterSpacing: 0.5 },
  headerActions: { flexDirection: "row", gap: SPACING.sm },
  headerIcon: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },

  // Greeting
  greetingSection: {
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },

  // Destinations
  destinationSection: { gap: SPACING.sm, paddingTop: SPACING.sm },
  chips: { gap: SPACING.sm, paddingHorizontal: SPACING.lg },
  destinationChip: {
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

  // Hero card
  heroCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    overflow: "hidden",
    padding: SPACING.md,
  },
  heroBadge: { marginBottom: SPACING.sm },
  heroBadgeText: { letterSpacing: 1.2 },
  heroContent: { flexDirection: "row", gap: SPACING.md },
  heroImageWrap: { width: 110 },
  heroSwatches: { height: 140, position: "relative" },
  heroItemImg: {
    borderRadius: 10,
    height: 90,
    left: 0,
    position: "absolute",
    width: 80,
  },
  heroSingleImg: {
    borderRadius: 12,
    height: 140,
    width: "100%",
  },
  heroPlaceholder: {
    alignItems: "center",
    backgroundColor: COLORS.surfaceMuted,
    justifyContent: "center",
  },
  heroText: { flex: 1, gap: SPACING.sm, justifyContent: "center" },
  heroTitle: { letterSpacing: -0.5 },
  heroTags: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs },
  heroTag: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  heroButton: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    alignSelf: "flex-start",
    marginTop: SPACING.xs,
  },

  // Score card
  scoreCard: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    padding: SPACING.md,
  },
  scoreCircle: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: 72,
    justifyContent: "center",
    width: 72,
  },
  scoreCopy: { flex: 1, gap: 3 },

  // Sections
  section: { gap: SPACING.md, marginTop: SPACING.lg },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
  },
  itemsRow: { gap: SPACING.sm, paddingHorizontal: SPACING.lg },
  itemThumb: { gap: SPACING.xs, width: 80 },
  itemThumbImg: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 12,
    height: 100,
    width: 80,
  },
  itemThumbLabel: { textAlign: "center" },

  // Inspiration
  inspoCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    minWidth: 120,
    padding: SPACING.md,
  },
  inspoEmpty: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 14,
    borderStyle: "dashed",
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    padding: SPACING.md,
  },

  // Quick actions
  quickActions: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
  },
  qaCard: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
  },
});
