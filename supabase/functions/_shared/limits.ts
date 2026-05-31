import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface LimitResult {
  allowed: boolean;
  count: number;
  error: Response | null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Günlük AI kullanım limiti (server-side, bypass edilemez).
 * Free kullanıcılar için sıkı, premium için yüksek limit.
 * Limit aşılırsa 429 Response döner.
 */
export async function enforceDailyLimit(
  userId: string,
  metric: "daily_ai_vision" | "daily_bg_removal",
  limit: number,
): Promise<LimitResult> {
  try {
    const periodKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
    const admin = adminClient();
    const { data, error } = await admin.rpc("check_and_increment_usage", {
      input_user_id: userId,
      input_metric: metric,
      input_period_key: periodKey,
      input_limit: limit,
    });

    if (error) {
      // Limit kontrolü patlarsa isteği geçir (fail-open) ama logla — kullanıcıyı engelleme
      console.error("limit check failed", error.message);
      return { allowed: true, count: 0, error: null };
    }

    const row = Array.isArray(data) ? data[0] : data;
    const allowed = row?.allowed ?? true;
    const count = row?.current_count ?? 0;

    if (!allowed) {
      return {
        allowed: false,
        count,
        error: json({ error: "Günlük AI kullanım limitine ulaştın. Premium ile sınırsız kullan.", limit_reached: true }, 429),
      };
    }

    return { allowed: true, count, error: null };
  } catch (e) {
    console.error("limit error", e);
    return { allowed: true, count: 0, error: null }; // fail-open
  }
}

/**
 * Kısa pencere rate limit (dakikalık) — DoS / abuse koruması.
 * Aynı kullanıcı 1 dakikada maxPerMinute'tan fazla çağıramaz.
 */
export async function enforceRateLimit(userId: string, maxPerMinute: number): Promise<LimitResult> {
  try {
    const now = new Date();
    const periodKey = `${now.toISOString().slice(0, 16)}`; // YYYY-MM-DDTHH:MM (dakika penceresi)
    const admin = adminClient();
    const { data, error } = await admin.rpc("check_and_increment_usage", {
      input_user_id: userId,
      input_metric: "minute_rate",
      input_period_key: periodKey,
      input_limit: maxPerMinute,
    });

    if (error) return { allowed: true, count: 0, error: null };

    const row = Array.isArray(data) ? data[0] : data;
    if (!(row?.allowed ?? true)) {
      return {
        allowed: false,
        count: row?.current_count ?? 0,
        error: json({ error: "Çok fazla istek. Lütfen biraz bekle." }, 429),
      };
    }
    return { allowed: true, count: row?.current_count ?? 0, error: null };
  } catch {
    return { allowed: true, count: 0, error: null };
  }
}
