import { nanoid } from "nanoid/non-secure";

import { throwApiError } from "@/lib/api/errors";
import { cacheWardrobeItems, getCachedWardrobeItems } from "@/lib/offlineCache";
import { captureEvent } from "@/lib/observability";
import { supabase } from "@/lib/supabase";
import { deleteWardrobeImagesForUserItem, uploadWardrobeImage } from "@/lib/storage/supabaseStorage";
import type { CreateWardrobeItemInput, UpdateWardrobeItemInput, WardrobeItem } from "@/types";
import { formatDateOnly } from "@/utils/formatters";

const validCategories = new Set(["ust", "alt", "elbise", "etek", "dis_giyim", "ayakkabi", "canta", "aksesuar", "ic_giyim", "spor", "diger"]);
const validSeasons = new Set(["ilkbahar", "yaz", "sonbahar", "kis"]);

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
  const normalizedInput = normalizeWardrobeItemInput(input, true);
  const itemId = nanoid();
  let imageUrl = input.image_url;
  let thumbnailUrl = input.thumbnail_url ?? null;
  const socialFlags = normalizeWardrobeSocialFlags(normalizedInput);

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
      category: normalizedInput.category,
      subcategory: normalizedInput.subcategory ?? null,
      colors: normalizedInput.colors ?? [],
      dominant_color_hex: normalizedInput.dominant_color_hex ?? null,
      season: normalizedInput.season ?? [],
      brand: normalizedInput.brand ?? null,
      purchase_price: normalizedInput.purchase_price ?? null,
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
  const normalizedInput = normalizeWardrobeItemInput(input, false);
  const updates = normalizeWardrobeSocialFlags(normalizedInput);
  const { data, error } = await supabase
    .from("wardrobe_items")
    .update({ ...normalizedInput, ...updates, updated_at: new Date().toISOString() })
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

function normalizeWardrobeItemInput<T extends CreateWardrobeItemInput | UpdateWardrobeItemInput>(input: T, requireMetadata: boolean): T {
  const normalized = { ...input };

  if ("image_url" in normalized && typeof normalized.image_url === "string") {
    normalized.image_url = normalized.image_url.trim();
    if (requireMetadata && !normalized.image_url) {
      throw new Error("Kiyafet fotografi gerekli.");
    }
  }

  if (normalized.category !== undefined && !validCategories.has(normalized.category)) {
    throw new Error("Gecerli bir kategori sec.");
  }

  if (normalized.subcategory !== undefined) {
    const subcategory = normalized.subcategory?.trim() ?? "";
    if (!subcategory) {
      throw new Error("Alt kategori dolabinda parcayi bulmak icin gerekli.");
    }
    normalized.subcategory = subcategory.slice(0, 80);
  } else if (requireMetadata) {
    throw new Error("Alt kategori dolabinda parcayi bulmak icin gerekli.");
  }

  if (normalized.colors !== undefined) {
    const colors = normalized.colors.map((color) => color.trim()).filter(Boolean).slice(0, 8);
    if (colors.length === 0) {
      throw new Error("En az bir renk ekle.");
    }
    normalized.colors = colors;
  } else if (requireMetadata) {
    throw new Error("En az bir renk ekle.");
  }

  if (normalized.season !== undefined) {
    const seasons = normalized.season.filter((season, index, allSeasons) => validSeasons.has(season) && allSeasons.indexOf(season) === index);
    if (seasons.length === 0) {
      throw new Error("En az bir sezon sec.");
    }
    normalized.season = seasons;
  } else if (requireMetadata) {
    throw new Error("En az bir sezon sec.");
  }

  if (normalized.brand !== undefined) {
    normalized.brand = normalized.brand?.trim().slice(0, 80) || null;
  }

  if (normalized.dominant_color_hex !== undefined) {
    const color = normalized.dominant_color_hex?.trim() ?? "";
    normalized.dominant_color_hex = /^#[0-9a-f]{6}$/i.test(color) ? color : null;
  }

  if (normalized.purchase_price !== undefined && normalized.purchase_price !== null) {
    if (!Number.isFinite(normalized.purchase_price) || normalized.purchase_price < 0) {
      throw new Error("Gecerli bir fiyat gir.");
    }
    normalized.purchase_price = Math.round(normalized.purchase_price * 100) / 100;
  }

  if ("wear_count" in normalized && normalized.wear_count !== undefined) {
    normalized.wear_count = Math.max(0, Math.trunc(normalized.wear_count));
  }

  return normalized;
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
