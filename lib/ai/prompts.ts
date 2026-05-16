import type { EventPlanInput, OutfitRecommendationInput, WardrobeItem } from "@/types";

export interface GroupOutfitInput {
  event: string;
  myWardrobe: WardrobeItem[];
  friendWardrobe: WardrobeItem[];
  friendName: string;
}

export function analyzeClothingPrompt() {
  return `Bu kiyafeti analiz et. Yalnizca JSON dondur, aciklama ekleme.

{
  "category": "ust|alt|elbise|etek|dis_giyim|ayakkabi|canta|aksesuar|ic_giyim|spor|diger",
  "subcategory": "string",
  "colors": ["renk1", "renk2"],
  "dominant_color_hex": "#RRGGBB",
  "season": ["ilkbahar|yaz|sonbahar|kis"],
  "brand": null,
  "fabric": "pamuk|keten|denim|deri|suni deri|polyester|viskon|yun|triko|ipek|null",
  "usage_context": ["gunluk|is|spor|gece|dugun|tatil|ev|resmi"]
}`;
}

export function recommendOutfitPrompt(params: OutfitRecommendationInput) {
  const wardrobeJson = JSON.stringify(
    params.wardrobe.slice(0, 60).map((item) => ({
      id: item.id,
      category: item.category,
      subcategory: item.subcategory,
      colors: item.colors,
      season: item.season,
      usage_context: item.usage_context,
      wear_count: item.wear_count,
      last_worn: item.last_worn,
      brand: item.brand,
    })),
  );

  const focusNote = params.focus_item_id
    ? `Odak parca ID: ${params.focus_item_id} — bu parçayi kombine dahil et.`
    : "";

  return {
    system: `Sen Shipirio'sun — Turkce konusan, moda konusunda uzman bir stilist asistansin.\n\nKullanicinin gardrobu:\n${wardrobeJson}`,
    user: `Etkinlik: ${params.event}
Ruh hali: ${params.mood}
Hava: ${params.weather ? `${params.weather.temp}°C, ${params.weather.description}` : "bilinmiyor"}
${focusNote}

3 farkli kombin oner. Her biri icin yalnizca JSON array dondur:
[{"items": ["id1","id2","id3"], "name": "Kombin adi", "reason": "...", "accessory_note": "opsiyonel aksesuar notu", "formality_match": "opsiyonel formality notu"}]`,
  };
}

export function buyDecisionPrompt(wardrobe: WardrobeItem[], price: number | null) {
  const wardrobeJson = JSON.stringify(
    wardrobe.slice(0, 60).map((item) => ({
      id: item.id,
      category: item.category,
      subcategory: item.subcategory,
      colors: item.colors,
      season: item.season,
      usage_context: item.usage_context,
      wear_count: item.wear_count,
    })),
  );

  return {
    system: `Sen Shipirio'sun. Turkce konusan, satin alma kararlarinda pratik bir stil danismanisin.\n\nKullanicinin mevcut gardrobu:\n${wardrobeJson}`,
    user: `Bu kiyafeti almali miyim? Fiyat: ${price ? `${price} TL` : "belirtilmedi"}

Yalnizca JSON dondur:
{
  "decision": "AL|BEKLEME|ALMA",
  "confidence": 0.85,
  "similar_items_in_wardrobe": ["item_id"],
  "combination_count": 5,
  "cost_per_wear_suggestion": "string",
  "main_reason": "Tek cumle",
  "details": "2-3 cumle",
  "discount_advice": "string|null"
}`,
  };
}

export function groupOutfitPrompt(params: GroupOutfitInput) {
  const myJson = JSON.stringify(
    params.myWardrobe.slice(0, 40).map((item) => ({
      id: item.id,
      owner: "ben",
      category: item.category,
      subcategory: item.subcategory,
      colors: item.colors,
      season: item.season,
      usage_context: item.usage_context,
    })),
  );

  const friendJson = JSON.stringify(
    params.friendWardrobe.slice(0, 40).map((item) => ({
      id: item.id,
      owner: params.friendName,
      category: item.category,
      subcategory: item.subcategory,
      colors: item.colors,
      season: item.season,
      usage_context: item.usage_context,
    })),
  );

  return {
    system: `Sen Shipirio'sun. Iki kisinin dolabini birlikte koordine eden Turkce konusan bir grup stilistsin.\n\nBenim dolabim:\n${myJson}\n\n${params.friendName} dolabi:\n${friendJson}`,
    user: `Etkinlik: ${params.event}

Iki kisinin birbirini tamamlayan, uyumlu 2 farkli grup kombin onerisi yap. Yalnizca JSON array dondur:
[{"my_items": ["id1","id2"], "friend_items": ["id3","id4"], "name": "Kombin adi", "reason": "Neden uyumlu", "color_story": "Renk uyumu aciklamasi"}]`,
  };
}

export function eventOutfitPrompt(params: EventPlanInput) {
  const wardrobeJson = JSON.stringify(
    params.wardrobe.slice(0, 60).map((item) => ({
      id: item.id,
      category: item.category,
      subcategory: item.subcategory,
      colors: item.colors,
      season: item.season,
      usage_context: item.usage_context,
      wear_count: item.wear_count,
    })),
  );

  return {
    system: `Sen Shipirio'sun. Etkinlik bazli kombin onerisinde uzman Turkce konusan bir stilistsin.\n\nKullanicinin gardrobu:\n${wardrobeJson}`,
    user: `Etkinlik: ${params.title}
Tip: ${params.event_type}
Tarih: ${params.event_date}
Lokasyon: ${params.location ?? "belirtilmedi"}
Notlar: ${params.notes ?? "yok"}
Hava: ${params.weather ? `${params.weather.temp}°C, ${params.weather.description}` : "bilinmiyor"}

3 farkli kombin oner. Yalnizca JSON array:
[{"items": ["id1","id2"], "name": "...", "reason": "...", "formality_match": "...", "accessory_note": "..."}]`,
  };
}
