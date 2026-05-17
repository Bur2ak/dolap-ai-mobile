import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Share } from "react-native";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CachedImage } from "@/components/ui/CachedImage";
import { EmptyState } from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
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
import type { AccessoryRecommendation } from "@/utils/accessoryRecommendations";
import { buildAccessoryRecommendations } from "@/utils/accessoryRecommendations";
import { buildCapsuleWardrobePlan } from "@/utils/capsuleWardrobe";

const moods = ["Rahat", "Sik", "Dikkat cekici", "Minimal", "Enerjik"];
const voteOptions: Array<{ value: OutfitVoteValue; label: string }> = [
  { value: "love", label: "Bayildim" },
  { value: "yes", label: "Olur" },
  { value: "no", label: "Baska dene" },
];

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
  const [selectedMood, setSelectedMood] = useState(moods[0]);
  const [focusItemId, setFocusItemId] = useState<string | null>(null);
  const [dailyUsage, setDailyUsage] = useState<number | null>(null);
  const [activeSuggestionAction, setActiveSuggestionAction] = useState<{ name: string; action: "save" | "share" } | null>(null);
  const [isSharingSavedSummary, setIsSharingSavedSummary] = useState(false);
  const repeatCandidate = useMemo(() => getRepeatCandidate(items), [items]);
  const capsulePlan = useMemo(() => buildCapsuleWardrobePlan(items), [items]);
  const accessoryRecommendations = useMemo(() => buildAccessoryRecommendations(items, weather), [items, weather]);
  const focusedItem = focusItemId ? items.find((item) => item.id === focusItemId) ?? null : null;
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
      accessory_recommendation_count: accessoryRecommendations.length,
      capsule_idea_count: capsulePlan.outfit_ideas.length,
      saved_outfit_count: savedOutfits.length,
      suggestion_count: suggestions.length,
      wardrobe_count: items.length,
      weather_available: Boolean(weather),
    });
  }, [accessoryRecommendations.length, capsulePlan.outfit_ideas.length, items.length, savedOutfits.length, suggestions.length, weather]);

  async function handleRecommend() {
    if (isActionBusy) {
      return;
    }

    if (!userId) {
      Alert.alert("Giris gerekli", "Kombin onermek icin once giris yapmalisin.");
      return;
    }

    if (items.length < 2) {
      Alert.alert("Dolap bos", "Kombin onermek icin once en az iki kiyafet eklemelisin.");
      return;
    }

    try {
      if (!premium) {
        const currentUsage = await getDailyOutfitSuggestionCount(userId);
        setDailyUsage(currentUsage);
        if (isLimitReached("DAILY_OUTFIT_SUGGESTIONS", currentUsage)) {
          Alert.alert(
            "Gunluk limit doldu",
            `Free planda gunluk ${formatLimit(limits.DAILY_OUTFIT_SUGGESTIONS)} kombin onerisi kullanabilirsin.`,
            [
              { text: "Vazgec", style: "cancel" },
              { text: "Premium'a Gec", onPress: () => router.push("/paywall") },
            ],
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
      captureError(error, { area: "outfit_recommend_action", event: selectedEvent, mood: selectedMood });
      Alert.alert("Kombin onerilemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  async function handleAskFriend(suggestion: OutfitSuggestion) {
    if (isActionBusy) {
      return;
    }

    if (!userId) {
      Alert.alert("Giris gerekli", "Kombini paylasmak icin once giris yapmalisin.");
      return;
    }

    setActiveSuggestionAction({ name: suggestion.name, action: "share" });
    try {
      const { outfit, notifiedFriendsCount } = await askFriendsToVote({
        input: recommendationInput,
        suggestion,
      });
      const shareUrl = createPublicAppLink(`/outfit/share/${outfit.share_token ?? outfit.id}`);
      if (notifiedFriendsCount > 0) {
        Alert.alert("Arkadaslara gonderildi", `${notifiedFriendsCount} arkadasina kombin oyu bildirimi gonderildi.`);
      } else {
        await Share.share({
          title: "Shipirio kombini",
          message: `Bu kombine oy verir misin? ${shareUrl}`,
          url: shareUrl,
        });
      }
      captureEvent("outfit_recommendation_shared", { notified_friends_count: notifiedFriendsCount, item_count: suggestion.items.length });
    } catch (error) {
      captureError(error, { area: "outfit_recommendation_share_action", item_count: suggestion.items.length });
      Alert.alert("Paylasilamadi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setActiveSuggestionAction(null);
    }
  }

  async function handleSaveOutfit(suggestion: OutfitSuggestion) {
    if (isActionBusy) {
      return;
    }

    if (!userId) {
      Alert.alert("Giris gerekli", "Kombini kaydetmek icin once giris yapmalisin.");
      return;
    }

    setActiveSuggestionAction({ name: suggestion.name, action: "save" });
    try {
      await saveOutfit({
        input: recommendationInput,
        suggestion,
      });
      captureEvent("outfit_recommendation_saved_from_tab", { item_count: suggestion.items.length });
      Alert.alert("Kaydedildi", "Kombin kayitli kombinlerine eklendi.");
    } catch (error) {
      captureError(error, { area: "outfit_recommendation_save_action", item_count: suggestion.items.length });
      Alert.alert("Kaydedilemedi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setActiveSuggestionAction(null);
    }
  }

  async function handleShareSavedOutfitsSummary() {
    if (isActionBusy) {
      return;
    }

    if (savedOutfits.length === 0) {
      Alert.alert("Ozet hazir degil", "Paylasilabilir kombin ozeti icin once bir kombin kaydet.");
      return;
    }

    try {
      setIsSharingSavedSummary(true);
      const result = await Share.share({
        title: "Shipirio kayitli kombin ozeti",
        message: buildSavedOutfitsSummary(savedOutfits),
      });
      captureEvent("outfit_saved_summary_shared", {
        action: result.action,
        completed: result.action === Share.sharedAction,
        saved_count: savedOutfits.length,
      });
    } catch (error) {
      captureError(error, { area: "outfit_saved_summary_share" });
      Alert.alert("Ozet paylasilamadi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setIsSharingSavedSummary(false);
    }
  }

  function handleUseCapsule() {
    if (isActionBusy) {
      return;
    }

    const firstIdea = capsulePlan.outfit_ideas[0];
    const firstItemId = firstIdea?.item_ids[0] ?? capsulePlan.core_item_ids[0] ?? null;

    if (firstItemId) {
      setFocusItemId(firstItemId);
    }

    if (firstIdea?.event) {
      setSelectedEvent(firstIdea.event);
    }
    captureEvent("outfit_capsule_applied", { has_focus_item: Boolean(firstItemId), idea_count: capsulePlan.outfit_ideas.length });
  }

  return (
    <View style={styles.rootContainer}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="h1">Kombin</Text>
      <Text variant="body" color="secondary">
        Hava, etkinlik ve ruh haline gore dolabindan oneriler.
      </Text>

      <Card style={styles.weather}>
        <Ionicons name="partly-sunny-outline" size={28} color={COLORS.primary} />
        <View>
          <Text variant="h3">{weather ? `${weather.temp} C, ${weather.city}` : "Hava durumu hazir degil"}</Text>
          <Text variant="body" color="secondary">
            {weather ? weather.description : isWeatherLoading ? "Konum ve hava bilgisi aliniyor." : "OpenWeather anahtari veya konum izni gerekebilir."}
          </Text>
        </View>
      </Card>

      {!premium ? (
        <Card style={styles.usageCard}>
          <View style={styles.usageCopy}>
            <Text variant="caption" color="muted">
              FREE LIMIT
            </Text>
            <Text variant="body" color="secondary">
              Gunluk kombin hakkini kullandikca burada takip edebilirsin.
            </Text>
          </View>
          <View style={styles.usageBadge}>
            <Text variant="label" color="inverse">
              {dailyUsage ?? 0}/{formatLimit(limits.DAILY_OUTFIT_SUGGESTIONS)}
            </Text>
          </View>
        </Card>
      ) : null}

      {repeatCandidate ? (
        <Card style={styles.repeatCard}>
          <View style={styles.repeatHeader}>
            <View style={styles.repeatCopy}>
              <Text variant="caption" color="muted">
                TEKRAR GIY ONERISI
              </Text>
              <Text variant="h3">{repeatCandidate.subcategory ?? repeatCandidate.category}</Text>
              <Text variant="body" color="secondary">
                {getRepeatReason(repeatCandidate)}
              </Text>
            </View>
            <CachedImage
              accessibilityLabel={repeatCandidate.subcategory ?? repeatCandidate.category}
              fallbackColor={repeatCandidate.dominant_color_hex}
              sourceUri={repeatCandidate.thumbnail_url ?? repeatCandidate.image_url}
              style={styles.repeatImage}
            />
          </View>
          <View style={styles.repeatActions}>
            <Button
              title={focusItemId === repeatCandidate.id ? "Odak Secildi" : "Bu Parcayla Oner"}
              variant="secondary"
              onPress={() => {
                if (isActionBusy) {
                  return;
                }

                setFocusItemId(repeatCandidate.id);
                captureEvent("outfit_focus_item_selected", { source: "repeat_candidate" });
              }}
              disabled={isActionBusy}
            />
            {focusItemId ? (
              <Button
                title="Odagi Kaldir"
                variant="ghost"
                onPress={() => {
                  setFocusItemId(null);
                  captureEvent("outfit_focus_item_cleared");
                }}
                disabled={isActionBusy}
              />
            ) : null}
          </View>
        </Card>
      ) : null}

      {focusedItem ? (
        <Card style={styles.focusNotice}>
          <Ionicons name="sparkles-outline" size={22} color={COLORS.primary} />
          <Text variant="body" color="secondary" style={styles.focusText}>
            Kombin onerileri {focusedItem.subcategory ?? focusedItem.category} parcasini one alacak.
          </Text>
        </Card>
      ) : null}

      {capsulePlan.core_item_ids.length > 0 ? (
        <Card style={styles.capsuleCard}>
          <View style={styles.capsuleHeader}>
            <View style={styles.repeatCopy}>
              <Text variant="caption" color="muted">
                KAPSUL GARDROP
              </Text>
              <Text variant="h3">{capsulePlan.title}</Text>
              <Text variant="body" color="secondary">
                {capsulePlan.summary}
              </Text>
            </View>
            <View style={styles.capsuleScore}>
              <Text variant="label" color="inverse">
                %{capsulePlan.coverage_score}
              </Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.capsuleItems}>
            {capsulePlan.core_item_ids.map((itemId) => {
              const item = items.find((wardrobeItem) => wardrobeItem.id === itemId);
              if (!item) {
                return null;
              }

              return (
                <Pressable
                  key={item.id}
                  style={styles.capsuleItem}
                  onPress={() => {
                    if (isActionBusy) {
                      return;
                    }

                    setFocusItemId(item.id);
                    captureEvent("outfit_focus_item_selected", { source: "capsule_core" });
                  }}
                  disabled={isActionBusy}
                >
                  <CachedImage
                    accessibilityLabel={item.subcategory ?? item.category}
                    fallbackColor={item.dominant_color_hex}
                    sourceUri={item.thumbnail_url ?? item.image_url}
                    style={styles.capsuleImage}
                  />
                  <Text variant="caption" color="secondary" style={styles.suggestionItemLabel}>
                    {item.subcategory ?? item.category}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {capsulePlan.outfit_ideas.length > 0 ? (
            <View style={styles.capsuleIdeas}>
              {capsulePlan.outfit_ideas.map((idea) => (
                <Pressable
                  key={idea.name}
                  style={styles.capsuleIdea}
                  disabled={isActionBusy}
                  onPress={() => {
                    if (isActionBusy) {
                      return;
                    }

                    setSelectedEvent(idea.event);
                    setFocusItemId(idea.item_ids[0] ?? null);
                    captureEvent("outfit_capsule_idea_selected", { item_count: idea.item_ids.length });
                  }}
                >
                  <Text variant="label">{idea.name}</Text>
                  <Text variant="caption" color="muted">
                    {idea.item_ids.length} parca - {idea.reason}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Button title="Kapsulden Oneri Hazirla" variant="secondary" onPress={handleUseCapsule} disabled={isActionBusy} />
        </Card>
      ) : null}

      {accessoryRecommendations.length > 0 ? (
        <Card style={styles.accessoryCard}>
          <View style={styles.accessoryHeader}>
            <View style={styles.repeatCopy}>
              <Text variant="caption" color="muted">
                AKSESUAR ONERILERI
              </Text>
              <Text variant="h3">Kombini tamamla</Text>
            </View>
            <Ionicons name="sparkles-outline" size={24} color={COLORS.primary} />
          </View>

          {accessoryRecommendations.map((recommendation) => (
            <Pressable
              key={`${recommendation.title}-${recommendation.priority}`}
              style={styles.accessoryRow}
              onPress={() => {
                if (isActionBusy) {
                  return;
                }

                const firstItemId = recommendation.item_ids[0];
                if (firstItemId) {
                  setFocusItemId(firstItemId);
                }
                captureEvent("outfit_accessory_recommendation_selected", {
                  has_item: Boolean(firstItemId),
                  priority: recommendation.priority,
                });
              }}
              disabled={isActionBusy}
            >
              <View style={[styles.priorityDot, getPriorityDotStyle(recommendation.priority)]} />
              <View style={styles.accessoryCopy}>
                <Text variant="label">{recommendation.title}</Text>
                <Text variant="body" color="secondary">
                  {recommendation.body}
                </Text>
                {recommendation.item_ids.length > 0 ? (
                  <Text variant="caption" color="muted">
                    {getAccessoryItemLabels(recommendation.item_ids, items)}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </Card>
      ) : null}

      <Text variant="h3">Nereye gidiyorsun?</Text>
      <View style={styles.wrap}>
        {EVENT_TYPES.slice(0, 6).map((event) => (
          <Pressable
            key={event.value}
            style={[styles.chip, selectedEvent === event.value && styles.activeChip]}
            onPress={() => {
              if (isActionBusy) {
                return;
              }

              setSelectedEvent(event.value);
              captureEvent("outfit_preference_changed", { field: "event", value: event.value });
            }}
            disabled={isActionBusy}
          >
            <Text variant="label" color={selectedEvent === event.value ? "inverse" : "secondary"}>
              {event.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text variant="h3">Ruh halin nasil?</Text>
      <View style={styles.wrap}>
        {moods.map((mood) => (
          <Pressable
            key={mood}
            style={[styles.chip, selectedMood === mood && styles.activeChip]}
            onPress={() => {
              if (isActionBusy) {
                return;
              }

              setSelectedMood(mood);
              captureEvent("outfit_preference_changed", { field: "mood", value: mood });
            }}
            disabled={isActionBusy}
          >
            <Text variant="label" color={selectedMood === mood ? "inverse" : "secondary"}>
              {mood}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.results}>
        {suggestions.map((suggestion) => {
          const suggestionItems = suggestion.items
            .map((itemId) => items.find((wardrobeItem) => wardrobeItem.id === itemId))
            .filter((item): item is WardrobeItem => Boolean(item));

          return (
            <Card key={suggestion.name} style={styles.suggestion}>
              <Text variant="h3">{suggestion.name}</Text>
              <Text variant="body" color="secondary">
                {suggestion.reason}
              </Text>
              {suggestion.accessory_note ? (
                <Text variant="caption" color="muted">
                  {suggestion.accessory_note}
                </Text>
              ) : null}
              <Text variant="caption" color="muted">
                {suggestion.items.length} parca
              </Text>
              {suggestionItems.length > 0 ? (
                <View style={styles.suggestionItems}>
                  {suggestionItems.map((item) => (
                    <View key={item.id} style={styles.suggestionItem}>
                      <CachedImage
                        accessibilityLabel={item.subcategory ?? item.category}
                        fallbackColor={item.dominant_color_hex}
                        sourceUri={item.thumbnail_url ?? item.image_url}
                        style={styles.suggestionImage}
                      />
                      <Text variant="caption" color="secondary" style={styles.suggestionItemLabel}>
                        {item.subcategory ?? item.category}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={styles.suggestionActions}>
                <Button
                  title="Kaydet"
                  variant="secondary"
                  onPress={() => void handleSaveOutfit(suggestion)}
                  loading={activeSuggestionAction?.name === suggestion.name && activeSuggestionAction.action === "save"}
                  disabled={isActionBusy}
                />
                <Button
                  title="Arkadasa Sor"
                  variant="ghost"
                  onPress={() => void handleAskFriend(suggestion)}
                  loading={activeSuggestionAction?.name === suggestion.name && activeSuggestionAction.action === "share"}
                  disabled={isActionBusy}
                />
              </View>
            </Card>
          );
        })}
      </View>

      {/* Spacer so content doesn't hide under sticky CTA */}
      <View style={styles.ctaSpacer} />

      <View style={styles.results}>
        <View style={styles.savedHeader}>
          <View style={styles.savedHeaderCopy}>
            <Text variant="h3">Kayitli kombinler</Text>
            <Text variant="caption" color="muted">
              {savedOutfits.length} kayit - {savedOutfits.filter((saved) => saved.outfit.is_favorite).length} favori
            </Text>
          </View>
          <Button
            title="Ozet"
            variant="secondary"
            onPress={() => void handleShareSavedOutfitsSummary()}
            loading={isSharingSavedSummary}
            disabled={isActionBusy || savedOutfits.length === 0}
            style={styles.savedSummaryButton}
          />
        </View>
        {isLoadingSavedOutfits ? (
          <EmptyState icon="sync-outline" title="Kombinler yukleniyor" body="Kayitli kombinlerin hazirlaniyor." />
        ) : savedOutfitsError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Kombinler yuklenemedi"
            body="Baglanti veya Supabase tarafinda gecici bir sorun olabilir."
            actionLabel="Tekrar Dene"
            loading={isRefetchingSavedOutfits}
            onAction={() => {
              if (isActionBusy) {
                return;
              }

              captureEvent("outfit_saved_refetch_requested");
              void refetchSavedOutfits();
            }}
          />
        ) : savedOutfits.length > 0 ? (
          savedOutfits.map((saved) => (
            <Pressable
              key={saved.outfit.id}
              onPress={() => {
                if (isActionBusy) {
                  return;
                }

                captureEvent("outfit_saved_opened", { outfit_id: saved.outfit.id, item_count: saved.items.length });
                router.push(`/outfit/${saved.outfit.id}`);
              }}
              disabled={isActionBusy}
            >
              <Card style={styles.suggestion}>
                <Text variant="h3">{saved.outfit.name ?? "Kayitli kombin"}</Text>
                <Text variant="body" color="secondary">
                  {saved.outfit.ai_reasoning ?? "Kaydedilen kombin"}
                </Text>
                <Text variant="caption" color="muted">
                  {saved.outfit.is_favorite ? "Favori - " : ""}
                  {saved.items.length} parca - {saved.votes.length} oy
                </Text>
                {saved.votes.length > 0 ? (
                  <View style={styles.voteSummary}>
                    {getVoteSummary(saved).map((item) => (
                      <View key={item.value} style={styles.votePill}>
                        <Text variant="caption" color="secondary">
                          {item.label}: {item.count}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {saved.items.length > 0 ? (
                  <View style={styles.suggestionItems}>
                    {saved.items.slice(0, 4).map((item) => (
                      <View key={item.id} style={styles.suggestionItem}>
                        <CachedImage
                          accessibilityLabel={item.subcategory ?? item.category}
                          fallbackColor={item.dominant_color_hex}
                          sourceUri={item.thumbnail_url ?? item.image_url}
                          style={styles.suggestionImage}
                        />
                      </View>
                    ))}
                  </View>
                ) : null}
              </Card>
            </Pressable>
          ))
        ) : (
          <EmptyState icon="sparkles-outline" title="Kayitli kombin yok" body="Henuz kayitli kombin yok." />
        )}
      </View>
    </ScrollView>

    {/* Sticky CTA — always visible regardless of scroll position */}
    <View style={styles.stickyBottom}>
      <Button
        title="Kombin Öner"
        onPress={handleRecommend}
        loading={isRecommending}
        disabled={isActionBusy}
        style={styles.stickyButton}
      />
    </View>
    </View>
  );
}

function getVoteSummary(saved: SharedOutfit) {
  return voteOptions
    .map((option) => ({
      ...option,
      count: saved.votes.filter((vote) => vote.vote === option.value).length,
    }))
    .filter((option) => option.count > 0);
}

function buildSavedOutfitsSummary(savedOutfits: SharedOutfit[]) {
  const favoriteCount = savedOutfits.filter((saved) => saved.outfit.is_favorite).length;
  const shareableCount = savedOutfits.filter((saved) => saved.outfit.is_shareable || saved.outfit.share_token).length;
  const wornCount = savedOutfits.filter((saved) => saved.outfit.worn_at).length;
  const totalVotes = savedOutfits.reduce((sum, saved) => sum + saved.votes.length, 0);
  const topOutfits = savedOutfits.slice(0, 5).map((saved, index) => {
    const loveCount = saved.votes.filter((vote) => vote.vote === "love").length;
    return `#${index + 1} ${saved.outfit.name ?? "Kayitli kombin"} - ${saved.items.length} parca - ${saved.votes.length} oy${loveCount > 0 ? ` - ${loveCount} favori oy` : ""}`;
  });

  return [
    "Shipirio kayitli kombin ozeti",
    "",
    `Toplam kombin: ${savedOutfits.length}`,
    `Favoriler: ${favoriteCount}`,
    `Paylasima acik: ${shareableCount}`,
    `Giyildi olarak isaretlenen: ${wornCount}`,
    `Toplam oy: ${totalVotes}`,
    "",
    "Son kayitlar:",
    ...(topOutfits.length > 0 ? topOutfits : ["- Kayitli kombin yok."]),
  ].join("\n");
}

function formatLimit(value: number | boolean) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "sinirsiz";
}

function getRepeatCandidate(items: WardrobeItem[]) {
  const candidates = items.filter((item) => item.is_active);

  return [...candidates].sort((a, b) => {
    const aLastWorn = a.last_worn ? new Date(a.last_worn).getTime() : 0;
    const bLastWorn = b.last_worn ? new Date(b.last_worn).getTime() : 0;
    const aScore = a.wear_count * 10 + Math.floor(aLastWorn / 86_400_000);
    const bScore = b.wear_count * 10 + Math.floor(bLastWorn / 86_400_000);
    return aScore - bScore;
  })[0];
}

function getRepeatReason(item: WardrobeItem) {
  if (!item.last_worn && item.wear_count === 0) {
    return "Bu parca henuz hic giyilmemis gorunuyor. Bugun bir kombine sokmak iyi olabilir.";
  }

  if (!item.last_worn) {
    return "Son giyilme tarihi yok; dolapta tekrar hatirlanmayi hak ediyor.";
  }

  const days = Math.max(0, Math.round((Date.now() - new Date(item.last_worn).getTime()) / 86_400_000));
  return `${days} gundur giyilmemis. Shipirio bunu bugunku kombine dahil edebilir.`;
}

function getAccessoryItemLabels(itemIds: string[], items: WardrobeItem[]) {
  return itemIds
    .map((itemId) => items.find((item) => item.id === itemId))
    .filter((item): item is WardrobeItem => Boolean(item))
    .map((item) => item.subcategory ?? item.brand ?? item.category)
    .join(", ");
}

function getPriorityDotStyle(priority: AccessoryRecommendation["priority"]) {
  if (priority === "high") {
    return styles.priorityDotHigh;
  }

  if (priority === "medium") {
    return styles.priorityDotMedium;
  }

  return styles.priorityDotLow;
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  stickyBottom: {
    backgroundColor: COLORS.background,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    padding: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  stickyButton: {
    minHeight: 52,
  },
  ctaSpacer: {
    height: SPACING.md,
  },
  content: {
    gap: SPACING.md,
    padding: SPACING.lg,
    paddingTop: 64,
    paddingBottom: SPACING.xl,
  },
  weather: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
  },
  repeatCard: {
    gap: SPACING.md,
  },
  repeatHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
  },
  repeatCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  repeatImage: {
    aspectRatio: 4 / 5,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    width: 86,
  },
  repeatActions: {
    gap: SPACING.sm,
  },
  focusNotice: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  usageCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
    justifyContent: "space-between",
  },
  usageCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  usageBadge: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    minWidth: 72,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  focusText: {
    flex: 1,
  },
  capsuleCard: {
    gap: SPACING.md,
  },
  capsuleHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
    justifyContent: "space-between",
  },
  capsuleScore: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  capsuleItems: {
    gap: SPACING.sm,
  },
  capsuleItem: {
    gap: SPACING.xs,
    width: 86,
  },
  capsuleImage: {
    aspectRatio: 4 / 5,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    width: "100%",
  },
  capsuleIdeas: {
    gap: SPACING.xs,
  },
  capsuleIdea: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    gap: 2,
    padding: SPACING.sm,
  },
  accessoryCard: {
    gap: SPACING.sm,
  },
  accessoryHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
    justifyContent: "space-between",
  },
  accessoryRow: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    flexDirection: "row",
    gap: SPACING.sm,
    padding: SPACING.sm,
  },
  accessoryCopy: {
    flex: 1,
    gap: 2,
  },
  priorityDot: {
    borderRadius: 999,
    height: 10,
    marginTop: 6,
    width: 10,
  },
  priorityDotHigh: {
    backgroundColor: COLORS.danger,
  },
  priorityDotMedium: {
    backgroundColor: COLORS.warning,
  },
  priorityDotLow: {
    backgroundColor: COLORS.success,
  },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  chip: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  activeChip: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  results: {
    gap: SPACING.sm,
  },
  savedHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
    justifyContent: "space-between",
  },
  savedHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  savedSummaryButton: {
    minHeight: 38,
    paddingHorizontal: SPACING.md,
  },
  suggestion: {
    gap: SPACING.xs,
  },
  suggestionItems: {
    flexDirection: "row",
    gap: SPACING.sm,
    paddingTop: SPACING.xs,
  },
  suggestionItem: {
    flex: 1,
    gap: SPACING.xs,
    minWidth: 0,
  },
  suggestionImage: {
    aspectRatio: 4 / 5,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    width: "100%",
  },
  suggestionColorBlock: {
    aspectRatio: 4 / 5,
    borderRadius: 8,
    width: "100%",
  },
  suggestionItemLabel: {
    textAlign: "center",
  },
  suggestionActions: {
    gap: SPACING.sm,
  },
  voteSummary: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  votePill: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  cta: {
    marginTop: SPACING.sm,
  },
});
