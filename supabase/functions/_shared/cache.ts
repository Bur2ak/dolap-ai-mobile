import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

const TTL_MS = 6 * 60 * 60 * 1000; // 6 saat

/** Basit deterministik hash (cache key üretimi için) */
export async function hashKey(parts: (string | number | null | undefined)[]): Promise<string> {
  const raw = parts.map((p) => String(p ?? "")).join("|");
  const data = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 48);
}

/** Cache'ten oku — taze (TTL içinde) ise döndür, yoksa null */
export async function getCached<T>(cacheKey: string): Promise<T | null> {
  try {
    const admin = adminClient();
    const { data, error } = await admin
      .from("ai_response_cache")
      .select("response, created_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (error || !data) return null;
    const age = Date.now() - new Date(data.created_at).getTime();
    if (age > TTL_MS) return null; // bayat
    return data.response as T;
  } catch {
    return null;
  }
}

/** Cache'e yaz (fire-and-forget — hata olsa da isteği bloklamaz) */
export async function setCached(cacheKey: string, userId: string, kind: string, response: unknown): Promise<void> {
  try {
    const admin = adminClient();
    await admin.from("ai_response_cache").upsert({
      cache_key: cacheKey,
      user_id: userId,
      kind,
      response,
      created_at: new Date().toISOString(),
    });
  } catch {
    // sessizce geç
  }
}
