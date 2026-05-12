import { captureEvent } from "@/lib/observability";

export function requireUserId(userId: string | null | undefined, action: string) {
  if (userId) {
    return userId;
  }

  captureEvent("auth_required_action_blocked", { action, reason: "missing_user" });
  throw new Error("Bu islem icin giris yapmalisin.");
}

export function requireValue<T>(value: T | null | undefined, action: string, message = "Gerekli veri henuz yuklenmedi. Tekrar dene.") {
  if (value !== null && value !== undefined) {
    return value;
  }

  captureEvent("required_value_action_blocked", { action, reason: "missing_value" });
  throw new Error(message);
}
