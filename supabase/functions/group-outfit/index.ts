import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const geminiMaxAttempts = 3;
const geminiBaseDelayMs = 700;
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_FLASH = "gemini-2.0-flash";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const { my_wardrobe, friend_wardrobe, friend_name, event } = await req.json();
    const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");

    if (!apiKey) {
      return json({ error: "GOOGLE_GEMINI_API_KEY is not configured" }, 500);
    }

    const safeEvent = typeof event === "string" ? event.slice(0, 80) : "Günlük";
    const safeFriendName = typeof friend_name === "string" ? friend_name.slice(0, 40) : "Arkadaş";
    const myItems = Array.isArray(my_wardrobe) ? my_wardrobe.slice(0, 40) : [];
    const friendItems = Array.isArray(friend_wardrobe) ? friend_wardrobe.slice(0, 40) : [];

    const myJson = JSON.stringify(myItems.map((item: Record<string, unknown>) => ({
      id: item.id,
      owner: "ben",
      category: item.category,
      subcategory: item.subcategory,
      colors: item.colors,
      season: item.season,
      usage_context: item.usage_context,
    })));

    const friendJson = JSON.stringify(friendItems.map((item: Record<string, unknown>) => ({
      id: item.id,
      owner: safeFriendName,
      category: item.category,
      subcategory: item.subcategory,
      colors: item.colors,
      season: item.season,
      usage_context: item.usage_context,
    })));

    const systemPrompt = `Sen Shipirio'sun. Iki kisinin dolabini birlikte koordine eden Turkce konusan bir grup stilistsin.\n\nBenim dolabim:\n${myJson}\n\n${safeFriendName} dolabi:\n${friendJson}`;
    const userPrompt = `Etkinlik: ${safeEvent}\n\nIki kisinin birbirini tamamlayan, uyumlu 2 farkli grup kombin onerisi yap. Yalnizca JSON array dondur:\n[{"my_items": ["id1","id2"], "friend_items": ["id3","id4"], "name": "Kombin adi", "reason": "Neden uyumlu", "color_story": "Renk uyumu aciklamasi"}]`;

    const text = await callGeminiWithRetry(apiKey, systemPrompt, userPrompt);
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      return json({ suggestions: [] }, 200);
    }

    const suggestions = JSON.parse(match[0]);
    return json({ suggestions }, 200);
  } catch (err) {
    console.error("group-outfit error:", err);
    return json({ error: "Grup kombin olusturulamadi." }, 500);
  }
});

async function callGeminiWithRetry(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  attempt = 1,
): Promise<string> {
  const url = `${GEMINI_BASE}/models/${GEMINI_FLASH}:generateContent?key=${apiKey}`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (res.status === 429 && attempt < geminiMaxAttempts) {
    await sleep(geminiBaseDelayMs * Math.pow(2, attempt - 1));
    return callGeminiWithRetry(apiKey, systemPrompt, userPrompt, attempt + 1);
  }

  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
