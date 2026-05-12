import { throwApiError } from "@/lib/api/errors";
import { captureError } from "@/lib/observability";
import { supabase } from "@/lib/supabase";

const wardrobeImagesBucket = "wardrobe-images";

async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Gorsel okunamadi (${response.status}).`);
  }

  const blob = await response.blob();
  if (blob.size === 0) {
    throw new Error("Gorsel dosyasi bos gorunuyor.");
  }

  return blob;
}

export async function uploadWardrobeImage(userId: string, localUri: string, itemId: string, suffix = "image") {
  const imageType = getImageUploadType(localUri);
  const path = `${userId}/${itemId}-${suffix}.${imageType.extension}`;
  let blob: Blob;
  try {
    blob = await uriToBlob(localUri);
  } catch (error) {
    captureError(error, { area: "wardrobe_image_read", user_id: userId, item_id: itemId, suffix });
    throwApiError(error, "Gorsel okunamadi.");
  }

  const { error } = await supabase.storage.from(wardrobeImagesBucket).upload(path, blob, {
    contentType: imageType.contentType,
    upsert: true,
  });

  if (error) {
    throwApiError(error, "Gorsel yuklenemedi.");
  }

  const { data } = supabase.storage.from(wardrobeImagesBucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteWardrobeImagesForUserItem(userId: string, urls: Array<string | null | undefined>) {
  const paths = urls.flatMap((url) => {
    const path = getWardrobeImagePathFromUrl(url);
    return path?.startsWith(`${userId}/`) ? [path] : [];
  });

  if (paths.length === 0) {
    return;
  }

  const { error } = await supabase.storage.from(wardrobeImagesBucket).remove([...new Set(paths)]);
  if (error) {
    captureError(error, { area: "wardrobe_image_delete", user_id: userId });
  }
}

function getImageUploadType(uri: string) {
  const normalized = uri.toLowerCase().split("?")[0] ?? "";
  if (normalized.endsWith(".png")) {
    return { extension: "png", contentType: "image/png" };
  }

  if (normalized.endsWith(".webp")) {
    return { extension: "webp", contentType: "image/webp" };
  }

  return { extension: "jpg", contentType: "image/jpeg" };
}

function getWardrobeImagePathFromUrl(url?: string | null) {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const marker = `/object/public/${wardrobeImagesBucket}/`;
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) {
      return null;
    }

    return decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}
