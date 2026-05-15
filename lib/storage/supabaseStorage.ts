import { throwApiError } from "@/lib/api/errors";
import { captureError } from "@/lib/observability";
import { deleteFromR2, getR2PathFromUrl, isR2Url, uploadToR2 } from "@/lib/storage/r2";
import { supabase } from "@/lib/supabase";

const wardrobeImagesBucket = "wardrobe-images";

export async function uploadWardrobeImage(
  userId: string,
  localUri: string,
  itemId: string,
  suffix = "image",
): Promise<string> {
  try {
    return await uploadToR2(userId, localUri, itemId, suffix);
  } catch (error) {
    captureError(error, { area: "wardrobe_image_upload_r2", user_id: userId, item_id: itemId, suffix });
    throwApiError(error, "Gorsel yuklenemedi.");
  }
}

export async function deleteWardrobeImagesForUserItem(
  userId: string,
  urls: Array<string | null | undefined>,
) {
  const r2Paths = urls
    .filter((url): url is string => isR2Url(url))
    .map((url) => getR2PathFromUrl(url))
    .filter((path): path is string => path !== null && path.startsWith(`${userId}/`));

  const supabasePaths = urls
    .filter((url): url is string => Boolean(url) && !isR2Url(url))
    .flatMap((url) => {
      const path = getSupabasePathFromUrl(url);
      return path?.startsWith(`${userId}/`) ? [path] : [];
    });

  await Promise.all([
    ...r2Paths.map((path) => deleteFromR2(path)),
    supabasePaths.length > 0
      ? supabase.storage
          .from(wardrobeImagesBucket)
          .remove([...new Set(supabasePaths)])
          .then(({ error }) => {
            if (error) captureError(error, { area: "wardrobe_image_delete_supabase", user_id: userId });
          })
      : Promise.resolve(),
  ]);
}

function getSupabasePathFromUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const marker = `/object/public/${wardrobeImagesBucket}/`;
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(parsed.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}
