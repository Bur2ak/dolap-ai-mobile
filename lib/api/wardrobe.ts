import { nanoid } from "nanoid/non-secure";

import { throwApiError } from "@/lib/api/errors";
import { cacheWardrobeItems, getCachedWardrobeItems } from "@/lib/offlineCache";
import { captureEvent } from "@/lib/observability";
import { supabase } from "@/lib/supabase";
import { deleteWardrobeImagesForUserItem, uploadWardrobeImage } from "@/lib/storage/supabaseStorage";
import type { CreateWardrobeItemInput, UpdateWardrobeItemInput, WardrobeItem } from "@/types";
import { formatDateOnly } from "@/utils/formatters";

export async function fetchWardrobeItems(userId: string): Promise<WardrobeItem[]> {
  try {
    const { data, error } = await supabase
      .from("wardrobe_items")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      throwApiError(error, "Dolap yuklenemedi.");
    }

    const items = (data ?? []) as WardrobeItem[];
    await cacheWardrobeItems(userId, items);
    return items;
  } catch (error) {
    const cachedItems = await getCachedWardrobeItems(userId);
    if (cachedItems.length > 0) {
      return cachedItems;
    }

    throwApiError(error, "Dolap yuklenemedi.");
  }
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
    throwApiError(error, "Kiyafet bulunamadi.");
  }

  return data as WardrobeItem;
}

export async function createWardrobeItem(userId: string, input: CreateWardrobeItemInput): Promise<WardrobeItem> {
  const itemId = nanoid();
  let imageUrl = input.image_url;
  let thumbnailUrl = input.thumbnail_url ?? null;
  const socialFlags = normalizeWardrobeSocialFlags(input);

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
      is_shareable: socialFlags.is_shareable ?? false,
      is_lendable: socialFlags.is_lendable ?? false,
    })
    .select("*")
    .single();

  if (error) {
    throwApiError(error, "Kiyafet kaydedilemedi.");
  }

  const item = data as WardrobeItem;
  captureEvent("wardrobe_item_created", {
    category: item.category,
    color_count: item.colors.length,
    has_price: item.purchase_price !== null,
    is_lendable: item.is_lendable,
    is_shareable: item.is_shareable,
    season_count: item.season.length,
  });

  return item;
}

export async function updateWardrobeItem(userId: string, itemId: string, input: UpdateWardrobeItemInput): Promise<WardrobeItem> {
  const updates = normalizeWardrobeSocialFlags(input);
  const { data, error } = await supabase
    .from("wardrobe_items")
    .update({ ...input, ...updates, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", itemId)
    .select("*")
    .single();

  if (error) {
    throwApiError(error, "Kiyafet guncellenemedi.");
  }

  const item = data as WardrobeItem;
  captureEvent("wardrobe_item_updated", {
    category: item.category,
    changed_lendable: input.is_lendable !== undefined,
    changed_shareable: input.is_shareable !== undefined,
    marked_worn: input.last_worn !== undefined || input.wear_count !== undefined,
  });

  return item;
}

function normalizeWardrobeSocialFlags(input: Pick<UpdateWardrobeItemInput, "is_shareable" | "is_lendable">) {
  const updates: Pick<UpdateWardrobeItemInput, "is_shareable" | "is_lendable"> = {};

  if (input.is_lendable === true) {
    updates.is_lendable = true;
    updates.is_shareable = true;
  }

  if (input.is_shareable === false) {
    updates.is_shareable = false;
    updates.is_lendable = false;
  }

  if (input.is_shareable === true) {
    updates.is_shareable = true;
  }

  if (input.is_lendable === false) {
    updates.is_lendable = false;
  }

  return updates;
}

export async function markWardrobeItemWorn(userId: string, item: WardrobeItem): Promise<WardrobeItem> {
  return updateWardrobeItem(userId, item.id, {
    wear_count: item.wear_count + 1,
    last_worn: formatDateOnly(new Date()),
  });
}

export async function deleteWardrobeItem(userId: string, itemId: string): Promise<void> {
  const item = await fetchWardrobeItem(userId, itemId);
  const { error } = await supabase
    .from("wardrobe_items")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("id", itemId);

  if (error) {
    throwApiError(error, "Kiyafet silinemedi.");
  }

  await deleteWardrobeImagesForUserItem(userId, [item.image_url, item.thumbnail_url]);
  captureEvent("wardrobe_item_deleted", { category: item.category, had_image: Boolean(item.image_url) });
}
