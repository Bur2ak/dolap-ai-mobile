import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import { router } from "expo-router";
import { useState } from "react";
import { ActionSheetIOS, Alert, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

import { CachedImage } from "@/components/ui/CachedImage";
import { EmptyState } from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { FONTS, FONT_SIZE } from "@/constants/typography";
import { SPACING } from "@/constants/spacing";
import { useColorDna } from "@/hooks/useColorDna";
import { useImagePicker } from "@/hooks/useImagePicker";
import { captureError, captureEvent } from "@/lib/observability";

const UNDERTONE_LABELS: Record<string, string> = {
  warm: "Sıcak ton",
  cool: "Soğuk ton",
  neutral: "Nötr ton",
};

const SEASON_LABELS: Record<string, string> = {
  spring: "İlkbahar",
  summer: "Yaz",
  autumn: "Sonbahar",
  winter: "Kış",
};

const SEASON_DESC: Record<string, string> = {
  spring: "Parlak, sıcak ve canlı renkler",
  summer: "Yumuşak, serin ve pastel tonlar",
  autumn: "Zengin, sıcak ve toprak tonları",
  winter: "Keskin, soğuk ve kontrast renkler",
};

export default function ColorDnaScreen() {
  const { dna, isLoading, analyze, isAnalyzing } = useColorDna();
  const { pickFromLibrary, takePhoto } = useImagePicker();
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  function handlePickPhoto() {
    if (isAnalyzing) return;
    // KVKK: selfie analizi öncesi açık rıza
    Alert.alert(
      "Fotoğraf İşleme Onayı",
      "Selfie'n yalnızca ten tonu ve renk paleti analizi için yapay zekâya gönderilir. " +
      "Fotoğrafın sunucularımızda saklanmaz, biyometrik kimlik verisi olarak işlenmez ve analiz sonrası silinir. " +
      "Devam etmek istiyor musun?",
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Onaylıyorum", onPress: () => { captureEvent("color_dna_consent_given"); openPicker(); } },
      ],
    );
  }

  function openPicker() {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Vazgeç", "Fotoğraf Çek", "Galeriden Seç"], cancelButtonIndex: 0 },
        async (i) => {
          if (i === 1) await runAnalysis("camera");
          if (i === 2) await runAnalysis("library");
        },
      );
    } else {
      Alert.alert("Selfie Seç", "Yüzün net görünen bir fotoğraf seç", [
        { text: "Vazgeç", style: "cancel" },
        { text: "Fotoğraf Çek", onPress: () => void runAnalysis("camera") },
        { text: "Galeriden Seç", onPress: () => void runAnalysis("library") },
      ]);
    }
  }

  async function runAnalysis(source: "camera" | "library") {
    try {
      const uri = source === "camera" ? await takePhoto() : await pickFromLibrary();
      if (!uri) return;
      setPreviewUri(uri);

      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const mimeType = uri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";

      captureEvent("color_dna_analysis_started", { source });
      await analyze({ imageBase64: base64, mimeType });
      captureEvent("color_dna_analysis_completed");
    } catch (err) {
      captureError(err, { area: "color_dna_analysis", source });
      Alert.alert("Analiz başarısız", err instanceof Error ? err.message : "Tekrar dene.");
      setPreviewUri(null);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <Text variant="h2">Renk DNA</Text>
        <View style={styles.spacer} />
      </View>

      {/* Intro */}
      <View style={styles.introCard}>
        <View style={styles.introIcon}>
          <Ionicons name="color-palette-outline" size={26} color={COLORS.accentText} />
        </View>
        <Text variant="h3">Kişisel renk paletini keşfet</Text>
        <Text variant="body" color="secondary" style={styles.introDesc}>
          Yüzünün bir selfie'sini ver, AI ten tonunu analiz etsin. Sana en yakışan renkleri
          ve kaçınman gerekenleri öğren.
        </Text>
      </View>

      {/* Action / Preview */}
      {isAnalyzing ? (
        <View style={styles.loadingCard}>
          {previewUri && <CachedImage accessibilityLabel="Analiz ediliyor" sourceUri={previewUri} style={styles.previewImage} />}
          <Ionicons name="sparkles" size={28} color={COLORS.accentText} />
          <Text variant="h3">Analiz ediliyor...</Text>
          <Text variant="body" color="secondary">AI ten tonu ve renk paletini çıkarıyor.</Text>
        </View>
      ) : dna ? (
        <ResultView dna={dna} onRetake={handlePickPhoto} previewUri={previewUri} />
      ) : isLoading ? (
        <EmptyState icon="sync-outline" title="Yükleniyor" body="" />
      ) : (
        <View style={styles.ctaCard}>
          <Text variant="h3">Henüz analiz yok</Text>
          <Text variant="body" color="secondary">İyi aydınlatılmış, yüzün net görünen bir selfie seç.</Text>
          <TouchableOpacity style={styles.cta} onPress={handlePickPhoto} activeOpacity={0.85}>
            <Ionicons name="camera" size={18} color={COLORS.textInverse} />
            <Text variant="label" color="inverse">Selfie Seç</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

function ResultView({ dna, onRetake, previewUri }: { dna: NonNullable<ReturnType<typeof useColorDna>["dna"]>; onRetake: () => void; previewUri: string | null }) {
  return (
    <>
      {/* Hero */}
      <View style={styles.heroCard}>
        {previewUri && (
          <CachedImage accessibilityLabel="Selfie" sourceUri={previewUri} style={styles.heroImage} />
        )}
        <View style={styles.heroInfo}>
          <Text variant="caption" style={styles.heroLabel}>RENK PROFİLİN</Text>
          <Text variant="h2" style={styles.heroTitle}>
            {UNDERTONE_LABELS[dna.undertone]} · {SEASON_LABELS[dna.seasonal_palette]}
          </Text>
          <Text variant="body" color="secondary">{dna.description}</Text>
          <View style={styles.confidenceRow}>
            <View style={styles.confidenceDot} />
            <Text variant="caption" color="muted">Güven %{dna.confidence}</Text>
          </View>
        </View>
      </View>

      {/* Season info */}
      <View style={styles.section}>
        <Text variant="h3">Sezon: {SEASON_LABELS[dna.seasonal_palette]}</Text>
        <Text variant="body" color="secondary">{SEASON_DESC[dna.seasonal_palette]}</Text>
      </View>

      {/* Best colors */}
      {dna.best_colors.length > 0 && (
        <View style={styles.section}>
          <Text variant="h3">Sana Yakışan Renkler</Text>
          <View style={styles.colorGrid}>
            {dna.best_colors.map((color) => (
              <View key={color} style={styles.colorItem}>
                <View style={[styles.colorSwatch, { backgroundColor: color }]} />
                <Text variant="caption" color="muted" style={styles.colorHex}>{color}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Avoid colors */}
      {dna.avoid_colors.length > 0 && (
        <View style={styles.section}>
          <Text variant="h3">Kaçınman İyi Olacak</Text>
          <View style={styles.colorGrid}>
            {dna.avoid_colors.map((color) => (
              <View key={color} style={styles.colorItem}>
                <View style={[styles.colorSwatch, styles.colorSwatchAvoid, { backgroundColor: color }]} />
                <Text variant="caption" color="muted" style={styles.colorHex}>{color}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Retake */}
      <TouchableOpacity style={styles.retakeBtn} onPress={onRetake} activeOpacity={0.7}>
        <Ionicons name="refresh-outline" size={16} color={COLORS.textSecondary} />
        <Text variant="label" color="secondary">Yeniden Analiz Et</Text>
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 100 },

  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingTop: 60,
    paddingBottom: SPACING.md,
  },
  backBtn: { padding: 4 },
  spacer: { width: 30 },

  introCard: {
    alignItems: "flex-start",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    padding: SPACING.md,
  },
  introIcon: {
    alignItems: "center",
    backgroundColor: COLORS.accentSoft,
    borderRadius: 12,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  introDesc: { lineHeight: 22 },

  ctaCard: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 16,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    padding: SPACING.lg,
  },
  cta: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    flexDirection: "row",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },

  loadingCard: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    padding: SPACING.lg,
  },
  previewImage: {
    borderRadius: 80,
    height: 120,
    width: 120,
  },

  // Result
  heroCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    overflow: "hidden",
    padding: SPACING.md,
  },
  heroImage: {
    alignSelf: "center",
    borderColor: COLORS.accent,
    borderRadius: 80,
    borderWidth: 3,
    height: 140,
    width: 140,
  },
  heroInfo: { alignItems: "center", gap: 6 },
  heroLabel: { color: COLORS.accentText, fontFamily: FONTS.sansMedium, letterSpacing: 0.8 },
  heroTitle: { fontFamily: FONTS.displayBold, letterSpacing: -0.3, textAlign: "center" },
  confidenceRow: { alignItems: "center", flexDirection: "row", gap: 5, marginTop: 4 },
  confidenceDot: { backgroundColor: COLORS.cta, borderRadius: 999, height: 6, width: 6 },

  section: { gap: SPACING.sm, marginTop: SPACING.lg, paddingHorizontal: SPACING.lg },

  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  colorItem: { alignItems: "center", gap: 4, width: 64 },
  colorSwatch: {
    borderColor: COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    height: 64,
    width: 64,
  },
  colorSwatchAvoid: { opacity: 0.7 },
  colorHex: { fontSize: 9 },

  retakeBtn: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
});
