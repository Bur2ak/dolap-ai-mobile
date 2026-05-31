import { Ionicons } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Alert, StyleSheet, TouchableOpacity, View } from "react-native";
import { captureRef } from "react-native-view-shot";

import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/typography";
import { SPACING } from "@/constants/spacing";
import { useColorDna } from "@/hooks/useColorDna";
import { useWardrobeAnalytics } from "@/hooks/useWardrobeAnalytics";
import { captureError, captureEvent } from "@/lib/observability";

export default function StyleDnaCardScreen() {
  const { analytics } = useWardrobeAnalytics();
  const { dna } = useColorDna();
  const cardRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);

  const profile = analytics.style_profile;
  const score = Math.round((analytics.utilization_score + analytics.sustainability_score) / 2);

  async function handleShare() {
    if (isSharing) return;
    try {
      setIsSharing(true);
      const uri = await captureRef(cardRef, { format: "png", quality: 1 });
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert("Paylaşım yok", "Bu cihazda paylaşım kullanılamıyor.");
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Stil DNA'mı paylaş" });
      captureEvent("style_dna_card_shared", { label: profile?.label });
    } catch (err) {
      captureError(err, { area: "style_dna_card_share" });
      Alert.alert("Paylaşılamadı", err instanceof Error ? err.message : "Tekrar dene.");
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <Text variant="h2">Stil DNA Kartım</Text>
        <View style={styles.spacer} />
      </View>

      <View style={styles.cardWrap}>
        {/* Paylaşılacak kart — captureRef ile görsele dönüşür */}
        <View ref={cardRef} collapsable={false} style={styles.card}>
          {/* Logo */}
          <View style={styles.cardHeader}>
            <Ionicons name="shirt-outline" size={18} color={COLORS.textInverse} />
            <Text variant="label" color="inverse" style={styles.cardLogo}>Shipirio</Text>
          </View>

          {/* Score circle */}
          <View style={styles.scoreCircle}>
            <Text variant="display" style={styles.scoreText}>%{score > 0 ? score : 92}</Text>
            <Text variant="caption" style={styles.scoreLabel}>STİL UYUMU</Text>
          </View>

          {/* Style label */}
          <Text variant="caption" style={styles.dnaLabel}>STİL DNA</Text>
          <Text variant="h1" style={styles.dnaTitle}>{profile?.label ?? "Zamansız Minimal"}</Text>
          <Text variant="body" style={styles.dnaSummary}>
            {profile?.summary ?? "Sade, dengeli ve zamansız parçaları seven bir stil."}
          </Text>

          {/* Signal tags */}
          <View style={styles.tagRow}>
            {(profile?.signals ?? ["Minimal", "Zarif", "Dengeli"]).slice(0, 4).map((sig) => (
              <View key={sig} style={styles.tag}>
                <Text variant="caption" style={styles.tagText}>{sig}</Text>
              </View>
            ))}
          </View>

          {/* Color DNA palette (varsa) */}
          {dna && dna.best_colors.length > 0 && (
            <View style={styles.paletteRow}>
              {dna.best_colors.slice(0, 6).map((c) => (
                <View key={c} style={[styles.swatch, { backgroundColor: c }]} />
              ))}
            </View>
          )}

          <Text variant="caption" style={styles.cardFooter}>shipirio.com · Stilini keşfet</Text>
        </View>
      </View>

      {/* Share button */}
      <TouchableOpacity style={[styles.shareBtn, isSharing && styles.shareBtnDisabled]} onPress={handleShare} disabled={isSharing} activeOpacity={0.85}>
        <Ionicons name="share-social-outline" size={18} color={COLORS.textInverse} />
        <Text variant="label" color="inverse">{isSharing ? "Hazırlanıyor..." : "Paylaş"}</Text>
      </TouchableOpacity>
      <Text variant="caption" color="muted" style={styles.hint}>
        Instagram story&apos;ne, arkadaşlarına paylaş — stilini keşfetsinler
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.background, flex: 1 },
  header: {
    alignItems: "center", flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: SPACING.lg, paddingTop: 60, paddingBottom: SPACING.md,
  },
  backBtn: { padding: 4 },
  spacer: { width: 30 },

  cardWrap: { alignItems: "center", flex: 1, justifyContent: "center", paddingHorizontal: SPACING.lg },
  card: {
    backgroundColor: COLORS.primary,
    borderRadius: 28,
    gap: SPACING.sm,
    overflow: "hidden",
    padding: SPACING.xl,
    width: 320,
  },
  cardHeader: { alignItems: "center", flexDirection: "row", gap: 6, justifyContent: "center", marginBottom: SPACING.sm },
  cardLogo: { fontFamily: FONTS.sansBold, letterSpacing: 0.5 },
  scoreCircle: {
    alignItems: "center",
    alignSelf: "center",
    borderColor: COLORS.accent,
    borderRadius: 999,
    borderWidth: 3,
    height: 130,
    justifyContent: "center",
    marginVertical: SPACING.sm,
    width: 130,
  },
  scoreText: { color: COLORS.textInverse, fontFamily: FONTS.displayBold },
  scoreLabel: { color: "rgba(255,255,255,0.6)", fontFamily: FONTS.sansMedium, letterSpacing: 1 },
  dnaLabel: { color: COLORS.accent, fontFamily: FONTS.sansBold, letterSpacing: 1.5, textAlign: "center" },
  dnaTitle: { color: COLORS.textInverse, fontFamily: FONTS.displayBold, textAlign: "center" },
  dnaSummary: { color: "rgba(255,255,255,0.7)", textAlign: "center" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: SPACING.sm },
  tag: { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 999, paddingHorizontal: SPACING.sm, paddingVertical: 4 },
  tagText: { color: COLORS.textInverse },
  paletteRow: { flexDirection: "row", gap: 6, justifyContent: "center", marginTop: SPACING.md },
  swatch: { borderRadius: 8, height: 28, width: 28 },
  cardFooter: { color: "rgba(255,255,255,0.45)", marginTop: SPACING.md, textAlign: "center" },

  shareBtn: {
    alignItems: "center", alignSelf: "center", backgroundColor: COLORS.primary,
    borderRadius: 14, flexDirection: "row", gap: SPACING.sm, justifyContent: "center",
    marginBottom: SPACING.sm, minHeight: 52, width: 200,
  },
  shareBtnDisabled: { opacity: 0.6 },
  hint: { marginBottom: SPACING.xl, paddingHorizontal: SPACING.lg, textAlign: "center" },
});
