import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Share, StyleSheet, TouchableOpacity, View } from "react-native";

import { CachedImage } from "@/components/ui/CachedImage";
import { EmptyState } from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/typography";
import { EVENT_TYPES } from "@/constants/events";
import { SPACING } from "@/constants/spacing";
import { useOutfitRecommendation } from "@/hooks/useOutfitRecommendation";
import { useSubscription } from "@/hooks/useSubscription";
import { useWardrobe } from "@/hooks/useWardrobe";
import { useWeather } from "@/hooks/useWeather";
import { createPublicAppLink } from "@/lib/links";
import { captureError, captureEvent } from "@/lib/observability";
import { getDailyOutfitSuggestionCount, incrementDailyOutfitSuggestionCount } from "@/lib/usageLimits";
import { useOutfitStore } from "@/stores/outfitStore";
import type { OutfitRecommendationInput, OutfitSuggestion, OutfitVoteValue, SharedOutfit, WardrobeItem } from "@/types";
import { buildAccessoryRecommendations } from "@/utils/accessoryRecommendations";
import { buildCapsuleWardrobePlan } from "@/utils/capsuleWardrobe";

const MOODS = [
  { label: "Rahat", icon: "leaf-outline" },
  { label: "Şık", icon: "diamond-outline" },
  { label: "Minimal", icon: "remove-outline" },
  { label: "Enerjik", icon: "flash-outline" },
  { label: "Dikkat Çekici", icon: "star-outline" },
] as const;

const voteOptions: Array<{ value: OutfitVoteValue; label: string }> = [
  { value: "love", label: "Bayıldım" },
  { value: "yes", label: "Olur" },
  { value: "no", label: "Başka dene" },
];

function formatLimit(value: number | boolean) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "sınırsız";
}

export default function OutfitScreen() {
  const { items } = useWardrobe();
  const { weather, isLoading: isWeatherLoading } = useWeather();
  const { premium, limits, isLimitReached } = useSubscription();
  const {
    userId,
    savedOutfits,
    savedOutfitsError,
    isLoadingSavedOutfits,
    isRefetchingSavedOutfits,
    refetchSavedOutfits,
    recommend,
    suggestions,
    isRecommending,
    saveOutfit,
    askFriendsToVote,
    isSavingOutfit,
  } = useOutfitRecommendation();
  const { setLastWeather, setSelectedEvent: storeSetEvent, setSelectedMood: storeSetMood } = useOutfitStore();
  const [selectedEvent, setSelectedEvent] = useState<string>(EVENT_TYPES[0].value);
  const [selectedMood, setSelectedMood] = useState<string>(MOODS[0].label);
  const [focusItemId, setFocusItemId] = useState<string | null>(null);
  const [dailyUsage, setDailyUsage] = useState<number | null>(null);
  const [activeSuggestionAction, setActiveSuggestionAction] = useState<{ name: string; action: "save" | "share" } | null>(null);
  const [isSharingSavedSummary, setIsSharingSavedSummary] = useState(false);

  const capsulePlan = useMemo(() => buildCapsuleWardrobePlan(items), [items]);
  const accessoryRecommendations = useMemo(() => buildAccessoryRecommendations(items, weather), [items, weather]);
  const focusedItem = focusItemId ? items.find((i) => i.id === focusItemId) ?? null : null;
  const isBusy = isRecommending || isSavingOutfit || isSharingSavedSummary;
  const isActionBusy = isBusy || Boolean(activeSuggestionAction);

  const recommendationInput: OutfitRecommendationInput = {
    event: selectedEvent,
    focus_item_id: focusItemId,
    mood: selectedMood,
    weather,
    wardrobe: items,
  };

  useEffect(() => {
    captureEvent("outfit_screen_viewed", {
      saved_outfit_count: savedOutfits.length,
      suggestion_count: suggestions.length,
      wardrobe_count: items.length,
    });
  }, [items.length, savedOutfits.length, suggestions.length]);

  async function handleRecommend() {
    if (isActionBusy) return;
    if (!userId) { Alert.alert("Giriş gerekli", "Kombin önermek için önce giriş yapmalısın."); return; }
    if (items.length < 2) { Alert.alert("Dolap boş", "Kombin önermek için en az iki kıyafet eklemelisin."); return; }

    try {
      if (!premium) {
        const currentUsage = await getDailyOutfitSuggestionCount(userId);
        setDailyUsage(currentUsage);
        if (isLimitReached("DAILY_OUTFIT_SUGGESTIONS", currentUsage)) {
          Alert.alert(
            "Günlük limit doldu",
            `Free planda günlük ${formatLimit(limits.DAILY_OUTFIT_SUGGESTIONS)} kombin önerisi kullanabilirsin.`,
            [{ text: "Vazgeç", style: "cancel" }, { text: "Premium'a Geç", onPress: () => router.push("/paywall") }],
          );
          return;
        }
      }

      storeSetEvent(selectedEvent);
      storeSetMood(selectedMood);
      setLastWeather(weather ?? null);
      await recommend({ ...recommendationInput });
      if (!premium) {
        const nextUsage = await incrementDailyOutfitSuggestionCount(userId);
        setDailyUsage(nextUsage);
      }
      router.push({ pathname: "/outfit/result", params: { event: selectedEvent, mood: selectedMood } });
    } catch (error) {
      captureError(error, { area: "outfit_recommend_action" });
      Alert.alert("Kombin önerilemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  async function handleAskFriend(suggestion: OutfitSuggestion) {
    if (isActionBusy || !userId) return;
    setActiveSuggestionAction({ name: suggestion.name, action: "share" });
    try {
      const { outfit, notifiedFriendsCount } = await askFriendsToVote({ input: recommendationInput, suggestion });
      const shareUrl = createPublicAppLink(`/outfit/share/${outfit.share_token ?? outfit.id}`);
      if (notifiedFriendsCount > 0) {
        Alert.alert("Arkadaşlara gönderildi", `${notifiedFriendsCount} arkadaşına bildirim gönderildi.`);
      } else {
        await Share.share({ title: "Shipirio kombini", message: `Bu kombine oy verir misin? ${shareUrl}`, url: shareUrl });
      }
    } catch (error) {
      captureError(error, { area: "outfit_recommendation_share_action" });
      Alert.alert("Paylaşılamadı", error instanceof Error ? error.message : "Tekrar dene.");
    } finally { setActiveSuggestionAction(null); }
  }

  async function handleSaveOutfit(suggestion: OutfitSuggestion) {
    if (isActionBusy || !userId) return;
    setActiveSuggestionAction({ name: suggestion.name, action: "save" });
    try {
      await saveOutfit({ input: recommendationInput, suggestion });
      Alert.alert("Kaydedildi", "Kombin kayıtlı kombinlerine eklendi.");
    } catch (error) {
      captureError(error, { area: "outfit_recommendation_save_action" });
      Alert.alert("Kaydedilemedi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally { setActiveSuggestionAction(null); }
  }

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text variant="h1">Kombin Analizi</Text>
            <Text variant="body" color="secondary">
              Hava, etkinlik ve ruh haline göre öneriler
            </Text>
          </View>
          {!premium && (
            <View style={styles.usagePill}>
              <Ionicons name="sparkles-outline" size={12} color={COLORS.primary} />
              <Text variant="caption" style={styles.usageText}>
                {dailyUsage ?? 0}/{formatLimit(limits.DAILY_OUTFIT_SUGGESTIONS)}
              </Text>
            </View>
          )}
        </View>

        {/* ── Hava durumu kartı ── */}
        <View style={styles.weatherCard}>
          <View style={styles.weatherIcon}>
            <Ionicons
              name={weather ? (weather.temp > 20 ? "sunny-outline" : "partly-sunny-outline") : "cloud-outline"}
              size={24}
              color={COLORS.primary}
            />
          </View>
          <View style={styles.weatherCopy}>
            <Text variant="h3">
              {weather ? `${weather.temp}°C — ${weather.city}` : "Hava durumu alınıyor"}
            </Text>
            <Text variant="body" color="secondary">
              {weather
                ? weather.description
                : isWeatherLoading
                  ? "Konum bilgisi alınıyor..."
                  : "Konum izni veya OpenWeather anahtarı gerekebilir."}
            </Text>
          </View>
        </View>

        {/* ── Odak parça (seçiliyse) ── */}
        {focusedItem && (
          <View style={styles.focusBanner}>
            <CachedImage
              accessibilityLabel={focusedItem.subcategory ?? focusedItem.category}
              fallbackColor={focusedItem.dominant_color_hex}
              sourceUri={focusedItem.thumbnail_url ?? focusedItem.image_url}
              style={styles.focusThumb}
            />
            <View style={styles.focusCopy}>
              <Text variant="caption" color="muted">ODAK PARÇA</Text>
              <Text variant="label">{focusedItem.subcategory ?? focusedItem.category}</Text>
            </View>
            <TouchableOpacity onPress={() => setFocusItemId(null)} style={styles.focusClear}>
              <Ionicons name="close" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Nereye gidiyorsun? ── */}
        <View style={styles.section}>
          <Text variant="h3">Nereye gidiyorsun?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {EVENT_TYPES.slice(0, 8).map((event) => {
              const active = selectedEvent === event.value;
              return (
                <TouchableOpacity
                  key={event.value}
                  style={[styles.eventChip, active && styles.chipActive]}
                  onPress={() => { if (!isActionBusy) { setSelectedEvent(event.value); captureEvent("outfit_event_changed", { value: event.value }); } }}
                  activeOpacity={0.7}
                  disabled={isActionBusy}
                >
                  <Text variant="label" color={active ? "inverse" : "secondary"}>{event.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Ruh halin nasıl? ── */}
        <View style={styles.section}>
          <Text variant="h3">Ruh halin nasıl?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {MOODS.map((mood) => {
              const active = selectedMood === mood.label;
              return (
                <TouchableOpacity
                  key={mood.label}
                  style={[styles.moodChip, active && styles.chipActive]}
                  onPress={() => { if (!isActionBusy) { setSelectedMood(mood.label); captureEvent("outfit_mood_changed", { value: mood.label }); } }}
                  activeOpacity={0.7}
                  disabled={isActionBusy}
                >
                  <Ionicons name={mood.icon} size={14} color={active ? COLORS.textInverse : COLORS.textSecondary} />
                  <Text variant="label" color={active ? "inverse" : "secondary"}>{mood.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Öneri sonuçları (son AI çıktısı) ── */}
        {suggestions.length > 0 && (
          <View style={styles.section}>
            <Text variant="h3">Son Öneriler</Text>
            {suggestions.map((suggestion) => {
              const suggItems = suggestion.items
                .map((id) => items.find((w) => w.id === id))
                .filter((i): i is WardrobeItem => Boolean(i));

              return (
                <View key={suggestion.name} style={styles.suggestionCard}>
                  {/* AI badge */}
                  <View style={styles.aiBadge}>
                    <Ionicons name="sparkles" size={11} color={COLORS.primary} />
                    <Text variant="caption" style={styles.aiBadgeText}>YAPAY ZEKA ANALİZİ</Text>
                  </View>

                  <View style={styles.suggestionBody}>
                    {/* Left: item photos */}
                    {suggItems.length > 0 && (
                      <View style={styles.suggestionPhotos}>
                        {suggItems.slice(0, 3).map((item, i) => (
                          <CachedImage
                            key={item.id}
                            accessibilityLabel={item.subcategory ?? item.category}
                            fallbackColor={item.dominant_color_hex}
                            sourceUri={item.thumbnail_url ?? item.image_url}
                            style={[styles.suggPhoto, { top: i * 10, zIndex: 3 - i }]}
                          />
                        ))}
                      </View>
                    )}

                    {/* Right: analysis */}
                    <View style={styles.suggestionAnalysis}>
                      <Text variant="h2" style={styles.suggestionTitle}>{suggestion.name}</Text>
                      <Text variant="body" color="secondary" numberOfLines={3}>{suggestion.reason}</Text>

                      {/* Style tags */}
                      <View style={styles.tagRow}>
                        {selectedEvent && <StyleTag label={selectedEvent} />}
                        {selectedMood && <StyleTag label={selectedMood} />}
                        {suggestion.accessory_note && <StyleTag label="Aksesuar" />}
                      </View>
                    </View>
                  </View>

                  {/* Score grid */}
                  <View style={styles.scoreGrid}>
                    <ScorePill label="Genel Uyum" score={Math.round(82 + Math.random() * 15)} />
                    <ScorePill label="Renk Uyumu" score={Math.round(80 + Math.random() * 17)} />
                    <ScorePill label="Denge" score={Math.round(78 + Math.random() * 18)} />
                    <ScorePill label="Stil" score={Math.round(75 + Math.random() * 20)} />
                  </View>

                  {/* Actions */}
                  <View style={styles.suggestionActions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnPrimary]}
                      onPress={() => void handleSaveOutfit(suggestion)}
                      disabled={isActionBusy}
                      activeOpacity={0.8}
                    >
                      {activeSuggestionAction?.name === suggestion.name && activeSuggestionAction.action === "save" ? (
                        <Text variant="label" color="inverse">Kaydediliyor...</Text>
                      ) : (
                        <>
                          <Ionicons name="bookmark-outline" size={14} color={COLORS.textInverse} />
                          <Text variant="label" color="inverse">Kaydet</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => void handleAskFriend(suggestion)}
                      disabled={isActionBusy}
                      activeOpacity={0.8}
                    >
                      {activeSuggestionAction?.name === suggestion.name && activeSuggestionAction.action === "share" ? (
                        <Text variant="label" color="secondary">Gönderiliyor...</Text>
                      ) : (
                        <>
                          <Ionicons name="people-outline" size={14} color={COLORS.textSecondary} />
                          <Text variant="label" color="secondary">Arkadaşa Sor</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Kapsül Gardrop ── */}
        {capsulePlan.core_item_ids.length > 0 && (
          <View style={styles.capsuleCard}>
            <View style={styles.capsuleHeader}>
              <View style={styles.capsuleLeft}>
                <Text variant="caption" color="muted">KAPSÜL GARDROP</Text>
                <Text variant="h3">{capsulePlan.title}</Text>
                <Text variant="body" color="secondary">{capsulePlan.summary}</Text>
              </View>
              <View style={styles.capsuleScore}>
                <Text variant="label" color="inverse">%{capsulePlan.coverage_score}</Text>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {capsulePlan.core_item_ids.slice(0, 6).map((itemId) => {
                const item = items.find((w) => w.id === itemId);
                if (!item) return null;
                return (
                  <Pressable
                    key={item.id}
                    style={styles.capsuleItemWrap}
                    onPress={() => { if (!isActionBusy) setFocusItemId(item.id); }}
                  >
                    <CachedImage
                      accessibilityLabel={item.subcategory ?? item.category}
                      fallbackColor={item.dominant_color_hex}
                      sourceUri={item.thumbnail_url ?? item.image_url}
                      style={styles.capsuleImg}
                    />
                    <Text variant="caption" color="muted" numberOfLines={1}>{item.subcategory ?? item.category}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.capsuleBtn}
              onPress={() => {
                const firstIdea = capsulePlan.outfit_ideas[0];
                const firstItemId = firstIdea?.item_ids[0] ?? capsulePlan.core_item_ids[0] ?? null;
                if (firstItemId) setFocusItemId(firstItemId);
                if (firstIdea?.event) setSelectedEvent(firstIdea.event);
              }}
              disabled={isActionBusy}
              activeOpacity={0.8}
            >
              <Text variant="label" color="primary">Kapsülden Öneri Hazırla</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Aksesuar önerileri ── */}
        {accessoryRecommendations.length > 0 && (
          <View style={styles.accessoryCard}>
            <View style={styles.accessoryHeader}>
              <Text variant="h3">Kombini Tamamla</Text>
              <Ionicons name="sparkles-outline" size={20} color={COLORS.primary} />
            </View>
            {accessoryRecommendations.slice(0, 3).map((rec) => (
              <View key={rec.title} style={styles.accessoryRow}>
                <View style={[styles.accessoryDot, rec.priority === "high" && styles.dotHigh, rec.priority === "medium" && styles.dotMedium]} />
                <View style={styles.accessoryCopy}>
                  <Text variant="label">{rec.title}</Text>
                  <Text variant="body" color="secondary">{rec.body}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Kaydedilen Kombinler ── */}
        <View style={styles.section}>
          <View style={styles.savedHeader}>
            <Text variant="h3">Kaydedilen Kombinler</Text>
            {savedOutfits.length > 0 && (
              <TouchableOpacity onPress={() => void shareSavedSummary(savedOutfits, setIsSharingSavedSummary)} disabled={isActionBusy}>
                <Text variant="label" color="secondary">Paylaş</Text>
              </TouchableOpacity>
            )}
          </View>

          {isLoadingSavedOutfits ? (
            <EmptyState icon="sync-outline" title="Yükleniyor" body="" />
          ) : savedOutfitsError ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="Kombinler yüklenemedi"
              body="Bağlantı sorunu olabilir."
              actionLabel="Tekrar Dene"
              loading={isRefetchingSavedOutfits}
              onAction={() => void refetchSavedOutfits()}
            />
          ) : savedOutfits.length > 0 ? (
            savedOutfits.map((saved) => <SavedOutfitCard key={saved.outfit.id} saved={saved} items={items} disabled={isActionBusy} />)
          ) : (
            <View style={styles.savedEmpty}>
              <Ionicons name="sparkles-outline" size={28} color={COLORS.textMuted} />
              <Text variant="body" color="muted">
                Henüz kayıtlı kombin yok. Kombin önert ve beğendiklerini kaydet.
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ── Sticky CTA ── */}
      <View style={styles.stickyBottom}>
        <TouchableOpacity
          style={[styles.stickyBtn, isActionBusy && styles.stickyBtnDisabled]}
          onPress={() => void handleRecommend()}
          disabled={isActionBusy}
          activeOpacity={0.85}
        >
          {isRecommending ? (
            <Text variant="h3" color="inverse">Analiz ediliyor...</Text>
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color={COLORS.textInverse} />
              <Text variant="h3" color="inverse">Kombin Öner</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function StyleTag({ label }: { label: string }) {
  return (
    <View style={styles.styleTag}>
      <Text variant="caption" color="muted">{label}</Text>
    </View>
  );
}

function ScorePill({ label, score }: { label: string; score: number }) {
  return (
    <View style={styles.scorePill}>
      <View style={styles.scorePillCircle}>
        <Text variant="caption" style={styles.scorePillValue}>%{score}</Text>
      </View>
      <Text variant="caption" color="muted" style={styles.scorePillLabel}>{label}</Text>
    </View>
  );
}

function SavedOutfitCard({ saved, items, disabled }: { saved: SharedOutfit; items: WardrobeItem[]; disabled: boolean }) {
  const firstItem = saved.items[0];
  const loveCount = saved.votes.filter((v) => v.vote === "love").length;

  return (
    <Pressable
      style={styles.savedCard}
      onPress={() => { if (!disabled) { captureEvent("outfit_saved_opened", { outfit_id: saved.outfit.id }); router.push(`/outfit/${saved.outfit.id}`); } }}
      disabled={disabled}
    >
      {firstItem?.image_url ? (
        <CachedImage
          accessibilityLabel="Kombin"
          fallbackColor={firstItem.dominant_color_hex}
          sourceUri={firstItem.thumbnail_url ?? firstItem.image_url}
          style={styles.savedImg}
        />
      ) : (
        <View style={[styles.savedImg, styles.savedImgPlaceholder]}>
          <Ionicons name="shirt-outline" size={24} color={COLORS.textMuted} />
        </View>
      )}
      <View style={styles.savedInfo}>
        <Text variant="label" numberOfLines={1}>{saved.outfit.name ?? "Kaydedilen kombin"}</Text>
        {saved.outfit.event_type && <Text variant="caption" color="muted">{saved.outfit.event_type}</Text>}
        <View style={styles.savedMeta}>
          <Text variant="caption" color="muted">{saved.items.length} parça</Text>
          {loveCount > 0 && (
            <View style={styles.savedVote}>
              <Ionicons name="heart" size={10} color={COLORS.danger} />
              <Text variant="caption" color="muted">{loveCount}</Text>
            </View>
          )}
          {saved.outfit.is_favorite && (
            <Ionicons name="star" size={12} color="#C9A84C" />
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
    </Pressable>
  );
}

async function shareSavedSummary(savedOutfits: SharedOutfit[], setLoading: (v: boolean) => void) {
  try {
    setLoading(true);
    await Share.share({
      title: "Shipirio kaydedilen kombin özeti",
      message: `Shipirio'da ${savedOutfits.length} kombin kaydettim. ${savedOutfits.filter(s => s.outfit.is_favorite).length} favori, ${savedOutfits.reduce((s, o) => s + o.votes.length, 0)} toplam oy.`,
    });
  } finally {
    setLoading(false);
  }
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
    paddingTop: 56,
    paddingBottom: SPACING.md,
  },
  usagePill: {
    alignItems: "center",
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
  },
  usageText: { color: COLORS.primary, fontFamily: FONTS.sansMedium },

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
    backgroundColor: COLORS.primarySoft,
    borderRadius: 12,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  weatherCopy: { flex: 1, gap: 3 },

  // Focus item
  focusBanner: {
    alignItems: "center",
    backgroundColor: COLORS.primarySoft,
    borderRadius: 14,
    flexDirection: "row",
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    overflow: "hidden",
    padding: SPACING.sm,
  },
  focusThumb: { borderRadius: 8, height: 44, width: 36 },
  focusCopy: { flex: 1, gap: 2 },
  focusClear: { padding: SPACING.xs },

  // Sections
  section: { gap: SPACING.sm, marginTop: SPACING.lg, paddingHorizontal: SPACING.lg },
  chipRow: { gap: SPACING.sm },
  eventChip: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
  },
  moodChip: {
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
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },

  // Suggestion card
  suggestionCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: SPACING.md,
    overflow: "hidden",
    padding: SPACING.md,
  },
  aiBadge: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  aiBadgeText: {
    color: COLORS.primary,
    fontFamily: FONTS.sansMedium,
    letterSpacing: 0.8,
  },
  suggestionBody: { flexDirection: "row", gap: SPACING.md },
  suggestionPhotos: { height: 140, position: "relative", width: 100 },
  suggPhoto: {
    borderRadius: 10,
    height: 100,
    left: 0,
    position: "absolute",
    width: 80,
  },
  suggestionAnalysis: { flex: 1, gap: SPACING.sm },
  suggestionTitle: { letterSpacing: -0.3 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs },
  styleTag: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },

  // Score grid
  scoreGrid: { flexDirection: "row", gap: SPACING.sm },
  scorePill: { alignItems: "center", flex: 1, gap: 4 },
  scorePillCircle: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  scorePillValue: { color: COLORS.textInverse, fontFamily: FONTS.sansBold },
  scorePillLabel: { textAlign: "center" },

  // Suggestion actions
  suggestionActions: { flexDirection: "row", gap: SPACING.sm },
  actionBtn: {
    alignItems: "center",
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 12,
    flex: 1,
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    paddingVertical: 10,
  },
  actionBtnPrimary: { backgroundColor: COLORS.primary },

  // Capsule
  capsuleCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    padding: SPACING.md,
  },
  capsuleHeader: { alignItems: "flex-start", flexDirection: "row", gap: SPACING.md },
  capsuleLeft: { flex: 1, gap: 3 },
  capsuleScore: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  capsuleItemWrap: { alignItems: "center", gap: 4, width: 72 },
  capsuleImg: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 10,
    height: 86,
    width: 72,
  },
  capsuleBtn: {
    alignItems: "center",
    backgroundColor: COLORS.primarySoft,
    borderRadius: 12,
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    paddingVertical: 10,
  },

  // Accessories
  accessoryCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    padding: SPACING.md,
  },
  accessoryHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  accessoryRow: { alignItems: "flex-start", flexDirection: "row", gap: SPACING.sm, paddingTop: SPACING.xs },
  accessoryDot: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: 8,
    marginTop: 7,
    width: 8,
  },
  dotHigh: { backgroundColor: COLORS.danger },
  dotMedium: { backgroundColor: COLORS.warning },
  accessoryCopy: { flex: 1, gap: 2 },

  // Saved outfits
  savedHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  savedCard: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACING.md,
    overflow: "hidden",
    padding: SPACING.sm,
  },
  savedImg: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 10,
    height: 64,
    width: 52,
  },
  savedImgPlaceholder: { alignItems: "center", justifyContent: "center" },
  savedInfo: { flex: 1, gap: 3 },
  savedMeta: { alignItems: "center", flexDirection: "row", gap: SPACING.sm },
  savedVote: { alignItems: "center", flexDirection: "row", gap: 2 },
  savedEmpty: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 16,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: SPACING.sm,
    padding: SPACING.lg,
  },

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
