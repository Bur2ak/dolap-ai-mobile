import { nanoid } from "nanoid";

import { throwApiError } from "@/lib/api/errors";
import { cacheWardrobeItems, getCachedWardrobeItems } from "@/lib/offlineCache";
import { captureError, captureEvent } from "@/lib/observability";
import { isUuid } from "@/lib/routeParams";
import { supabase } from "@/lib/supabase";
import { deleteWardrobeImagesForUserItem, uploadWardrobeImage } from "@/lib/storage/supabaseStorage";
import type { CreateWardrobeItemInput, UpdateWardrobeItemInput, WardrobeItem } from "@/types";
import { formatDateOnly } from "@/utils/formatters";

const validCategories = new Set(["ust", "alt", "elbise", "etek", "dis_giyim", "ayakkabi", "canta", "aksesuar", "ic_giyim", "spor", "diger"]);
const validSeasons = new Set(["ilkbahar", "yaz", "sonbahar", "kis"]);
const maxPurchasePrice = 10_000_000;

// Explicit column list — excludes embedding (vector(512) = 2KB/row, never used client-side)
const WARDROBE_COLS = "id,user_id,image_url,thumbnail_url,category,subcategory,colors,dominant_color_hex,season,brand,fabric,usage_context,purchase_price,wear_count,last_worn,is_shareable,is_lendable,is_active,created_at,updated_at" as const;

export async function fetchWardrobeItems(userId: string): Promise<WardrobeItem[]> {
  assertUserId(userId);

  try {
    const { data, error } = await supabase
      .from("wardrobe_items")
      .select(WARDROBE_COLS)
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      throwApiError(error, "Dolap yuklenemedi.");
    }

    const items = (data ?? []).map(normalizeWardrobeItemRecord).filter((item): item is WardrobeItem => item !== null);
    cacheWardrobeItems(userId, items);
    return items;
  } catch (error) {
    const cachedItems = getCachedWardrobeItems(userId);
    if (cachedItems.length > 0) {
      return cachedItems;
    }

    throwApiError(error, "Dolap yuklenemedi.");
  }
}

export async function fetchWardrobeItem(userId: string, itemId: string): Promise<WardrobeItem> {
  assertUserId(userId);
  assertItemId(itemId);

  const { data, error } = await supabase
    .from("wardrobe_items")
    .select(WARDROBE_COLS)
    .eq("user_id", userId)
    .eq("id", itemId)
    .eq("is_active", true)
    .single();

  if (error) {
    throwApiError(error, "Kiyafet bulunamadi.");
  }

  const item = normalizeWardrobeItemRecord(data);
  if (!item) {
    throw new Error("Kiyafet kaydi gecersiz dondu.");
  }

  return item;
}

export async function createWardrobeItem(userId: string, input: CreateWardrobeItemInput): Promise<WardrobeItem> {
  assertUserId(userId);
  const normalizedInput = normalizeWardrobeItemInput(input, true);
  const itemId = nanoid();
  let imageUrl = normalizedInput.image_url;
  let thumbnailUrl = normalizedInput.thumbnail_url ?? null;
  const socialFlags = normalizeWardrobeSocialFlags(normalizedInput);

  try {
    if (normalizedInput.image_url.startsWith("file:") || normalizedInput.image_url.startsWith("blob:")) {
      imageUrl = await uploadWardrobeImage(userId, normalizedInput.image_url, itemId, "image");
    }

    if (normalizedInput.thumbnail_url?.startsWith("file:") || normalizedInput.thumbnail_url?.startsWith("blob:")) {
      thumbnailUrl = await uploadWardrobeImage(userId, normalizedInput.thumbnail_url, itemId, "thumb");
    }
  } catch (uploadError) {
    // Upload failed before DB insert — no orphan in DB, just cleanup any partial uploads
    await cleanupUploadedImages(userId, [imageUrl, thumbnailUrl]);
    throwApiError(uploadError, "Gorsel yuklenemedi. Lutfen tekrar deneyin.");
  }

  // embedding stored in wardrobe_embeddings (separate table) — not in wardrobe_items
  const embedding = Array.isArray(normalizedInput.embedding) && normalizedInput.embedding.length === 512
    ? normalizedInput.embedding
    : null;

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
      fabric: normalizedInput.fabric ?? null,
      usage_context: normalizedInput.usage_context ?? [],
      purchase_price: normalizedInput.purchase_price ?? null,
      is_shareable: socialFlags.is_shareable ?? false,
      is_lendable: socialFlags.is_lendable ?? false,
    })
    .select(WARDROBE_COLS)
    .single();

  if (error) {
    await cleanupUploadedImages(userId, [imageUrl, thumbnailUrl]);
    throwApiError(error, "Kiyafet kaydedilemedi.");
  }

  const item = normalizeWardrobeItemRecord(data);
  if (!item) {
    await cleanupUploadedImages(userId, [imageUrl, thumbnailUrl]);
    throw new Error("Kiyafet kaydi gecersiz dondu.");
  }

  // Store embedding in separate table (fire-and-forget — doesn't block the create flow)
  if (embedding) {
    void supabase.from("wardrobe_embeddings").upsert({ item_id: item.id, embedding }).then(({ error: embErr }) => {
      if (embErr) captureError(embErr, { area: "wardrobe_embedding_save", item_id: item.id });
    });
  }

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
  assertUserId(userId);
  assertItemId(itemId);

  const normalizedInput = normalizeWardrobeItemInput(input, false);
  const updates = normalizeWardrobeSocialFlags(normalizedInput);
  const { data, error } = await supabase
    .from("wardrobe_items")
    .update({ ...normalizedInput, ...updates, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", itemId)
    .select(WARDROBE_COLS)
    .single();

  if (error) {
    throwApiError(error, "Kiyafet guncellenemedi.");
  }

  const item = normalizeWardrobeItemRecord(data);
  if (!item) {
    throw new Error("Kiyafet kaydi gecersiz dondu.");
  }

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
    const colors = [...new Set(normalized.colors.map((color) => color.trim().toLowerCase()).filter(Boolean))].slice(0, 8);
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

  if (normalized.fabric !== undefined) {
    normalized.fabric = normalized.fabric?.trim().replace(/\s+/g, " ").slice(0, 80) || null;
  }

  if (normalized.usage_context !== undefined) {
    normalized.usage_context = [...new Set(normalized.usage_context.map((entry) => entry.trim().toLowerCase()).filter(Boolean))].slice(0, 8);
  }

  if (normalized.dominant_color_hex !== undefined) {
    const color = normalized.dominant_color_hex?.trim() ?? "";
    normalized.dominant_color_hex = /^#[0-9a-f]{6}$/i.test(color) ? color : null;
  }

  if (normalized.purchase_price !== undefined && normalized.purchase_price !== null) {
    if (!Number.isFinite(normalized.purchase_price) || normalized.purchase_price < 0 || normalized.purchase_price > maxPurchasePrice) {
      throw new Error("Gecerli bir fiyat gir.");
    }
    normalized.purchase_price = Math.round(normalized.purchase_price * 100) / 100;
  }

  if ("wear_count" in normalized && normalized.wear_count !== undefined) {
    normalized.wear_count = Math.max(0, Math.trunc(normalized.wear_count));
  }

  if ("last_worn" in normalized && normalized.last_worn !== undefined && normalized.last_worn !== null) {
    const lastWorn = new Date(`${normalized.last_worn}T00:00:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized.last_worn) || !Number.isFinite(lastWorn.getTime())) {
      throw new Error("Gecerli bir giyme tarihi gir.");
    }
  }

  return normalized;
}

function normalizeWardrobeItemRecord(value: unknown): WardrobeItem | null {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Partial<WardrobeItem>) : {};
  if (typeof record.id !== "string" || !isUuid(record.id) || typeof record.user_id !== "string" || !isUuid(record.user_id)) {
    return null;
  }

  const category = typeof record.category === "string" && validCategories.has(record.category) ? record.category : "diger";
  const seasons = Array.isArray(record.season)
    ? record.season.filter((season, index, allSeasons): season is WardrobeItem["season"][number] => typeof season === "string" && validSeasons.has(season) && allSeasons.indexOf(season) === index)
    : [];
  const colors = Array.isArray(record.colors)
    ? [...new Set(record.colors.filter((color): color is string => typeof color === "string" && color.trim().length > 0).map((color) => color.trim().toLowerCase()))].slice(0, 8)
    : [];
  const purchasePrice = Number(record.purchase_price);
  const wearCount = Number(record.wear_count);

  return {
    id: record.id,
    user_id: record.user_id,
    image_url: typeof record.image_url === "string" ? record.image_url.trim() : "",
    thumbnail_url: typeof record.thumbnail_url === "string" ? normalizeNullableText(record.thumbnail_url, 500) : null,
    category: category as WardrobeItem["category"],
    subcategory: typeof record.subcategory === "string" ? normalizeNullableText(record.subcategory, 80) : null,
    colors,
    dominant_color_hex: typeof record.dominant_color_hex === "string" && /^#[0-9a-f]{6}$/i.test(record.dominant_color_hex.trim()) ? record.dominant_color_hex.trim() : null,
    season: seasons,
    brand: typeof record.brand === "string" ? normalizeNullableText(record.brand, 80) : null,
    fabric: typeof record.fabric === "string" ? normalizeNullableText(record.fabric, 80) : null,
    usage_context: Array.isArray(record.usage_context)
      ? [...new Set(record.usage_context.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).map((entry) => entry.trim().toLowerCase()))].slice(0, 8)
      : [],
    purchase_price: Number.isFinite(purchasePrice) && purchasePrice >= 0 && purchasePrice <= maxPurchasePrice ? Math.round(purchasePrice * 100) / 100 : null,
    wear_count: Number.isFinite(wearCount) ? Math.max(0, Math.min(10_000, Math.trunc(wearCount))) : 0,
    last_worn: normalizeNullableDate(record.last_worn),
    is_shareable: record.is_shareable === true,
    is_lendable: record.is_lendable === true,
    is_active: record.is_active !== false,
    created_at: normalizeDate(record.created_at),
    updated_at: normalizeDate(record.updated_at),
  };
}

function normalizeNullableText(value: string, maxLength: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength) || null;
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string") {
    return new Date().toISOString();
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function normalizeNullableDate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? value : null;
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
  assertItemId(item.id);
  return updateWardrobeItem(userId, item.id, {
    wear_count: item.wear_count + 1,
    last_worn: formatDateOnly(new Date()),
  });
}

export async function deleteWardrobeItem(userId: string, itemId: string): Promise<void> {
  assertUserId(userId);
  assertItemId(itemId);

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

export async function findSimilarWardrobeItems(itemId: string, userId: string, limit = 6): Promise<WardrobeItem[]> {
  assertItemId(itemId);
  assertUserId(userId);

  try {
    const { data: item, error: itemError } = await supabase
      .from("wardrobe_items")
      .select("embedding")
      .eq("id", itemId)
      .eq("user_id", userId)
      .single();

    // No embedding → item not yet analyzed, return empty silently
    if (itemError || !item?.embedding) {
      return [];
    }

    const { data, error } = await supabase.rpc("find_similar_wardrobe_items", {
      query_embedding: item.embedding,
      match_count: limit + 1,  // +1 because source item may appear in results
    });

    if (error) {
      captureError(error, { area: "find_similar_wardrobe_items", item_id: itemId });
      return [];
    }

    return ((data as WardrobeItem[]) ?? [])
      .filter((row) => row.id !== itemId)
      .slice(0, limit);
  } catch (error) {
    captureError(error, { area: "find_similar_wardrobe_items", item_id: itemId });
    return [];
  }
}

async function cleanupUploadedImages(userId: string, urls: Array<string | null | undefined>) {
  const uploadedUrls = urls.filter((url): url is string => typeof url === "string" && url.includes("/storage/v1/object/public/"));
  if (uploadedUrls.length === 0) {
    return;
  }

  try {
    await deleteWardrobeImagesForUserItem(userId, uploadedUrls);
  } catch (error) {
    captureError(error, { area: "wardrobe_item_create_cleanup", uploaded_count: uploadedUrls.length });
  }
}

function assertUserId(value: string) {
  if (!isUuid(value)) {
    throw new Error("Oturum bilgisi gecersiz. Tekrar giris yapmayi dene.");
  }
}

function assertItemId(value: string) {
  if (!isUuid(value)) {
    throw new Error("Kiyafet kaydi gecersiz.");
  }
}
