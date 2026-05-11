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
  const priceHistory = input.current_price ? [{ price: input.current_price, date: new Date().toISOString() }] : [];
  const { data, error } = await supabase
    .from("price_tracking")
    .insert({
      user_id: userId,
      product_name: input.product_name,
      product_url: input.product_url ?? null,
      current_price: input.current_price ?? null,
      initial_price: input.current_price ?? null,
      target_price: input.target_price ?? null,
      store: input.store ?? null,
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
  const updatePayload: Record<string, unknown> = { ...input };

  if (input.current_price !== undefined) {
    const { data: existingTracking, error: existingError } = await supabase
      .from("price_tracking")
      .select("current_price, initial_price, price_history")
      .eq("user_id", userId)
      .eq("id", trackingId)
      .single();

    if (existingError) {
      throwApiError(existingError, "Fiyat takibi guncellenemedi.");
    }

    const currentPrice = input.current_price ?? null;
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

export async function checkPriceTrackings(): Promise<PriceCheckResult> {
  const data = await invokeFunctionWithRetry<PriceCheckResult>("price-check", {});
  return data ?? { checked: 0, updated: 0, notified: 0, results: [] };
}
