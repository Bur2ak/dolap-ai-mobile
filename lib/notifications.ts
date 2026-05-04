import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === "web" || !Device.isDevice) {
    return null;
  }

  const existingStatus = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus.status;

  if (existingStatus.status !== "granted") {
    const permission = await Notifications.requestPermissionsAsync();
    finalStatus = permission.status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase.from("profiles").update({ push_token: token }).eq("id", user.id);
  }

  return token;
}

export async function scheduleOutfitReminder(): Promise<string | null> {
  if (Platform.OS === "web") {
    return null;
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title: "Bugun ne giyeceksin?",
      body: "Shipirio sana hava ve planlarina gore kombin onerebilir.",
      data: { screen: "/(tabs)/outfit" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 8,
      minute: 0,
    },
  });
}

export async function cancelOutfitReminders(): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const outfitReminders = scheduled.filter((notification) => notification.content.data?.screen === "/(tabs)/outfit");

  await Promise.all(outfitReminders.map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier)));
}
