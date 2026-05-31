import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CachedImage } from "@/components/ui/CachedImage";
import { EmptyState } from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useOutfitDiary } from "@/hooks/useOutfitDiary";
import { useWardrobe } from "@/hooks/useWardrobe";
import { captureEvent } from "@/lib/observability";
import type { DiaryEntry } from "@/lib/api/outfitDiary";
import { formatDate } from "@/utils/formatters";
import { calculateStreak } from "@/utils/streak";

const MOODS = ["😊 Güzel", "💪 Enerjik", "😌 Rahat", "🔥 Kendinden emin", "😐 Sıradan"];
const RATINGS = [1, 2, 3, 4, 5];

export default function OutfitDiaryScreen() {
  const { entries, todayEntry, isLoading, isRefetching, refetch, deleteEntry, isDeleting } = useOutfitDiary();
  const { items } = useWardrobe();
  const itemMap = new Map(items.map((i) => [i.id, i]));

  useEffect(() => {
    captureEvent("outfit_diary_opened", { entry_count: entries.length, has_today: Boolean(todayEntry) });
  }, [entries.length, todayEntry]);

  const grouped = groupByMonth(entries);
  const streak = calculateStreak(entries.map((e) => e.worn_at));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} />
        <Text variant="h2">Giyim Günlüğü</Text>
        <View style={styles.spacer} />
      </View>

      {/* Streak banner */}
      {streak.current > 0 && (
        <View style={styles.streakCard}>
          <View style={styles.streakFlame}>
            <Ionicons name="flame" size={26} color="#E8743B" />
          </View>
          <View style={styles.streakCopy}>
            <Text variant="h2" style={styles.streakNumber}>{streak.current} gün</Text>
            <Text variant="body" color="secondary">
              {streak.loggedToday
                ? "Bugünü kaydettin, seri devam ediyor! 🔥"
                : "Bugünü de kaydet, seriyi koru!"}
            </Text>
          </View>
          {streak.longest > streak.current && (
            <View style={styles.streakBest}>
              <Text variant="caption" color="muted">En uzun</Text>
              <Text variant="label">{streak.longest}g</Text>
            </View>
          )}
        </View>
      )}

      {/* Weekly calendar */}
      <WeeklyCalendar entries={entries} />

      {/* Today card */}
      <Card style={styles.todayCard}>
        <View style={styles.todayHeader}>
          <View>
            <Text variant="caption" color="muted">BUGÜN</Text>
            <Text variant="h3">{formatDate(new Date().toISOString())}</Text>
          </View>
          {todayEntry ? (
            <View style={styles.ratingRow}>
              {RATINGS.map((r) => (
                <Ionicons key={r} name={r <= (todayEntry.rating ?? 0) ? "star" : "star-outline"} size={16} color={COLORS.accent} />
              ))}
            </View>
          ) : null}
        </View>

        {todayEntry ? (
          <>
            {todayEntry.mood && <Text variant="body" color="secondary">{todayEntry.mood}</Text>}
            {todayEntry.item_ids.length > 0 && (
              <View style={styles.itemSwatches}>
                {todayEntry.item_ids.slice(0, 6).map((id) => {
                  const item = itemMap.get(id);
                  return item ? (
                    <View key={id} style={[styles.swatch, { backgroundColor: item.dominant_color_hex ?? COLORS.primarySoft }]} />
                  ) : null;
                })}
                {todayEntry.item_ids.length > 6 && <Text variant="caption" color="muted">+{todayEntry.item_ids.length - 6}</Text>}
              </View>
            )}
            {todayEntry.notes && <Text variant="caption" color="secondary">{todayEntry.notes}</Text>}
            <Button
              title="Düzenle"
              variant="secondary"
              onPress={() => router.push({ pathname: "/outfit-diary/log", params: { date: todayEntry.worn_at } })}
              style={styles.logBtn}
            />
          </>
        ) : (
          <>
            <Text variant="body" color="secondary">Bugün ne giydiğini kaydet.</Text>
            <Button
              title="Bugünü Kaydet"
              onPress={() => router.push({ pathname: "/outfit-diary/log", params: { date: new Date().toISOString().slice(0, 10) } })}
              style={styles.logBtn}
            />
          </>
        )}
      </Card>

      {/* History */}
      {isLoading ? (
        <EmptyState icon="sync-outline" title="Yükleniyor" body="" />
      ) : entries.length === 0 ? (
        <EmptyState icon="book-outline" title="Henüz kayıt yok" body="Giyim günlüğün burada oluşacak." />
      ) : (
        Object.entries(grouped).map(([month, monthEntries]) => (
          <View key={month}>
            <Text variant="caption" color="muted" style={styles.monthLabel}>{month}</Text>
            {monthEntries.map((entry) => (
              <DiaryCard
                key={entry.id}
                entry={entry}
                itemMap={itemMap}
                onEdit={() => router.push({ pathname: "/outfit-diary/log", params: { date: entry.worn_at } })}
                onDelete={() => {
                  Alert.alert("Kaydı sil", "Bu giyim kaydı silinecek.", [
                    { text: "Vazgeç", style: "cancel" },
                    { text: "Sil", style: "destructive", onPress: () => void deleteEntry(entry.id) },
                  ]);
                }}
                isDeleting={isDeleting}
              />
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

function WeeklyCalendar({ entries }: { entries: DiaryEntry[] }) {
  const entryDates = new Set(entries.map((e) => e.worn_at));
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const weekDays: Array<{ date: string; label: string; dayNum: number }> = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    weekDays.push({
      date: dateStr,
      label: d.toLocaleDateString("tr-TR", { weekday: "short" }),
      dayNum: d.getDate(),
    });
  }

  return (
    <Card style={styles.weekCard}>
      <Text variant="caption" color="muted">BU HAFTA</Text>
      <View style={styles.weekRow}>
        {weekDays.map(({ date, label, dayNum }) => {
          const hasEntry = entryDates.has(date);
          const isToday = date === todayStr;
          return (
            <Pressable
              key={date}
              style={[styles.dayCell, isToday && styles.dayCellToday, hasEntry && styles.dayCellFilled]}
              onPress={() => router.push({ pathname: "/outfit-diary/log", params: { date } })}
            >
              <Text variant="caption" color={hasEntry ? "inverse" : isToday ? "primary" : "muted"}>{label}</Text>
              <Text variant="label" color={hasEntry ? "inverse" : isToday ? "primary" : "secondary"}>{dayNum}</Text>
              {hasEntry ? <Ionicons name="checkmark" size={10} color={COLORS.surface} /> : <View style={styles.dayDot} />}
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

function DiaryCard({ entry, itemMap, onEdit, onDelete, isDeleting }: {
  entry: DiaryEntry;
  itemMap: Map<string, { dominant_color_hex: string | null; subcategory: string | null; category: string }>;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  return (
    <Card style={styles.entryCard}>
      <View style={styles.entryHeader}>
        <View>
          <Text variant="label">{formatDate(entry.worn_at)}</Text>
          {entry.mood && <Text variant="caption" color="secondary">{entry.mood}</Text>}
        </View>
        <View style={styles.entryActions}>
          {entry.rating ? (
            <View style={styles.ratingRow}>
              {[1,2,3,4,5].map((r) => (
                <Ionicons key={r} name={r <= entry.rating! ? "star" : "star-outline"} size={12} color={COLORS.accent} />
              ))}
            </View>
          ) : null}
          <Pressable onPress={onEdit} disabled={isDeleting}>
            <Ionicons name="pencil-outline" size={16} color={COLORS.textMuted} />
          </Pressable>
          <Pressable onPress={onDelete} disabled={isDeleting}>
            <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
          </Pressable>
        </View>
      </View>

      {entry.item_ids.length > 0 && (
        <View style={styles.itemSwatches}>
          {entry.item_ids.slice(0, 8).map((id) => {
            const item = itemMap.get(id);
            return item ? (
              <View key={id} style={styles.swatchWrap}>
                <View style={[styles.swatch, { backgroundColor: item.dominant_color_hex ?? COLORS.primarySoft }]} />
                <Text variant="caption" color="muted" numberOfLines={1} style={styles.swatchLabel}>
                  {item.subcategory ?? item.category}
                </Text>
              </View>
            ) : null;
          })}
        </View>
      )}
      {entry.notes && <Text variant="caption" color="secondary">{entry.notes}</Text>}
    </Card>
  );
}

function groupByMonth(entries: DiaryEntry[]): Record<string, DiaryEntry[]> {
  const result: Record<string, DiaryEntry[]> = {};
  for (const e of entries) {
    const month = e.worn_at.slice(0, 7);
    const label = new Date(month + "-01").toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
    if (!result[label]) result[label] = [];
    result[label].push(e);
  }
  return result;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  streakCard: {
    alignItems: "center",
    backgroundColor: "#FFF1E8",
    borderColor: "#F5D9C8",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACING.md,
    padding: SPACING.md,
  },
  streakFlame: {
    alignItems: "center",
    backgroundColor: "#FFE3D2",
    borderRadius: 999,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  streakCopy: { flex: 1, gap: 2 },
  streakNumber: { color: "#E8743B" },
  streakBest: { alignItems: "center", gap: 2 },
  content: { gap: SPACING.md, padding: SPACING.lg, paddingTop: 56, paddingBottom: 120 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  spacer: { width: 72 },
  todayCard: { gap: SPACING.sm },
  todayHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  ratingRow: { flexDirection: "row", gap: 2 },
  itemSwatches: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  swatchWrap: { alignItems: "center", gap: 2, width: 48 },
  swatch: { borderRadius: 8, height: 48, width: 48 },
  swatchLabel: { textAlign: "center" },
  logBtn: { alignSelf: "flex-start", minHeight: 38, paddingHorizontal: SPACING.md },
  monthLabel: { marginTop: SPACING.sm, marginBottom: SPACING.xs, textTransform: "uppercase" },
  entryCard: { gap: SPACING.xs, marginBottom: SPACING.sm },
  entryHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  entryActions: { alignItems: "center", flexDirection: "row", gap: SPACING.sm },
  weekCard: { gap: SPACING.sm },
  weekRow: { flexDirection: "row", justifyContent: "space-between" },
  dayCell: {
    alignItems: "center",
    borderColor: COLORS.border,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    marginHorizontal: 2,
    paddingVertical: SPACING.xs,
  },
  dayCellToday: { borderColor: COLORS.primary, borderWidth: 2 },
  dayCellFilled: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayDot: { backgroundColor: COLORS.surfaceMuted, borderRadius: 999, height: 6, width: 6 },
});
