import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { FlatList, Image, StyleSheet, View } from "react-native";

import { PremiumGate } from "@/components/shared/PremiumGate";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { CATEGORIES } from "@/constants/categories";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useFriendWardrobe } from "@/hooks/useSocial";
import { useSubscription } from "@/hooks/useSubscription";
import type { FriendWardrobe, WardrobeItem } from "@/types";

export default function FriendWardrobeScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { premium } = useSubscription();
  const { data, isLoading, error } = useFriendWardrobe(userId);

  const visibleItems = data?.profile.privacy_settings.wardrobe_visible ? data.items : [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} />
        <Text variant="h2">Arkadas Dolabi</Text>
        <View style={styles.headerSpacer} />
      </View>

      {!premium ? (
        <PremiumGate title="Arkadas dolabi Premium" body="Arkadaslarinin paylastigi parcalari gormek icin Premium gerekir." />
      ) : error ? (
        <Card style={styles.empty}>
          <Ionicons name="lock-closed-outline" size={40} color={COLORS.primary} />
          <Text variant="h3">Dolap acilamadi</Text>
          <Text variant="body" color="secondary" style={styles.centerText}>
            Arkadaslik onayi veya gizlilik izni gerekiyor olabilir.
          </Text>
        </Card>
      ) : isLoading ? (
        <Card style={styles.empty}>
          <Ionicons name="sync-outline" size={40} color={COLORS.primary} />
          <Text variant="h3">Dolap yukleniyor</Text>
        </Card>
      ) : data ? (
        <FlatList
          data={visibleItems}
          keyExtractor={(item) => item.id}
          numColumns={2}
          ListHeaderComponent={<ProfileHeader data={data} />}
          ListEmptyComponent={<EmptySharedWardrobe />}
          columnWrapperStyle={visibleItems.length > 0 ? styles.gridRow : undefined}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => <SharedWardrobeItem item={item} />}
        />
      ) : null}
    </View>
  );
}

function ProfileHeader({ data }: { data: FriendWardrobe }) {
  return (
    <Card style={styles.profileCard}>
      <View style={styles.avatar}>
        <Text variant="h2" color="inverse">
          {(data.profile.full_name?.[0] ?? data.profile.username?.[0] ?? "D").toUpperCase()}
        </Text>
      </View>
      <View style={styles.profileCopy}>
        <Text variant="h3">{data.profile.full_name ?? "Shipirio kullanicisi"}</Text>
        <Text variant="caption" color="muted">
          @{data.profile.username ?? "username-yok"}
        </Text>
        {data.profile.bio ? (
          <Text variant="body" color="secondary">
            {data.profile.bio}
          </Text>
        ) : null}
        <Text variant="body" color="secondary">
          {data.items.length} paylasilan kiyafet
        </Text>
      </View>
    </Card>
  );
}

function SharedWardrobeItem({ item }: { item: WardrobeItem }) {
  const categoryLabel = CATEGORIES.find((category) => category.value === item.category)?.label ?? item.category;

  return (
    <View style={styles.itemPressable}>
      <Card style={styles.itemCard}>
        {item.thumbnail_url || item.image_url ? (
          <Image source={{ uri: item.thumbnail_url ?? item.image_url }} style={styles.itemImage} />
        ) : (
          <View style={[styles.colorBlock, { backgroundColor: item.dominant_color_hex ?? COLORS.primarySoft }]} />
        )}
        <Text variant="label">{item.subcategory ?? categoryLabel}</Text>
        <Text variant="caption" color="muted">
          {item.is_lendable ? "Odunc alinabilir" : `${item.wear_count} kez giyildi`}
        </Text>
      </Card>
    </View>
  );
}

function EmptySharedWardrobe() {
  return (
    <Card style={styles.empty}>
      <Ionicons name="shirt-outline" size={42} color={COLORS.primary} />
      <Text variant="h3" style={styles.centerText}>
        Paylasilan kiyafet yok
      </Text>
      <Text variant="body" color="secondary" style={styles.centerText}>
        Arkadasin dolabini acmis olsa bile sadece paylasilabilir isaretlenen parcalar burada gorunur.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    flex: 1,
    padding: SPACING.lg,
    paddingTop: 56,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
  },
  headerSpacer: {
    width: 72,
  },
  profileCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  profileCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  grid: {
    gap: SPACING.md,
    paddingBottom: 120,
  },
  gridRow: {
    gap: SPACING.md,
  },
  itemPressable: {
    flex: 1,
  },
  itemCard: {
    flex: 1,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    minHeight: 176,
  },
  itemImage: {
    aspectRatio: 4 / 5,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    width: "100%",
  },
  colorBlock: {
    borderRadius: 8,
    height: 104,
    width: "100%",
  },
  empty: {
    alignItems: "center",
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingVertical: 40,
  },
  centerText: {
    textAlign: "center",
  },
});
