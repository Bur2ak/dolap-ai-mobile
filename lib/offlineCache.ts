import { createMMKV } from "react-native-mmkv";

import { captureError } from "@/lib/observability";
import type { OutfitSuggestion, WardrobeItem } from "@/types";

const mmkv = createMMKV({ id: "shipirio-cache" });

const wardrobeCacheLimit = 30;
const outfitSuggestionCacheLimit = 3;

function getWardrobeCacheKey(userId: string) {
  return `shipirio:offline:wardrobe:${userId}`;
}

function getOutfitSuggestionsCacheKey(userId: string) {
  return `shipirio:offline:outfit-suggestions:${userId}`;
}

export function cacheWardrobeItems(userId: string, items: WardrobeItem[]) {
  try {
    mmkv.set(getWardrobeCacheKey(userId), JSON.stringify(items.slice(0, wardrobeCacheLimit)));
  } catch (error) {
    captureError(error, { area: "offline_cache_wardrobe_write", user_id: userId });
  }
}

export function getCachedWardrobeItems(userId: string): WardrobeItem[] {
  try {
    const rawValue = mmkv.getString(getWardrobeCacheKey(userId));
    if (!rawValue) return [];
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed.filter(isCachedWardrobeItem) : [];
  } catch (error) {
    captureError(error, { area: "offline_cache_wardrobe_read", user_id: userId });
    return [];
  }
}

export function cacheOutfitSuggestions(userId: string, suggestions: OutfitSuggestion[]) {
  try {
    mmkv.set(getOutfitSuggestionsCacheKey(userId), JSON.stringify(suggestions.slice(0, outfitSuggestionCacheLimit)));
  } catch (error) {
    captureError(error, { area: "offline_cache_outfit_write", user_id: userId });
  }
}

export function getCachedOutfitSuggestions(userId: string): OutfitSuggestion[] {
  try {
    const rawValue = mmkv.getString(getOutfitSuggestionsCacheKey(userId));
    if (!rawValue) return [];
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed.filter(isCachedOutfitSuggestion) : [];
  } catch (error) {
    captureError(error, { area: "offline_cache_outfit_read", user_id: userId });
    return [];
  }
}

export function clearUserCache(userId: string) {
  try {
    mmkv.remove(getWardrobeCacheKey(userId));
    mmkv.remove(getOutfitSuggestionsCacheKey(userId));
  } catch (error) {
    captureError(error, { area: "offline_cache_clear", user_id: userId });
  }
}

function isCachedWardrobeItem(value: unknown): value is WardrobeItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<WardrobeItem>;
  return (
    typeof item.id === "string" &&
    typeof item.user_id === "string" &&
    typeof item.image_url === "string" &&
    typeof item.category === "string" &&
    Array.isArray(item.colors) &&
    Array.isArray(item.season)
  );
}

function isCachedOutfitSuggestion(value: unknown): value is OutfitSuggestion {
  if (!value || typeof value !== "object") return false;
  const suggestion = value as Partial<OutfitSuggestion>;
  return (
    Array.isArray(suggestion.items) &&
    suggestion.items.every((item) => typeof item === "string") &&
    typeof suggestion.name === "string" &&
    typeof suggestion.reason === "string"
  );
}
