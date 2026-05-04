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
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!apiKey) {
      return json({ error: "ANTHROPIC_API_KEY is not configured" }, 500);
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1200,
        system: `Sen Shipirio'sin. Turkce konusan, satin alma kararlarinda pratik bir stil danismanisin.

Kullanicinin mevcut gardrobu:
${JSON.stringify(wardrobe ?? [])}`,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mimeType || "image/jpeg",
                  data: imageBase64,
                },
              },
              {
                type: "text",
                text: `Bu kiyafeti almali miyim? Fiyat: ${price ? `${price} TL` : "belirtilmedi"}

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
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      return json({ error: "Anthropic request failed", status: response.status }, response.status);
    }

    const data = await response.json();
    const text = data.content?.find((part: { type: string }) => part.type === "text")?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
      return json({ error: "Anthropic response did not include JSON" }, 502);
    }

    return json(JSON.parse(match[0]));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
