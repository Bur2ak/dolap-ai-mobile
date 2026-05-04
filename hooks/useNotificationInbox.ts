import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteNotification,
  deleteReadNotifications,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/notifications";
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
    mutationFn: (notificationId: string) => markNotificationRead(userId!, notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    },
  });
  const markAllReadMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(userId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (notificationId: string) => deleteNotification(userId!, notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    },
  });
  const deleteReadMutation = useMutation({
    mutationFn: () => deleteReadNotifications(userId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    },
  });
  const notifications = notificationsQuery.data ?? [];
  const readCount = notifications.filter((notification) => notification.is_read).length;

  return {
    notifications,
    unreadCount: notifications.filter((notification) => !notification.is_read).length,
    readCount,
    isLoading: notificationsQuery.isLoading,
    markRead: markReadMutation.mutateAsync,
    markAllRead: markAllReadMutation.mutateAsync,
    deleteOne: deleteMutation.mutateAsync,
    deleteRead: deleteReadMutation.mutateAsync,
    isUpdating: markReadMutation.isPending || markAllReadMutation.isPending || deleteMutation.isPending || deleteReadMutation.isPending,
    canUse: Boolean(userId),
  };
}
