import * as FileSystem from "expo-file-system/legacy";

import { supabase } from "@/lib/supabase";
import type { BuyDecisionInput, BuyDecisionResult } from "@/types";

export async function requestBuyDecision(input: BuyDecisionInput): Promise<BuyDecisionResult> {
  const imageBase64 = await FileSystem.readAsStringAsync(input.imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const { data, error } = await supabase.functions.invoke<BuyDecisionResult>("buy-decision", {
    body: {
      imageBase64,
      mimeType: "image/jpeg",
      wardrobe: input.wardrobe,
      price: input.price,
    },
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Karar motoru bos yanit dondu.");
  }

  return data;
}

export async function saveBuyDecisionResult(userId: string, result: BuyDecisionResult, imageUrl: string | null, price: number | null) {
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
    throw error;
  }
}
