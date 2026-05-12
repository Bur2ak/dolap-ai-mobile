import { throwApiError } from "@/lib/api/errors";
import { isUuid } from "@/lib/routeParams";
import { supabase } from "@/lib/supabase";
import type { NotificationPreferences, NotificationRecord } from "@/types";

type NotificationPreferenceKey = keyof NotificationPreferences;
const validNotificationTypes = new Set<NotificationRecord["type"]>(["friend_request", "outfit_vote", "price_drop", "outfit_reminder", "lend_request", "system"]);

export async function fetchNotifications(userId: string): Promise<NotificationRecord[]> {
  assertUserId(userId);
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("sent_at", { ascending: false })
    .limit(50);

  if (error) {
    throwApiError(error, "Bildirimler yuklenemedi.");
  }

  return (data ?? []).map(normalizeNotificationRecord).filter((record): record is NotificationRecord => record !== null);
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  assertUserId(userId);
  assertNotificationId(notificationId);
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("id", notificationId);

  if (error) {
    throwApiError(error, "Bildirim okundu olarak isaretlenemedi.");
  }
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  assertUserId(userId);
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);

  if (error) {
    throwApiError(error, "Bildirimler okundu olarak isaretlenemedi.");
  }
}

export async function deleteNotification(userId: string, notificationId: string): Promise<void> {
  assertUserId(userId);
  assertNotificationId(notificationId);
  const { error } = await supabase.from("notifications").delete().eq("user_id", userId).eq("id", notificationId);

  if (error) {
    throwApiError(error, "Bildirim silinemedi.");
  }
}

export async function deleteReadNotifications(userId: string): Promise<void> {
  assertUserId(userId);
  const { error } = await supabase.from("notifications").delete().eq("user_id", userId).eq("is_read", true);

  if (error) {
    throwApiError(error, "Okunmus bildirimler silinemedi.");
  }
}

export async function userAllowsNotification(userId: string, preferenceKey: NotificationPreferenceKey): Promise<boolean> {
  assertUserId(userId);
  const allowedUserIds = await filterUsersByNotificationPreference([userId], preferenceKey);
  return allowedUserIds.length > 0;
}

export async function filterUsersByNotificationPreference(userIds: string[], preferenceKey: NotificationPreferenceKey): Promise<string[]> {
  if (!isNotificationPreferenceKey(preferenceKey)) {
    return [];
  }

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

function assertUserId(value: string) {
  if (!isUuid(value)) {
    throw new Error("Oturum bilgisi gecersiz. Tekrar giris yapmayi dene.");
  }
}

function normalizeNotificationRecord(value: unknown): NotificationRecord | null {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Partial<NotificationRecord>) : {};
  if (typeof record.id !== "string" || !isUuid(record.id) || typeof record.user_id !== "string" || !isUuid(record.user_id)) {
    return null;
  }

  const type = typeof record.type === "string" && validNotificationTypes.has(record.type as NotificationRecord["type"]) ? (record.type as NotificationRecord["type"]) : "system";

  return {
    id: record.id,
    user_id: record.user_id,
    type,
    title: normalizeText(record.title, "Bildirim", 120),
    body: typeof record.body === "string" ? normalizeText(record.body, "", 240) || null : null,
    data: normalizeNotificationData(record.data),
    is_read: record.is_read === true,
    sent_at: normalizeDate(record.sent_at),
  };
}

function normalizeNotificationData(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key, entry]) => key.length <= 48 && (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean" || entry === null))
      .slice(0, 20),
  );
}

function normalizeText(value: unknown, fallback: string, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : fallback;
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string") {
    return new Date().toISOString();
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function isNotificationPreferenceKey(value: string): value is NotificationPreferenceKey {
  return value === "outfit_reminder" || value === "price_drops" || value === "friend_requests" || value === "outfit_votes" || value === "lend_requests";
}
