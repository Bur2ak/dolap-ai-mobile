import { invokeFunctionWithRetry } from "@/lib/api/functions";
import { captureError } from "@/lib/observability";
import { publicEnv } from "@/lib/env";

const maxUploadBytes = 8 * 1024 * 1024;

interface UploadUrlResponse {
  uploadUrl: string;
  publicUrl: string;
  path: string;
}

function getExtension(uri: string): string {
  const normalized = uri.toLowerCase().split("?")[0] ?? "";
  if (normalized.endsWith(".png")) return "png";
  if (normalized.endsWith(".webp")) return "webp";
  return "jpg";
}

function getMimeType(ext: string): string {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

async function uriToBlob(uri: string): Promise<Blob> {
  const trimmed = uri.trim();
  if (!trimmed) throw new Error("Gorsel yolu bos.");

  const response = await fetch(trimmed);
  if (!response.ok) throw new Error(`Gorsel okunamadi (${response.status}).`);

  const blob = await response.blob();
  if (blob.size === 0) throw new Error("Gorsel dosyasi bos.");
  if (blob.size > maxUploadBytes) throw new Error("Gorsel dosyasi cok buyuk (max 8 MB).");

  return blob;
}

export async function uploadToR2(
  userId: string,
  localUri: string,
  itemId: string,
  suffix = "image",
): Promise<string> {
  const ext = getExtension(localUri);
  const mimeType = getMimeType(ext);
  const path = `${userId}/${itemId}-${suffix}.${ext}`;

  const result = await invokeFunctionWithRetry<UploadUrlResponse>("get-upload-url", {
    path,
    mimeType,
  });

  if (!result?.uploadUrl) {
    throw new Error("Presigned URL alinamadi.");
  }

  let blob: Blob;
  try {
    blob = await uriToBlob(localUri);
  } catch (error) {
    captureError(error, { area: "r2_image_read", user_id: userId, item_id: itemId });
    throw error;
  }

  const uploadResponse = await fetch(result.uploadUrl, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": mimeType },
  });

  if (!uploadResponse.ok) {
    throw new Error(`R2 yukleme hatasi: ${uploadResponse.status}`);
  }

  return result.publicUrl;
}

export async function deleteFromR2(path: string): Promise<void> {
  try {
    await invokeFunctionWithRetry("delete-file", { path });
  } catch (error) {
    captureError(error, { area: "r2_delete", path });
  }
}

export function getR2PathFromUrl(url?: string | null): string | null {
  if (!url) return null;
  const r2Base = publicEnv.r2PublicUrl;
  if (!r2Base || !url.startsWith(r2Base)) return null;
  return url.slice(r2Base.length).replace(/^\//, "");
}

export function isR2Url(url?: string | null): boolean {
  if (!url || !publicEnv.r2PublicUrl) return false;
  return url.startsWith(publicEnv.r2PublicUrl);
}
