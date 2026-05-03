import { nanoid } from "nanoid/non-secure";

import { supabase } from "@/lib/supabase";
import { uploadWardrobeImage } from "@/lib/storage/supabaseStorage";
import type { CreateWardrobeItemInput, UpdateWardrobeItemInput, WardrobeItem } from "@/types";

export async function fetchWardrobeItems(userId: string): Promise<WardrobeItem[]> {
  const { data, error } = await supabase
    .from("wardrobe_items")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as WardrobeItem[];
}

export async function fetchWardrobeItem(userId: string, itemId: string): Promise<WardrobeItem> {
  const { data, error } = await supabase
    .from("wardrobe_items")
    .select("*")
    .eq("user_id", userId)
    .eq("id", itemId)
    .eq("is_active", true)
    .single();

  if (error) {
    throw error;
  }

  return data as WardrobeItem;
}

export async function createWardrobeItem(userId: string, input: CreateWardrobeItemInput): Promise<WardrobeItem> {
  const itemId = nanoid();
  let imageUrl = input.image_url;
  let thumbnailUrl = input.thumbnail_url ?? null;

  if (input.image_url.startsWith("file:") || input.image_url.startsWith("blob:")) {
    imageUrl = await uploadWardrobeImage(userId, input.image_url, itemId, "image");
  }

  if (input.thumbnail_url?.startsWith("file:") || input.thumbnail_url?.startsWith("blob:")) {
    thumbnailUrl = await uploadWardrobeImage(userId, input.thumbnail_url, itemId, "thumb");
  }

  const { data, error } = await supabase
    .from("wardrobe_items")
    .insert({
      user_id: userId,
      image_url: imageUrl,
      thumbnail_url: thumbnailUrl,
      category: input.category,
      subcategory: input.subcategory ?? null,
      colors: input.colors ?? [],
      dominant_color_hex: input.dominant_color_hex ?? null,
      season: input.season ?? [],
      brand: input.brand ?? null,
      purchase_price: input.purchase_price ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as WardrobeItem;
}

export async function updateWardrobeItem(userId: string, itemId: string, input: UpdateWardrobeItemInput): Promise<WardrobeItem> {
  const { data, error } = await supabase
    .from("wardrobe_items")
    .update(input)
    .eq("user_id", userId)
    .eq("id", itemId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as WardrobeItem;
}

export async function markWardrobeItemWorn(userId: string, item: WardrobeItem): Promise<WardrobeItem> {
  return updateWardrobeItem(userId, item.id, {
    wear_count: item.wear_count + 1,
    last_worn: new Date().toISOString().slice(0, 10),
  });
}

export async function deleteWardrobeItem(userId: string, itemId: string): Promise<void> {
  const { error } = await supabase
    .from("wardrobe_items")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("id", itemId);

  if (error) {
    throw error;
  }
}
