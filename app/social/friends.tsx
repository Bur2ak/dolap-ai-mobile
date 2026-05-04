import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

import { PremiumGate } from "@/components/shared/PremiumGate";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useSocial } from "@/hooks/useSocial";
import { useSubscription } from "@/hooks/useSubscription";
import type { Friendship, Profile } from "@/types";

export default function FriendsScreen() {
  const { premium } = useSubscription();
  const {
    userId,
    friendships,
    isLoading,
    searchUsers,
    searchResults,
    isSearching,
    sendFriendRequest,
    updateFriendshipStatus,
    deleteFriendship,
    isMutating,
  } = useSocial();
  const [query, setQuery] = useState("");

  async function handleSearch() {
    try {
      await searchUsers(query);
    } catch (error) {
      Alert.alert("Arama yapilamadi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  async function handleSend(addresseeId: string) {
    try {
      await sendFriendRequest(addresseeId);
      Alert.alert("Istek gonderildi", "Arkadaslik istegi beklemede.");
    } catch (error) {
      Alert.alert("Istek gonderilemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  async function handleStatus(friendshipId: string, status: "accepted" | "blocked") {
    try {
      await updateFriendshipStatus({ friendshipId, status });
    } catch (error) {
      Alert.alert("Guncellenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  function handleDelete(friendship: Friendship) {
    const accepted = friendship.status === "accepted";
    Alert.alert(accepted ? "Arkadasliktan cikar" : "Istegi iptal et", accepted ? "Bu kullanici arkadas listenden kaldirilacak." : "Bekleyen arkadaslik istegi iptal edilecek.", [
      { text: "Vazgec", style: "cancel" },
      {
        text: accepted ? "Cikar" : "Iptal Et",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteFriendship(friendship.id);
          } catch (error) {
            Alert.alert("Guncellenemedi", error instanceof Error ? error.message : "Tekrar dene.");
          }
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} />
        <Text variant="h2">Arkadaslar</Text>
        <View style={styles.headerSpacer} />
      </View>

      {!premium ? (
        <PremiumGate title="Sosyal ozellikler Premium" body="Arkadas dolabi, kombin sorma ve davet akislari Premium planda acilir." />
      ) : (
        <>
          <Card style={styles.searchCard}>
            <Text variant="h3">Kullanici ara</Text>
            <Input label="Kullanici adi veya ad" value={query} onChangeText={setQuery} autoCapitalize="none" />
            <Button title="Ara" onPress={handleSearch} loading={isSearching} />
            <Button title="Davet Linki" variant="secondary" onPress={() => router.push("/social/invite")} />
          </Card>

          {searchResults.length > 0 ? (
            <Card style={styles.section}>
              <Text variant="h3">Sonuclar</Text>
              {searchResults.map((user) => (
                <View key={user.id} style={styles.userRow}>
                  <Avatar profile={user} />
                  <View style={styles.userCopy}>
                    <Text variant="label">{user.full_name ?? "Isimsiz kullanici"}</Text>
                    <Text variant="caption" color="muted">
                      @{user.username ?? "username-yok"}
                    </Text>
                  </View>
                  <Button title="Ekle" variant="secondary" onPress={() => void handleSend(user.id)} loading={isMutating} />
                </View>
              ))}
            </Card>
          ) : null}

          <Card style={styles.section}>
            <Text variant="h3">Istekler ve arkadaslar</Text>
            {isLoading ? (
              <Text variant="body" color="secondary">
                Liste yukleniyor.
              </Text>
            ) : friendships.length > 0 ? (
              friendships.map((friendship) => (
                <FriendshipRow
                  key={friendship.id}
                  friendship={friendship}
                  currentUserId={userId}
                  onAccept={() => void handleStatus(friendship.id, "accepted")}
                  onBlock={() => void handleStatus(friendship.id, "blocked")}
                  onDelete={() => handleDelete(friendship)}
                  loading={isMutating}
                />
              ))
            ) : (
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={36} color={COLORS.primary} />
                <Text variant="body" color="secondary" style={styles.centerText}>
                  Henuz arkadas veya bekleyen istek yok.
                </Text>
              </View>
            )}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function FriendshipRow({
  friendship,
  currentUserId,
  onAccept,
  onBlock,
  onDelete,
  loading,
}: {
  friendship: Friendship;
  currentUserId?: string;
  onAccept: () => void;
  onBlock: () => void;
  onDelete: () => void;
  loading: boolean;
}) {
  const otherProfile = friendship.requester_id === currentUserId ? friendship.addressee : friendship.requester;
  const otherUserId = friendship.requester_id === currentUserId ? friendship.addressee_id : friendship.requester_id;
  const incoming = friendship.addressee_id === currentUserId && friendship.status === "pending";
  const accepted = friendship.status === "accepted";

  return (
    <View style={styles.userRow}>
      <Avatar profile={otherProfile} />
      <View style={styles.userCopy}>
        <Text variant="label">{otherProfile?.full_name ?? "Kullanici"}</Text>
        <Text variant="caption" color="muted">
          {friendship.status === "pending" ? (incoming ? "Senden cevap bekliyor" : "Istek gonderildi") : friendship.status}
        </Text>
      </View>
      {incoming ? <Button title="Kabul" variant="secondary" onPress={onAccept} loading={loading} /> : null}
      {accepted ? <Button title="Dolap" variant="secondary" onPress={() => router.push(`/social/${otherUserId}`)} /> : null}
      {friendship.status !== "blocked" ? (
        <Button title={accepted ? "Cikar" : "Iptal"} variant="ghost" onPress={onDelete} loading={loading} />
      ) : null}
      <Button title="Engelle" variant="ghost" onPress={onBlock} loading={loading} />
    </View>
  );
}

function Avatar({ profile }: { profile?: Pick<Profile, "full_name" | "username" | "avatar_url"> | null }) {
  return (
    <View style={styles.avatar}>
      <Text variant="label" color="inverse">
        {(profile?.full_name?.[0] ?? profile?.username?.[0] ?? "D").toUpperCase()}
      </Text>
    </View>
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
  searchCard: {
    gap: SPACING.md,
  },
  section: {
    gap: SPACING.md,
  },
  userRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  userCopy: {
    flex: 1,
  },
  empty: {
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: 24,
  },
  centerText: {
    textAlign: "center",
  },
});
