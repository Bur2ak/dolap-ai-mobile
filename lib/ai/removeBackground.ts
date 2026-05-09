import * as FileSystem from "expo-file-system/legacy";

import { invokeFunctionWithRetry } from "@/lib/api/functions";
import { captureError } from "@/lib/observability";

interface RemoveBackgroundResult {
  imageBase64: string | null;
  mimeType: string | null;
  skipped: boolean;
}

export async function removeImageBackground(imageUri: string): Promise<string> {
  try {
    const imageBase64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const result = await invokeFunctionWithRetry<RemoveBackgroundResult>("remove-background", {
      imageBase64,
      mimeType: "image/jpeg",
    });

    if (!result?.imageBase64 || result.skipped) {
      return imageUri;
    }

    const baseDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!baseDirectory) {
      return imageUri;
    }

    const outputUri = `${baseDirectory}shipirio-bg-${Date.now()}.png`;
    await FileSystem.writeAsStringAsync(outputUri, result.imageBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return outputUri;
  } catch (error) {
    captureError(error, { area: "background_removal" });
    return imageUri;
  }
}
