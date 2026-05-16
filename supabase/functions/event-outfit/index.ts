import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { fetchUserWardrobe, json, requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const geminiMaxAttempts = 3;
const geminiBaseDelayMs = 700;
const maxWardrobePromptItems = 80;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const auth = await requireAuth(req);
    if (auth.error) return auth.error;

    const { title, event_type, event_date, location, notes, weather } = await req.json();
    const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");

    const wardrobe = await fetchUserWardrobe(auth.userId);
    const promptWardrobe = wardrobe.slice(0, maxWardrobePromptItems);
    const safeTitle = getPromptText(title, "Etkinlik", 120);
    const safeEventType = getPromptText(event_type, "genel", 80);
    const safeEventDate = getPromptText(event_date, "belirtilmedi", 80);
    const safeLocation = getPromptText(location, "belirtilmedi", 120);
    const safeNotes = getPromptText(notes, "yok", 400);

    if (!apiKey) {
      return json(fallbackOutfits(wardrobe, safeTitle));
    }

    const prompt = `Sen Shipirio'sin. Turkce konusan etkinlik stilisti asistansin.

Kullanicinin gardrobu:
${JSON.stringify(promptWardrobe)}

Etkinlik kombini oner.

Baslik: ${safeTitle}
Tip: ${safeEventType}
Tarih: ${safeEventDate}
Lokasyon: ${safeLocation}
Notlar: ${safeNotes}
Hava: ${weather ? `${weather.temp} C, ${weather.description}` : "bilinmiyor"}

3 uygun kombin oner.
Kurallar:
1. Sadece gardroptaki item id'lerini kullan.
2. Etkinlik uygunsa aksesuar ekle ve accessory_note alaninda nedenini yaz.
3. Aksesuar uygun degilse accessory_note alaninda kisa acikla.
4. Kumas, usage_context, sezon ve renk bilgisini etkinlik resmi/gunluk dengesine gore oku.
5. Hava ve lokasyon bilgisi varsa kumas ve katman secimini buna gore yap.
6. Sadece JSON dondur:
[
  {"items":["id1","id2"],"name":"Kombin adi","reason":"2 cumle gerekce","accessory_note":"Aksesuar notu","formality_match":"Etkinlik uyumu"}
]`;

    const response = await callGemini(apiKey, [{ text: prompt }], 1200);

    if (!response.ok) {
      return json(fallbackOutfits(wardrobe, safeTitle));
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const match = text.match(/\[[\s\S]*\]/);

    if (!match) {
      return json(fallbackOutfits(wardrobe, safeTitle));
    }

    return json(normalizeOutfitSuggestions(JSON.parse(match[0]), wardrobe, safeTitle));
  } catch (error) {
    return json(fallbackOutfits([], "Etkinlik"));
  }
});

function normalizeOutfitSuggestions(value: unknown, wardrobe: unknown, title: unknown) {
  const items = Array.isArray(wardrobe) ? wardrobe : [];
  const validIds = new Set(
    items
      .map((item) => (isRecord(item) && typeof item.id === "string" ? item.id : null))
      .filter((id): id is string => Boolean(id)),
  );

  if (!Array.isArray(value) || validIds.size < 2) {
    return fallbackOutfits(wardrobe, title);
  }

  const suggestions = value
    .map((entry) => {
      if (!isRecord(entry) || !Array.isArray(entry.items)) {
        return null;
      }

      const ids = [...new Set(entry.items.filter((id): id is string => typeof id === "string" && validIds.has(id)))].slice(0, 4);
      if (ids.length < 2) {
        return null;
      }

      return {
        items: ids,
        name: typeof entry.name === "string" && entry.name.trim() ? entry.name.trim().slice(0, 80) : "Etkinlik Kombini",
        reason: typeof entry.reason === "string" && entry.reason.trim() ? entry.reason.trim().slice(0, 360) : "Etkinlik icin dolabindaki uyumlu parcalardan olusturuldu.",
        accessory_note: typeof entry.accessory_note === "string" ? entry.accessory_note.trim().slice(0, 240) || null : null,
        formality_match: typeof entry.formality_match === "string" ? entry.formality_match.trim().slice(0, 120) || "Temel uyum" : "Temel uyum",
      };
    })
    .filter(Boolean)
    .slice(0, 3);

  return suggestions.length > 0 ? suggestions : fallbackOutfits(wardrobe, title);
}

function getPromptText(value: unknown, fallback: string, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : fallback;
}

function fallbackOutfits(wardrobe: unknown, title: unknown) {
  const items = Array.isArray(wardrobe) ? wardrobe : [];
  const allIds = items
    .filter((item): item is Record<string, unknown> => isRecord(item) && typeof item.id === "string")
    .sort((a, b) => scoreEventItem(b, title) - scoreEventItem(a, title))
    .map((item) => String(item.id));
  const accessoryId = getFirstCategoryId(items, "aksesuar");
  const ids = allIds.slice(0, 4);

  if (ids.length < 2) {
    return [];
  }

  return [
    {
      items: withAccessory(ids.slice(0, Math.min(ids.length, 3)), accessoryId),
      name: "Etkinlik Kombini",
      reason: `${String(title ?? "Etkinlik")} icin dolabindaki uyumlu parcalardan pratik bir oneridir.`,
      accessory_note: accessoryId ? "Etkinlik kombininin daha tamamlanmis gorunmesi icin aksesuar eklendi." : "Dolapta uygun aksesuar bulunamadigi icin aksesuar eklenmedi.",
      formality_match: "Temel uyum",
    },
  ];
}

function scoreEventItem(item: Record<string, unknown>, title: unknown) {
  const signal = normalizeText(String(title ?? ""));
  const category = String(item.category ?? "");
  const text = normalizeText([
    item.subcategory,
    item.brand,
    item.fabric,
    ...(Array.isArray(item.colors) ? item.colors : []),
    ...(Array.isArray(item.season) ? item.season : []),
    ...(Array.isArray(item.usage_context) ? item.usage_context : []),
  ].join(" "));
  let score = 0;

  if (signal.includes("dugun") || signal.includes("davet") || signal.includes("gece")) {
    score += text.includes("resmi") || text.includes("gece") || category === "elbise" || category === "aksesuar" ? 3 : 0;
  }
  if (signal.includes("is") || signal.includes("toplanti") || signal.includes("ofis")) {
    score += text.includes("is") || text.includes("resmi") || ["ust", "alt", "dis_giyim", "ayakkabi"].includes(category) ? 3 : 0;
  }
  if (signal.includes("tatil") || signal.includes("seyahat") || signal.includes("festival")) {
    score += text.includes("tatil") || text.includes("gunluk") || text.includes("yaz") || category === "ayakkabi" ? 3 : 0;
  }
  if (["ust", "alt", "elbise", "ayakkabi"].includes(category)) {
    score += 1;
  }

  return score;
}

function getFirstCategoryId(items: unknown[], category: string) {
  for (const item of items) {
    if (isRecord(item) && item.category === category && typeof item.id === "string") {
      return item.id;
    }
  }

  return null;
}

function withAccessory(ids: string[], accessoryId: string | null) {
  if (!accessoryId || ids.includes(accessoryId) || ids.length >= 4) {
    return ids;
  }

  return [...ids, accessoryId];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeText(value: string) {
  return value.toLocaleLowerCase("tr-TR").trim();
}

async function callGemini(apiKey: string, parts: unknown[], maxOutputTokens: number) {
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens,
    },
  });

  for (let attempt = 1; attempt <= geminiMaxAttempts; attempt += 1) {
    try {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body,
        signal: AbortSignal.timeout(15_000),
      });

      if (response.ok || !isRetryableGeminiStatus(response.status) || attempt === geminiMaxAttempts) {
        return response;
      }
    } catch (error) {
      if (attempt === geminiMaxAttempts) {
        throw error;
      }
    }

    await delay(geminiBaseDelayMs * 2 ** (attempt - 1));
  }

  throw new Error("Gemini request failed");
}

function isRetryableGeminiStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

