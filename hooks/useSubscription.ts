import { FREE_LIMITS, PREMIUM_LIMITS, type LimitKey } from "@/constants/limits";
import { captureError } from "@/lib/observability";
import { getRevenueCatCustomerInfo, hasPremiumEntitlement } from "@/lib/revenuecat";
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

  async function refreshPremiumStatus() {
    try {
      const customerInfo = await getRevenueCatCustomerInfo();
      const freshPremium = hasPremiumEntitlement(customerInfo);
      useSubscriptionStore.getState().setRevenueCatPremium(freshPremium);
      return freshPremium;
    } catch (error) {
      captureError(error, { area: "subscription_refresh" });
      return premium;
    }
  }

  return {
    premium,
    localPremiumOverride: effectiveLocalPremiumOverride,
    revenueCatPremium,
    limits,
    checkGate,
    isLimitReached,
    setLocalPremiumOverride,
    refreshPremiumStatus,
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
