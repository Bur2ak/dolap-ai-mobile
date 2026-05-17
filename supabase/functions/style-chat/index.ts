import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { fetchUserWardrobe, json, requireAuth } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_FLASH = "gemini-2.0-flash";
const MAX_HISTORY = 10;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const auth = await requireAuth(req);
    if (auth.error) return auth.error;

    const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!apiKey) return json({ error: "GOOGLE_GEMINI_API_KEY not configured" }, 500);

    const { message, history = [] } = await req.json();
    if (!message?.trim()) return json({ error: "Mesaj boş olamaz" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Fetch wardrobe server-side
    const wardrobe = await fetchUserWardrobe(auth.userId);
    const wardrobeContext = JSON.stringify(
      wardrobe.slice(0, 80).map((item) => ({
        id: item.id,
        category: item.category,
        subcategory: item.subcategory,
        colors: item.colors,
        brand: item.brand,
        season: item.season,
        usage_context: item.usage_context,
        wear_count: item.wear_count,
        last_worn: item.last_worn,
      }))
    );

    // Build conversation turns from history
    const turns = (history as Array<{ role: string; content: string }>)
      .slice(-MAX_HISTORY)
      .map((h) => ({ role: h.role === "user" ? "user" : "model", parts: [{ text: h.content }] }));

    // Add current user message
    turns.push({ role: "user", parts: [{ text: message }] });

    const systemInstruction = `Sen Shipirio'sun — kullanıcının kişisel AI stil danışmanısın. Türkçe konuş, samimi ama profesyonel ol. Kullanıcının dolabını TAM olarak biliyorsun.

Kullanıcının dolabı (${wardrobe.length} parça):
${wardrobeContext}

Kurallar:
- Sadece dolaptaki item'lardan öner (id'lerini kullan)
- Hava durumu, etkinlik ve ruh haline göre kişiselleştir
- Kısa ve aksiyon odaklı cevaplar ver
- Samimi bir arkadaş gibi konuş
- Eksik parça varsa nazikçe belirt
- Maksimum 3-4 cümle, gerekirse madde madde`;

    const body = JSON.stringify({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: turns,
      generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
    });

    const res = await fetch(`${GEMINI_BASE}/models/${GEMINI_FLASH}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Gemini error:", err);
      return json({ error: "Yanıt alınamadı, tekrar dene." }, 502);
    }

    const data = await res.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "Üzgünüm, şu an yanıt veremiyorum.";

    // Save to history
    await admin.from("style_chat_history").insert([
      { user_id: auth.userId, role: "user", content: message.trim() },
      { user_id: auth.userId, role: "assistant", content: reply },
    ]).then(({ error }) => {
      if (error) console.error("History save error:", error);
    });

    return json({ reply });
  } catch (err) {
    console.error("style-chat error:", err);
    return json({ error: "Bir hata oluştu." }, 500);
  }
});
