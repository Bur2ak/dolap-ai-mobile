import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useNotificationInbox } from "@/hooks/useNotificationInbox";
import type { NotificationRecord } from "@/types";

const notificationLabels: Record<NotificationRecord["type"], string> = {
  friend_request: "Arkadas istegi",
  outfit_vote: "Kombin oyu",
  price_drop: "Fiyat dususu",
  outfit_reminder: "Kombin hatirlaticisi",
  lend_request: "Odunc istegi",
  system: "Sistem",
};

export default function NotificationsScreen() {
  const { notifications, unreadCount, readCount, isLoading, markRead, markAllRead, deleteOne, deleteRead, isUpdating, canUse } = useNotificationInbox();

  async function handleMarkAllRead() {
    try {
      await markAllRead();
    } catch (error) {
      Alert.alert("Guncellenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  function handleDeleteRead() {
    Alert.alert("Okunanlari temizle", "Okunmus bildirimler kalici olarak silinecek.", [
      { text: "Vazgec", style: "cancel" },
      {
        text: "Temizle",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteRead();
          } catch (error) {
            Alert.alert("Temizlenemedi", error instanceof Error ? error.message : "Tekrar dene.");
          }
        },
      },
    ]);
  }

  function handleDeleteOne(notificationId: string) {
    Alert.alert("Bildirimi sil", "Bu bildirim kalici olarak silinecek.", [
      { text: "Vazgec", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteOne(notificationId);
          } catch (error) {
            Alert.alert("Silinemedi", error instanceof Error ? error.message : "Tekrar dene.");
          }
        },
      },
    ]);
  }

  async function handlePress(notification: NotificationRecord) {
    try {
      if (!notification.is_read) {
        await markRead(notification.id);
      }
      routeFromNotification(notification);
    } catch (error) {
      Alert.alert("Acilamadi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} />
        <Text variant="h2">Bildirimler</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Card style={styles.summary}>
        <View style={styles.summaryCopy}>
          <Text variant="h3">{unreadCount} okunmamis</Text>
          <Text variant="body" color="secondary">
            Fiyat dususleri, arkadaslik istekleri ve kombin oylarini burada takip et.
          </Text>
        </View>
        <View style={styles.summaryActions}>
          <Button title="Tumunu Oku" variant="secondary" onPress={handleMarkAllRead} loading={isUpdating} disabled={unreadCount === 0} />
          <Button title="Temizle" variant="ghost" onPress={handleDeleteRead} loading={isUpdating} disabled={readCount === 0} />
        </View>
      </Card>

      {!canUse ? (
        <EmptyState icon="person-outline" title="Giris gerekli" body="Bildirimlerini gormek icin once giris yapmalisin." />
      ) : isLoading ? (
        <EmptyState icon="sync-outline" title="Yukleniyor" body="Bildirimlerin hazirlaniyor." />
      ) : notifications.length > 0 ? (
        <View style={styles.list}>
          {notifications.map((notification) => (
            <Card key={notification.id} style={[styles.notificationCard, !notification.is_read && styles.unreadCard]}>
              <Pressable style={styles.notificationMain} onPress={() => void handlePress(notification)} disabled={isUpdating}>
                <View style={styles.iconWrap}>
                  <Ionicons name={iconForNotification(notification.type)} size={22} color={COLORS.primary} />
                </View>
                <View style={styles.notificationCopy}>
                  <Text variant="caption" color="muted">
                    {notificationLabels[notification.type]}
                  </Text>
                  <Text variant="h3">{notification.title}</Text>
                  {notification.body ? (
                    <Text variant="body" color="secondary">
                      {notification.body}
                    </Text>
                  ) : null}
                  <Text variant="caption" color="muted">
                    {formatDate(notification.sent_at)}
                  </Text>
                </View>
              </Pressable>
              <View style={styles.trailingActions}>
                {!notification.is_read ? <View style={styles.unreadDot} /> : null}
                <Button title="Sil" variant="ghost" onPress={() => handleDeleteOne(notification.id)} disabled={isUpdating} style={styles.deleteButton} />
              </View>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState icon="notifications-outline" title="Bildirim yok" body="Yeni gelismeler burada gorunecek." />
      )}
    </ScrollView>
  );
}

function routeFromNotification(notification: NotificationRecord) {
  const outfitId = typeof notification.data.outfit_id === "string" ? notification.data.outfit_id : null;
  const trackingId = typeof notification.data.tracking_id === "string" ? notification.data.tracking_id : null;

  if (notification.type === "outfit_vote" && outfitId) {
    router.push(`/outfit/${outfitId}`);
    return;
  }

  if (notification.type === "price_drop" && trackingId) {
    router.push("/price-tracking");
    return;
  }

  if (notification.type === "friend_request") {
    router.push("/social/friends");
  }
}

function iconForNotification(type: NotificationRecord["type"]) {
  if (type === "price_drop") {
    return "pricetag-outline" as const;
  }

  if (type === "friend_request") {
    return "people-outline" as const;
  }

  if (type === "outfit_vote") {
    return "heart-outline" as const;
  }

  return "notifications-outline" as const;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function EmptyState({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) {
  return (
    <Card style={styles.empty}>
      <Ionicons name={icon} size={40} color={COLORS.primary} />
      <Text variant="h3">{title}</Text>
      <Text variant="body" color="secondary" style={styles.centerText}>
        {body}
      </Text>
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
    paddingBottom: SPACING.xl,
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
  summary: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
  },
  summaryCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  summaryActions: {
    gap: SPACING.xs,
    width: 132,
  },
  list: {
    gap: SPACING.sm,
  },
  notificationCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
  },
  notificationMain: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: SPACING.md,
  },
  unreadCard: {
    borderColor: COLORS.primary,
  },
  iconWrap: {
    alignItems: "center",
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  notificationCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  unreadDot: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  trailingActions: {
    alignItems: "center",
    gap: SPACING.xs,
  },
  deleteButton: {
    minHeight: 36,
    paddingHorizontal: SPACING.sm,
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
