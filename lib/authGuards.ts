import { captureEvent } from "@/lib/observability";

export function requireUserId(userId: string | null | undefined, action: string) {
  if (userId) {
    return userId;
  }

  captureEvent("auth_required_action_blocked", { action, reason: "missing_user" });
  throw new Error("Bu islem icin giris yapmalisin.");
}
