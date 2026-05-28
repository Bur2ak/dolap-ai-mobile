import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageBase64Length = 12_000_000;

interface ColorDnaResult {
  undertone: "warm" | "cool" | "neutral";
  seasonal_palette: "spring" | "summer" | "autumn" | "winter";
  best_colors: string[];      // HEX renkler — ten tonuna en uygun
  avoid_colors: string[];     // HEX — kaçınılması önerilen
  description: string;        // Kısa açıklama (TR)
  confidence: number;         // 0..100
  analyzed_at: string;        // ISO timestamp
}

const SYSTEM_PROMPT = `Sen profesyonel bir kişisel imaj danışmanısın. Kullanıcının selfie fotoğrafından
ten tonu (undertone) ve mevsimsel renk paleti analizi yap.

Sadece yüzdeki cilt tonu, saç rengi ve göz rengini analiz et. Kıyafet renklerini değerlendirme.

Çıktıyı SADECE şu JSON formatında ver (başka metin ekleme):
{
  "undertone": "warm" | "cool" | "neutral",
  "seasonal_palette": "spring" | "summer" | "autumn" | "winter",
  "best_colors": ["#hex", "#hex", ...] (6-10 renk),
  "avoid_colors": ["#hex", "#hex", ...] (3-5 renk),
  "description": "Kısa açıklama 1-2 cümle Türkçe",
  "confidence": 0..100 (analiz güven skoru)
}

Renk kuralları:
- Warm undertone → bej, altın sarısı, mercan, sıcak yeşil tonları
- Cool undertone → soğuk mavi, lavanta, gümüş, soğuk pembe
- Neutral undertone → her iki tonu da destekler
- Spring: parlak ve sıcak (mercan, kavun, açık yeşil)
- Summer: yumuşak ve serin (lavanta, açık mavi, gül kurusu)
- Autumn: zengin ve sıcak (terracotta, hardal, olive)
- Winter: keskin ve serin (saf beyaz, siyah, kraliyet mavisi, fuşya)`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Yetkilendirme gerekli." }, 401);
    }

    const { imageBase64, mimeType } = await req.json();
    const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!apiKey) return json({ error: "AI servisi yapılandırılmamış." }, 500);

    const safeMime = typeof mimeType === "string" && allowedMimeTypes.has(mimeType) ? mimeType : "image/jpeg";

    if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
      return json({ error: "Geçerli fotoğraf gerekli." }, 400);
    }
    if (imageBase64.length > maxImageBase64Length) {
      return json({ error: "Fotoğraf çok büyük (max 8 MB)." }, 413);
    }

    const result = await analyzeWithGemini(imageBase64, safeMime, apiKey);
    return json(result, 200);
  } catch (err) {
    console.error("color-dna error", err);
    return json({ error: err instanceof Error ? err.message : "Analiz başarısız oldu." }, 500);
  }
});

async function analyzeWithGemini(imageBase64: string, mimeType: string, apiKey: string): Promise<ColorDnaResult> {
  const model = "gemini-2.0-flash-exp";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{
      role: "user",
      parts: [
        { text: SYSTEM_PROMPT },
        { inline_data: { mime_type: mimeType, data: imageBase64 } },
      ],
    }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
    },
  };

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini hatası (${res.status}): ${errText.slice(0, 200)}`);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (!text) throw new Error("AI çıktı boş");

      const parsed = JSON.parse(text) as Partial<ColorDnaResult>;
      return normalize(parsed);
    } catch (err) {
      lastError = err;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Renk DNA analizi başarısız.");
}

function normalize(p: Partial<ColorDnaResult>): ColorDnaResult {
  const valid = {
    undertone: (["warm", "cool", "neutral"].includes(p.undertone as string) ? p.undertone : "neutral") as ColorDnaResult["undertone"],
    seasonal_palette: (["spring", "summer", "autumn", "winter"].includes(p.seasonal_palette as string) ? p.seasonal_palette : "autumn") as ColorDnaResult["seasonal_palette"],
    best_colors: Array.isArray(p.best_colors) ? p.best_colors.filter(isHex).slice(0, 10) : [],
    avoid_colors: Array.isArray(p.avoid_colors) ? p.avoid_colors.filter(isHex).slice(0, 5) : [],
    description: typeof p.description === "string" ? p.description.slice(0, 300) : "",
    confidence: typeof p.confidence === "number" ? Math.max(0, Math.min(100, Math.round(p.confidence))) : 75,
    analyzed_at: new Date().toISOString(),
  };
  return valid;
}

function isHex(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim());
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
