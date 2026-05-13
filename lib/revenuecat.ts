import { Platform } from "react-native";
import type { CustomerInfo, PurchasesPackage } from "react-native-purchases";

import { publicEnv } from "@/lib/env";
import { isUuid } from "@/lib/routeParams";

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
    return normalizeRevenueCatKey(publicEnv.revenueCatIosKey, "appl_");
  }

  if (Platform.OS === "android") {
    return normalizeRevenueCatKey(publicEnv.revenueCatAndroidKey, "goog_");
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
  const normalizedUserId = appUserID && isUuid(appUserID) ? appUserID : null;
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
  return (offerings.current?.availablePackages ?? []).filter(isPurchasablePackage).slice(0, 6);
}

export async function purchaseRevenueCatPackage(revenueCatPackage: PurchasesPackage) {
  if (!isPurchasablePackage(revenueCatPackage)) {
    throw new Error("RevenueCat paketi gecersiz.");
  }

  const status = await configureRevenueCat(configuredForUserId);
  if (!status.configured) {
    throw new Error(status.reason ?? "RevenueCat hazir degil.");
  }

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

function normalizeRevenueCatKey(value: string | null, expectedPrefix: string) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.startsWith(expectedPrefix) ? trimmed : null;
}

function isPurchasablePackage(value: unknown): value is PurchasesPackage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PurchasesPackage>;
  const product = candidate.product;
  return (
    typeof candidate.identifier === "string" &&
    candidate.identifier.trim().length > 0 &&
    Boolean(product) &&
    typeof product?.identifier === "string" &&
    typeof product.priceString === "string" &&
    typeof product.title === "string"
  );
}
