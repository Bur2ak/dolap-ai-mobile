import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const activatingEvents = new Set(["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "NON_RENEWING_PURCHASE", "PRODUCT_CHANGE", "TEMPORARY_ENTITLEMENT_GRANT"]);
const expiringEvents = new Set(["EXPIRATION"]);
const nonRevokingEvents = new Set(["CANCELLATION", "BILLING_ISSUE", "SUBSCRIPTION_PAUSED"]);

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

    if (!webhookSecret) {
      return json({ error: "REVENUECAT_WEBHOOK_SECRET is missing" }, 500);
    }

    if (authorization !== `Bearer ${webhookSecret}`) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Supabase service env values are missing" }, 500);
    }

    const payload = await readJson(req);
    const event = isRecord(payload.event) ? payload.event : payload;
    const appUserId = pickString(event, ["app_user_id", "appUserId", "original_app_user_id"]);

    if (!appUserId) {
      return json({ error: "app_user_id is missing" }, 400);
    }

    const eventType = pickString(event, ["type", "event_type"]) ?? "UNKNOWN";
    const productId = pickString(event, ["product_id", "productId"]) ?? "";
    const entitlementIds = getEntitlementIds(event);
    const expiresAt = getExpiration(event);
    const tier = resolveTier(eventType, productId, entitlementIds, expiresAt);

    if (!isSubscriptionEvent(eventType, productId, entitlementIds)) {
      return json({
        ok: true,
        ignored: true,
        app_user_id: appUserId,
        event_type: eventType,
      });
    }

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
    const result = await updateProfileSubscription(supabase, appUserId, updates);

    if (!result.updated) {
      return json({ error: "Profile not found", app_user_id: appUserId, event_type: eventType }, 404);
    }

    return json({
      ok: true,
      app_user_id: appUserId,
      event_type: eventType,
      tier,
      subscription_expires_at: updates.subscription_expires_at,
      profile_id: result.profileId,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

function resolveTier(eventType: string, productId: string, entitlementIds: string[], expiresAt: string | null) {
  if (expiringEvents.has(eventType)) {
    return "free";
  }

  if (nonRevokingEvents.has(eventType)) {
    return isFuture(expiresAt) ? resolvePaidTier(productId, entitlementIds) : "free";
  }

  if (activatingEvents.has(eventType) || isFuture(expiresAt)) {
    return resolvePaidTier(productId, entitlementIds);
  }

  return "free";
}

function resolvePaidTier(productId: string, entitlementIds: string[]) {
  const normalizedProduct = productId.toLowerCase();
  const normalizedEntitlements = entitlementIds.map((entitlementId) => entitlementId.toLowerCase());
  return normalizedProduct.includes("family") || normalizedEntitlements.includes("family") ? "family" : "premium";
}

function isSubscriptionEvent(eventType: string, productId: string, entitlementIds: string[]) {
  return (
    activatingEvents.has(eventType) ||
    expiringEvents.has(eventType) ||
    nonRevokingEvents.has(eventType) ||
    productId.toLowerCase().includes("premium") ||
    productId.toLowerCase().includes("family") ||
    entitlementIds.some((entitlementId) => ["premium", "family"].includes(entitlementId.toLowerCase()))
  );
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

async function updateProfileSubscription(
  supabase: ReturnType<typeof createClient>,
  appUserId: string,
  updates: {
    subscription_tier: string;
    subscription_expires_at: string | null;
    revenuecat_customer_id: string;
  },
) {
  const candidates = isUuid(appUserId)
    ? [
        ["id", appUserId],
        ["revenuecat_customer_id", appUserId],
      ]
    : [["revenuecat_customer_id", appUserId]];

  for (const [column, value] of candidates) {
    const { data, error } = await supabase.from("profiles").update(updates).eq(column, value).select("id").maybeSingle();

    if (error) {
      throw error;
    }

    if (data?.id) {
      return { updated: true, profileId: data.id as string };
    }
  }

  return { updated: false, profileId: null };
}

async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return isRecord(body) ? body : {};
  } catch (_error) {
    return {};
  }
}

function getEntitlementIds(event: Record<string, unknown>) {
  const ids = event.entitlement_ids ?? event.entitlementIds;

  if (Array.isArray(ids)) {
    return ids.filter((id): id is string => typeof id === "string" && id.length > 0);
  }

  const singleId = pickString(event, ["entitlement_id", "entitlementId"]);
  return singleId ? [singleId] : [];
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
