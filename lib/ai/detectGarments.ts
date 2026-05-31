import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { Image } from "react-native";

import { invokeFunctionWithRetry } from "@/lib/api/functions";
import type { ClothingCategory, Season } from "@/types";

const maxImageBase64Length = 12_000_000;

export interface DetectedGarment {
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000
  category: ClothingCategory;
  subcategory: string;
  colors: string[];
  dominant_color_hex: string;
  season: Season[];
  fabric: string | null;
  usage_context: string[];
}

export interface DetectedGarmentCrop extends DetectedGarment {
  croppedUri: string;
}

/**
 * Tek fotoğraftan birden fazla kıyafet tespit eder, her birini ayrı ayrı crop'lar.
 * Gemini bounding box (0-1000 normalize) → piksel koordinatı → ImageManipulator crop.
 */
export async function detectAndCropGarments(imageUri: string): Promise<DetectedGarmentCrop[]> {
  const normalizedUri = imageUri.trim();
  if (!normalizedUri) return [];

  const imageBase64 = await FileSystem.readAsStringAsync(normalizedUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (imageBase64.length > maxImageBase64Length) return [];

  const data = await invokeFunctionWithRetry<{ garments: DetectedGarment[]; error?: string }>(
    "detect-garments",
    { imageBase64, mimeType: getMimeType(normalizedUri) },
  );

  const garments = data?.garments ?? [];
  if (garments.length === 0) return [];

  // Gerçek görsel boyutlarını al
  const { width, height } = await getImageSize(normalizedUri);
  if (!width || !height) return [];

  const crops: DetectedGarmentCrop[] = [];
  for (const g of garments) {
    try {
      const [ymin, xmin, ymax, xmax] = g.box_2d;
      // 0-1000 normalize → piksel
      const originX = Math.round((xmin / 1000) * width);
      const originY = Math.round((ymin / 1000) * height);
      const cropW = Math.round(((xmax - xmin) / 1000) * width);
      const cropH = Math.round(((ymax - ymin) / 1000) * height);

      // Çok küçük tespitleri atla (gürültü)
      if (cropW < 40 || cropH < 40) continue;

      const result = await ImageManipulator.manipulateAsync(
        normalizedUri,
        [{
          crop: {
            originX: Math.max(0, originX),
            originY: Math.max(0, originY),
            width: Math.min(cropW, width - originX),
            height: Math.min(cropH, height - originY),
          },
        }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );

      crops.push({ ...g, croppedUri: result.uri });
    } catch {
      // Bu parçayı atla, diğerlerine devam
    }
  }

  return crops;
}

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve({ width: 0, height: 0 }),
    );
  });
}

function getMimeType(uri: string) {
  const normalized = uri.toLowerCase().split("?")[0] ?? "";
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}
