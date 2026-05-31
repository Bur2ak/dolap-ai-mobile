import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { ActionSheetIOS, Alert, Image, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/typography";
import { SPACING } from "@/constants/spacing";
import { useImagePicker } from "@/hooks/useImagePicker";
import { useSubscription } from "@/hooks/useSubscription";
import { useWardrobe } from "@/hooks/useWardrobe";
import { detectAndCropGarments, type DetectedGarmentCrop } from "@/lib/ai/detectGarments";
import { captureError, captureEvent } from "@/lib/observability";
import { createThumbnail, optimizeImage } from "@/utils/imageUtils";
import { CATEGORIES } from "@/constants/categories";

type Phase = "intro" | "detecting" | "review" | "saving";

interface ReviewItem extends DetectedGarmentCrop {
  id: string;
  selected: boolean;
}

export default function SmartScanScreen() {
  const { takePhoto, pickFromLibrary, isPicking } = useImagePicker();
  const { createItem, canCreate, items } = useWardrobe();
  const { isLimitReached } = useSubscription();
  const [phase, setPhase] = useState<Phase>("intro");
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [saveProgress, setSaveProgress] = useState({ done: 0, total: 0 });

  const selectedCount = reviewItems.filter((i) => i.selected).length;

  function handlePick() {
    if (isPicking || phase === "detecting" || phase === "saving") return;
    if (!canCreate) {
      Alert.alert("Giriş gerekli", "Kıyafet eklemek için önce giriş yapmalısın.");
      return;
    }
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Vazgeç", "Fotoğraf Çek", "Galeriden Seç"], cancelButtonIndex: 0 },
        async (i) => {
          if (i === 1) await runDetection("camera");
          if (i === 2) await runDetection("library");
        },
      );
    } else {
      Alert.alert("Akıllı Tarama", "Birden fazla kıyafeti yan yana ser, tek fotoğraf çek", [
        { text: "Vazgeç", style: "cancel" },
        { text: "Fotoğraf Çek", onPress: () => void runDetection("camera") },
        { text: "Galeriden Seç", onPress: () => void runDetection("library") },
      ]);
    }
  }

  async function runDetection(source: "camera" | "library") {
    try {
      const uri = source === "camera" ? await takePhoto() : await pickFromLibrary();
      if (!uri) return;

      setPhase("detecting");
      captureEvent("smart_scan_started", { source });

      const optimized = await optimizeImage(uri);
      const crops = await detectAndCropGarments(optimized);

      if (crops.length === 0) {
        setPhase("intro");
        Alert.alert(
          "Parça bulunamadı",
          "Bu fotoğrafta net kıyafet tespit edilemedi. Parçaları düz bir zemine, üst üste binmeyecek şekilde ser ve tekrar dene.",
        );
        return;
      }

      setReviewItems(crops.map((c, idx) => ({ ...c, id: `scan-${idx}-${Date.now()}`, selected: true })));
      setPhase("review");
      captureEvent("smart_scan_detected", { count: crops.length });
    } catch (error) {
      captureError(error, { area: "smart_scan_detect", source });
      setPhase("intro");
      Alert.alert("Tarama başarısız", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  function toggleItem(id: string) {
    setReviewItems((prev) => prev.map((i) => (i.id === id ? { ...i, selected: !i.selected } : i)));
  }

  async function handleSaveAll() {
    const toSave = reviewItems.filter((i) => i.selected);
    if (toSave.length === 0) {
      Alert.alert("Parça seç", "Eklemek için en az bir parça seçmelisin.");
      return;
    }
    if (isLimitReached("MAX_WARDROBE_ITEMS", items.length)) {
      Alert.alert("Dolap limiti doldu", "Free plandaki kıyafet limitine ulaştın.", [
        { text: "Vazgeç", style: "cancel" },
        { text: "Premium'a Geç", onPress: () => router.push("/paywall") },
      ]);
      return;
    }

    setPhase("saving");
    setSaveProgress({ done: 0, total: toSave.length });
    let errors = 0;

    for (let i = 0; i < toSave.length; i++) {
      const item = toSave[i];
      try {
        const thumb = await createThumbnail(item.croppedUri);
        await createItem({
          image_url: item.croppedUri,
          thumbnail_url: thumb,
          category: item.category,
          subcategory: item.subcategory.trim(),
          colors: item.colors,
          dominant_color_hex: item.dominant_color_hex,
          season: item.season,
          fabric: item.fabric,
          usage_context: item.usage_context,
          is_shareable: false,
          is_lendable: false,
        });
      } catch (error) {
        errors++;
        captureError(error, { area: "smart_scan_save_item", index: i });
      }
      setSaveProgress({ done: i + 1, total: toSave.length });
    }

    const saved = toSave.length - errors;
    captureEvent("smart_scan_completed", { saved, errors });

    // Aha moment: yeterli parça eklendiyse hemen ilk kombin önerisine yönlendir
    const totalAfter = items.length + saved;
    if (saved > 0 && totalAfter >= 2) {
      Alert.alert(
        "Harika başlangıç! 🎉",
        `${saved} parça eklendi. Şimdi bunlarla sana özel ilk kombinini görelim mi?`,
        [
          { text: "Sonra", style: "cancel", onPress: () => router.replace("/(tabs)") },
          { text: "Kombinimi Gör ✨", onPress: () => { captureEvent("aha_moment_outfit_from_scan"); router.replace("/(tabs)/outfit"); } },
        ],
      );
    } else {
      Alert.alert(
        "Eklendi 🎉",
        `${saved} kıyafet dolabına eklendi${errors > 0 ? `, ${errors} başarısız` : ""}.\n\nBirkaç parça daha ekleyince AI sana kombin önermeye başlar.`,
        [{ text: "Harika", onPress: () => router.replace("/(tabs)") }],
      );
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} disabled={phase === "detecting" || phase === "saving"}>
          <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <Text variant="h2">Akıllı Tarama</Text>
        <View style={styles.spacer} />
      </View>

      {phase === "intro" && (
        <ScrollView contentContainerStyle={styles.introContent}>
          <View style={styles.introIcon}>
            <Ionicons name="scan-outline" size={40} color={COLORS.accentText} />
          </View>
          <Text variant="h2" style={styles.center}>Tek fotoğrafla{"\n"}birden fazla parça ekle</Text>
          <Text variant="body" color="secondary" style={styles.center}>
            Kıyafetlerini düz bir zemine üst üste binmeyecek şekilde ser, tek fotoğraf çek.
            AI hepsini ayrı ayrı tanıyıp dolabına ekler.
          </Text>

          <View style={styles.tipsCard}>
            {[
              { icon: "albums-outline", text: "5-10 parçayı yan yana diz" },
              { icon: "sunny-outline", text: "İyi aydınlatılmış ortamda çek" },
              { icon: "resize-outline", text: "Parçalar üst üste binmesin" },
            ].map((tip) => (
              <View key={tip.text} style={styles.tipRow}>
                <Ionicons name={tip.icon as keyof typeof Ionicons.glyphMap} size={18} color={COLORS.accentText} />
                <Text variant="body" color="secondary">{tip.text}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.cta} onPress={handlePick} activeOpacity={0.85}>
            <Ionicons name="camera" size={18} color={COLORS.textInverse} />
            <Text variant="label" color="inverse">Fotoğraf Seç</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace("/item/add")} style={styles.altLink}>
            <Text variant="label" color="secondary">Tek tek eklemeyi tercih et</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {phase === "detecting" && (
        <View style={styles.centerFill}>
          <Ionicons name="sparkles" size={32} color={COLORS.accentText} />
          <Text variant="h3" style={styles.center}>Parçalar tespit ediliyor...</Text>
          <Text variant="body" color="secondary" style={styles.center}>AI fotoğraftaki her kıyafeti ayırıyor.</Text>
        </View>
      )}

      {phase === "review" && (
        <>
          <View style={styles.reviewHeader}>
            <Text variant="body" color="secondary">
              <Text variant="label">{reviewItems.length}</Text> parça bulundu · {selectedCount} seçili
            </Text>
          </View>
          <ScrollView contentContainerStyle={styles.grid}>
            {reviewItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.gridItem, !item.selected && styles.gridItemUnselected]}
                onPress={() => toggleItem(item.id)}
                activeOpacity={0.8}
              >
                <Image source={{ uri: item.croppedUri }} style={styles.gridImage} />
                <View style={[styles.checkBadge, item.selected ? styles.checkBadgeOn : styles.checkBadgeOff]}>
                  <Ionicons name={item.selected ? "checkmark" : "add"} size={14} color={item.selected ? COLORS.textInverse : COLORS.textMuted} />
                </View>
                <Text variant="caption" numberOfLines={1} style={styles.gridLabel}>
                  {CATEGORIES.find((c) => c.value === item.category)?.label ?? item.subcategory}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.rescanBtn} onPress={() => setPhase("intro")}>
              <Ionicons name="refresh-outline" size={16} color={COLORS.textSecondary} />
              <Text variant="label" color="secondary">Yeni Tarama</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, selectedCount === 0 && styles.saveBtnDisabled]}
              onPress={() => void handleSaveAll()}
              disabled={selectedCount === 0}
              activeOpacity={0.85}
            >
              <Text variant="label" color="inverse">{selectedCount} Parçayı Ekle</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {phase === "saving" && (
        <View style={styles.centerFill}>
          <Ionicons name="cloud-upload-outline" size={32} color={COLORS.accentText} />
          <Text variant="h3" style={styles.center}>Ekleniyor... {saveProgress.done}/{saveProgress.total}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    alignItems: "center", flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: SPACING.lg, paddingTop: 60, paddingBottom: SPACING.md,
  },
  backBtn: { padding: 4 },
  spacer: { width: 30 },
  center: { textAlign: "center" },
  centerFill: { alignItems: "center", flex: 1, gap: SPACING.sm, justifyContent: "center", padding: SPACING.lg },

  introContent: { alignItems: "center", gap: SPACING.md, padding: SPACING.lg },
  introIcon: {
    alignItems: "center", backgroundColor: COLORS.accentSoft, borderRadius: 20,
    height: 72, justifyContent: "center", marginTop: SPACING.md, width: 72,
  },
  tipsCard: {
    backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 16,
    borderWidth: 1, gap: SPACING.sm, marginTop: SPACING.sm, padding: SPACING.md, width: "100%",
  },
  tipRow: { alignItems: "center", flexDirection: "row", gap: SPACING.sm },
  cta: {
    alignItems: "center", backgroundColor: COLORS.primary, borderRadius: 14,
    flexDirection: "row", gap: SPACING.sm, justifyContent: "center",
    marginTop: SPACING.sm, minHeight: 52, width: "100%",
  },
  altLink: { padding: SPACING.sm },

  reviewHeader: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, padding: SPACING.lg, paddingTop: 0, paddingBottom: 120 },
  gridItem: {
    backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 12,
    borderWidth: 2, overflow: "hidden", position: "relative", width: "31%",
  },
  gridItemUnselected: { opacity: 0.45 },
  gridImage: { aspectRatio: 3 / 4, backgroundColor: COLORS.surfaceMuted, width: "100%" },
  checkBadge: {
    alignItems: "center", borderRadius: 999, height: 24, justifyContent: "center",
    position: "absolute", right: 6, top: 6, width: 24,
  },
  checkBadgeOn: { backgroundColor: COLORS.cta },
  checkBadgeOff: { backgroundColor: "rgba(255,255,255,0.85)" },
  gridLabel: { paddingHorizontal: 6, paddingVertical: 4, textAlign: "center" },

  bottomBar: {
    backgroundColor: COLORS.background, borderTopColor: COLORS.border, borderTopWidth: 1,
    flexDirection: "row", gap: SPACING.sm, padding: SPACING.md, paddingBottom: SPACING.lg,
  },
  rescanBtn: {
    alignItems: "center", backgroundColor: COLORS.surfaceMuted, borderRadius: 14,
    flexDirection: "row", gap: 6, justifyContent: "center", paddingHorizontal: SPACING.md,
  },
  saveBtn: {
    alignItems: "center", backgroundColor: COLORS.primary, borderRadius: 14,
    flex: 1, justifyContent: "center", minHeight: 52,
  },
  saveBtnDisabled: { opacity: 0.5 },
});
