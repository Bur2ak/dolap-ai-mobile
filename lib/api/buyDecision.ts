import * as FileSystem from "expo-file-system/legacy";
import { nanoid } from "nanoid/non-secure";

import { throwApiError } from "@/lib/api/errors";
import { invokeFunctionWithRetry } from "@/lib/api/functions";
import { isUuid } from "@/lib/routeParams";
import { deleteWardrobeImagesForUserItem, uploadWardrobeImage } from "@/lib/storage/supabaseStorage";
import { supabase } from "@/lib/supabase";
import type { BuyDecisionInput, BuyDecisionRecord, BuyDecisionResult } from "@/types";

export async function requestBuyDecision(input: BuyDecisionInput): Promise<BuyDecisionResult> {
  if (!input.imageUri) {
    throw new Error("Karar motoru icin gorsel gerekli.");
  }

  const imageBase64 = await FileSystem.readAsStringAsync(input.imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const data = await invokeFunctionWithRetry<BuyDecisionResult>("buy-decision", {
    imageBase64,
    mimeType: "image/jpeg",
    wardrobe: input.wardrobe,
    price: input.price,
  });

  return normalizeBuyDecisionResult(data);
}

export async function saveBuyDecisionResult(userId: string, result: BuyDecisionResult, imageUri: string | null, price: number | null) {
  assertUserId(userId);
  const imageUrl = imageUri ? await uploadWardrobeImage(userId, imageUri, `decision-${nanoid()}`, "image") : null;
  const normalizedResult = normalizeBuyDecisionResult(result);

  const { error } = await supabase.from("buy_decisions").insert({
    user_id: userId,
    product_image_url: imageUrl,
    price: normalizeOptionalPrice(price),
    decision: normalizedResult.decision,
    confidence: normalizedResult.confidence,
    similar_items: normalizedResult.similar_items_in_wardrobe,
    combination_count: normalizedResult.combination_count,
    ai_reasoning: `${normalizedResult.main_reason}\n\n${normalizedResult.details}`.slice(0, 1200),
  });

  if (error) {
    throwApiError(error, "Karar kaydedilemedi.");
  }
}

export async function fetchBuyDecisionHistory(userId: string): Promise<BuyDecisionRecord[]> {
  assertUserId(userId);
  const { data, error } = await supabase
    .from("buy_decisions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throwApiError(error, "Karar gecmisi yuklenemedi.");
  }

  return (data ?? []).map(normalizeBuyDecisionRecord).filter((record): record is BuyDecisionRecord => record !== null);
}

export async function deleteBuyDecision(userId: string, decisionId: string): Promise<void> {
  assertUserId(userId);
  assertDecisionId(decisionId);
  const { data: decision, error: fetchError } = await supabase
    .from("buy_decisions")
    .select("product_image_url")
    .eq("user_id", userId)
    .eq("id", decisionId)
    .single();

  if (fetchError) {
    throwApiError(fetchError, "Karar kaydi bulunamadi.");
  }

  const { error } = await supabase.from("buy_decisions").delete().eq("user_id", userId).eq("id", decisionId);

  if (error) {
    throwApiError(error, "Karar silinemedi.");
  }

  await deleteWardrobeImagesForUserItem(userId, [decision.product_image_url]);
}

function normalizeBuyDecisionRecord(value: unknown): BuyDecisionRecord | null {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Partial<BuyDecisionRecord>) : {};
  if (typeof record.id !== "string" || !isUuid(record.id) || typeof record.user_id !== "string" || !isUuid(record.user_id)) {
    return null;
  }

  return {
    id: record.id,
    user_id: record.user_id,
    product_image_url: typeof record.product_image_url === "string" ? normalizeNullableText(record.product_image_url, 500) : null,
    product_name: typeof record.product_name === "string" ? normalizeNullableText(record.product_name, 120) : null,
    price: normalizeNullablePrice(record.price),
    decision: normalizeDecision(record.decision),
    confidence: normalizeConfidence(record.confidence),
    similar_items: Array.isArray(record.similar_items) ? normalizeIdList(record.similar_items) : [],
    combination_count: normalizeCombinationCount(record.combination_count),
    ai_reasoning: normalizeText(record.ai_reasoning, "Karar detayi bulunamadi.", 1200),
    created_at: normalizeDate(record.created_at),
  };
}

function normalizeBuyDecisionResult(result: unknown): BuyDecisionResult {
  const record = result && typeof result === "object" && !Array.isArray(result) ? (result as Partial<BuyDecisionResult>) : {};
  const decision = normalizeDecision(record.decision);
  const confidence = normalizeConfidence(record.confidence);
  const similarItems = Array.isArray(record.similar_items_in_wardrobe) ? normalizeIdList(record.similar_items_in_wardrobe).slice(0, 10) : [];
  const combinationCount = normalizeCombinationCount(record.combination_count);

  return {
    decision,
    confidence,
    similar_items_in_wardrobe: similarItems,
    combination_count: combinationCount,
    cost_per_wear_suggestion: normalizeText(record.cost_per_wear_suggestion, "Kullanim basi maliyet icin tekrar degerlendir.", 300),
    main_reason: normalizeText(record.main_reason, "Dolap uyumuna gore karar onerildi.", 240),
    details: normalizeText(record.details, "Mevcut gardrop ve fiyat bilgisi birlikte degerlendirildi.", 800),
    discount_advice: typeof record.discount_advice === "string" ? normalizeNullableText(record.discount_advice, 300) : null,
  };
}

function normalizeDecision(value: unknown) {
  return value === "AL" || value === "BEKLEME" || value === "ALMA" ? value : "BEKLEME";
}

function normalizeConfidence(value: unknown) {
  const confidence = Number(value);
  return Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.55;
}

function normalizeCombinationCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.min(50, Math.round(count))) : 0;
}

function normalizeIdList(value: unknown[]) {
  return [...new Set(value.filter((id): id is string => typeof id === "string" && isUuid(id)))];
}

function assertUserId(value: string) {
  if (!isUuid(value)) {
    throw new Error("Oturum bilgisi gecersiz. Tekrar giris yapmayi dene.");
  }
}

function assertDecisionId(value: string) {
  if (!isUuid(value)) {
    throw new Error("Karar kaydi gecersiz.");
  }
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string") {
    return new Date().toISOString();
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function normalizeNullableText(value: string, maxLength: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength) || null;
}

function normalizeNullablePrice(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const price = Number(value);
  return Number.isFinite(price) && price >= 0 && price <= 10_000_000 ? Math.round(price * 100) / 100 : null;
}

function normalizeOptionalPrice(value: number | null) {
  if (value === null) {
    return null;
  }

  if (!Number.isFinite(value) || value < 0 || value > 10_000_000) {
    throw new Error("Gecerli bir fiyat gir.");
  }

  return Math.round(value * 100) / 100;
}

function normalizeText(value: unknown, fallback: string, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : fallback;
}
