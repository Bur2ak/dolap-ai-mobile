import { supabase } from "@/lib/supabase";
import type { NotificationRecord } from "@/types";

export async function fetchNotifications(userId: string): Promise<NotificationRecord[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("sent_at", { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  return (data ?? []) as NotificationRecord[];
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("id", notificationId);

  if (error) {
    throw error;
  }
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);

  if (error) {
    throw error;
  }
}

export async function deleteNotification(userId: string, notificationId: string): Promise<void> {
  const { error } = await supabase.from("notifications").delete().eq("user_id", userId).eq("id", notificationId);

  if (error) {
    throw error;
  }
}

export async function deleteReadNotifications(userId: string): Promise<void> {
  const { error } = await supabase.from("notifications").delete().eq("user_id", userId).eq("is_read", true);

  if (error) {
    throw error;
  }
}
