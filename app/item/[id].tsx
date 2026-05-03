import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Image, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { CATEGORIES } from "@/constants/categories";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useWardrobeItem } from "@/hooks/useWardrobe";

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { item, isLoading, markWorn, deleteItem, isUpdating } = useWardrobeItem(id);

  const categoryLabel = CATEGORIES.find((category) => category.value === item?.category)?.label ?? item?.category;

  async function handleMarkWorn() {
    if (!item) {
      return;
    }

    try {
      await markWorn(item);
    } catch (error) {
      Alert.alert("Guncellenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  function handleDelete() {
    Alert.alert("Kiyafeti sil", "Bu kiyafet dolabindan kaldirilacak.", [
      { text: "Vazgec", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteItem();
            router.replace("/(tabs)");
          } catch (error) {
            Alert.alert("Silinemedi", error instanceof Error ? error.message : "Tekrar dene.");
          }
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} />
        <Text variant="h2">Kiyafet Detay</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <Card style={styles.empty}>
          <Ionicons name="sync-outline" size={40} color={COLORS.primary} />
          <Text variant="h3">Kiyafet yukleniyor</Text>
        </Card>
      ) : item ? (
        <>
          <Image source={{ uri: item.image_url }} style={styles.heroImage} />

          <Card style={styles.summary}>
            <Text variant="caption" color="muted">
              {categoryLabel}
            </Text>
            <Text variant="h1">{item.subcategory ?? "Kiyafet"}</Text>
            <Text variant="body" color="secondary">
              {item.brand ? `${item.brand} markasi` : "Marka bilgisi eklenmemis"}
            </Text>
          </Card>

          <View style={styles.stats}>
            <Card style={styles.statCard}>
              <Text variant="caption" color="muted">
                Giyilme
              </Text>
              <Text variant="h2">{item.wear_count}</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text variant="caption" color="muted">
                Son giyilme
              </Text>
              <Text variant="h3">{item.last_worn ?? "Yok"}</Text>
            </Card>
          </View>

          <Card style={styles.meta}>
            <Text variant="h3">Metadata</Text>
            <Text variant="body" color="secondary">
              Renkler: {item.colors.length > 0 ? item.colors.join(", ") : "Yok"}
            </Text>
            <Text variant="body" color="secondary">
              Sezon: {item.season.length > 0 ? item.season.join(", ") : "Yok"}
            </Text>
            <Text variant="body" color="secondary">
              Fiyat: {item.purchase_price ? `${item.purchase_price} TL` : "Yok"}
            </Text>
          </Card>

          <View style={styles.actions}>
            <Button title="Bugun Giydim" onPress={handleMarkWorn} loading={isUpdating} />
            <Button title="Sil" variant="secondary" onPress={handleDelete} loading={isUpdating} />
          </View>
        </>
      ) : (
        <Card style={styles.empty}>
          <Text variant="h3">Kiyafet bulunamadi</Text>
          <Text variant="body" color="secondary" style={styles.centerText}>
            Silinmis olabilir veya dolabina ait olmayabilir.
          </Text>
        </Card>
      )}
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
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerSpacer: {
    width: 72,
  },
  heroImage: {
    aspectRatio: 4 / 5,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    width: "100%",
  },
  summary: {
    gap: SPACING.xs,
  },
  stats: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
    gap: SPACING.xs,
  },
  meta: {
    gap: SPACING.sm,
  },
  actions: {
    gap: SPACING.sm,
    paddingBottom: SPACING.xl,
  },
  empty: {
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: 40,
  },
  centerText: {
    textAlign: "center",
  },
});
