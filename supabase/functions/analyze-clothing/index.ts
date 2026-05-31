import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";
import { enforceDailyLimit, enforceRateLimit } from "../_shared/limits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAILY_AI_VISION_LIMIT = 60;
const RATE_PER_MINUTE = 20;

const geminiMaxAttempts = 3;
const geminiBaseDelayMs = 700;
const maxImageBase64Length = 12_000_000;
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const auth = await requireAuth(req);
    if (auth.error) return auth.error;

    const rate = await enforceRateLimit(auth.userId, RATE_PER_MINUTE);
    if (rate.error) return rate.error;

    const limit = await enforceDailyLimit(auth.userId, "daily_ai_vision", DAILY_AI_VISION_LIMIT);
    if (limit.error) return limit.error;

    const { imageBase64, mimeType } = await req.json();
    const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    const safeMimeType = typeof mimeType === "string" && allowedMimeTypes.has(mimeType) ? mimeType : "image/jpeg";

    if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
      return json(fallbackAnalysis("Gecerli kiyafet gorseli bulunamadigi icin manuel duzenlenebilir varsayilan analiz kullanildi."), 400);
    }

    if (imageBase64.length > maxImageBase64Length) {
      return json(fallbackAnalysis("Gorsel boyutu cok buyuk oldugu icin manuel duzenlenebilir varsayilan analiz kullanildi."), 413);
    }

    if (!apiKey) {
      return json(fallbackAnalysis("Gemini anahtari olmadigi icin manuel duzenlenebilir varsayilan analiz kullanildi."));
    }

    const response = await callGemini(
      apiKey,
      [
        {
          inline_data: {
            mime_type: safeMimeType,
            data: imageBase64,
          },
        },
        {
          text: `Bu kiyafeti analiz et. Yalnizca JSON dondur, aciklama ekleme.

{
  "category": "ust|alt|elbise|etek|dis_giyim|ayakkabi|canta|aksesuar|ic_giyim|spor|diger",
  "subcategory": "string",
  "colors": ["renk1", "renk2"],
  "dominant_color_hex": "#RRGGBB",
  "season": ["ilkbahar|yaz|sonbahar|kis"],
  "brand": null,
  "fabric": "pamuk|keten|denim|deri|suni deri|polyester|viskon|yun|triko|ipek|null",
  "usage_context": ["gunluk|is|spor|gece|dugun|tatil|ev|resmi"]
}`,
        },
      ],
      500,
    );

    if (!response.ok) {
      return json(fallbackAnalysis(`Gemini gecici olarak yanit vermedi (${response.status}).`));
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
      return json(fallbackAnalysis("Gemini yaniti beklenen JSON formatinda degildi."));
    }

    const analysis = normalizeAnalysis(JSON.parse(match[0]));
    const embedding = await generateEmbedding(apiKey, analysis);
    return json({ ...analysis, embedding });
  } catch (error) {
    return json(fallbackAnalysis(error instanceof Error ? error.message : "Bilinmeyen hata."));
  }
});

const validCategories = new Set(["ust", "alt", "elbise", "etek", "dis_giyim", "ayakkabi", "canta", "aksesuar", "ic_giyim", "spor", "diger"]);
const validSeasons = new Set(["ilkbahar", "yaz", "sonbahar", "kis"]);

function normalizeAnalysis(value: unknown) {
  if (!isRecord(value)) {
    return fallbackAnalysis("Gemini yaniti beklenen analiz formatinda degildi.");
  }

  const category = typeof value.category === "string" && validCategories.has(value.category) ? value.category : "diger";
  const colors = Array.isArray(value.colors)
    ? value.colors
        .filter((color): color is string => typeof color === "string" && Boolean(color.trim()))
        .map((color) => color.trim().toLowerCase().slice(0, 32))
        .slice(0, 5)
    : [];
  const season = Array.isArray(value.season)
    ? [...new Set(value.season.filter((entry): entry is string => typeof entry === "string" && validSeasons.has(entry)))].slice(0, 4)
    : [];
  const dominantColor = typeof value.dominant_color_hex === "string" && /^#[0-9a-f]{6}$/i.test(value.dominant_color_hex.trim()) ? value.dominant_color_hex.trim() : "#12312B";
  const usageContext = Array.isArray(value.usage_context)
    ? [...new Set(value.usage_context.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).map((entry) => entry.trim().toLowerCase().slice(0, 40)))].slice(0, 8)
    : [];

  return {
    category,
    subcategory: typeof value.subcategory === "string" && value.subcategory.trim() ? value.subcategory.trim().slice(0, 80) : "Tanimlanacak parca",
    colors: colors.length > 0 ? colors : ["belirsiz"],
    dominant_color_hex: dominantColor,
    season: season.length > 0 ? season : ["ilkbahar", "yaz"],
    brand: typeof value.brand === "string" && value.brand.trim() ? value.brand.trim().slice(0, 80) : null,
    fabric: typeof value.fabric === "string" && value.fabric.trim() ? value.fabric.trim().slice(0, 80) : null,
    usage_context: usageContext,
  };
}

function fallbackAnalysis(reason: string) {
  return {
    category: "ust",
    subcategory: "Tanimlanacak parca",
    colors: ["belirsiz"],
    dominant_color_hex: "#12312B",
    season: ["ilkbahar", "yaz"],
    brand: null,
    fabric: null,
    usage_context: [],
    analysis_note: reason,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function callGemini(apiKey: string, parts: unknown[], maxOutputTokens: number) {
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.1,
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

async function generateEmbedding(apiKey: string, analysis: ReturnType<typeof normalizeAnalysis>): Promise<number[] | null> {
  try {
    const text = [
      analysis.category,
      analysis.subcategory,
      ...analysis.colors,
      ...analysis.season,
      analysis.brand ?? "",
      analysis.fabric ?? "",
      ...analysis.usage_context,
    ]
      .filter(Boolean)
      .join(" ");

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: { parts: [{ text }] },
        outputDimensionality: 512,
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const values: unknown = data?.embedding?.values;
    return Array.isArray(values) ? (values as number[]) : null;
  } catch {
    return null;
  }
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
