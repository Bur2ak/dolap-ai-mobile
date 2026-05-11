import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteNotification,
  deleteReadNotifications,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/notifications";
import { requireUserId } from "@/lib/authGuards";
import { captureError, captureEvent } from "@/lib/observability";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

export function useNotificationInbox() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.session?.user.id);
  const notificationsQuery = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => fetchNotifications(userId!),
    enabled: Boolean(userId),
  });
  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(requireUserId(userId, "notification_mark_read"), notificationId),
    onSuccess: () => {
      captureEvent("notification_marked_read");
      void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    },
    onError: (error) => {
      captureError(error, { area: "notification_mark_read" });
    },
  });
  const markAllReadMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(requireUserId(userId, "notifications_mark_all_read")),
    onSuccess: () => {
      captureEvent("notifications_marked_all_read");
      void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    },
    onError: (error) => {
      captureError(error, { area: "notifications_mark_all_read" });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (notificationId: string) => deleteNotification(requireUserId(userId, "notification_delete"), notificationId),
    onSuccess: () => {
      captureEvent("notification_deleted");
      void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    },
    onError: (error) => {
      captureError(error, { area: "notification_delete" });
    },
  });
  const deleteReadMutation = useMutation({
    mutationFn: () => deleteReadNotifications(requireUserId(userId, "notifications_delete_read")),
    onSuccess: () => {
      captureEvent("notifications_read_deleted");
      void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    },
    onError: (error) => {
      captureError(error, { area: "notifications_delete_read" });
    },
  });
  useEffect(() => {
    if (!userId) {
      return;
    }

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  const notifications = notificationsQuery.data ?? [];
  const readCount = notifications.filter((notification) => notification.is_read).length;

  return {
    notifications,
    unreadCount: notifications.filter((notification) => !notification.is_read).length,
    readCount,
    error: notificationsQuery.error,
    isLoading: notificationsQuery.isLoading,
    isRefetching: notificationsQuery.isRefetching,
    refetch: notificationsQuery.refetch,
    markRead: markReadMutation.mutateAsync,
    markAllRead: markAllReadMutation.mutateAsync,
    deleteOne: deleteMutation.mutateAsync,
    deleteRead: deleteReadMutation.mutateAsync,
    isUpdating: markReadMutation.isPending || markAllReadMutation.isPending || deleteMutation.isPending || deleteReadMutation.isPending,
    canUse: Boolean(userId),
  };
}
