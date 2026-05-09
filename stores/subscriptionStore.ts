import { create } from "zustand";

interface SubscriptionState {
  localPremiumOverride: boolean;
  revenueCatPremium: boolean;
  setLocalPremiumOverride: (value: boolean) => void;
  setRevenueCatPremium: (value: boolean) => void;
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  localPremiumOverride: false,
  revenueCatPremium: false,
  setLocalPremiumOverride: (value) => set({ localPremiumOverride: value }),
  setRevenueCatPremium: (value) => set({ revenueCatPremium: value }),
}));
