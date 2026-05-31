import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Hafif health-check + keep-alive endpoint.
// UptimeRobot bu URL'i her 5 dakikada bir pingler → Supabase free tier uyumaz (Pro'ya gerek kalmaz).
// Auth gerektirmez, Gemini çağırmaz, sadece DB'ye 1 hafif sorgu atar.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();
  let dbOk = false;

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (url && key) {
      const admin = createClient(url, key, { auth: { persistSession: false } });
      // En hafif sorgu — sadece bağlantıyı canlı tutar
      const { error } = await admin.from("profiles").select("id", { count: "exact", head: true }).limit(1);
      dbOk = !error;
    }
  } catch {
    dbOk = false;
  }

  return new Response(
    JSON.stringify({
      status: "ok",
      db: dbOk ? "up" : "down",
      latency_ms: Date.now() - startedAt,
      ts: new Date().toISOString(),
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
