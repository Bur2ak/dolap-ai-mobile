import * as FileSystem from "expo-file-system/legacy";
import { nanoid } from "nanoid/non-secure";

import { throwApiError } from "@/lib/api/errors";
import { invokeFunctionWithRetry } from "@/lib/api/functions";
import { deleteWardrobeImagesForUserItem, uploadWardrobeImage } from "@/lib/storage/supabaseStorage";
import { supabase } from "@/lib/supabase";
import type { BuyDecisionInput, BuyDecisionRecord, BuyDecisionResult } from "@/types";

export async function requestBuyDecision(input: BuyDecisionInput): Promise<BuyDecisionResult> {
  const imageBase64 = await FileSystem.readAsStringAsync(input.imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const data = await invokeFunctionWithRetry<BuyDecisionResult>("buy-decision", {
    imageBase64,
    mimeType: "image/jpeg",
    wardrobe: input.wardrobe,
    price: input.price,
  });

  if (!data) {
    throw new Error("Karar motoru bos yanit dondu.");
  }

  return data;
}

export async function saveBuyDecisionResult(userId: string, result: BuyDecisionResult, imageUri: string | null, price: number | null) {
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
  const { data, error } = await supabase
    .from("buy_decisions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throwApiError(error, "Karar gecmisi yuklenemedi.");
  }

  return (data ?? []) as BuyDecisionRecord[];
}

export async function deleteBuyDecision(userId: string, decisionId: string): Promise<void> {
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

function normalizeBuyDecisionResult(result: BuyDecisionResult): BuyDecisionResult {
  const decision = result.decision === "AL" || result.decision === "BEKLEME" || result.decision === "ALMA" ? result.decision : "BEKLEME";
  const confidence = Number.isFinite(result.confidence) ? Math.max(0, Math.min(1, result.confidence)) : 0.55;
  const similarItems = Array.isArray(result.similar_items_in_wardrobe)
    ? [...new Set(result.similar_items_in_wardrobe.filter((id) => typeof id === "string" && id.trim()).map((id) => id.trim()))].slice(0, 10)
    : [];
  const combinationCount = Number.isFinite(result.combination_count) ? Math.max(0, Math.min(50, Math.round(result.combination_count))) : 0;

  return {
    decision,
    confidence,
    similar_items_in_wardrobe: similarItems,
    combination_count: combinationCount,
    cost_per_wear_suggestion: normalizeText(result.cost_per_wear_suggestion, "Kullanim basi maliyet icin tekrar degerlendir.", 300),
    main_reason: normalizeText(result.main_reason, "Dolap uyumuna gore karar onerildi.", 240),
    details: normalizeText(result.details, "Mevcut gardrop ve fiyat bilgisi birlikte degerlendirildi.", 800),
    discount_advice: typeof result.discount_advice === "string" ? result.discount_advice.trim().slice(0, 300) || null : null,
  };
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

function normalizeText(value: string, fallback: string, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : fallback;
}
