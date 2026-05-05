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
    const { title, event_type, event_date, location, notes, weather, wardrobe } = await req.json();
    const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");

    if (!apiKey) {
      return json({ error: "GOOGLE_GEMINI_API_KEY is not configured" }, 500);
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

3 uygun kombin oner. Sadece JSON dondur:
[
  {"items":["id1","id2"],"name":"Kombin adi","reason":"2 cumle gerekce","formality_match":"Etkinlik uyumu"}
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
      name: "Etkinlik Kombini",
      reason: `${String(title ?? "Etkinlik")} icin dolabindaki uyumlu parcalardan pratik bir oneridir.`,
      formality_match: "Temel uyum",
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
