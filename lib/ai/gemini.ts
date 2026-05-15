const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_FLASH = "gemini-2.0-flash";
const GEMINI_EMBEDDING = "text-embedding-004";

const maxAttempts = 3;
const baseDelayMs = 700;

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

async function callGeminiWithRetry(
  apiKey: string,
  parts: GeminiPart[],
  options: { temperature?: number; maxOutputTokens?: number } = {},
): Promise<string> {
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      maxOutputTokens: options.maxOutputTokens ?? 1200,
    },
  });

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(`${GEMINI_BASE}/models/${GEMINI_FLASH}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body,
      signal: AbortSignal.timeout(20_000),
    });

    if (response.ok) {
      const data = await response.json();
      const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      return text;
    }

    const isRetryable = response.status === 429 || response.status >= 500;
    if (!isRetryable || attempt === maxAttempts) {
      throw new Error(`Gemini ${response.status}`);
    }

    await delay(baseDelayMs * 2 ** (attempt - 1));
  }

  throw new Error("Gemini exhausted retries");
}

export async function geminiGenerateJSON<T>(
  apiKey: string,
  parts: GeminiPart[],
  options?: { temperature?: number; maxOutputTokens?: number },
): Promise<T> {
  const text = await callGeminiWithRetry(apiKey, parts, options);
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Gemini JSON parse failed");
  return JSON.parse(match[0]) as T;
}

export async function geminiGenerateJSONArray<T>(
  apiKey: string,
  parts: GeminiPart[],
  options?: { temperature?: number; maxOutputTokens?: number },
): Promise<T[]> {
  const text = await callGeminiWithRetry(apiKey, parts, options);
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("Gemini JSON array parse failed");
  return JSON.parse(match[0]) as T[];
}

export async function geminiEmbedText(
  apiKey: string,
  text: string,
  outputDimensionality = 512,
): Promise<number[] | null> {
  try {
    const response = await fetch(`${GEMINI_BASE}/models/${GEMINI_EMBEDDING}:embedContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        model: `models/${GEMINI_EMBEDDING}`,
        content: { parts: [{ text }] },
        outputDimensionality,
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

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
