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

  const { error } = await supabase.from("buy_decisions").insert({
    user_id: userId,
    product_image_url: imageUrl,
    price,
    decision: result.decision,
    confidence: result.confidence,
    similar_items: result.similar_items_in_wardrobe,
    combination_count: result.combination_count,
    ai_reasoning: `${result.main_reason}\n\n${result.details}`,
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
