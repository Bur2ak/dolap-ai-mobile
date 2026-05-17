import { supabase } from "@/lib/supabase";
import { isUuid } from "@/lib/routeParams";

export async function uploadAvatarImage(userId: string, localUri: string): Promise<string> {
  if (!isUuid(userId)) throw new Error("Oturum bilgisi geçersiz.");

  const trimmed = localUri.trim();
  const response = await fetch(trimmed);
  if (!response.ok) throw new Error("Görsel okunamadı.");

  const blob = await response.blob();
  if (blob.size === 0) throw new Error("Görsel boş.");
  if (blob.size > 5 * 1024 * 1024) throw new Error("Görsel 5 MB'dan küçük olmalı.");

  const ext = trimmed.toLowerCase().includes(".png") ? "png" : "jpg";
  const contentType = ext === "png" ? "image/png" : "image/jpeg";
  const path = `${userId}/avatar.${ext}`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { upsert: true, contentType });

  if (error) throw new Error("Profil fotoğrafı yüklenemedi: " + error.message);

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl + `?t=${Date.now()}`;
}
