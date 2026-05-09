import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PriceTrackingRow {
  id: string;
  user_id: string;
  product_name: string;
  product_url: string | null;
  current_price: number | null;
  target_price: number | null;
  initial_price: number | null;
  price_history: Array<{ price: number; date: string }>;
  store: string | null;
  notified_at: string | null;
  profiles?: {
    push_token: string | null;
    notification_preferences: Record<string, unknown> | null;
  } | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return json({ error: "Supabase service env values are missing" }, 500);
    }

    const body = await readJson(req);
    const trackingId = typeof body.trackingId === "string" ? body.trackingId : null;
    const manualPrices = isRecord(body.prices) ? body.prices : {};
    const authorization = req.headers.get("Authorization") ?? "";
    const isServiceInvocation = authorization === `Bearer ${serviceRoleKey}`;
    const requestingUserId = isServiceInvocation ? null : await getRequestingUserId(supabaseUrl, anonKey, authorization);

    if (!isServiceInvocation && !requestingUserId) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
      },
    });

    let query = supabase
      .from("price_tracking")
      .select("*, profiles(push_token, notification_preferences)")
      .eq("is_active", true)
      .order("last_checked", { ascending: true, nullsFirst: true })
      .limit(50);

    if (trackingId) {
      query = query.eq("id", trackingId);
    }

    if (requestingUserId) {
      query = query.eq("user_id", requestingUserId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const results = [];

    for (const tracking of (data ?? []) as PriceTrackingRow[]) {
      const checked = await checkTracking(supabase, tracking, manualPrices);
      results.push(checked);
    }

    return json({
      checked: results.length,
      updated: results.filter((result) => result.updated).length,
      notified: results.filter((result) => result.notified).length,
      results,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

async function getRequestingUserId(supabaseUrl: string, anonKey: string, authorization: string) {
  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ?? null;
}

async function checkTracking(
  supabase: ReturnType<typeof createClient>,
  tracking: PriceTrackingRow,
  manualPrices: Record<string, unknown>,
) {
  const checkedAt = new Date().toISOString();
  const manualPrice = normalizePrice(manualPrices[tracking.id] ?? manualPrices[tracking.product_name]);
  const detectedPrice = manualPrice ?? (tracking.product_url ? await fetchPrice(tracking.product_url) : null);

  if (!detectedPrice) {
    await supabase.from("price_tracking").update({ last_checked: checkedAt }).eq("id", tracking.id);
    return {
      id: tracking.id,
      product_name: tracking.product_name,
      updated: false,
      notified: false,
      reason: "price_not_detected",
    };
  }

  const previousPrice = normalizePrice(tracking.current_price);
  const targetPrice = normalizePrice(tracking.target_price);
  const changed = previousPrice === null || previousPrice !== detectedPrice;
  const history = Array.isArray(tracking.price_history) ? tracking.price_history : [];
  const nextHistory = changed ? [...history, { price: detectedPrice, date: checkedAt }] : history;
  const shouldNotify =
    targetPrice !== null &&
    detectedPrice <= targetPrice &&
    (tracking.notified_at === null || previousPrice === null || previousPrice > targetPrice);
  const notificationsEnabled = tracking.profiles?.notification_preferences?.price_drops !== false;

  const { error } = await supabase
    .from("price_tracking")
    .update({
      current_price: detectedPrice,
      initial_price: tracking.initial_price ?? detectedPrice,
      price_history: nextHistory,
      last_checked: checkedAt,
      notified_at: shouldNotify && notificationsEnabled ? checkedAt : tracking.notified_at,
    })
    .eq("id", tracking.id);

  if (error) {
    throw error;
  }

  if (shouldNotify && notificationsEnabled) {
    const { error: notificationError } = await supabase.from("notifications").insert({
      user_id: tracking.user_id,
      type: "price_drop",
      title: "Fiyat dustu",
      body: `${tracking.product_name} hedef fiyatina indi.`,
      data: {
        tracking_id: tracking.id,
        product_name: tracking.product_name,
        current_price: detectedPrice,
        target_price: targetPrice,
      },
    });

    if (notificationError) {
      throw notificationError;
    }

    await sendPriceDropPush(tracking, detectedPrice, targetPrice);
  }

  return {
    id: tracking.id,
    product_name: tracking.product_name,
    price: detectedPrice,
    updated: changed,
    notified: shouldNotify && notificationsEnabled,
  };
}

async function sendPriceDropPush(tracking: PriceTrackingRow, currentPrice: number, targetPrice: number | null) {
  const preferences = tracking.profiles?.notification_preferences;
  const pushEnabled = preferences?.price_drops !== false;
  const pushToken = tracking.profiles?.push_token;
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!pushEnabled || !pushToken || !supabaseUrl || !serviceRoleKey) {
    return;
  }

  try {
    await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: tracking.user_id,
        push_token: pushToken,
        title: "Fiyat dustu",
        body: `${tracking.product_name} ${formatPrice(currentPrice)} seviyesine indi.`,
        data: {
          type: "price_drop",
          tracking_id: tracking.id,
          product_name: tracking.product_name,
          current_price: currentPrice,
          target_price: targetPrice,
        },
      }),
    });
  } catch (_error) {
    // Inbox notification is already stored; push delivery can fail independently.
  }
}

function formatPrice(price: number) {
  return `${price.toFixed(2)} TL`;
}

async function fetchPrice(url: string) {
  try {
    const safeUrl = normalizeHttpUrl(url);
    if (!safeUrl) {
      return null;
    }

    const response = await fetch(safeUrl, {
      headers: {
        "User-Agent": "ShipirioPriceBot/1.0",
      },
    });

    if (!response.ok) {
      return null;
    }

    return extractPrice(await response.text());
  } catch (_error) {
    return null;
  }
}

function normalizeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.toString();
  } catch (_error) {
    return null;
  }
}

function extractPrice(html: string) {
  const jsonLdMatch = html.match(/"price"\s*:\s*"?([0-9]+(?:[.,][0-9]{1,2})?)"?/i);
  if (jsonLdMatch?.[1]) {
    return normalizePrice(jsonLdMatch[1]);
  }

  const tlMatch = html.match(/([0-9]{1,3}(?:[.\s][0-9]{3})*(?:,[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*(?:TL|TRY)/i);
  if (tlMatch?.[1]) {
    return normalizePrice(tlMatch[1]);
  }

  return null;
}

function normalizePrice(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number(value.toFixed(2));
  }

  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value
    .replace(/\s/g, "")
    .replace(/[^\d.,]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(cleaned);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Number(parsed.toFixed(2));
}

async function readJson(req: Request): Promise<Record<string, unknown>> {
  if (req.method !== "POST") {
    return {};
  }

  try {
    const body = await req.json();
    return isRecord(body) ? body : {};
  } catch (_error) {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
