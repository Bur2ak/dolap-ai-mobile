import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useOutfitDiary } from "@/hooks/useOutfitDiary";
import { useWardrobe } from "@/hooks/useWardrobe";
import { captureError, captureEvent } from "@/lib/observability";
import { formatDate } from "@/utils/formatters";

const MOODS = ["😊 Güzel hissettim", "💪 Enerjikti", "😌 Rahat ve keyifli", "🔥 Kendinden emindim", "😐 Sıradan bir gündü"];

export default function LogOutfitScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { saveEntry, isSaving, todayEntry } = useOutfitDiary();
  const { items } = useWardrobe();

  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (todayEntry && date === new Date().toISOString().slice(0, 10)) {
      setSelectedItemIds(todayEntry.item_ids);
      setSelectedMood(todayEntry.mood);
      setRating(todayEntry.rating ?? 0);
      setNotes(todayEntry.notes ?? "");
    }
  }, [todayEntry, date]);

  function toggleItem(id: string) {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSave() {
    if (selectedItemIds.length === 0) {
      Alert.alert("Kıyafet seç", "En az bir kıyafet seçmelisin.");
      return;
    }
    try {
      await saveEntry({
        worn_at: date ?? new Date().toISOString().slice(0, 10),
        item_ids: selectedItemIds,
        mood: selectedMood,
        rating: rating || null,
        notes: notes.trim() || null,
      });
      captureEvent("outfit_diary_saved", { item_count: selectedItemIds.length, has_rating: rating > 0, has_mood: Boolean(selectedMood) });
      router.back();
    } catch (err) {
      captureError(err, { area: "outfit_diary_log_save" });
      Alert.alert("Kaydedilemedi", err instanceof Error ? err.message : "Tekrar dene.");
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="İptal" variant="ghost" onPress={() => router.back()} disabled={isSaving} />
        <Text variant="h2">{formatDate(date ?? new Date().toISOString())}</Text>
        <View style={styles.spacer} />
      </View>

      {/* Rating */}
      <Card style={styles.section}>
        <Text variant="h3">Bu kombin nasıldı?</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((r) => (
            <TouchableOpacity key={r} onPress={() => setRating(r === rating ? 0 : r)}>
              <Ionicons name={r <= rating ? "star" : "star-outline"} size={32} color={COLORS.accent} />
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* Mood */}
      <Card style={styles.section}>
        <Text variant="h3">Ruh hali</Text>
        <View style={styles.moodChips}>
          {MOODS.map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.moodChip, selectedMood === m && styles.moodChipActive]}
              onPress={() => setSelectedMood(m === selectedMood ? null : m)}
            >
              <Text variant="caption" color={selectedMood === m ? "inverse" : "secondary"}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* Items */}
      <Card style={styles.section}>
        <Text variant="h3">Giyilen kıyafetler</Text>
        <Text variant="caption" color="muted">{selectedItemIds.length} seçildi</Text>
        <View style={styles.itemGrid}>
          {items.map((item) => {
            const selected = selectedItemIds.includes(item.id);
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.itemCard, selected && styles.itemCardSelected]}
                onPress={() => toggleItem(item.id)}
              >
                <View style={[styles.swatch, { backgroundColor: item.dominant_color_hex ?? COLORS.primarySoft }]} />
                <Text variant="caption" numberOfLines={1}>{item.subcategory ?? item.category}</Text>
                {selected && (
                  <View style={styles.checkBadge}>
                    <Ionicons name="checkmark" size={10} color={COLORS.surface} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      {/* Notes */}
      <Card style={styles.section}>
        <Input
          label="Not (opsiyonel)"
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="Bu kombinle ilgili bir şey not almak ister misin?"
          editable={!isSaving}
        />
      </Card>

      <Button title="Kaydet" onPress={() => void handleSave()} loading={isSaving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { gap: SPACING.md, padding: SPACING.lg, paddingTop: 56, paddingBottom: 120 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  spacer: { width: 72 },
  section: { gap: SPACING.md },
  stars: { flexDirection: "row", gap: SPACING.sm },
  moodChips: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs },
  moodChip: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  moodChipActive: { backgroundColor: COLORS.primary },
  itemGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  itemCard: {
    alignItems: "center",
    borderColor: COLORS.border,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 4,
    padding: SPACING.xs,
    position: "relative",
    width: 72,
  },
  itemCardSelected: { borderColor: COLORS.primary, borderWidth: 2 },
  swatch: { borderRadius: 8, height: 56, width: 56 },
  checkBadge: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: 16,
    justifyContent: "center",
    position: "absolute",
    right: 4,
    top: 4,
    width: 16,
  },
});
