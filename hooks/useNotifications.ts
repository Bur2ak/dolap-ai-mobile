import { useMutation } from "@tanstack/react-query";

import { cancelOutfitReminders, registerForPushNotifications, scheduleOutfitReminder } from "@/lib/notifications";
import { captureEvent } from "@/lib/observability";
import { useAuthStore } from "@/stores/authStore";
import type { NotificationPreferences } from "@/types";

export function useNotifications() {
  const profile = useAuthStore((state) => state.profile);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const preferences = profile?.notification_preferences ?? {
    outfit_reminder: true,
    price_drops: true,
    friend_requests: true,
    outfit_votes: true,
    lend_requests: true,
  };

  const registerMutation = useMutation({
    mutationFn: registerForPushNotifications,
    onSuccess: (token) => {
      captureEvent("push_registration_completed", { success: Boolean(token) });
      if (token) {
        void updateProfile({ push_token: token });
      }
    },
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      const nextPreferences = { ...preferences, ...updates };
      await updateProfile({ notification_preferences: nextPreferences });

      if (updates.outfit_reminder === true) {
        await scheduleOutfitReminder();
      }

      if (updates.outfit_reminder === false) {
        await cancelOutfitReminders();
      }

      Object.entries(updates).forEach(([key, value]) => {
        captureEvent("notification_preference_updated", {
          enabled: Boolean(value),
          preference: key,
        });
      });

      return nextPreferences;
    },
  });

  return {
    preferences,
    registerForPush: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    updatePreferences: updatePreferencesMutation.mutateAsync,
    isUpdating: updatePreferencesMutation.isPending,
  };
}
