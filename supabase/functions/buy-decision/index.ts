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
    const { imageBase64, mimeType, wardrobe, price } = await req.json();
    const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");

    if (!apiKey) {
      return json(fallbackDecision(wardrobe, price, "Gemini anahtari olmadigi icin pratik dolap analizi kullanildi."));
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
      return json(fallbackDecision(wardrobe, price, `Gemini gecici olarak yanit vermedi (${response.status}).`));
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
      return json(fallbackDecision(wardrobe, price, "Gemini yaniti beklenen JSON formatinda degildi."));
    }

    return json(JSON.parse(match[0]));
  } catch (error) {
    return json(fallbackDecision([], null, error instanceof Error ? error.message : "Bilinmeyen hata."));
  }
});

function fallbackDecision(wardrobe: unknown, price: unknown, reason: string) {
  const items = Array.isArray(wardrobe) ? wardrobe : [];
  const similarIds = items
    .filter((item) => isRecord(item) && typeof item.id === "string")
    .slice(0, 3)
    .map((item) => String((item as Record<string, unknown>).id));
  const numericPrice = typeof price === "number" && Number.isFinite(price) ? price : null;
  const decision = similarIds.length >= 2 ? "BEKLEME" : numericPrice && numericPrice > 2500 ? "BEKLEME" : "AL";

  return {
    decision,
    confidence: 0.55,
    similar_items_in_wardrobe: similarIds,
    combination_count: Math.max(1, Math.min(5, items.length)),
    cost_per_wear_suggestion: numericPrice
      ? `${numericPrice} TL icin once bu parcayi en az 5 farkli kombinle kullanip kullanamayacagini kontrol et.`
      : "Fiyat eklenirse kullanim basi maliyet daha net yorumlanir.",
    main_reason: reason,
    details:
      similarIds.length > 0
        ? "Dolabinda benzer veya tamamlayici parcalar oldugu icin satin alma kararini aceleye getirme. Mevcut parcalarla net kombin ihtiyacini kontrol et."
        : "Dolabinda yeterli benzer veri yok; bu parca gercek bir ihtiyaci karsiliyorsa alinabilir.",
    discount_advice: numericPrice && numericPrice > 1500 ? "Indirim veya ikinci el alternatifi takip etmek mantikli olabilir." : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function callGemini(apiKey: string, parts: unknown[], maxOutputTokens: number) {
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.2,
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
