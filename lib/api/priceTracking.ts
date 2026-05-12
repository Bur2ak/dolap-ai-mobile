import { throwApiError } from "@/lib/api/errors";
import { invokeFunctionWithRetry } from "@/lib/api/functions";
import { supabase } from "@/lib/supabase";
import type { CreatePriceTrackingInput, PriceTracking, UpdatePriceTrackingInput } from "@/types";

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
  const { data, error } = await supabase
    .from("price_tracking")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    throwApiError(error, "Fiyat takip listesi yuklenemedi.");
  }

  return (data ?? []) as PriceTracking[];
}

export async function createPriceTracking(userId: string, input: CreatePriceTrackingInput): Promise<PriceTracking> {
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

  return data as PriceTracking;
}

export async function deletePriceTracking(userId: string, trackingId: string): Promise<void> {
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

  return data as PriceTracking;
}

function normalizePriceHistory(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is { date: string; price: number } => {
      if (!entry || typeof entry !== "object") {
        return false;
      }

      const candidate = entry as { date?: unknown; price?: unknown };
      return typeof candidate.date === "string" && Number.isFinite(Number(candidate.price));
    })
    .map((entry) => ({ date: entry.date, price: Number(entry.price) }));
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
    normalized.product_url = normalized.product_url?.trim() || null;
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

  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Gecerli bir fiyat gir.");
  }

  return Math.round(value * 100) / 100;
}

export async function checkPriceTrackings(): Promise<PriceCheckResult> {
  const data = await invokeFunctionWithRetry<PriceCheckResult>("price-check", {});
  return data ?? { checked: 0, updated: 0, notified: 0, results: [] };
}
