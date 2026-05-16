import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { fetchFriendShareableWardrobe, fetchUserWardrobe, json, requireAuth } from "../_shared/auth.ts";

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
    const auth = await requireAuth(req);
    if (auth.error) return auth.error;

    const { friend_id, event } = await req.json();
    const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");

    if (!apiKey) {
      return json({ error: "GOOGLE_GEMINI_API_KEY is not configured" }, 500);
    }

    if (typeof friend_id !== "string" || !friend_id.trim()) {
      return json({ error: "friend_id required" }, 400);
    }

    const safeEvent = typeof event === "string" ? event.slice(0, 80) : "Günlük";

    // Both wardrobes fetched server-side — friend access verified via friendship table
    const [myWardrobe, friendResult] = await Promise.all([
      fetchUserWardrobe(auth.userId),
      fetchFriendShareableWardrobe(friend_id, auth.userId),
    ]);

    if (!friendResult) {
      return json({ error: "Arkadaslık ilişkisi bulunamadı" }, 403);
    }

    if (myWardrobe.length < 2 || friendResult.length < 2) {
      return json({ suggestions: [] }, 200);
    }

    const myJson = JSON.stringify(myWardrobe.slice(0, 40).map((item) => ({
      id: item.id, owner: "ben", category: item.category,
      subcategory: item.subcategory, colors: item.colors,
      season: item.season, usage_context: item.usage_context,
    })));

    const friendJson = JSON.stringify(friendResult.slice(0, 40).map((item) => ({
      id: item.id, owner: "arkadas", category: item.category,
      subcategory: item.subcategory, colors: item.colors,
      season: item.season, usage_context: item.usage_context,
    })));

    const prompt = `Sen Shipirio'sun. Iki kisinin dolabini birlikte koordine eden Turkce konusan bir grup stilistsin.\n\nBenim dolabim:\n${myJson}\n\nArkadas dolabi:\n${friendJson}\n\nEtkinlik: ${safeEvent}\n\nIki kisinin birbirini tamamlayan 2 grup kombin onerisi yap. Yalnizca JSON:\n[{"my_items":["id1"],"friend_items":["id2"],"name":"...","reason":"...","color_story":"..."}]`;

    const text = await callGeminiWithRetry(apiKey, prompt);
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return json({ suggestions: [] }, 200);

    const suggestions = JSON.parse(match[0]);
    return json({ suggestions }, 200);
  } catch (err) {
    console.error("group-outfit error:", err);
    return json({ error: "Grup kombin olusturulamadi." }, 500);
  }
});

async function callGeminiWithRetry(apiKey: string, prompt: string, attempt = 1): Promise<string> {
  const url = `${GEMINI_BASE}/models/${GEMINI_FLASH}:generateContent`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body,
    signal: AbortSignal.timeout(15_000),
  });

  if (res.status === 429 && attempt < geminiMaxAttempts) {
    await new Promise((r) => setTimeout(r, geminiBaseDelayMs * Math.pow(2, attempt - 1)));
    return callGeminiWithRetry(apiKey, prompt, attempt + 1);
  }

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}
