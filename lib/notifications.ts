import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { isUuid } from "@/lib/routeParams";
import { supabase } from "@/lib/supabase";
import type { EventRecord, SmartNotificationPlan } from "@/types";

export interface PushNotificationReadiness {
  available: boolean;
  canRequest: boolean;
  deviceReady: boolean;
  easProjectReady: boolean;
  granted: boolean;
  reason: string;
  status: string;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function getPushNotificationReadiness(): Promise<PushNotificationReadiness> {
  if (Platform.OS === "web") {
    return {
      available: false,
      canRequest: false,
      deviceReady: false,
      easProjectReady: false,
      granted: false,
      reason: "Web ortaminda Expo push bildirimi kullanilmaz.",
      status: "web",
    };
  }

  const deviceReady = Device.isDevice;
  const easProjectReady = Boolean(getEasProjectId());
  const permissions = await Notifications.getPermissionsAsync();
  const granted = permissions.status === "granted";
  const canRequest = permissions.canAskAgain && !granted;

  return {
    available: deviceReady && easProjectReady && (granted || canRequest),
    canRequest,
    deviceReady,
    easProjectReady,
    granted,
    reason: getPushReadinessReason({ canRequest, deviceReady, easProjectReady, granted, status: permissions.status }),
    status: permissions.status,
  };
}

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

  const projectId = getEasProjectId();
  if (!projectId) {
    throw new Error("EAS projectId bulunamadi. Gercek cihaz push bildirimi icin EAS projesi baglanmali.");
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase.from("profiles").update({ push_token: token }).eq("id", user.id);
  }

  return token;
}

function getPushReadinessReason(input: { canRequest: boolean; deviceReady: boolean; easProjectReady: boolean; granted: boolean; status: string }) {
  if (!input.deviceReady) {
    return "Push token sadece fiziksel cihazda alinabilir.";
  }

  if (!input.easProjectReady) {
    return "EAS projectId eksik; production push icin EAS projesi baglanmali.";
  }

  if (input.granted) {
    return "Bildirim izni verilmis ve cihaz push icin hazir.";
  }

  if (input.canRequest) {
    return "Bildirim izni henuz verilmemis; kullanicidan izin istenebilir.";
  }

  return `Bildirim izni ${input.status}; sistem ayarlarindan degistirilmesi gerekebilir.`;
}

function getEasProjectId() {
  const extraProjectId = normalizeEasProjectId(Constants.expoConfig?.extra?.eas?.projectId);
  if (extraProjectId) {
    return extraProjectId;
  }

  return normalizeEasProjectId(Constants.easConfig?.projectId);
}

function normalizeEasProjectId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed === "your-eas-project-id" || trimmed === "YOUR_EAS_PROJECT_ID") {
    return null;
  }

  return trimmed;
}

export async function scheduleOutfitReminder(plan?: SmartNotificationPlan): Promise<string | null> {
  if (Platform.OS === "web") {
    return null;
  }

  await cancelOutfitReminders();

  return Notifications.scheduleNotificationAsync({
    content: {
      title: plan?.title ?? "Bugun ne giyeceksin?",
      body: plan?.body ?? "Shipirio sana hava ve planlarina gore kombin onerebilir.",
      data: { screen: plan?.route ?? "/(tabs)/outfit", type: "smart_outfit_reminder" },
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

export async function scheduleEventReminder(event: EventRecord, minutesBefore = 120): Promise<string | null> {
  if (Platform.OS === "web") {
    return null;
  }

  const eventDate = new Date(event.event_date);
  const reminderDate = new Date(eventDate.getTime() - minutesBefore * 60 * 1000);

  if (Number.isNaN(eventDate.getTime()) || reminderDate.getTime() <= Date.now()) {
    return null;
  }

  await cancelEventReminder(event.id);

  return Notifications.scheduleNotificationAsync({
    content: {
      title: `${event.title} yaklasiyor`,
      body: event.location ? `${event.location} icin kombinini hazirla.` : "Etkinlik kombinini hazirla.",
      data: { event_id: event.id, screen: "/event", type: "event_reminder" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderDate,
    },
  });
}

export async function cancelEventReminder(eventId: string): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const eventReminders = scheduled.filter((notification) => notification.content.data?.event_id === eventId);

  await Promise.all(eventReminders.map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier)));
}

export function getNotificationRoute(data: Record<string, unknown>) {
  const screen = typeof data.screen === "string" ? data.screen : null;
  const type = typeof data.type === "string" ? data.type : null;
  const outfitId = getUuidPayloadValue(data.outfit_id);
  const itemId = getUuidPayloadValue(data.item_id);
  const loanRequestId = typeof data.loan_request_id === "string" ? data.loan_request_id : null;
  const friendId = getUuidPayloadValue(data.friend_id) ?? getUuidPayloadValue(data.user_id);

  if (screen === "/(tabs)/outfit" || screen === "/(tabs)/analytics" || screen === "/event") {
    return screen;
  }

  if (type === "price_drop" || typeof data.tracking_id === "string") {
    return "/price-tracking";
  }

  if ((type === "outfit_vote" || outfitId) && outfitId) {
    return `/outfit/${outfitId}`;
  }

  if (type === "lend_request" && loanRequestId) {
    return "/social/loans";
  }

  if (type === "lend_request" && itemId) {
    return `/item/${itemId}`;
  }

  if (type === "friend_request" || typeof data.friendship_id === "string") {
    return "/social/friends";
  }

  if (type === "friend_wardrobe" && friendId) {
    return `/social/${friendId}`;
  }

  return "/notifications";
}

function getUuidPayloadValue(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed && isUuid(trimmed) ? trimmed : null;
}
