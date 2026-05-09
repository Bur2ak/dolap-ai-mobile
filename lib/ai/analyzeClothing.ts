import * as FileSystem from "expo-file-system/legacy";

import { invokeFunctionWithRetry } from "@/lib/api/functions";
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

  try {
    const data = await invokeFunctionWithRetry<ClothingAnalysisResult>("analyze-clothing", {
      imageBase64,
      mimeType: getImageMimeType(imageUri),
    });

    return data ?? fallbackClothingAnalysis;
  } catch {
    return fallbackClothingAnalysis;
  }
}

function getImageMimeType(uri: string) {
  const normalized = uri.toLowerCase().split("?")[0] ?? "";
  if (normalized.endsWith(".png")) {
    return "image/png";
  }

  if (normalized.endsWith(".webp")) {
    return "image/webp";
  }

  return "image/jpeg";
}
