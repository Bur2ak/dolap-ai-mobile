import AsyncStorage from "@react-native-async-storage/async-storage";

import { captureError } from "@/lib/observability";
import type { OutfitSuggestion, WardrobeItem } from "@/types";

const wardrobeCacheLimit = 30;
const outfitSuggestionCacheLimit = 3;

function getWardrobeCacheKey(userId: string) {
  return `shipirio:offline:wardrobe:${userId}`;
}

function getOutfitSuggestionsCacheKey(userId: string) {
  return `shipirio:offline:outfit-suggestions:${userId}`;
}

export async function cacheWardrobeItems(userId: string, items: WardrobeItem[]) {
  try {
    await AsyncStorage.setItem(getWardrobeCacheKey(userId), JSON.stringify(items.slice(0, wardrobeCacheLimit)));
  } catch (error) {
    captureError(error, { area: "offline_cache_wardrobe_write", user_id: userId });
  }
}

export async function getCachedWardrobeItems(userId: string): Promise<WardrobeItem[]> {
  try {
    const rawValue = await AsyncStorage.getItem(getWardrobeCacheKey(userId));
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? (parsed as WardrobeItem[]) : [];
  } catch (error) {
    captureError(error, { area: "offline_cache_wardrobe_read", user_id: userId });
    return [];
  }
}

export async function cacheOutfitSuggestions(userId: string, suggestions: OutfitSuggestion[]) {
  try {
    await AsyncStorage.setItem(getOutfitSuggestionsCacheKey(userId), JSON.stringify(suggestions.slice(0, outfitSuggestionCacheLimit)));
  } catch (error) {
    captureError(error, { area: "offline_cache_outfit_write", user_id: userId });
  }
}

export async function getCachedOutfitSuggestions(userId: string): Promise<OutfitSuggestion[]> {
  try {
    const rawValue = await AsyncStorage.getItem(getOutfitSuggestionsCacheKey(userId));
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? (parsed as OutfitSuggestion[]) : [];
  } catch (error) {
    captureError(error, { area: "offline_cache_outfit_read", user_id: userId });
    return [];
  }
}
