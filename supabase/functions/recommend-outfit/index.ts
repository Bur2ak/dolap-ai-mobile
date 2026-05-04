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
      return json({ error: "Gemini request failed", status: response.status }, response.status);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const match = text.match(/\[[\s\S]*\]/);

    if (!match) {
      return json({ error: "Gemini response did not include JSON" }, 502);
    }

    return json(JSON.parse(match[0]));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

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
