import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

import { PremiumGate } from "@/components/shared/PremiumGate";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useSocial } from "@/hooks/useSocial";
import { useSubscription } from "@/hooks/useSubscription";
import { captureError, captureEvent } from "@/lib/observability";
import { getStringParam } from "@/lib/routeParams";
import type { Friendship, Profile } from "@/types";

export default function FriendsScreen() {
  const { invite: inviteParam } = useLocalSearchParams<{ invite?: string | string[] }>();
  const invite = getStringParam(inviteParam);
  const { premium } = useSubscription();
  const {
    userId,
    friendships,
    error,
    isLoading,
    isRefetching,
    refetch,
    searchUsers,
    searchResults,
    isSearching,
    sendFriendRequest,
    updateFriendshipStatus,
    deleteFriendship,
    isMutating,
  } = useSocial();
  const [query, setQuery] = useState("");
  const [handledInvite, setHandledInvite] = useState<string | null>(null);

  useEffect(() => {
    if (!premium || !invite || invite === handledInvite) {
      return;
    }

    const inviteQuery = String(invite).trim();
    if (!inviteQuery) {
      return;
    }

    setQuery(inviteQuery);
    setHandledInvite(inviteQuery);
    void searchUsers(inviteQuery).catch((error) => {
      captureError(error, { area: "friend_invite_search" });
      Alert.alert("Davet acilamadi", error instanceof Error ? error.message : "Tekrar dene.");
    });
  }, [handledInvite, invite, premium, searchUsers]);

  async function handleSearch() {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      Alert.alert("Arama kisa", "En az 2 karakter yazarak tekrar dene.");
      return;
    }

    try {
      const results = await searchUsers(normalizedQuery);
      captureEvent("friend_search_performed", {
        result_count: Array.isArray(results) ? results.length : 0,
        search_length: normalizedQuery.length,
      });
    } catch (error) {
      captureError(error, { area: "friend_search_action" });
      Alert.alert("Arama yapilamadi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  async function handleSend(addresseeId: string) {
    if (isMutating) {
      return;
    }

    try {
      await sendFriendRequest(addresseeId);
      captureEvent("friend_request_sent", { addressee_id: addresseeId });
      Alert.alert("Istek gonderildi", "Arkadaslik istegi beklemede.");
    } catch (error) {
      captureError(error, { area: "friend_request_send_action", addressee_id: addresseeId });
      Alert.alert("Istek gonderilemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  async function handleStatus(friendshipId: string, status: "accepted" | "blocked") {
    if (isMutating) {
      return;
    }

    try {
      const { referralRewarded } = await updateFriendshipStatus({ friendshipId, status });
      captureEvent("friendship_status_changed", { friendship_id: friendshipId, status, referral_rewarded: referralRewarded });
      if (status === "accepted" && referralRewarded) {
        Alert.alert("Arkadas oldunuz", "Davet odulu olarak iki hesaba da 30 gun Premium eklendi.");
      }
    } catch (error) {
      captureError(error, { area: "friendship_status_action", friendship_id: friendshipId, status });
      Alert.alert("Guncellenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  function handleDelete(friendship: Friendship) {
    const accepted = friendship.status === "accepted";
    if (isMutating) {
      return;
    }

    Alert.alert(accepted ? "Arkadasliktan cikar" : "Istegi iptal et", accepted ? "Bu kullanici arkadas listenden kaldirilacak." : "Bekleyen arkadaslik istegi iptal edilecek.", [
      { text: "Vazgec", style: "cancel" },
      {
        text: accepted ? "Cikar" : "Iptal Et",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteFriendship(friendship.id);
            captureEvent("friendship_deleted", { friendship_id: friendship.id, accepted });
          } catch (error) {
            captureError(error, { area: "friendship_delete_action", friendship_id: friendship.id, accepted });
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
            <Button title="Ara" onPress={handleSearch} loading={isSearching} disabled={isSearching || isMutating} />
            <Button title="Davet Linki" variant="secondary" onPress={() => router.push("/social/invite")} disabled={isSearching || isMutating} />
          </Card>

          {searchResults.length > 0 ? (
            <Card style={styles.section}>
              <Text variant="h3">Sonuclar</Text>
              {searchResults.map((user) => {
                const friendship = friendships.find(
                  (item) =>
                    item.requester_id === user.id ||
                    item.addressee_id === user.id,
                );
                const incoming = Boolean(friendship && friendship.addressee_id === userId && friendship.status === "pending");
                const accepted = friendship?.status === "accepted";
                const pending = friendship?.status === "pending";

                return (
                  <View key={user.id} style={styles.userRow}>
                    <Avatar profile={user} />
                    <View style={styles.userCopy}>
                      <Text variant="label">{user.full_name ?? "Isimsiz kullanici"}</Text>
                      <Text variant="caption" color="muted">
                        {getSearchResultStatus(user.username, friendship)}
                      </Text>
                    </View>
                    <View style={styles.rowActions}>
                      {friendship && incoming ? (
                        <Button title="Kabul" variant="secondary" onPress={() => void handleStatus(friendship.id, "accepted")} loading={isMutating} disabled={isMutating} style={styles.compactButton} />
                      ) : accepted ? (
                        <Button title="Dolap" variant="secondary" onPress={() => router.push(`/social/${user.id}`)} disabled={isMutating} style={styles.compactButton} />
                      ) : (
                        <Button title={pending ? "Bekliyor" : "Ekle"} variant="secondary" onPress={() => void handleSend(user.id)} loading={isMutating} disabled={pending || isMutating} style={styles.compactButton} />
                      )}
                    </View>
                  </View>
                );
              })}
            </Card>
          ) : null}

          <Card style={styles.section}>
            <Text variant="h3">Istekler ve arkadaslar</Text>
            {isLoading ? (
              <EmptyState icon="sync-outline" title="Liste yukleniyor" body="Arkadas listen hazirlaniyor." />
            ) : error ? (
              <EmptyState
                icon="cloud-offline-outline"
                title="Arkadas listesi yuklenemedi"
                body="Baglanti veya Supabase tarafinda gecici bir sorun olabilir."
                actionLabel="Tekrar Dene"
                loading={isRefetching}
                onAction={() => void refetch()}
              />
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
              <EmptyState icon="people-outline" title="Arkadas yok" body="Henuz arkadas veya bekleyen istek yok." />
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
      <View style={styles.rowActions}>
        {incoming ? <Button title="Kabul" variant="secondary" onPress={onAccept} loading={loading} disabled={loading} style={styles.compactButton} /> : null}
        {accepted ? <Button title="Dolap" variant="secondary" onPress={() => router.push(`/social/${otherUserId}`)} disabled={loading} style={styles.compactButton} /> : null}
        {friendship.status !== "blocked" ? (
          <Button title={accepted ? "Cikar" : "Iptal"} variant="ghost" onPress={onDelete} loading={loading} disabled={loading} style={styles.compactButton} />
        ) : null}
        <Button title="Engelle" variant="ghost" onPress={onBlock} loading={loading} disabled={loading} style={styles.compactButton} />
      </View>
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

function getSearchResultStatus(username: string | null, friendship?: Friendship) {
  if (!friendship) {
    return `@${username ?? "username-yok"}`;
  }

  if (friendship.status === "accepted") {
    return "Zaten arkadas";
  }

  if (friendship.status === "blocked") {
    return "Engellendi";
  }

  return "Bekleyen istek var";
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
    alignItems: "flex-start",
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
    paddingTop: SPACING.xs,
  },
  rowActions: {
    alignItems: "flex-end",
    gap: SPACING.xs,
    maxWidth: 116,
  },
  compactButton: {
    minHeight: 36,
    paddingHorizontal: SPACING.sm,
    width: "100%",
  },
  centerText: {
    textAlign: "center",
  },
});
