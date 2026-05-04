import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { usePriceTracking } from "@/hooks/usePriceTracking";
import { useSubscription } from "@/hooks/useSubscription";
import type { PriceTracking } from "@/types";
import { formatCurrency } from "@/utils/formatters";

export default function PriceTrackingScreen() {
  const {
    trackings,
    createTracking,
    updateTracking,
    deleteTracking,
    checkPrices,
    isCreating,
    isUpdating,
    isDeleting,
    isChecking,
    canUse,
  } = usePriceTracking();
  const { isLimitReached } = useSubscription();
  const [productName, setProductName] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [store, setStore] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [targetPrice, setTargetPrice] = useState("");

  async function handleCreate() {
    if (!canUse) {
      Alert.alert("Giris gerekli", "Fiyat takibi icin once giris yapmalisin.");
      return;
    }

    if (isLimitReached("PRICE_TRACKING_ITEMS", trackings.length)) {
      router.push("/paywall");
      return;
    }

    if (!productName.trim()) {
      Alert.alert("Urun adi gerekli", "Takip edecegin urune bir ad ver.");
      return;
    }

    try {
      await createTracking({
        product_name: productName.trim(),
        product_url: productUrl.trim() || null,
        store: store.trim() || null,
        current_price: currentPrice.trim() ? Number(currentPrice.replace(",", ".")) : null,
        target_price: targetPrice.trim() ? Number(targetPrice.replace(",", ".")) : null,
      });
      setProductName("");
      setProductUrl("");
      setStore("");
      setCurrentPrice("");
      setTargetPrice("");
    } catch (error) {
      Alert.alert("Takip eklenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  async function handleDelete(id: string) {
    Alert.alert("Takibi sil", "Bu fiyat takibi listenden kaldirilacak.", [
      { text: "Vazgec", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteTracking(id);
          } catch (error) {
            Alert.alert("Silinemedi", error instanceof Error ? error.message : "Tekrar dene.");
          }
        },
      },
    ]);
  }

  async function handleCheckPrices() {
    if (!canUse) {
      Alert.alert("Giris gerekli", "Fiyatlari kontrol etmek icin once giris yapmalisin.");
      return;
    }

    try {
      const result = await checkPrices();
      Alert.alert("Kontrol tamam", `${result.checked} urun kontrol edildi, ${result.updated} fiyat guncellendi.`);
    } catch (error) {
      Alert.alert("Kontrol edilemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} />
        <Text variant="h2">Fiyat Takibi</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Card style={styles.form}>
        <Text variant="h3">Yeni takip</Text>
        <Input label="Urun adi" value={productName} onChangeText={setProductName} />
        <Input label="Magaza" value={store} onChangeText={setStore} />
        <Input label="Urun linki" value={productUrl} onChangeText={setProductUrl} autoCapitalize="none" />
        <Input label="Mevcut fiyat" value={currentPrice} onChangeText={setCurrentPrice} keyboardType="decimal-pad" />
        <Input label="Hedef fiyat" value={targetPrice} onChangeText={setTargetPrice} keyboardType="decimal-pad" />
        <Button title="Takibe Ekle" onPress={handleCreate} loading={isCreating} />
      </Card>

      <View style={styles.list}>
        <View style={styles.listHeader}>
          <Text variant="h3">Takip listesi</Text>
          <Button title="Kontrol Et" variant="secondary" onPress={handleCheckPrices} loading={isChecking} />
        </View>
        {trackings.length > 0 ? (
          trackings.map((tracking) => (
            <TrackingCard
              key={tracking.id}
              tracking={tracking}
              onDelete={handleDelete}
              onUpdate={updateTracking}
              isDeleting={isDeleting}
              isUpdating={isUpdating}
            />
          ))
        ) : (
          <Card style={styles.empty}>
            <Ionicons name="pricetag-outline" size={36} color={COLORS.primary} />
            <Text variant="body" color="secondary" style={styles.centerText}>
              Henuz takip edilen urun yok.
            </Text>
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

function TrackingCard({
  tracking,
  onDelete,
  onUpdate,
  isDeleting,
  isUpdating,
}: {
  tracking: PriceTracking;
  onDelete: (id: string) => Promise<void>;
  onUpdate: ReturnType<typeof usePriceTracking>["updateTracking"];
  isDeleting: boolean;
  isUpdating: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(tracking.product_name);
  const [store, setStore] = useState(tracking.store ?? "");
  const [url, setUrl] = useState(tracking.product_url ?? "");
  const [currentPrice, setCurrentPrice] = useState(tracking.current_price ? String(tracking.current_price) : "");
  const [targetPrice, setTargetPrice] = useState(tracking.target_price ? String(tracking.target_price) : "");

  useEffect(() => {
    setName(tracking.product_name);
    setStore(tracking.store ?? "");
    setUrl(tracking.product_url ?? "");
    setCurrentPrice(tracking.current_price ? String(tracking.current_price) : "");
    setTargetPrice(tracking.target_price ? String(tracking.target_price) : "");
  }, [tracking]);

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert("Urun adi gerekli", "Takip kaydi icin urun adi bos olamaz.");
      return;
    }

    try {
      await onUpdate({
        trackingId: tracking.id,
        input: {
          current_price: currentPrice.trim() ? Number(currentPrice.replace(",", ".")) : null,
          product_name: name.trim(),
          product_url: url.trim() || null,
          store: store.trim() || null,
          target_price: targetPrice.trim() ? Number(targetPrice.replace(",", ".")) : null,
        },
      });
      setIsEditing(false);
    } catch (error) {
      Alert.alert("Guncellenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  return (
    <Card style={styles.trackingCard}>
      <View style={styles.trackingHeader}>
        <View style={styles.trackingCopy}>
          <Text variant="h3">{tracking.product_name}</Text>
          <Text variant="body" color="secondary">
            {tracking.store ?? "Magaza belirtilmedi"}
          </Text>
        </View>
        <View style={styles.cardActions}>
          <Pressable style={styles.iconButton} onPress={() => setIsEditing((value) => !value)} disabled={isUpdating}>
            <Ionicons name={isEditing ? "close-outline" : "create-outline"} size={20} color={COLORS.primary} />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => void onDelete(tracking.id)} disabled={isDeleting}>
            <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
          </Pressable>
        </View>
      </View>

      {isEditing ? (
        <View style={styles.editForm}>
          <Input label="Urun adi" value={name} onChangeText={setName} />
          <Input label="Magaza" value={store} onChangeText={setStore} />
          <Input label="Urun linki" value={url} onChangeText={setUrl} autoCapitalize="none" />
          <Input label="Mevcut fiyat" value={currentPrice} onChangeText={setCurrentPrice} keyboardType="decimal-pad" />
          <Input label="Hedef fiyat" value={targetPrice} onChangeText={setTargetPrice} keyboardType="decimal-pad" />
          <Button title="Degisiklikleri Kaydet" onPress={handleSave} loading={isUpdating} />
        </View>
      ) : (
        <View style={styles.priceRow}>
          <Text variant="body" color="secondary">
            Mevcut: {tracking.current_price ? formatCurrency(tracking.current_price) : "Yok"}
          </Text>
          <Text variant="body" color="secondary">
            Hedef: {tracking.target_price ? formatCurrency(tracking.target_price) : "Yok"}
          </Text>
        </View>
      )}
    </Card>
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
    paddingBottom: SPACING.xl,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerSpacer: {
    width: 72,
  },
  form: {
    gap: SPACING.md,
  },
  list: {
    gap: SPACING.sm,
  },
  listHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
    justifyContent: "space-between",
  },
  trackingCard: {
    gap: SPACING.md,
  },
  trackingHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
    justifyContent: "space-between",
  },
  trackingCopy: {
    flex: 1,
  },
  cardActions: {
    flexDirection: "row",
    gap: SPACING.xs,
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  priceRow: {
    gap: SPACING.xs,
  },
  editForm: {
    gap: SPACING.sm,
  },
  empty: {
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: 28,
  },
  centerText: {
    textAlign: "center",
  },
});
