import { create } from "zustand";

interface SubscriptionState {
  localPremiumOverride: boolean;
  setLocalPremiumOverride: (value: boolean) => void;
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  localPremiumOverride: false,
  setLocalPremiumOverride: (value) => set({ localPremiumOverride: value }),
}));
