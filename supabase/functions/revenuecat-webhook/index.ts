import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const premiumEvents = new Set(["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "NON_RENEWING_PURCHASE", "PRODUCT_CHANGE"]);
const freeEvents = new Set(["EXPIRATION", "BILLING_ISSUE", "CANCELLATION"]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const webhookSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
    const authorization = req.headers.get("authorization") ?? "";

    if (webhookSecret && authorization !== `Bearer ${webhookSecret}`) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Supabase service env values are missing" }, 500);
    }

    const payload = await req.json();
    const event = isRecord(payload.event) ? payload.event : payload;
    const appUserId = pickString(event, ["app_user_id", "appUserId", "original_app_user_id"]);

    if (!appUserId) {
      return json({ error: "app_user_id is missing" }, 400);
    }

    const eventType = pickString(event, ["type", "event_type"]) ?? "UNKNOWN";
    const productId = pickString(event, ["product_id", "productId"]) ?? "";
    const expiresAt = getExpiration(event);
    const tier = resolveTier(eventType, productId, expiresAt);
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
      },
    });
    const updates = {
      subscription_tier: tier,
      subscription_expires_at: tier === "free" ? null : expiresAt,
      revenuecat_customer_id: appUserId,
    };
    const query = supabase.from("profiles").update(updates);
    const { error } = isUuid(appUserId) ? await query.eq("id", appUserId) : await query.eq("revenuecat_customer_id", appUserId);

    if (error) {
      throw error;
    }

    return json({
      ok: true,
      app_user_id: appUserId,
      event_type: eventType,
      tier,
      subscription_expires_at: updates.subscription_expires_at,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

function resolveTier(eventType: string, productId: string, expiresAt: string | null) {
  if (freeEvents.has(eventType)) {
    return "free";
  }

  if (premiumEvents.has(eventType) || isFuture(expiresAt)) {
    return productId.toLowerCase().includes("family") ? "family" : "premium";
  }

  return "free";
}

function getExpiration(event: Record<string, unknown>) {
  const millis = pickNumber(event, ["expiration_at_ms", "expirationAtMs", "expires_at_ms"]);
  if (millis) {
    return new Date(millis).toISOString();
  }

  const seconds = pickNumber(event, ["expiration_at", "expirationAt", "expires_at"]);
  if (seconds) {
    return new Date(seconds * 1000).toISOString();
  }

  const value = pickString(event, ["expiration_at", "expirationAt", "expires_at"]);
  return value ? new Date(value).toISOString() : null;
}

function isFuture(value: string | null) {
  return value ? new Date(value).getTime() > Date.now() : false;
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return null;
}

function pickNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
