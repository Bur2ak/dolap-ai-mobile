import { supabase } from "@/lib/supabase";

async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return response.blob();
}

export async function uploadWardrobeImage(userId: string, localUri: string, itemId: string, suffix = "image") {
  const path = `${userId}/${itemId}-${suffix}.jpg`;
  const blob = await uriToBlob(localUri);

  const { error } = await supabase.storage.from("wardrobe-images").upload(path, blob, {
    contentType: "image/jpeg",
    upsert: true,
  });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from("wardrobe-images").getPublicUrl(path);
  return data.publicUrl;
}
