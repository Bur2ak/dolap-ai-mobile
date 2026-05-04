import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { usePriceTracking } from "@/hooks/usePriceTracking";
import { useSubscription } from "@/hooks/useSubscription";
import { formatCurrency } from "@/utils/formatters";

export default function PriceTrackingScreen() {
  const { trackings, createTracking, deleteTracking, checkPrices, isCreating, isDeleting, isChecking, canUse } = usePriceTracking();
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
    try {
      await deleteTracking(id);
    } catch (error) {
      Alert.alert("Silinemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
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
            <Card key={tracking.id} style={styles.trackingCard}>
              <View style={styles.trackingHeader}>
                <View style={styles.trackingCopy}>
                  <Text variant="h3">{tracking.product_name}</Text>
                  <Text variant="body" color="secondary">
                    {tracking.store ?? "Magaza belirtilmedi"}
                  </Text>
                </View>
                <Pressable style={styles.deleteButton} onPress={() => void handleDelete(tracking.id)} disabled={isDeleting}>
                  <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
                </Pressable>
              </View>
              <View style={styles.priceRow}>
                <Text variant="body" color="secondary">
                  Mevcut: {tracking.current_price ? formatCurrency(tracking.current_price) : "Yok"}
                </Text>
                <Text variant="body" color="secondary">
                  Hedef: {tracking.target_price ? formatCurrency(tracking.target_price) : "Yok"}
                </Text>
              </View>
            </Card>
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
  deleteButton: {
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
  empty: {
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: 28,
  },
  centerText: {
    textAlign: "center",
  },
});
