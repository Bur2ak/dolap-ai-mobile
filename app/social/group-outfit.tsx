import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useWardrobe } from "@/hooks/useWardrobe";
import { invokeFunctionWithRetry } from "@/lib/api/functions";
import { fetchFriendWardrobe } from "@/lib/api/social";
import { captureError, captureEvent } from "@/lib/observability";
import { getUuidParam } from "@/lib/routeParams";
import type { WardrobeItem } from "@/types";

interface GroupOutfitSuggestion {
  my_items: string[];
  friend_items: string[];
  name: string;
  reason: string;
  color_story: string;
}

export default function GroupOutfitScreen() {
  const { friendId: friendIdParam, friendName: friendNameParam } = useLocalSearchParams<{ friendId?: string | string[]; friendName?: string | string[] }>();
  const friendId = getUuidParam(friendIdParam);
  const friendName = typeof friendNameParam === "string" ? friendNameParam : (Array.isArray(friendNameParam) ? friendNameParam[0] : null) ?? "Arkadaş";

  const { items: myItems } = useWardrobe();
  const [friendItems, setFriendItems] = useState<WardrobeItem[]>([]);
  const [suggestions, setSuggestions] = useState<GroupOutfitSuggestion[]>([]);
  const [event, setEvent] = useState("Günlük");
  const [isLoadingFriend, setIsLoadingFriend] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const isBusy = isLoadingFriend || isGenerating;

  const eventOptions = ["Günlük", "İş", "Gece", "Spor", "Özel etkinlik"];

  useEffect(() => {
    if (!friendId) return;
    setIsLoadingFriend(true);
    fetchFriendWardrobe(friendId)
      .then((fw) => setFriendItems(fw.items))
      .catch((err) => {
        captureError(err, { area: "group_outfit_fetch_friend_wardrobe", friend_id: friendId });
        Alert.alert("Dolap yüklenemedi", "Arkadaşın dolabına erişilemedi.");
      })
      .finally(() => setIsLoadingFriend(false));
  }, [friendId]);

  useEffect(() => {
    captureEvent("group_outfit_screen_viewed", {
      friend_id: friendId ?? "missing",
      my_item_count: myItems.length,
    });
  }, [friendId, myItems.length]);

  async function handleGenerate() {
    if (isBusy) return;
    if (myItems.length === 0) {
      Alert.alert("Dolap boş", "Kombin oluşturmak için önce dolabına kıyafet ekle.");
      return;
    }
    if (friendItems.length === 0) {
      Alert.alert("Arkadaş dolabı boş", "Arkadaşının dolabında paylaşılabilir kıyafet bulunamadı.");
      return;
    }

    setIsGenerating(true);
    setSuggestions([]);
    try {
      const data = await invokeFunctionWithRetry<{ suggestions: GroupOutfitSuggestion[] }>("group-outfit", {
        my_wardrobe: myItems,
        friend_wardrobe: friendItems,
        friend_name: friendName,
        event,
      });

      const result = data?.suggestions ?? [];
      const valid = result.filter(
        (s) =>
          Array.isArray(s.my_items) &&
          Array.isArray(s.friend_items) &&
          typeof s.name === "string" &&
          typeof s.reason === "string",
      );

      if (valid.length === 0) {
        Alert.alert("Öneri oluşturulamadı", "Dolap verileri yeterli kombin için uygun değil. Farklı bir etkinlik dene.");
        return;
      }

      setSuggestions(valid);
      captureEvent("group_outfit_generated", {
        event,
        suggestion_count: valid.length,
        friend_id: friendId ?? "missing",
      });
    } catch (err) {
      captureError(err, { area: "group_outfit_generate", event });
      Alert.alert("Öneri oluşturulamadı", err instanceof Error ? err.message : "Tekrar dene.");
    } finally {
      setIsGenerating(false);
    }
  }

  if (!friendId) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <EmptyState icon="people-outline" title="Arkadaş bulunamadı" body="Grup kombin için arkadaşlar ekranından bir arkadaş seç." actionLabel="Arkadaşlara Git" onAction={() => router.push("/social/friends")} />
      </ScrollView>
    );
  }

  const myItemsMap = new Map(myItems.map((i) => [i.id, i]));
  const friendItemsMap = new Map(friendItems.map((i) => [i.id, i]));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} disabled={isBusy} />
        <Text variant="h2">Grup Kombin</Text>
        <View style={styles.spacer} />
      </View>

      <Card style={styles.section}>
        <Text variant="h3">{friendName} ile kombin</Text>
        <Text variant="body" color="secondary">
          İki dolabı harmanlayan, birbirini tamamlayan kombinler.
        </Text>
        <View style={styles.statusRow}>
          <View style={styles.statusPill}>
            <Text variant="caption" color="muted">BENİM DOLABIM</Text>
            <Text variant="label">{myItems.length} parça</Text>
          </View>
          <View style={styles.statusPill}>
            <Text variant="caption" color="muted">{friendName.toUpperCase()}</Text>
            <Text variant="label">{isLoadingFriend ? "Yükleniyor..." : `${friendItems.length} parça`}</Text>
          </View>
        </View>
      </Card>

      <Card style={styles.section}>
        <Text variant="h3">Etkinlik</Text>
        <View style={styles.chipRow}>
          {eventOptions.map((opt) => (
            <Button
              key={opt}
              title={opt}
              variant={event === opt ? "primary" : "secondary"}
              onPress={() => setEvent(opt)}
              disabled={isBusy}
              style={styles.chip}
            />
          ))}
        </View>
        <Button
          title="Grup Kombin Oluştur"
          onPress={() => void handleGenerate()}
          loading={isGenerating}
          disabled={isBusy || isLoadingFriend}
        />
      </Card>

      {suggestions.length > 0 && suggestions.map((suggestion, index) => {
        const myOutfitItems = suggestion.my_items.map((id) => myItemsMap.get(id)).filter(Boolean) as WardrobeItem[];
        const friendOutfitItems = suggestion.friend_items.map((id) => friendItemsMap.get(id)).filter(Boolean) as WardrobeItem[];

        return (
          <Card key={index} style={styles.section}>
            <Text variant="h3">{suggestion.name}</Text>
            <Text variant="body" color="secondary">{suggestion.reason}</Text>
            {suggestion.color_story ? (
              <Text variant="caption" color="muted">{suggestion.color_story}</Text>
            ) : null}

            <View style={styles.outfitBlock}>
              <Text variant="label">Benim kombinim</Text>
              <View style={styles.swatchRow}>
                {myOutfitItems.length > 0 ? myOutfitItems.map((item) => (
                  <View key={item.id} style={styles.swatchItem}>
                    <View style={[styles.swatch, { backgroundColor: item.dominant_color_hex ?? COLORS.primarySoft }]} />
                    <Text variant="caption" numberOfLines={1}>{item.subcategory ?? item.category}</Text>
                  </View>
                )) : (
                  <Text variant="caption" color="muted">Parça eşleştirilemedi</Text>
                )}
              </View>
            </View>

            <View style={styles.outfitBlock}>
              <Text variant="label">{friendName}&apos;in kombinı</Text>
              <View style={styles.swatchRow}>
                {friendOutfitItems.length > 0 ? friendOutfitItems.map((item) => (
                  <View key={item.id} style={styles.swatchItem}>
                    <View style={[styles.swatch, { backgroundColor: item.dominant_color_hex ?? COLORS.primarySoft }]} />
                    <Text variant="caption" numberOfLines={1}>{item.subcategory ?? item.category}</Text>
                  </View>
                )) : (
                  <Text variant="caption" color="muted">Parça eşleştirilemedi</Text>
                )}
              </View>
            </View>
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  content: {
    gap: SPACING.md,
    padding: SPACING.lg,
    paddingTop: 56,
    paddingBottom: 120,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  spacer: {
    width: 72,
  },
  section: {
    gap: SPACING.md,
  },
  statusRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  statusPill: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    flex: 1,
    gap: SPACING.xs,
    padding: SPACING.sm,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: SPACING.md,
  },
  outfitBlock: {
    gap: SPACING.xs,
  },
  swatchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  swatchItem: {
    alignItems: "center",
    gap: 4,
    width: 64,
  },
  swatch: {
    borderRadius: 10,
    height: 64,
    width: 64,
  },
});
