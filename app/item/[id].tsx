import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { CATEGORIES } from "@/constants/categories";
import { COLORS } from "@/constants/colors";
import { SEASONS } from "@/constants/seasons";
import { SPACING } from "@/constants/spacing";
import { useWardrobeItem } from "@/hooks/useWardrobe";
import type { ClothingCategory, Season } from "@/types";

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { item, isLoading, updateItem, markWorn, deleteItem, isUpdating } = useWardrobeItem(id);
  const [isEditing, setIsEditing] = useState(false);
  const [category, setCategory] = useState<ClothingCategory>("ust");
  const [subcategory, setSubcategory] = useState("");
  const [colors, setColors] = useState("");
  const [brand, setBrand] = useState("");
  const [price, setPrice] = useState("");
  const [seasons, setSeasons] = useState<Season[]>([]);

  const categoryLabel = CATEGORIES.find((category) => category.value === item?.category)?.label ?? item?.category;

  useEffect(() => {
    if (!item) {
      return;
    }

    setCategory(item.category);
    setSubcategory(item.subcategory ?? "");
    setColors(item.colors.join(", "));
    setBrand(item.brand ?? "");
    setPrice(item.purchase_price ? String(item.purchase_price) : "");
    setSeasons(item.season);
  }, [item]);

  function toggleSeason(season: Season) {
    setSeasons((current) => (current.includes(season) ? current.filter((item) => item !== season) : [...current, season]));
  }

  async function handleSaveEdits() {
    if (!item) {
      return;
    }

    try {
      await updateItem({
        brand: brand.trim() || null,
        category,
        colors: colors
          .split(",")
          .map((color) => color.trim())
          .filter(Boolean),
        purchase_price: price.trim() ? Number(price.replace(",", ".")) : null,
        season: seasons,
        subcategory: subcategory.trim() || null,
      });
      setIsEditing(false);
      Alert.alert("Kaydedildi", "Kiyafet bilgileri guncellendi.");
    } catch (error) {
      Alert.alert("Kaydedilemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

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

  async function handleShareableToggle() {
    if (!item) {
      return;
    }

    try {
      await updateItem({ is_shareable: !item.is_shareable });
    } catch (error) {
      Alert.alert("Guncellenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  async function handleLendableToggle() {
    if (!item) {
      return;
    }

    try {
      await updateItem({ is_lendable: !item.is_lendable });
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
            <Button title={isEditing ? "Duzenlemeyi Kapat" : "Bilgileri Duzenle"} variant="secondary" onPress={() => setIsEditing((value) => !value)} />
          </Card>

          {isEditing ? (
            <Card style={styles.editCard}>
              <Text variant="h3">Bilgileri duzenle</Text>

              <Text variant="label">Kategori</Text>
              <View style={styles.wrap}>
                {CATEGORIES.map((itemCategory) => {
                  const active = itemCategory.value === category;
                  return (
                    <Button
                      key={itemCategory.value}
                      title={itemCategory.label}
                      variant={active ? "primary" : "secondary"}
                      onPress={() => setCategory(itemCategory.value)}
                      style={styles.chipButton}
                    />
                  );
                })}
              </View>

              <Text variant="label">Sezon</Text>
              <View style={styles.wrap}>
                {SEASONS.map((season) => {
                  const active = seasons.includes(season.value);
                  return (
                    <Button
                      key={season.value}
                      title={season.label}
                      variant={active ? "primary" : "secondary"}
                      onPress={() => toggleSeason(season.value)}
                      style={styles.chipButton}
                    />
                  );
                })}
              </View>

              <Input label="Alt kategori" value={subcategory} onChangeText={setSubcategory} />
              <Input label="Renkler" value={colors} onChangeText={setColors} />
              <Input label="Marka" value={brand} onChangeText={setBrand} />
              <Input label="Fiyat" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
              <Button title="Degisiklikleri Kaydet" onPress={handleSaveEdits} loading={isUpdating} />
            </Card>
          ) : null}

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

          <Card style={styles.meta}>
            <Text variant="h3">Paylasim</Text>
            <Text variant="body" color="secondary">
              Arkadas dolabinda gorunme: {item.is_shareable ? "Acik" : "Kapali"}
            </Text>
            <Text variant="body" color="secondary">
              Odunc verilebilir: {item.is_lendable ? "Evet" : "Hayir"}
            </Text>
            <View style={styles.inlineActions}>
              <Button
                title={item.is_shareable ? "Paylasimi Kapat" : "Paylas"}
                variant="secondary"
                onPress={() => void handleShareableToggle()}
                loading={isUpdating}
              />
              <Button
                title={item.is_lendable ? "Odunc Kapat" : "Odunc Verilebilir"}
                variant="ghost"
                onPress={() => void handleLendableToggle()}
                loading={isUpdating}
              />
            </View>
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
  editCard: {
    gap: SPACING.md,
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
  inlineActions: {
    gap: SPACING.sm,
  },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  chipButton: {
    minHeight: 40,
    paddingHorizontal: SPACING.md,
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
