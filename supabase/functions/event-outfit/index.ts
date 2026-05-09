import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const geminiMaxAttempts = 3;
const geminiBaseDelayMs = 700;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { title, event_type, event_date, location, notes, weather, wardrobe } = await req.json();
    const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");

    if (!apiKey) {
      return json(fallbackOutfits(wardrobe, title));
    }

    const prompt = `Sen Shipirio'sin. Turkce konusan etkinlik stilisti asistansin.

Kullanicinin gardrobu:
${JSON.stringify(wardrobe ?? [])}

Etkinlik kombini oner.

Baslik: ${title}
Tip: ${event_type}
Tarih: ${event_date}
Lokasyon: ${location ?? "belirtilmedi"}
Notlar: ${notes ?? "yok"}
Hava: ${weather ? `${weather.temp} C, ${weather.description}` : "bilinmiyor"}

3 uygun kombin oner.
Kurallar:
1. Sadece gardroptaki item id'lerini kullan.
2. Etkinlik uygunsa aksesuar ekle ve accessory_note alaninda nedenini yaz.
3. Aksesuar uygun degilse accessory_note alaninda kisa acikla.
4. Sadece JSON dondur:
[
  {"items":["id1","id2"],"name":"Kombin adi","reason":"2 cumle gerekce","accessory_note":"Aksesuar notu","formality_match":"Etkinlik uyumu"}
]`;

    const response = await callGemini(apiKey, [{ text: prompt }], 1200);

    if (!response.ok) {
      return json(fallbackOutfits(wardrobe, title));
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const match = text.match(/\[[\s\S]*\]/);

    if (!match) {
      return json(fallbackOutfits(wardrobe, title));
    }

    return json(JSON.parse(match[0]));
  } catch (error) {
    return json(fallbackOutfits([], "Etkinlik"));
  }
});

function fallbackOutfits(wardrobe: unknown, title: unknown) {
  const items = Array.isArray(wardrobe) ? wardrobe : [];
  const allIds = items
    .map((item) => (isRecord(item) && typeof item.id === "string" ? item.id : null))
    .filter((id): id is string => Boolean(id));
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
