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
    throw error;
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
    throw error;
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
    throw error;
  }
}

export async function updatePriceTracking(userId: string, trackingId: string, input: UpdatePriceTrackingInput): Promise<PriceTracking> {
  const { data, error } = await supabase
    .from("price_tracking")
    .update(input)
    .eq("user_id", userId)
    .eq("id", trackingId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as PriceTracking;
}

export async function checkPriceTrackings(): Promise<PriceCheckResult> {
  const { data, error } = await supabase.functions.invoke<PriceCheckResult>("price-check", {
    body: {},
  });

  if (error) {
    throw error;
  }

  return data ?? { checked: 0, updated: 0, notified: 0, results: [] };
}
