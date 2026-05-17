import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useBrandWishlist } from "@/hooks/useBrandWishlist";
import { captureError, captureEvent } from "@/lib/observability";
import type { BrandWishlistEntry } from "@/lib/api/brandWishlist";

export default function BrandWishlistScreen() {
  const { entries, isLoading, addEntry, isAdding, deleteEntry, isDeleting } = useBrandWishlist();
  const [brandName, setBrandName] = useState("");
  const [storeUrl, setStoreUrl] = useState("");

  async function handleAdd() {
    const name = brandName.trim();
    if (!name) {
      Alert.alert("Marka adı gerekli", "Takip etmek istediğin markanın adını yaz.");
      return;
    }

    const duplicate = entries.some((e) => e.brand_name.toLocaleLowerCase("tr-TR") === name.toLocaleLowerCase("tr-TR"));
    if (duplicate) {
      Alert.alert("Zaten listede", "Bu marka zaten takip listende var.");
      return;
    }

    try {
      await addEntry({
        brand_name: name,
        store_url: storeUrl.trim() || null,
        notify_on_sale: true,
      });
      captureEvent("brand_wishlist_added", { brand_name: name });
      setBrandName("");
      setStoreUrl("");
    } catch (err) {
      captureError(err, { area: "brand_wishlist_screen_add" });
      Alert.alert("Eklenemedi", err instanceof Error ? err.message : "Tekrar dene.");
    }
  }

  function handleDelete(entry: BrandWishlistEntry) {
    Alert.alert("Markayı sil", `"${entry.brand_name}" takip listenden kaldırılacak.`, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteEntry(entry.id);
            captureEvent("brand_wishlist_deleted", { brand_name: entry.brand_name });
          } catch (err) {
            captureError(err, { area: "brand_wishlist_screen_delete" });
            Alert.alert("Silinemedi", err instanceof Error ? err.message : "Tekrar dene.");
          }
        },
      },
    ]);
  }

  async function handleOpenStore(entry: BrandWishlistEntry) {
    const url = entry.store_url ?? buildBrandSearchUrl(entry.brand_name);
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert("Link açılamadı", "Bu bağlantı bu cihazda açılamıyor.");
        return;
      }
      captureEvent("brand_wishlist_store_opened", { brand_name: entry.brand_name });
      await Linking.openURL(url);
    } catch (err) {
      captureError(err, { area: "brand_wishlist_store_open" });
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} />
        <Text variant="h2">Marka Takibi</Text>
        <View style={styles.spacer} />
      </View>

      <Text variant="body" color="secondary">
        Takip ettiğin markalar indirime girdiğinde bildirim al.
      </Text>

      {/* Add form */}
      <Card style={styles.addCard}>
        <Text variant="h3">Marka Ekle</Text>
        <Input
          label="Marka adı"
          value={brandName}
          onChangeText={setBrandName}
          placeholder="Ör. Zara, H&M, Mango"
          editable={!isAdding}
        />
        <Input
          label="Mağaza linki (opsiyonel)"
          value={storeUrl}
          onChangeText={setStoreUrl}
          placeholder="https://www.marka.com"
          keyboardType="url"
          autoCapitalize="none"
          editable={!isAdding}
        />
        <Button
          title="Takibe Al"
          onPress={() => void handleAdd()}
          loading={isAdding}
          disabled={isAdding || !brandName.trim()}
        />
      </Card>

      {/* Entries */}
      {isLoading ? (
        <EmptyState icon="sync-outline" title="Yükleniyor" body="" />
      ) : entries.length === 0 ? (
        <EmptyState
          icon="heart-outline"
          title="Henüz takip yok"
          body="Favori markalarını ekle, indirimlerini kaçırma."
        />
      ) : (
        <Card style={styles.listCard}>
          <Text variant="h3">Takip Edilen Markalar ({entries.length})</Text>
          {entries.map((entry) => (
            <View key={entry.id} style={styles.entryRow}>
              <View style={styles.entryInfo}>
                <Text variant="label">{entry.brand_name}</Text>
                <View style={styles.entryMeta}>
                  <View style={[styles.notifyBadge, entry.notify_on_sale ? styles.notifyActive : styles.notifyMuted]}>
                    <Ionicons
                      name={entry.notify_on_sale ? "notifications" : "notifications-off-outline"}
                      size={12}
                      color={entry.notify_on_sale ? COLORS.surface : COLORS.textMuted}
                    />
                    <Text variant="caption" color={entry.notify_on_sale ? "inverse" : "muted"}>
                      {entry.notify_on_sale ? "Bildirim açık" : "Bildirim kapalı"}
                    </Text>
                  </View>
                  {entry.last_notified_at && (
                    <Text variant="caption" color="muted">
                      Son bildirim: {new Date(entry.last_notified_at).toLocaleDateString("tr-TR")}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.entryActions}>
                <Pressable onPress={() => void handleOpenStore(entry)} style={styles.iconBtn} disabled={isDeleting}>
                  <Ionicons name="open-outline" size={18} color={COLORS.primary} />
                </Pressable>
                <Pressable onPress={() => handleDelete(entry)} style={styles.iconBtn} disabled={isDeleting}>
                  <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                </Pressable>
              </View>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

function buildBrandSearchUrl(brandName: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(brandName + " indirim kampanya")}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { gap: SPACING.md, padding: SPACING.lg, paddingTop: 56, paddingBottom: 120 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  spacer: { width: 72 },
  addCard: { gap: SPACING.md },
  listCard: { gap: SPACING.md },
  entryRow: {
    alignItems: "center",
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  entryInfo: { flex: 1, gap: SPACING.xs },
  entryMeta: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs },
  notifyBadge: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  notifyActive: { backgroundColor: COLORS.primary },
  notifyMuted: { backgroundColor: COLORS.surfaceMuted },
  entryActions: { alignItems: "center", flexDirection: "row", gap: SPACING.sm },
  iconBtn: { padding: SPACING.xs },
});
