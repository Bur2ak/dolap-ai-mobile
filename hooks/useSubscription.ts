import { FREE_LIMITS, PREMIUM_LIMITS, type LimitKey } from "@/constants/limits";
import { useAuthStore } from "@/stores/authStore";
import { useSubscriptionStore } from "@/stores/subscriptionStore";

export function useSubscription() {
  const profile = useAuthStore((state) => state.profile);
  const localPremiumOverride = useSubscriptionStore((state) => state.localPremiumOverride);
  const revenueCatPremium = useSubscriptionStore((state) => state.revenueCatPremium);
  const setLocalPremiumOverride = useSubscriptionStore((state) => state.setLocalPremiumOverride);
  const profilePremium = profile ? hasActiveProfilePremium(profile.subscription_tier, profile.subscription_expires_at) : false;
  const effectiveLocalPremiumOverride = __DEV__ && localPremiumOverride;
  const premium = effectiveLocalPremiumOverride || revenueCatPremium || profilePremium;
  const limits = premium ? PREMIUM_LIMITS : FREE_LIMITS;

  function checkGate(feature: LimitKey): boolean {
    const value = limits[feature];
    if (typeof value === "boolean") {
      return value;
    }

    return Number.isFinite(value) && value > 0;
  }

  function isLimitReached(feature: LimitKey, currentValue: number): boolean {
    const value = limits[feature];
    if (typeof value === "boolean") {
      return !value;
    }

    const safeCurrentValue = Number.isFinite(currentValue) ? Math.max(0, Math.floor(currentValue)) : 0;
    return safeCurrentValue >= value;
  }

  return {
    premium,
    localPremiumOverride: effectiveLocalPremiumOverride,
    revenueCatPremium,
    limits,
    checkGate,
    isLimitReached,
    setLocalPremiumOverride,
  };
}

function hasActiveProfilePremium(tier: string, expiresAt: string | null): boolean {
  const normalizedTier = tier.trim().toLowerCase();
  if (normalizedTier !== "premium" && normalizedTier !== "family") {
    return false;
  }

  if (!expiresAt) {
    return true;
  }

  const expiresAtTimestamp = new Date(expiresAt).getTime();
  return Number.isFinite(expiresAtTimestamp) && expiresAtTimestamp > Date.now();
}
