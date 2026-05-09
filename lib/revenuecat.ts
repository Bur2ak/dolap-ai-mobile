import { Platform } from "react-native";
import type { CustomerInfo, PurchasesPackage } from "react-native-purchases";

import { publicEnv } from "@/lib/env";

const PREMIUM_ENTITLEMENT = "premium";

let configuredForUserId: string | null = null;
let isConfigured = false;

export interface RevenueCatStatus {
  configured: boolean;
  reason?: string;
}

export function hasPremiumEntitlement(customerInfo: CustomerInfo | null) {
  return Boolean(customerInfo?.entitlements.active[PREMIUM_ENTITLEMENT]);
}

export function getRevenueCatApiKey() {
  if (Platform.OS === "ios") {
    return publicEnv.revenueCatIosKey;
  }

  if (Platform.OS === "android") {
    return publicEnv.revenueCatAndroidKey;
  }

  return null;
}

export function getRevenueCatReadiness(): RevenueCatStatus {
  if (Platform.OS === "web") {
    return { configured: false, reason: "RevenueCat web ortaminda calismaz." };
  }

  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    return { configured: false, reason: "RevenueCat anahtari eksik." };
  }

  return { configured: true };
}

export async function configureRevenueCat(appUserID: string | null): Promise<RevenueCatStatus> {
  const readiness = getRevenueCatReadiness();
  if (!readiness.configured) {
    return readiness;
  }

  const apiKey = getRevenueCatApiKey()!;
  const normalizedUserId = appUserID ?? null;
  const { default: Purchases, LOG_LEVEL } = await import("react-native-purchases");
  await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);

  if (!isConfigured) {
    Purchases.configure({ apiKey, appUserID: normalizedUserId ?? undefined });
    isConfigured = true;
    configuredForUserId = normalizedUserId;
    return { configured: true };
  }

  if (configuredForUserId === normalizedUserId) {
    return { configured: true };
  }

  if (normalizedUserId) {
    await Purchases.logIn(normalizedUserId);
  } else if (configuredForUserId) {
    await Purchases.logOut();
  }

  configuredForUserId = normalizedUserId;

  return { configured: true };
}

export async function getRevenueCatCustomerInfo() {
  const status = await configureRevenueCat(configuredForUserId);
  if (!status.configured) {
    return null;
  }

  const { default: Purchases } = await import("react-native-purchases");
  return Purchases.getCustomerInfo();
}

export async function getRevenueCatPackages(): Promise<PurchasesPackage[]> {
  const status = await configureRevenueCat(configuredForUserId);
  if (!status.configured) {
    return [];
  }

  const { default: Purchases } = await import("react-native-purchases");
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

export async function purchaseRevenueCatPackage(revenueCatPackage: PurchasesPackage) {
  const { default: Purchases } = await import("react-native-purchases");
  const result = await Purchases.purchasePackage(revenueCatPackage);
  return result.customerInfo;
}

export async function restoreRevenueCatPurchases() {
  const status = await configureRevenueCat(configuredForUserId);
  if (!status.configured) {
    return null;
  }

  const { default: Purchases } = await import("react-native-purchases");
  return Purchases.restorePurchases();
}
