import * as FileSystem from "expo-file-system/legacy";

import { supabase } from "@/lib/supabase";
import type { ClothingAnalysisResult } from "@/types";

export const fallbackClothingAnalysis: ClothingAnalysisResult = {
  category: "ust",
  subcategory: "Tanimlanacak parca",
  colors: ["belirsiz"],
  dominant_color_hex: "#12312B",
  season: ["ilkbahar", "yaz"],
  brand: null,
};

export async function analyzeClothingImage(imageUri: string): Promise<ClothingAnalysisResult> {
  const imageBase64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const { data, error } = await supabase.functions.invoke<ClothingAnalysisResult>("analyze-clothing", {
    body: {
      imageBase64,
      mimeType: "image/jpeg",
    },
  });

  if (error) {
    throw error;
  }

  return data ?? fallbackClothingAnalysis;
}
