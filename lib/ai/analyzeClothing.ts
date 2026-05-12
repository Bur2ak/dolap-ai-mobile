import * as FileSystem from "expo-file-system/legacy";

import { invokeFunctionWithRetry } from "@/lib/api/functions";
import type { ClothingAnalysisResult } from "@/types";

const maxImageBase64Length = 12_000_000;

export const fallbackClothingAnalysis: ClothingAnalysisResult = {
  category: "ust",
  subcategory: "Tanimlanacak parca",
  colors: ["belirsiz"],
  dominant_color_hex: "#12312B",
  season: ["ilkbahar", "yaz"],
  brand: null,
};

export async function analyzeClothingImage(imageUri: string): Promise<ClothingAnalysisResult> {
  const normalizedUri = imageUri.trim();
  if (!normalizedUri) {
    return fallbackClothingAnalysis;
  }

  const imageBase64 = await FileSystem.readAsStringAsync(normalizedUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (imageBase64.length > maxImageBase64Length) {
    return fallbackClothingAnalysis;
  }

  try {
    const data = await invokeFunctionWithRetry<ClothingAnalysisResult>("analyze-clothing", {
      imageBase64,
      mimeType: getImageMimeType(normalizedUri),
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
