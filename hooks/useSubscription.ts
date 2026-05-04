import { FREE_LIMITS, PREMIUM_LIMITS, type LimitKey } from "@/constants/limits";
import { useAuthStore } from "@/stores/authStore";
import { useSubscriptionStore } from "@/stores/subscriptionStore";

export function useSubscription() {
  const profile = useAuthStore((state) => state.profile);
  const localPremiumOverride = useSubscriptionStore((state) => state.localPremiumOverride);
  const setLocalPremiumOverride = useSubscriptionStore((state) => state.setLocalPremiumOverride);
  const premium = localPremiumOverride || profile?.subscription_tier === "premium" || profile?.subscription_tier === "family";
  const limits = premium ? PREMIUM_LIMITS : FREE_LIMITS;

  function checkGate(feature: LimitKey): boolean {
    const value = limits[feature];
    if (typeof value === "boolean") {
      return value;
    }

    return value > 0;
  }

  function isLimitReached(feature: LimitKey, currentValue: number): boolean {
    const value = limits[feature];
    if (typeof value === "boolean") {
      return !value;
    }

    return currentValue >= value;
  }

  return {
    premium,
    localPremiumOverride,
    limits,
    checkGate,
    isLimitReached,
    setLocalPremiumOverride,
  };
}
