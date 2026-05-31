import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const maxImageBase64Length = 12_000_000;
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const validCategories = new Set(["ust", "alt", "elbise", "etek", "dis_giyim", "ayakkabi", "canta", "aksesuar", "ic_giyim", "spor", "diger"]);
const validSeasons = new Set(["ilkbahar", "yaz", "sonbahar", "kis"]);

// Tek fotoğrafta birden fazla kıyafet tespit eder.
// Gemini bounding box döndürür: box_2d = [ymin, xmin, ymax, xmax] (0-1000 normalize).
interface DetectedGarment {
  box_2d: [number, number, number, number];
  category: string;
  subcategory: string;
  colors: string[];
  dominant_color_hex: string;
  season: string[];
  fabric: string | null;
  usage_context: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { imageBase64, mimeType } = await req.json();
    const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    const safeMime = typeof mimeType === "string" && allowedMimeTypes.has(mimeType) ? mimeType : "image/jpeg";

    if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
      return json({ error: "Geçerli görsel gerekli.", garments: [] }, 400);
    }
    if (imageBase64.length > maxImageBase64Length) {
      return json({ error: "Görsel çok büyük.", garments: [] }, 413);
    }
    if (!apiKey) {
      return json({ error: "AI servisi yapılandırılmamış.", garments: [] }, 500);
    }

    const response = await callGemini(apiKey, [
      { inline_data: { mime_type: safeMime, data: imageBase64 } },
      {
        text: `Bu fotoğrafta birden fazla kıyafet/aksesuar olabilir (yatağa veya yere serilmiş).
Her belirgin parçayı ayrı ayrı tespit et ve bounding box ver.

KURALLAR:
- Sadece net görünen, ayrı duran kıyafet/ayakkabı/çanta/aksesuarları tespit et.
- Üst üste binen veya belirsiz parçaları atla.
- En fazla 12 parça döndür.
- box_2d formatı: [ymin, xmin, ymax, xmax], her değer 0-1000 arası normalize.

SADECE şu JSON formatında dön, açıklama ekleme:
{
  "garments": [
    {
      "box_2d": [ymin, xmin, ymax, xmax],
      "category": "ust|alt|elbise|etek|dis_giyim|ayakkabi|canta|aksesuar|ic_giyim|spor|diger",
      "subcategory": "kısa açıklama",
      "colors": ["renk1"],
      "dominant_color_hex": "#RRGGBB",
      "season": ["ilkbahar|yaz|sonbahar|kis"],
      "fabric": "pamuk|keten|denim|deri|polyester|viskon|yun|triko|ipek|null",
      "usage_context": ["gunluk|is|spor|gece|dugun|tatil|ev|resmi"]
    }
  ]
}`,
      },
    ], 2048);

    if (!response.ok) {
      return json({ error: `AI geçici olarak yanıt vermedi (${response.status}).`, garments: [] }, 200);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return json({ error: "AI yanıtı beklenen formatta değildi.", garments: [] }, 200);
    }

    const parsed = JSON.parse(match[0]);
    const garments = normalizeGarments(parsed?.garments);
    return json({ garments });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Bilinmeyen hata.", garments: [] }, 200);
  }
});

function normalizeGarments(value: unknown): DetectedGarment[] {
  if (!Array.isArray(value)) return [];
  const result: DetectedGarment[] = [];

  for (const item of value.slice(0, 12)) {
    if (!isRecord(item)) continue;
    const box = item.box_2d;
    if (!Array.isArray(box) || box.length !== 4) continue;
    const [ymin, xmin, ymax, xmax] = box.map((n) => clampBox(Number(n)));
    if (ymax <= ymin || xmax <= xmin) continue;

    const category = typeof item.category === "string" && validCategories.has(item.category) ? item.category : "diger";
    const colors = Array.isArray(item.colors)
      ? item.colors.filter((c): c is string => typeof c === "string" && Boolean(c.trim())).map((c) => c.trim().toLowerCase().slice(0, 32)).slice(0, 5)
      : [];
    const season = Array.isArray(item.season)
      ? [...new Set(item.season.filter((s): s is string => typeof s === "string" && validSeasons.has(s)))].slice(0, 4)
      : [];
    const usageContext = Array.isArray(item.usage_context)
      ? [...new Set(item.usage_context.filter((u): u is string => typeof u === "string" && u.trim().length > 0).map((u) => u.trim().toLowerCase().slice(0, 40)))].slice(0, 8)
      : [];

    result.push({
      box_2d: [ymin, xmin, ymax, xmax],
      category,
      subcategory: typeof item.subcategory === "string" && item.subcategory.trim() ? item.subcategory.trim().slice(0, 80) : "Tanımlanacak parça",
      colors: colors.length > 0 ? colors : ["belirsiz"],
      dominant_color_hex: typeof item.dominant_color_hex === "string" && /^#[0-9a-f]{6}$/i.test(item.dominant_color_hex.trim()) ? item.dominant_color_hex.trim() : "#12312B",
      season: season.length > 0 ? season : ["ilkbahar", "yaz"],
      fabric: typeof item.fabric === "string" && item.fabric.trim() && item.fabric !== "null" ? item.fabric.trim().slice(0, 80) : null,
      usage_context: usageContext,
    });
  }

  return result;
}

function clampBox(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1000, Math.round(n)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function callGemini(apiKey: string, parts: unknown[], maxOutputTokens: number) {
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: { temperature: 0.1, maxOutputTokens },
  });

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body,
        signal: AbortSignal.timeout(20_000),
      });
      if (response.ok || ![408, 429].includes(response.status) && response.status < 500 || attempt === 3) {
        return response;
      }
    } catch (error) {
      if (attempt === 3) throw error;
    }
    await new Promise((r) => setTimeout(r, 700 * 2 ** (attempt - 1)));
  }
  throw new Error("Gemini request failed");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
