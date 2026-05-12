import { throwApiError } from "@/lib/api/errors";
import { isUuid } from "@/lib/routeParams";
import { supabase } from "@/lib/supabase";
import type { NotificationPreferences, NotificationRecord } from "@/types";

type NotificationPreferenceKey = keyof NotificationPreferences;

export async function fetchNotifications(userId: string): Promise<NotificationRecord[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("sent_at", { ascending: false })
    .limit(50);

  if (error) {
    throwApiError(error, "Bildirimler yuklenemedi.");
  }

  return (data ?? []) as NotificationRecord[];
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  assertNotificationId(notificationId);
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("id", notificationId);

  if (error) {
    throwApiError(error, "Bildirim okundu olarak isaretlenemedi.");
  }
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);

  if (error) {
    throwApiError(error, "Bildirimler okundu olarak isaretlenemedi.");
  }
}

export async function deleteNotification(userId: string, notificationId: string): Promise<void> {
  assertNotificationId(notificationId);
  const { error } = await supabase.from("notifications").delete().eq("user_id", userId).eq("id", notificationId);

  if (error) {
    throwApiError(error, "Bildirim silinemedi.");
  }
}

export async function deleteReadNotifications(userId: string): Promise<void> {
  const { error } = await supabase.from("notifications").delete().eq("user_id", userId).eq("is_read", true);

  if (error) {
    throwApiError(error, "Okunmus bildirimler silinemedi.");
  }
}

export async function userAllowsNotification(userId: string, preferenceKey: NotificationPreferenceKey): Promise<boolean> {
  const allowedUserIds = await filterUsersByNotificationPreference([userId], preferenceKey);
  return allowedUserIds.length > 0;
}

export async function filterUsersByNotificationPreference(userIds: string[], preferenceKey: NotificationPreferenceKey): Promise<string[]> {
  const uniqueUserIds = [...new Set(userIds)].filter(isUuid);
  if (uniqueUserIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, notification_preferences")
    .in("id", uniqueUserIds);

  if (error) {
    throwApiError(error, "Bildirim tercihleri kontrol edilemedi.");
  }

  return (data ?? [])
    .filter((profile) => {
      const preferences = profile.notification_preferences as Partial<NotificationPreferences> | null;
      return preferences?.[preferenceKey] !== false;
    })
    .map((profile) => profile.id as string);
}

function assertNotificationId(value: string) {
  if (!isUuid(value)) {
    throw new Error("Bildirim kaydi gecersiz.");
  }
}
