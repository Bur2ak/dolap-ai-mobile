import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useNotificationInbox } from "@/hooks/useNotificationInbox";
import { getNotificationRoute } from "@/lib/notifications";
import { captureError, captureEvent } from "@/lib/observability";
import type { NotificationRecord } from "@/types";

const notificationLabels: Record<NotificationRecord["type"], string> = {
  friend_request: "Arkadas istegi",
  outfit_vote: "Kombin oyu",
  price_drop: "Fiyat dususu",
  outfit_reminder: "Kombin hatirlaticisi",
  lend_request: "Odunc istegi",
  system: "Sistem",
};

type NotificationFilter = "all" | "unread" | NotificationRecord["type"];

const filters: Array<{ label: string; value: NotificationFilter }> = [
  { label: "Tumu", value: "all" },
  { label: "Okunmamis", value: "unread" },
  { label: "Fiyat", value: "price_drop" },
  { label: "Sosyal", value: "friend_request" },
  { label: "Kombin", value: "outfit_vote" },
  { label: "Odunc", value: "lend_request" },
];

export default function NotificationsScreen() {
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [activeAction, setActiveAction] = useState<"mark_all" | "delete_read" | null>(null);
  const [activeDeleteNotificationId, setActiveDeleteNotificationId] = useState<string | null>(null);
  const [activeOpenNotificationId, setActiveOpenNotificationId] = useState<string | null>(null);
  const {
    notifications,
    unreadCount,
    readCount,
    error,
    isLoading,
    isRefetching,
    refetch,
    markRead,
    markAllRead,
    deleteOne,
    deleteRead,
    isUpdating,
    canUse,
  } = useNotificationInbox();
  const visibleNotifications = useMemo(
    () =>
      notifications.filter((notification) => {
        if (filter === "all") {
          return true;
        }

        if (filter === "unread") {
          return !notification.is_read;
        }

        return notification.type === filter;
      }),
    [filter, notifications],
  );
  const isBusy = isUpdating || Boolean(activeAction) || Boolean(activeDeleteNotificationId) || Boolean(activeOpenNotificationId);

  useEffect(() => {
    captureEvent("notifications_screen_viewed", {
      notification_count: notifications.length,
      read_count: readCount,
      unread_count: unreadCount,
      visible_count: visibleNotifications.length,
      filter,
    });
  }, [filter, notifications.length, readCount, unreadCount, visibleNotifications.length]);

  async function handleMarkAllRead() {
    if (isBusy || unreadCount === 0) {
      return;
    }

    setActiveAction("mark_all");
    try {
      await markAllRead();
      captureEvent("notifications_mark_all_read_pressed", { unread_count: unreadCount });
    } catch (error) {
      captureError(error, { area: "notifications_mark_all_read_action" });
      Alert.alert("Guncellenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setActiveAction(null);
    }
  }

  function handleDeleteRead() {
    if (isBusy || readCount === 0) {
      return;
    }

    captureEvent("notifications_delete_read_prompt_opened", { read_count: readCount });
    Alert.alert("Okunanlari temizle", "Okunmus bildirimler kalici olarak silinecek.", [
      { text: "Vazgec", style: "cancel" },
      {
        text: "Temizle",
        style: "destructive",
        onPress: async () => {
          setActiveAction("delete_read");
          try {
            await deleteRead();
            captureEvent("notifications_delete_read_pressed", { read_count: readCount });
          } catch (error) {
            captureError(error, { area: "notifications_delete_read_action" });
            Alert.alert("Temizlenemedi", error instanceof Error ? error.message : "Tekrar dene.");
          } finally {
            setActiveAction(null);
          }
        },
      },
    ]);
  }

  function handleDeleteOne(notificationId: string) {
    if (isBusy) {
      return;
    }

    captureEvent("notification_delete_prompt_opened", { notification_id: notificationId });
    Alert.alert("Bildirimi sil", "Bu bildirim kalici olarak silinecek.", [
      { text: "Vazgec", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          setActiveDeleteNotificationId(notificationId);
          try {
            await deleteOne(notificationId);
            captureEvent("notification_delete_pressed");
          } catch (error) {
            captureError(error, { area: "notification_delete_action", notification_id: notificationId });
            Alert.alert("Silinemedi", error instanceof Error ? error.message : "Tekrar dene.");
          } finally {
            setActiveDeleteNotificationId(null);
          }
        },
      },
    ]);
  }

  async function handlePress(notification: NotificationRecord) {
    if (isBusy) {
      return;
    }

    setActiveOpenNotificationId(notification.id);
    try {
      if (!notification.is_read) {
        await markRead(notification.id);
      }
      captureEvent("notification_opened", { type: notification.type });
      routeFromNotification(notification);
    } catch (error) {
      captureError(error, { area: "notification_open_action", notification_id: notification.id, type: notification.type });
      Alert.alert("Acilamadi", error instanceof Error ? error.message : "Tekrar dene.");
    } finally {
      setActiveOpenNotificationId(null);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} disabled={isBusy} />
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
          <Button title="Tumunu Oku" variant="secondary" onPress={handleMarkAllRead} loading={activeAction === "mark_all"} disabled={isBusy || unreadCount === 0} />
          <Button title="Temizle" variant="ghost" onPress={handleDeleteRead} loading={activeAction === "delete_read"} disabled={isBusy || readCount === 0} />
        </View>
      </Card>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {filters.map((item) => {
          const active = item.value === filter;
          const count = getFilterCount(item.value, notifications);
          return (
            <Pressable
              key={item.value}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => {
                setFilter(item.value);
                captureEvent("notifications_filter_changed", { filter: item.value });
              }}
              disabled={isBusy}
            >
              <Text variant="caption" color={active ? "inverse" : "secondary"}>
                {item.label} {count > 0 ? count : ""}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {!canUse ? (
        <EmptyState icon="person-outline" title="Giris gerekli" body="Bildirimlerini gormek icin once giris yapmalisin." />
      ) : isLoading ? (
        <EmptyState icon="sync-outline" title="Yukleniyor" body="Bildirimlerin hazirlaniyor." />
      ) : error ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Bildirimler yuklenemedi"
          body="Baglanti veya Supabase tarafinda gecici bir sorun olabilir."
          actionLabel="Tekrar Dene"
          loading={isRefetching}
          onAction={() => {
            captureEvent("notifications_refetch_requested");
            void refetch();
          }}
        />
      ) : visibleNotifications.length > 0 ? (
        <View style={styles.list}>
          {visibleNotifications.map((notification) => (
            <Card key={notification.id} style={[styles.notificationCard, !notification.is_read && styles.unreadCard]}>
              <Pressable style={styles.notificationMain} onPress={() => void handlePress(notification)} disabled={isBusy}>
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
                <Button
                  title="Sil"
                  variant="ghost"
                  onPress={() => handleDeleteOne(notification.id)}
                  loading={activeDeleteNotificationId === notification.id}
                  disabled={isBusy && activeDeleteNotificationId !== notification.id}
                  style={styles.deleteButton}
                />
              </View>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState
          icon="notifications-outline"
          title={notifications.length > 0 ? "Bu filtrede bildirim yok" : "Bildirim yok"}
          body={notifications.length > 0 ? "Farkli bir filtre secerek diger bildirimlere bakabilirsin." : "Yeni gelismeler burada gorunecek."}
          actionLabel={notifications.length > 0 ? "Tumunu Goster" : undefined}
          onAction={
            notifications.length > 0
              ? () => {
                  captureEvent("notifications_filter_reset");
                  setFilter("all");
                }
              : undefined
          }
        />
      )}
    </ScrollView>
  );
}

function routeFromNotification(notification: NotificationRecord) {
  router.push(getNotificationRoute({ ...notification.data, type: notification.type }));
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

  if (type === "lend_request") {
    return "shirt-outline" as const;
  }

  return "notifications-outline" as const;
}

function getFilterCount(filter: NotificationFilter, notifications: NotificationRecord[]) {
  if (filter === "all") {
    return notifications.length;
  }

  if (filter === "unread") {
    return notifications.filter((notification) => !notification.is_read).length;
  }

  return notifications.filter((notification) => notification.type === filter).length;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
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
  filters: {
    gap: SPACING.sm,
    paddingRight: SPACING.lg,
  },
  filterChip: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: SPACING.md,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
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
});
