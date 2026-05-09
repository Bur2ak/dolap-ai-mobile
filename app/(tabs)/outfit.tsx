import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Share } from "react-native";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
import { getDailyOutfitSuggestionCount, incrementDailyOutfitSuggestionCount } from "@/lib/usageLimits";
import type { OutfitRecommendationInput, OutfitSuggestion, OutfitVoteValue, SharedOutfit, WardrobeItem } from "@/types";
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
  const [selectedEvent, setSelectedEvent] = useState<string>(EVENT_TYPES[0].value);
  const [selectedMood, setSelectedMood] = useState(moods[0]);
  const [focusItemId, setFocusItemId] = useState<string | null>(null);
  const repeatCandidate = useMemo(() => getRepeatCandidate(items), [items]);
  const capsulePlan = useMemo(() => buildCapsuleWardrobePlan(items), [items]);
  const focusedItem = focusItemId ? items.find((item) => item.id === focusItemId) ?? null : null;

  const recommendationInput: OutfitRecommendationInput = {
    event: selectedEvent,
    focus_item_id: focusItemId,
    mood: selectedMood,
    weather,
    wardrobe: items,
  };

  async function handleRecommend() {
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

      await recommend({
        ...recommendationInput,
      });
      if (!premium) {
        await incrementDailyOutfitSuggestionCount(userId);
      }
    } catch (error) {
      Alert.alert("Kombin onerilemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  async function handleAskFriend(suggestion: OutfitSuggestion) {
    if (!userId) {
      Alert.alert("Giris gerekli", "Kombini paylasmak icin once giris yapmalisin.");
      return;
    }

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
    } catch (error) {
      Alert.alert("Paylasilamadi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  async function handleSaveOutfit(suggestion: OutfitSuggestion) {
    if (!userId) {
      Alert.alert("Giris gerekli", "Kombini kaydetmek icin once giris yapmalisin.");
      return;
    }

    try {
      await saveOutfit({
        input: recommendationInput,
        suggestion,
      });
      Alert.alert("Kaydedildi", "Kombin kayitli kombinlerine eklendi.");
    } catch (error) {
      Alert.alert("Kaydedilemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  function handleUseCapsule() {
    const firstIdea = capsulePlan.outfit_ideas[0];
    const firstItemId = firstIdea?.item_ids[0] ?? capsulePlan.core_item_ids[0] ?? null;

    if (firstItemId) {
      setFocusItemId(firstItemId);
    }

    if (firstIdea?.event) {
      setSelectedEvent(firstIdea.event);
    }
  }

  return (
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
            {repeatCandidate.thumbnail_url || repeatCandidate.image_url ? (
              <Image source={{ uri: repeatCandidate.thumbnail_url ?? repeatCandidate.image_url }} style={styles.repeatImage} />
            ) : (
              <View style={[styles.repeatImage, { backgroundColor: repeatCandidate.dominant_color_hex ?? COLORS.primarySoft }]} />
            )}
          </View>
          <View style={styles.repeatActions}>
            <Button
              title={focusItemId === repeatCandidate.id ? "Odak Secildi" : "Bu Parcayla Oner"}
              variant="secondary"
              onPress={() => setFocusItemId(repeatCandidate.id)}
            />
            {focusItemId ? <Button title="Odagi Kaldir" variant="ghost" onPress={() => setFocusItemId(null)} /> : null}
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
                <Pressable key={item.id} style={styles.capsuleItem} onPress={() => setFocusItemId(item.id)}>
                  {item.thumbnail_url || item.image_url ? (
                    <Image source={{ uri: item.thumbnail_url ?? item.image_url }} style={styles.capsuleImage} />
                  ) : (
                    <View style={[styles.capsuleImage, { backgroundColor: item.dominant_color_hex ?? COLORS.primarySoft }]} />
                  )}
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
                  onPress={() => {
                    setSelectedEvent(idea.event);
                    setFocusItemId(idea.item_ids[0] ?? null);
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

          <Button title="Kapsulden Oneri Hazirla" variant="secondary" onPress={handleUseCapsule} />
        </Card>
      ) : null}

      <Text variant="h3">Nereye gidiyorsun?</Text>
      <View style={styles.wrap}>
        {EVENT_TYPES.slice(0, 6).map((event) => (
          <Pressable
            key={event.value}
            style={[styles.chip, selectedEvent === event.value && styles.activeChip]}
            onPress={() => setSelectedEvent(event.value)}
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
            onPress={() => setSelectedMood(mood)}
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
                      {item.thumbnail_url || item.image_url ? (
                        <Image source={{ uri: item.thumbnail_url ?? item.image_url }} style={styles.suggestionImage} />
                      ) : (
                        <View style={[styles.suggestionColorBlock, { backgroundColor: item.dominant_color_hex ?? COLORS.primarySoft }]} />
                      )}
                      <Text variant="caption" color="secondary" style={styles.suggestionItemLabel}>
                        {item.subcategory ?? item.category}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={styles.suggestionActions}>
                <Button title="Kaydet" variant="secondary" onPress={() => void handleSaveOutfit(suggestion)} loading={isSavingOutfit} />
                <Button title="Arkadasa Sor" variant="ghost" onPress={() => void handleAskFriend(suggestion)} loading={isSavingOutfit} />
              </View>
            </Card>
          );
        })}
      </View>

      <Button title="Kombin Oner" onPress={handleRecommend} loading={isRecommending} style={styles.cta} />

      <View style={styles.results}>
        <Text variant="h3">Kayitli kombinler</Text>
        {isLoadingSavedOutfits ? (
          <EmptyState icon="sync-outline" title="Kombinler yukleniyor" body="Kayitli kombinlerin hazirlaniyor." />
        ) : savedOutfitsError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Kombinler yuklenemedi"
            body="Baglanti veya Supabase tarafinda gecici bir sorun olabilir."
            actionLabel="Tekrar Dene"
            loading={isRefetchingSavedOutfits}
            onAction={() => void refetchSavedOutfits()}
          />
        ) : savedOutfits.length > 0 ? (
          savedOutfits.map((saved) => (
            <Pressable key={saved.outfit.id} onPress={() => router.push(`/outfit/${saved.outfit.id}`)}>
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
                        {item.thumbnail_url || item.image_url ? (
                          <Image source={{ uri: item.thumbnail_url ?? item.image_url }} style={styles.suggestionImage} />
                        ) : (
                          <View style={[styles.suggestionColorBlock, { backgroundColor: item.dominant_color_hex ?? COLORS.primarySoft }]} />
                        )}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
