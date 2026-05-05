import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { wardrobe, event, weather, mood } = await req.json();
    const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");

    if (!apiKey) {
      return json({ error: "GOOGLE_GEMINI_API_KEY is not configured" }, 500);
    }

    const prompt = `Sen Shipirio'sin. Turkce konusan pratik bir stilist asistansin.

Kullanicinin gardrobu JSON:
${JSON.stringify(wardrobe ?? [])}

3 kombin oner.

Etkinlik: ${event}
Ruh hali: ${mood}
Hava: ${weather ? `${weather.temp} C, ${weather.description}` : "bilinmiyor"}

Kurallar:
1. Sadece gardroptaki item id'lerini kullan.
2. Her kombin 2-4 parca olsun.
3. Yalnizca JSON dondur.

Format:
[
  {"items":["id1","id2"],"name":"Kombin adi","reason":"En fazla 2 cumle gerekce"}
]`;

    const response = await callGemini(apiKey, [{ text: prompt }], 1200);

    if (!response.ok) {
      return json(fallbackOutfits(wardrobe, event, mood));
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const match = text.match(/\[[\s\S]*\]/);

    if (!match) {
      return json(fallbackOutfits(wardrobe, event, mood));
    }

    return json(JSON.parse(match[0]));
  } catch (error) {
    return json(fallbackOutfits([], "kombin", "rahat"));
  }
});

function fallbackOutfits(wardrobe: unknown, event: unknown, mood: unknown) {
  const items = Array.isArray(wardrobe) ? wardrobe : [];
  const ids = items
    .map((item) => (isRecord(item) && typeof item.id === "string" ? item.id : null))
    .filter((id): id is string => Boolean(id))
    .slice(0, 4);

  if (ids.length < 2) {
    return [];
  }

  return [
    {
      items: ids.slice(0, Math.min(ids.length, 3)),
      name: "Pratik Kombin",
      reason: `${String(event ?? "Etkinlik")} ve ${String(mood ?? "rahat")} hissi icin dolabindaki uyumlu parcalardan pratik bir oneridir.`,
    },
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function callGemini(apiKey: string, parts: unknown[], maxOutputTokens: number) {
  return fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens,
      },
    }),
  });
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
