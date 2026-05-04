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
        system: `Sen Shipirio'sin. Turkce konusan pratik bir stilist asistansin.

Kullanicinin gardrobu JSON:
${JSON.stringify(wardrobe ?? [])}`,
        messages: [
          {
            role: "user",
            content: `3 kombin oner.

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
]`,
          },
        ],
      }),
    });

    if (!response.ok) {
      return json({ error: "Anthropic request failed", status: response.status }, response.status);
    }

    const data = await response.json();
    const text = data.content?.find((part: { type: string }) => part.type === "text")?.text ?? "";
    const match = text.match(/\[[\s\S]*\]/);

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
