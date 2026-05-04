import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/api/notifications";
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
  const notifications = notificationsQuery.data ?? [];

  return {
    notifications,
    unreadCount: notifications.filter((notification) => !notification.is_read).length,
    isLoading: notificationsQuery.isLoading,
    markRead: markReadMutation.mutateAsync,
    markAllRead: markAllReadMutation.mutateAsync,
    isUpdating: markReadMutation.isPending || markAllReadMutation.isPending,
    canUse: Boolean(userId),
  };
}
