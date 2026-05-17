import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Share, StyleSheet, TouchableOpacity, View } from "react-native";

import { CachedImage } from "@/components/ui/CachedImage";
import { EmptyState } from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { FONTS, FONT_SIZE } from "@/constants/typography";
import { EVENT_TYPES } from "@/constants/events";
import { SPACING } from "@/constants/spacing";
import { useOutfitRecommendation } from "@/hooks/useOutfitRecommendation";
import { useSubscription } from "@/hooks/useSubscription";
import { useWardrobe } from "@/hooks/useWardrobe";
import { useWardrobeAnalytics } from "@/hooks/useWardrobeAnalytics";
import { useWeather } from "@/hooks/useWeather";
import { createPublicAppLink } from "@/lib/links";
import { captureError, captureEvent } from "@/lib/observability";
import { getDailyOutfitSuggestionCount, incrementDailyOutfitSuggestionCount } from "@/lib/usageLimits";
import { useOutfitStore } from "@/stores/outfitStore";
import type { OutfitRecommendationInput, OutfitSuggestion, OutfitVoteValue, SharedOutfit, WardrobeItem } from "@/types";
import { buildAccessoryRecommendations } from "@/utils/accessoryRecommendations";
import { buildCapsuleWardrobePlan } from "@/utils/capsuleWardrobe";

const MOODS = [
  { label: "Rahat", icon: "leaf-outline" as const },
  { label: "Şık", icon: "diamond-outline" as const },
  { label: "Minimal", icon: "remove-outline" as const },
  { label: "Enerjik", icon: "flash-outline" as const },
  { label: "Dikkat Çekici", icon: "star-outline" as const },
];

const voteOptions: Array<{ value: OutfitVoteValue; label: string }> = [
  { value: "love", label: "Bayıldım" },
  { value: "yes", label: "Olur" },
  { value: "no", label: "Başka dene" },
];

function formatLimit(v: number | boolean) {
  return typeof v === "number" && Number.isFinite(v) ? String(v) : "sınırsız";
}

export default function OutfitScreen() {
  const { items } = useWardrobe();
  const { analytics } = useWardrobeAnalytics();
  const { weather, isLoading: isWeatherLoading } = useWeather();
  const { premium, limits, isLimitReached } = useSubscription();
  const {
    userId, savedOutfits, savedOutfitsError, isLoadingSavedOutfits,
    isRefetchingSavedOutfits, refetchSavedOutfits, recommend, suggestions,
    isRecommending, saveOutfit, askFriendsToVote, isSavingOutfit,
  } = useOutfitRecommendation();
  const { setLastWeather, setSelectedEvent: storeSetEvent, setSelectedMood: storeSetMood } = useOutfitStore();

  const [selectedEvent, setSelectedEvent] = useState<string>(EVENT_TYPES[0].value);
  const [selectedMood, setSelectedMood] = useState<string>(MOODS[0].label);
  const [focusItemId, setFocusItemId] = useState<string | null>(null);
  const [dailyUsage, setDailyUsage] = useState<number | null>(null);
  const [activeSuggestionAction, setActiveSuggestionAction] = useState<{ name: string; action: "save" | "share" } | null>(null);
  const [isSharingSavedSummary, setIsSharingSavedSummary] = useState(false);

  const accessoryRecommendations = useMemo(() => buildAccessoryRecommendations(items, weather), [items, weather]);
  const isBusy = isRecommending || isSavingOutfit || isSharingSavedSummary;
  const isActionBusy = isBusy || Boolean(activeSuggestionAction);

  // Scores from real wardrobe analytics
  const scores = [
    { label: "Genel Uyum", value: analytics.utilization_score || 0 },
    { label: "Renk Uyumu", value: analytics.style_profile?.confidence || 0 },
    { label: "Denge ve Oran", value: analytics.sustainability_score || 0 },
    { label: "Vücut Tipine Uyum", value: Math.round(((analytics.utilization_score || 0) + (analytics.sustainability_score || 0)) / 2) || 0 },
  ];

  const recommendationInput: OutfitRecommendationInput = {
    event: selectedEvent, focus_item_id: focusItemId,
    mood: selectedMood, weather, wardrobe: items,
  };

  useEffect(() => {
    captureEvent("outfit_screen_viewed", { saved_outfit_count: savedOutfits.length, suggestion_count: suggestions.length, wardrobe_count: items.length });
  }, [items.length, savedOutfits.length, suggestions.length]);

  async function handleRecommend() {
    if (isActionBusy) return;
    if (!userId) { Alert.alert("Giriş gerekli", "Kombin önermek için önce giriş yapmalısın."); return; }
    if (items.length < 2) { Alert.alert("Dolap boş", "En az iki kıyafet eklemelisin."); return; }
    try {
      if (!premium) {
        const cur = await getDailyOutfitSuggestionCount(userId);
        setDailyUsage(cur);
        if (isLimitReached("DAILY_OUTFIT_SUGGESTIONS", cur)) {
          Alert.alert("Günlük limit doldu", `Free planda günlük ${formatLimit(limits.DAILY_OUTFIT_SUGGESTIONS)} öneri kullanabilirsin.`,
            [{ text: "Vazgeç", style: "cancel" }, { text: "Premium'a Geç", onPress: () => router.push("/paywall") }]);
          return;
        }
      }
      storeSetEvent(selectedEvent); storeSetMood(selectedMood); setLastWeather(weather ?? null);
      await recommend({ ...recommendationInput });
      if (!premium) { const next = await incrementDailyOutfitSuggestionCount(userId); setDailyUsage(next); }
      router.push({ pathname: "/outfit/result", params: { event: selectedEvent, mood: selectedMood } });
    } catch (err) {
      captureError(err, { area: "outfit_recommend_action" });
      Alert.alert("Kombin önerilemedi", err instanceof Error ? err.message : "Tekrar dene.");
    }
  }

  async function handleSaveOutfit(suggestion: OutfitSuggestion) {
    if (isActionBusy || !userId) return;
    setActiveSuggestionAction({ name: suggestion.name, action: "save" });
    try {
      await saveOutfit({ input: recommendationInput, suggestion });
      Alert.alert("Kaydedildi", "Kombin kayıtlı kombinlerine eklendi.");
    } catch (err) {
      captureError(err, { area: "outfit_save" });
      Alert.alert("Kaydedilemedi", err instanceof Error ? err.message : "Tekrar dene.");
    } finally { setActiveSuggestionAction(null); }
  }

  async function handleAskFriend(suggestion: OutfitSuggestion) {
    if (isActionBusy || !userId) return;
    setActiveSuggestionAction({ name: suggestion.name, action: "share" });
    try {
      const { outfit, notifiedFriendsCount } = await askFriendsToVote({ input: recommendationInput, suggestion });
      const url = createPublicAppLink(`/outfit/share/${outfit.share_token ?? outfit.id}`);
      if (notifiedFriendsCount > 0) Alert.alert("Gönderildi", `${notifiedFriendsCount} arkadaşına bildirim gönderildi.`);
      else await Share.share({ title: "Shipirio kombini", message: `Bu kombine oy verir misin? ${url}`, url });
    } catch (err) {
      captureError(err, { area: "outfit_share" });
      Alert.alert("Paylaşılamadı", err instanceof Error ? err.message : "Tekrar dene.");
    } finally { setActiveSuggestionAction(null); }
  }

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text variant="h1">Kombin Analiz</Text>
            <Text variant="body" color="secondary">Yapay zekâ kombinini analiz eder, stil dengesini ortaya çıkarır.</Text>
          </View>
          {!premium && (
            <View style={styles.usagePill}>
              <Ionicons name="sparkles-outline" size={12} color={COLORS.accentText} />
              <Text variant="caption" style={styles.usageText}>{dailyUsage ?? 0}/{formatLimit(limits.DAILY_OUTFIT_SUGGESTIONS)}</Text>
            </View>
          )}
        </View>

        {/* ── Son analiz sonucu (suggestions varsa) ── */}
        {suggestions.length > 0 && suggestions.map((suggestion) => {
          const suggItems = suggestion.items.map(id => items.find(w => w.id === id)).filter((i): i is WardrobeItem => Boolean(i));
          const heroItem = suggItems[0] ?? null;

          return (
            <View key={suggestion.name} style={styles.analysisBlock}>
              {/* Hero card */}
              <View style={styles.heroCard}>
                <View style={styles.heroPhotoWrap}>
                  {heroItem?.image_url ? (
                    <CachedImage accessibilityLabel="" fallbackColor={heroItem.dominant_color_hex}
                      sourceUri={heroItem.thumbnail_url ?? heroItem.image_url} style={styles.heroPhoto} />
                  ) : (
                    <View style={[styles.heroPhoto, styles.heroPlaceholder]}>
                      <Ionicons name="shirt-outline" size={32} color={COLORS.textMuted} />
                    </View>
                  )}
                  <View style={styles.heroAiBadge}>
                    <Ionicons name="sparkles" size={12} color={COLORS.accentText} />
                  </View>
                </View>
                <View style={styles.heroRight}>
                  <Text variant="caption" style={styles.heroLabel}>YAPAY ZEKÂ ANALİZİ</Text>
                  <Text variant="h1" style={styles.heroTitle}>{suggestion.name}</Text>
                  <Text variant="body" color="secondary" style={styles.heroDesc} numberOfLines={3}>{suggestion.reason}</Text>
                  <View style={styles.heroTags}>
                    {[selectedEvent, selectedMood, "Dengeli"].filter(Boolean).slice(0, 4).map(tag => (
                      <View key={tag} style={styles.heroTag}>
                        <Text variant="caption" color="secondary">{tag}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>

              {/* 4 score circles */}
              <View style={styles.scoreRow}>
                {scores.map((s) => (
                  <View key={s.label} style={styles.scoreCard}>
                    <Text variant="caption" color="secondary" style={styles.scoreTitle} numberOfLines={2}>{s.label}</Text>
                    <View style={[styles.scoreCircle, s.value === 0 && styles.scoreCircleEmpty]}>
                      <Text variant="label" style={styles.scoreValue}>{s.value > 0 ? `%${s.value}` : "–"}</Text>
                    </View>
                    <Ionicons name="sparkles-outline" size={12} color={COLORS.accentText} />
                  </View>
                ))}
              </View>

              {/* Stil Önerileri */}
              <View style={styles.stilCard}>
                <View style={styles.stilHeader}>
                  <Ionicons name="sparkles-outline" size={16} color={COLORS.accentText} />
                  <Text variant="h3" style={styles.stilTitle}>Stil Önerileri</Text>
                </View>
                {accessoryRecommendations.slice(0, 3).map((rec) => (
                  <View key={rec.title} style={styles.stilRow}>
                    <View style={[styles.stilDot, rec.priority === "high" && styles.stilDotHigh]}>
                      <Ionicons name="shirt-outline" size={12} color={COLORS.textInverse} />
                    </View>
                    <Text variant="body" color="secondary" style={styles.stilText}>{rec.body}</Text>
                  </View>
                ))}
                {accessoryRecommendations.length === 0 && (
                  <Text variant="body" color="secondary">Bu kombin için aksesuar önerisi yok.</Text>
                )}
              </View>

              {/* Suggestion actions */}
              <View style={styles.suggActions}>
                <TouchableOpacity style={styles.suggBtn} onPress={() => void handleSaveOutfit(suggestion)} disabled={isActionBusy} activeOpacity={0.8}>
                  <Ionicons name="bookmark-outline" size={14} color={COLORS.primary} />
                  <Text variant="label">{activeSuggestionAction?.name === suggestion.name && activeSuggestionAction.action === "save" ? "Kaydediliyor..." : "Kaydet"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.suggBtn, styles.suggBtnGhost]} onPress={() => void handleAskFriend(suggestion)} disabled={isActionBusy} activeOpacity={0.8}>
                  <Ionicons name="people-outline" size={14} color={COLORS.textSecondary} />
                  <Text variant="label" color="secondary">Arkadaşa Sor</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* ── Hava durumu ── */}
        <View style={styles.weatherCard}>
          <View style={styles.weatherIcon}>
            <Ionicons name={weather && weather.temp > 20 ? "sunny-outline" : "partly-sunny-outline"} size={22} color={COLORS.primary} />
          </View>
          <View style={styles.weatherCopy}>
            <Text variant="h3">{weather ? `${weather.temp}°C — ${weather.city}` : "Hava durumu alınıyor"}</Text>
            <Text variant="body" color="secondary">{weather ? weather.description : isWeatherLoading ? "Konum bilgisi alınıyor..." : "Konum izni gerekebilir."}</Text>
          </View>
        </View>

        {/* ── Nereye gidiyorsun? ── */}
        <View style={styles.section}>
          <Text variant="h3">Nereye gidiyorsun?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {EVENT_TYPES.slice(0, 7).map((ev) => {
              const active = selectedEvent === ev.value;
              return (
                <TouchableOpacity key={ev.value} style={[styles.chip, active && styles.chipActive]}
                  onPress={() => { if (!isActionBusy) { setSelectedEvent(ev.value); captureEvent("outfit_event_changed", { value: ev.value }); } }}
                  disabled={isActionBusy} activeOpacity={0.7}>
                  <Text variant="label" style={active ? styles.chipTextActive : styles.chipText}>{ev.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Ruh halin nasıl? ── */}
        <View style={styles.section}>
          <Text variant="h3">Ruh halin nasıl?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {MOODS.map((m) => {
              const active = selectedMood === m.label;
              return (
                <TouchableOpacity key={m.label} style={[styles.chip, active && styles.chipActive]}
                  onPress={() => { if (!isActionBusy) { setSelectedMood(m.label); captureEvent("outfit_mood_changed", { value: m.label }); } }}
                  disabled={isActionBusy} activeOpacity={0.7}>
                  <Ionicons name={m.icon} size={13} color={active ? COLORS.accentText : COLORS.textSecondary} />
                  <Text variant="label" style={active ? styles.chipTextActive : styles.chipText}>{m.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Kaydedilen Kombinler ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="h3">Kaydedilen Kombinler</Text>
            {savedOutfits.length > 0 && (
              <TouchableOpacity onPress={async () => {
                setIsSharingSavedSummary(true);
                try { await Share.share({ title: "Shipirio kombinler", message: `${savedOutfits.length} kombini kaydetim.` }); }
                finally { setIsSharingSavedSummary(false); }
              }} disabled={isActionBusy}>
                <Text variant="label" style={styles.seeAll}>Tümünü Gör</Text>
              </TouchableOpacity>
            )}
          </View>

          {isLoadingSavedOutfits ? (
            <EmptyState icon="sync-outline" title="Yükleniyor" body="" />
          ) : savedOutfitsError ? (
            <EmptyState icon="cloud-offline-outline" title="Yüklenemedi" body="" actionLabel="Tekrar Dene" loading={isRefetchingSavedOutfits} onAction={() => void refetchSavedOutfits()} />
          ) : savedOutfits.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedRow}>
              {savedOutfits.slice(0, 6).map((saved) => (
                <SavedOutfitCard key={saved.outfit.id} saved={saved} items={items} disabled={isActionBusy} />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.savedEmpty}>
              <Ionicons name="sparkles-outline" size={24} color={COLORS.textMuted} />
              <Text variant="body" color="muted">Henüz kayıtlı kombin yok.</Text>
            </View>
          )}
        </View>

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* ── Sticky CTA ── */}
      <View style={styles.stickyBottom}>
        <TouchableOpacity style={[styles.stickyBtn, isActionBusy && styles.stickyBtnDisabled]}
          onPress={() => void handleRecommend()} disabled={isActionBusy} activeOpacity={0.85}>
          <Ionicons name="sparkles" size={18} color={COLORS.textInverse} />
          <Text variant="h3" color="inverse">{isRecommending ? "Analiz ediliyor..." : "Kombin Öner"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SavedOutfitCard({ saved, items, disabled }: { saved: SharedOutfit; items: WardrobeItem[]; disabled: boolean }) {
  const firstItem = saved.items[0];
  const loveCount = saved.votes.filter(v => v.vote === "love").length;
  return (
    <Pressable style={styles.savedCard} onPress={() => { if (!disabled) router.push(`/outfit/${saved.outfit.id}`); }} disabled={disabled}>
      {firstItem?.image_url ? (
        <CachedImage accessibilityLabel="" fallbackColor={firstItem.dominant_color_hex} sourceUri={firstItem.thumbnail_url ?? firstItem.image_url} style={styles.savedImg} />
      ) : (
        <View style={[styles.savedImg, { alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surfaceMuted }]}>
          <Ionicons name="shirt-outline" size={20} color={COLORS.textMuted} />
        </View>
      )}
      <View style={styles.savedHeart}>
        <Ionicons name={saved.outfit.is_favorite ? "heart" : "heart-outline"} size={12} color={saved.outfit.is_favorite ? COLORS.danger : COLORS.textInverse} />
      </View>
      <Text variant="caption" color="secondary" numberOfLines={2} style={styles.savedName}>{saved.outfit.name ?? "Kombin"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: COLORS.background, flex: 1 },
  scroll: { flex: 1 },
  content: { paddingBottom: 20 },

  // Header
  header: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingTop: 60,
    paddingBottom: SPACING.md,
  },
  usagePill: {
    alignItems: "center",
    backgroundColor: COLORS.accentSoft,
    borderRadius: 999,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
  },
  usageText: { color: COLORS.accentText, fontFamily: FONTS.sansMedium },

  // Analysis block
  analysisBlock: { gap: SPACING.md, marginBottom: SPACING.sm },

  // Hero card
  heroCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    height: 220,
    marginHorizontal: SPACING.lg,
    overflow: "hidden",
  },
  heroPhotoWrap: { height: 220, position: "relative", width: "42%" },
  heroPhoto: { height: 220, width: "100%" },
  heroPlaceholder: { alignItems: "center", backgroundColor: COLORS.surfaceMuted, justifyContent: "center" },
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
  heroRight: { flex: 1, gap: SPACING.xs, justifyContent: "center", padding: SPACING.md },
  heroLabel: { color: COLORS.accentText, fontFamily: FONTS.sansMedium, letterSpacing: 0.8 },
  heroTitle: { fontFamily: FONTS.displayBold, fontSize: 22, letterSpacing: -0.3, lineHeight: 26 },
  heroDesc: { fontSize: FONT_SIZE.caption, lineHeight: 16 },
  heroTags: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  heroTag: { backgroundColor: COLORS.accentSoft, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },

  // Score row
  scoreRow: { flexDirection: "row", gap: SPACING.sm, paddingHorizontal: SPACING.lg },
  scoreCard: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    paddingHorizontal: 4,
  },
  scoreTitle: { fontSize: 10, textAlign: "center", fontFamily: FONTS.sansMedium },
  scoreCircle: {
    alignItems: "center",
    borderColor: COLORS.accent,
    borderRadius: 999,
    borderWidth: 2,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  scoreCircleEmpty: { borderStyle: "dashed", borderColor: COLORS.textMuted },
  scoreValue: { color: COLORS.accentText, fontFamily: FONTS.sansBold, fontSize: 13 },

  // Stil Önerileri
  stilCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    padding: SPACING.md,
  },
  stilHeader: { alignItems: "center", flexDirection: "row", gap: SPACING.xs },
  stilTitle: { color: COLORS.accentText, fontFamily: FONTS.sansBold },
  stilRow: { alignItems: "flex-start", flexDirection: "row", gap: SPACING.sm },
  stilDot: {
    alignItems: "center",
    backgroundColor: COLORS.cta,
    borderRadius: 999,
    flexShrink: 0,
    height: 24,
    justifyContent: "center",
    marginTop: 1,
    width: 24,
  },
  stilDotHigh: { backgroundColor: COLORS.danger },
  stilText: { flex: 1, fontSize: FONT_SIZE.body },

  // Suggestion actions
  suggActions: {
    flexDirection: "row",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  suggBtn: {
    alignItems: "center",
    backgroundColor: COLORS.primarySoft,
    borderRadius: 12,
    flex: 1,
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    paddingVertical: 10,
  },
  suggBtnGhost: { backgroundColor: COLORS.surfaceMuted },

  // Weather
  weatherCard: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACING.md,
    marginHorizontal: SPACING.lg,
    padding: SPACING.md,
  },
  weatherIcon: {
    alignItems: "center",
    backgroundColor: COLORS.accentSoft,
    borderRadius: 12,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  weatherCopy: { flex: 1, gap: 3 },

  // Sections
  section: { gap: SPACING.sm, paddingHorizontal: SPACING.lg },
  sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  seeAll: { color: COLORS.primary, fontFamily: FONTS.sansMedium },
  chipRow: { gap: SPACING.sm },

  // Chips — lavender active
  chip: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: COLORS.accentSoft, borderColor: COLORS.accent },
  chipText: { color: COLORS.textSecondary, fontFamily: FONTS.sansMedium, fontSize: FONT_SIZE.label },
  chipTextActive: { color: COLORS.accentText, fontFamily: FONTS.sansBold, fontSize: FONT_SIZE.label },

  // Saved outfits
  savedRow: { gap: SPACING.sm },
  savedCard: { position: "relative", width: 100 },
  savedImg: { backgroundColor: COLORS.surfaceMuted, borderRadius: 12, height: 120, width: 100 },
  savedHeart: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
    borderRadius: 999,
    height: 24,
    justifyContent: "center",
    position: "absolute",
    right: 6,
    top: 6,
    width: 24,
  },
  savedName: { marginTop: 4, textAlign: "center" },
  savedEmpty: { alignItems: "center", flexDirection: "row", gap: SPACING.sm, paddingVertical: SPACING.md },

  // Sticky CTA
  stickyBottom: {
    backgroundColor: COLORS.background,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    padding: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  stickyBtn: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    flexDirection: "row",
    gap: SPACING.sm,
    justifyContent: "center",
    minHeight: 56,
  },
  stickyBtnDisabled: { opacity: 0.55 },
});
