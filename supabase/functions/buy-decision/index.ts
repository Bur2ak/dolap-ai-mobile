import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const geminiMaxAttempts = 3;
const geminiBaseDelayMs = 700;
const maxImageBase64Length = 12_000_000;
const maxWardrobePromptItems = 60;
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const { imageBase64, mimeType, wardrobe, price } = await req.json();
    const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    const safeMimeType = typeof mimeType === "string" && allowedMimeTypes.has(mimeType) ? mimeType : "image/jpeg";
    const promptWardrobe = Array.isArray(wardrobe) ? wardrobe.slice(0, maxWardrobePromptItems) : [];
    const safePrice = typeof price === "number" && Number.isFinite(price) && price > 0 && price <= 10_000_000 ? price : null;

    if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
      return json(fallbackDecision(wardrobe, safePrice, "Gecerli kiyafet gorseli bulunamadigi icin pratik dolap analizi kullanildi."), 400);
    }

    if (imageBase64.length > maxImageBase64Length) {
      return json(fallbackDecision(wardrobe, safePrice, "Gorsel boyutu cok buyuk oldugu icin pratik dolap analizi kullanildi."), 413);
    }

    if (!apiKey) {
      return json(fallbackDecision(wardrobe, safePrice, "Gemini anahtari olmadigi icin pratik dolap analizi kullanildi."));
    }

    const prompt = `Sen Shipirio'sin. Turkce konusan, satin alma kararlarinda pratik bir stil danismanisin.

Kullanicinin mevcut gardrobu:
${JSON.stringify(promptWardrobe)}

Bu kiyafeti almali miyim? Fiyat: ${safePrice ? `${safePrice} TL` : "belirtilmedi"}

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
            mime_type: safeMimeType,
            data: imageBase64,
          },
        },
        { text: prompt },
      ],
      1200,
    );

    if (!response.ok) {
      return json(fallbackDecision(wardrobe, safePrice, `Gemini gecici olarak yanit vermedi (${response.status}).`));
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
      return json(fallbackDecision(wardrobe, price, "Gemini yaniti beklenen JSON formatinda degildi."));
    }

    return json(normalizeDecision(JSON.parse(match[0]), wardrobe, safePrice));
  } catch (error) {
    return json(fallbackDecision([], null, error instanceof Error ? error.message : "Bilinmeyen hata."));
  }
});

function normalizeDecision(value: unknown, wardrobe: unknown, price: unknown) {
  if (!isRecord(value)) {
    return fallbackDecision(wardrobe, price, "Gemini yaniti beklenen karar formatinda degildi.");
  }

  const validIds = new Set(
    (Array.isArray(wardrobe) ? wardrobe : [])
      .map((item) => (isRecord(item) && typeof item.id === "string" ? item.id : null))
      .filter((id): id is string => Boolean(id)),
  );
  const decision = value.decision === "AL" || value.decision === "BEKLEME" || value.decision === "ALMA" ? value.decision : "BEKLEME";
  const confidence = typeof value.confidence === "number" && Number.isFinite(value.confidence) ? Math.max(0, Math.min(1, value.confidence)) : 0.55;
  const similarItems = Array.isArray(value.similar_items_in_wardrobe)
    ? [...new Set(value.similar_items_in_wardrobe.filter((id): id is string => typeof id === "string" && validIds.has(id)))].slice(0, 5)
    : [];
  const combinationCount = typeof value.combination_count === "number" && Number.isFinite(value.combination_count) ? Math.max(0, Math.min(20, Math.round(value.combination_count))) : 0;

  return {
    decision,
    confidence,
    similar_items_in_wardrobe: similarItems,
    combination_count: combinationCount,
    cost_per_wear_suggestion: getText(value.cost_per_wear_suggestion, "Kullanim basi maliyet icin bu parcayi kac farkli kombinde kullanacagini kontrol et.", 240),
    main_reason: getText(value.main_reason, "Dolap uyumu ve ihtiyacina gore dengeli bir karar onerildi.", 180),
    details: getText(value.details, "Mevcut gardrobunla uyumu, benzer parcalar ve fiyat etkisi birlikte degerlendirildi.", 500),
    discount_advice: typeof value.discount_advice === "string" ? value.discount_advice.trim().slice(0, 240) || null : null,
  };
}

function getText(value: unknown, fallback: string, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : fallback;
}

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
