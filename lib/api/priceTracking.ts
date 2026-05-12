import { throwApiError } from "@/lib/api/errors";
import { invokeFunctionWithRetry } from "@/lib/api/functions";
import { isUuid } from "@/lib/routeParams";
import { supabase } from "@/lib/supabase";
import { normalizeOptionalHttpUrl } from "@/utils/validation";
import type { CreatePriceTrackingInput, PriceTracking, UpdatePriceTrackingInput } from "@/types";

const maxTrackedPrice = 10_000_000;

export interface PriceCheckResult {
  checked: number;
  updated: number;
  notified: number;
  results: Array<{
    id: string;
    product_name: string;
    price?: number;
    updated: boolean;
    notified: boolean;
    push_sent?: boolean;
    reason?: string;
  }>;
}

export async function fetchPriceTrackings(userId: string): Promise<PriceTracking[]> {
  assertUserId(userId);
  const { data, error } = await supabase
    .from("price_tracking")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    throwApiError(error, "Fiyat takip listesi yuklenemedi.");
  }

  return (data ?? []).map(normalizePriceTrackingRecord).filter((tracking): tracking is PriceTracking => tracking !== null);
}

export async function createPriceTracking(userId: string, input: CreatePriceTrackingInput): Promise<PriceTracking> {
  assertUserId(userId);
  const normalizedInput = normalizePriceTrackingInput(input, true);
  const priceHistory = normalizedInput.current_price ? [{ price: normalizedInput.current_price, date: new Date().toISOString() }] : [];
  const { data, error } = await supabase
    .from("price_tracking")
    .insert({
      user_id: userId,
      product_name: normalizedInput.product_name,
      product_url: normalizedInput.product_url ?? null,
      current_price: normalizedInput.current_price ?? null,
      initial_price: normalizedInput.current_price ?? null,
      target_price: normalizedInput.target_price ?? null,
      store: normalizedInput.store ?? null,
      price_history: priceHistory,
    })
    .select("*")
    .single();

  if (error) {
    throwApiError(error, "Fiyat takibi eklenemedi.");
  }

  const tracking = normalizePriceTrackingRecord(data);
  if (!tracking) {
    throw new Error("Fiyat takibi kaydi gecersiz dondu.");
  }

  return tracking;
}

export async function deletePriceTracking(userId: string, trackingId: string): Promise<void> {
  assertUserId(userId);
  assertTrackingId(trackingId);
  const { error } = await supabase
    .from("price_tracking")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("id", trackingId);

  if (error) {
    throwApiError(error, "Fiyat takibi silinemedi.");
  }
}

export async function updatePriceTracking(userId: string, trackingId: string, input: UpdatePriceTrackingInput): Promise<PriceTracking> {
  assertUserId(userId);
  assertTrackingId(trackingId);
  const normalizedInput = normalizePriceTrackingInput(input, false);
  const updatePayload: Record<string, unknown> = { ...normalizedInput };

  if (normalizedInput.current_price !== undefined) {
    const { data: existingTracking, error: existingError } = await supabase
      .from("price_tracking")
      .select("current_price, initial_price, price_history")
      .eq("user_id", userId)
      .eq("id", trackingId)
      .single();

    if (existingError) {
      throwApiError(existingError, "Fiyat takibi guncellenemedi.");
    }

    const currentPrice = normalizedInput.current_price ?? null;
    const existingCurrentPrice = existingTracking.current_price === null ? null : Number(existingTracking.current_price);
    const priceChanged = currentPrice !== null && currentPrice !== existingCurrentPrice;
    if (priceChanged) {
      updatePayload.price_history = [
        ...normalizePriceHistory(existingTracking.price_history),
        { date: new Date().toISOString(), price: currentPrice },
      ].slice(-24);
    }

    if (currentPrice !== null && existingTracking.initial_price === null) {
      updatePayload.initial_price = currentPrice;
    }
  }

  const { data, error } = await supabase
    .from("price_tracking")
    .update(updatePayload)
    .eq("user_id", userId)
    .eq("id", trackingId)
    .select("*")
    .single();

  if (error) {
    throwApiError(error, "Fiyat takibi guncellenemedi.");
  }

  const tracking = normalizePriceTrackingRecord(data);
  if (!tracking) {
    throw new Error("Fiyat takibi kaydi gecersiz dondu.");
  }

  return tracking;
}

function normalizePriceTrackingRecord(value: unknown): PriceTracking | null {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Partial<PriceTracking>) : {};
  if (typeof record.id !== "string" || !isUuid(record.id) || typeof record.user_id !== "string" || !isUuid(record.user_id)) {
    return null;
  }

  return {
    id: record.id,
    user_id: record.user_id,
    product_name: normalizeText(record.product_name, "Urun", 120),
    product_url: typeof record.product_url === "string" ? normalizeNullableText(record.product_url, 500) : null,
    product_image_url: typeof record.product_image_url === "string" ? normalizeNullableText(record.product_image_url, 500) : null,
    current_price: normalizeNullablePrice(record.current_price),
    target_price: normalizeNullablePrice(record.target_price),
    initial_price: normalizeNullablePrice(record.initial_price),
    price_history: normalizePriceHistory(record.price_history),
    store: typeof record.store === "string" ? normalizeNullableText(record.store, 80) : null,
    is_active: record.is_active !== false,
    last_checked: normalizeNullableDate(record.last_checked),
    notified_at: normalizeNullableDate(record.notified_at),
    created_at: normalizeDate(record.created_at),
  };
}

function normalizePriceHistory(value: unknown): Array<{ price: number; date: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is { date: string; price: number } => {
      if (!entry || typeof entry !== "object") {
        return false;
      }

      const candidate = entry as { date?: unknown; price?: unknown };
      const date = typeof candidate.date === "string" ? new Date(candidate.date) : null;
      const price = Number(candidate.price);
      return Boolean(date && Number.isFinite(date.getTime()) && Number.isFinite(price) && price >= 0 && price <= maxTrackedPrice);
    })
    .map((entry) => ({ date: new Date(entry.date).toISOString(), price: Math.round(Number(entry.price) * 100) / 100 }))
    .slice(-24);
}

function normalizePriceTrackingInput<T extends CreatePriceTrackingInput | UpdatePriceTrackingInput>(input: T, requireName: boolean): T {
  const normalized = { ...input };

  if (normalized.product_name !== undefined) {
    normalized.product_name = normalized.product_name.trim().replace(/\s+/g, " ").slice(0, 120);
    if (!normalized.product_name) {
      throw new Error("Urun adi gerekli.");
    }
  } else if (requireName) {
    throw new Error("Urun adi gerekli.");
  }

  if (normalized.product_url !== undefined) {
    normalized.product_url = normalizeOptionalHttpUrl(normalized.product_url ?? "");
  }

  if (normalized.store !== undefined) {
    normalized.store = normalized.store?.trim().replace(/\s+/g, " ").slice(0, 80) || null;
  }

  if (normalized.current_price !== undefined) {
    normalized.current_price = normalizeOptionalPrice(normalized.current_price);
  }

  if (normalized.target_price !== undefined) {
    normalized.target_price = normalizeOptionalPrice(normalized.target_price);
  }

  return normalized;
}

function normalizeOptionalPrice(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isFinite(value) || value < 0 || value > maxTrackedPrice) {
    throw new Error("Gecerli bir fiyat gir.");
  }

  return Math.round(value * 100) / 100;
}

export async function checkPriceTrackings(): Promise<PriceCheckResult> {
  const data = await invokeFunctionWithRetry<PriceCheckResult>("price-check", {});
  return normalizePriceCheckResult(data);
}

function normalizePriceCheckResult(value: unknown): PriceCheckResult {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Partial<PriceCheckResult>) : {};
  const results = Array.isArray(record.results) ? record.results : [];

  return {
    checked: normalizeCount(record.checked),
    updated: normalizeCount(record.updated),
    notified: normalizeCount(record.notified),
    results: results
      .filter((item): item is PriceCheckResult["results"][number] => Boolean(item && typeof item === "object"))
      .map((item) => ({
        id: typeof item.id === "string" && isUuid(item.id) ? item.id : "",
        product_name: normalizeText(item.product_name, "Urun", 120),
        price: normalizeNullablePrice(item.price) ?? undefined,
        updated: item.updated === true,
        notified: item.notified === true,
        push_sent: item.push_sent === true,
        reason: typeof item.reason === "string" ? normalizeText(item.reason, "unknown", 80) : undefined,
      }))
      .filter((item) => item.id)
      .slice(0, 100),
  };
}

function assertUserId(value: string) {
  if (!isUuid(value)) {
    throw new Error("Oturum bilgisi gecersiz. Tekrar giris yapmayi dene.");
  }
}

function assertTrackingId(value: string) {
  if (!isUuid(value)) {
    throw new Error("Fiyat takibi kaydi gecersiz.");
  }
}

function normalizeText(value: unknown, fallback: string, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : fallback;
}

function normalizeNullableText(value: string, maxLength: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength) || null;
}

function normalizeNullablePrice(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const price = Number(value);
  return Number.isFinite(price) && price >= 0 && price <= maxTrackedPrice ? Math.round(price * 100) / 100 : null;
}

function normalizeCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.min(10_000, Math.round(count))) : 0;
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string") {
    return new Date().toISOString();
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function normalizeNullableDate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
