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
    const { imageBase64, mimeType, wardrobe, price } = await req.json();
    const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");

    if (!apiKey) {
      return json({ error: "GOOGLE_GEMINI_API_KEY is not configured" }, 500);
    }

    const prompt = `Sen Shipirio'sin. Turkce konusan, satin alma kararlarinda pratik bir stil danismanisin.

Kullanicinin mevcut gardrobu:
${JSON.stringify(wardrobe ?? [])}

Bu kiyafeti almali miyim? Fiyat: ${price ? `${price} TL` : "belirtilmedi"}

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
}`;

    const response = await callGemini(
      apiKey,
      [
        {
          inline_data: {
            mime_type: mimeType || "image/jpeg",
            data: imageBase64,
          },
        },
        { text: prompt },
      ],
      1200,
    );

    if (!response.ok) {
      return json({ error: "Gemini request failed", status: response.status }, response.status);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);

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
        temperature: 0.2,
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
