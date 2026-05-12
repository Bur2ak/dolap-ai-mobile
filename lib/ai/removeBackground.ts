import * as FileSystem from "expo-file-system/legacy";

import { invokeFunctionWithRetry } from "@/lib/api/functions";
import { captureError } from "@/lib/observability";

interface RemoveBackgroundResult {
  imageBase64: string | null;
  mimeType: string | null;
  skipped: boolean;
}

const maxImageBase64Length = 12_000_000;

export async function removeImageBackground(imageUri: string): Promise<string> {
  const normalizedUri = imageUri.trim();
  if (!normalizedUri) {
    return imageUri;
  }

  try {
    const imageBase64 = await FileSystem.readAsStringAsync(normalizedUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (imageBase64.length > maxImageBase64Length) {
      return normalizedUri;
    }

    const result = await invokeFunctionWithRetry<RemoveBackgroundResult>("remove-background", {
      imageBase64,
      mimeType: getImageMimeType(normalizedUri),
    });

    if (!result?.imageBase64 || result.skipped) {
      return normalizedUri;
    }

    const baseDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!baseDirectory) {
      return normalizedUri;
    }

    const outputUri = `${baseDirectory}shipirio-bg-${Date.now()}.png`;
    await FileSystem.writeAsStringAsync(outputUri, result.imageBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return outputUri;
  } catch (error) {
    captureError(error, { area: "background_removal" });
    return normalizedUri;
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
