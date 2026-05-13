import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

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
    const { wardrobe, event, weather, mood, focus_item_id } = await req.json();
    const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    const promptWardrobe = Array.isArray(wardrobe) ? wardrobe.slice(0, maxWardrobePromptItems) : [];
    const safeEvent = getPromptText(event, "kombin", 80);
    const safeMood = getPromptText(mood, "rahat", 80);
    const safeFocusItemId = typeof focus_item_id === "string" && focus_item_id.trim() ? focus_item_id.trim().slice(0, 80) : null;

    if (!apiKey) {
      return json({ error: "GOOGLE_GEMINI_API_KEY is not configured" }, 500);
    }

    const prompt = `Sen Shipirio'sin. Turkce konusan pratik bir stilist asistansin.

Kullanicinin gardrobu JSON:
${JSON.stringify(promptWardrobe)}

3 kombin oner.

Etkinlik: ${safeEvent}
Ruh hali: ${safeMood}
Hava: ${weather ? `${weather.temp} C, ${weather.description}` : "bilinmiyor"}
Odak parca id: ${safeFocusItemId ?? "yok"}

Kurallar:
1. Sadece gardroptaki item id'lerini kullan.
2. Her kombin 2-4 parca olsun.
3. Odak parca id varsa ve etkinlik/hava ile tamamen uyumsuz degilse ilk kombin mutlaka bu parcayi icersin.
4. Gardropta aksesuar varsa ve kombini guclendiriyorsa 1 aksesuar ekle; aksesuar gereksizse zorlama.
5. Kumas, usage_context, sezon ve renk bilgisini birlikte degerlendir.
6. accessory_note alaninda aksesuar neden secildi veya neden eklenmedi kisaca yaz.
7. formality_match alaninda etkinlik ve ruh haline uyumu tek cumleyle acikla.
8. Yalnizca JSON dondur.

Format:
[
  {"items":["id1","id2"],"name":"Kombin adi","reason":"En fazla 2 cumle gerekce","accessory_note":"Aksesuar notu","formality_match":"Etkinlik/ruh hali uyumu"}
]`;

    const response = await callGemini(apiKey, [{ text: prompt }], 1200);

    if (!response.ok) {
      return json(fallbackOutfits(wardrobe, event, mood, focus_item_id));
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const match = text.match(/\[[\s\S]*\]/);

    if (!match) {
      return json(fallbackOutfits(wardrobe, event, mood, focus_item_id));
    }

    return json(normalizeOutfitSuggestions(JSON.parse(match[0]), wardrobe, safeFocusItemId));
  } catch (error) {
    return json(fallbackOutfits([], "kombin", "rahat", null));
  }
});

function normalizeOutfitSuggestions(value: unknown, wardrobe: unknown, focusItemId: unknown) {
  const items = Array.isArray(wardrobe) ? wardrobe : [];
  const validIds = new Set(
    items
      .map((item) => (isRecord(item) && typeof item.id === "string" ? item.id : null))
      .filter((id): id is string => Boolean(id)),
  );

  if (!Array.isArray(value) || validIds.size < 2) {
    return fallbackOutfits(wardrobe, "kombin", "rahat", focusItemId);
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
        name: typeof entry.name === "string" && entry.name.trim() ? entry.name.trim().slice(0, 80) : "Shipirio Kombini",
        reason: typeof entry.reason === "string" && entry.reason.trim() ? entry.reason.trim().slice(0, 360) : "Dolabindaki uyumlu parcalardan olusturuldu.",
        accessory_note: typeof entry.accessory_note === "string" ? entry.accessory_note.trim().slice(0, 240) || null : null,
        formality_match: typeof entry.formality_match === "string" ? entry.formality_match.trim().slice(0, 120) || "Temel uyum" : "Temel uyum",
      };
    })
    .filter(Boolean)
    .slice(0, 3);

  return suggestions.length > 0 ? suggestions : fallbackOutfits(wardrobe, "kombin", "rahat", focusItemId);
}

function getPromptText(value: unknown, fallback: string, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : fallback;
}

function fallbackOutfits(wardrobe: unknown, event: unknown, mood: unknown, focusItemId: unknown) {
  const items = Array.isArray(wardrobe) ? wardrobe : [];
  const candidateItems = items.filter((item): item is Record<string, unknown> => isRecord(item) && typeof item.id === "string");
  const focusId = typeof focusItemId === "string" ? focusItemId : null;
  const accessoryId = getFirstCategoryId(items, "aksesuar");
  const sortedIds = candidateItems
    .sort((a, b) => scoreOutfitItem(b, event, mood) - scoreOutfitItem(a, event, mood))
    .map((item) => String(item.id));
  const ids = [
    ...(focusId && sortedIds.includes(focusId) ? [focusId] : []),
    ...sortedIds.filter((id) => id !== focusId),
  ].slice(0, 4);

  if (ids.length < 2) {
    return [];
  }

  return [
    {
      items: withAccessory(ids.slice(0, Math.min(ids.length, 3)), accessoryId),
      name: focusId ? "Tekrar Giy Kombini" : "Pratik Kombin",
      reason: focusId
        ? `Uzun suredir bekleyen parcayi ${String(event ?? "etkinlik")} ve ${String(mood ?? "rahat")} hissine gore tekrar kullanmak icin pratik bir oneridir.`
        : `${String(event ?? "Etkinlik")} ve ${String(mood ?? "rahat")} hissi icin dolabindaki uyumlu parcalardan pratik bir oneridir.`,
      accessory_note: accessoryId ? "Dolaptaki uygun aksesuar kombini tamamlamak icin eklendi." : "Dolapta uygun aksesuar bulunamadigi icin aksesuar eklenmedi.",
      formality_match: "Temel uyum",
    },
  ];
}

function scoreOutfitItem(item: Record<string, unknown>, event: unknown, mood: unknown) {
  const signal = normalizeText(`${String(event ?? "")} ${String(mood ?? "")}`);
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

  if (signal.includes("is") || signal.includes("ofis") || signal.includes("toplanti")) {
    score += text.includes("is") || text.includes("resmi") || ["ust", "alt", "elbise", "dis_giyim", "ayakkabi"].includes(category) ? 3 : 0;
  }
  if (signal.includes("spor") || signal.includes("rahat")) {
    score += text.includes("spor") || text.includes("gunluk") || category === "spor" || category === "ayakkabi" ? 3 : 0;
  }
  if (signal.includes("gece") || signal.includes("dugun") || signal.includes("sik")) {
    score += text.includes("gece") || text.includes("resmi") || category === "elbise" || category === "aksesuar" ? 3 : 0;
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
