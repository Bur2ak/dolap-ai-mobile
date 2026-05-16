import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ sent: false, error: "Method not allowed" }, 405);
  }

  try {
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = req.headers.get("Authorization");

    if (serviceRoleKey && authorization !== `Bearer ${serviceRoleKey}`) {
      return json({ sent: false, error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const pushToken = typeof body.push_token === "string" ? body.push_token : "";
    const title = normalizeText(body.title, "Shipirio", 80);
    const messageBody = normalizeText(body.body, "", 180);
    const data = sanitizeData(body.data);

    if (!isExpoPushToken(pushToken)) {
      return json({ sent: false, reason: "missing_or_invalid_push_token" });
    }

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: pushToken,
        sound: "default",
        title,
        body: messageBody,
        data,
        priority: "high",
      }),
    });

    const expoResult = await response.json().catch(() => null);

    if (!response.ok) {
      return json({ sent: false, error: "expo_push_request_failed", expo_result: expoResult }, response.status);
    }

    if (isRecord(expoResult?.data) && expoResult.data.status === "error") {
      const errDetails = expoResult.data.details;
      // DeviceNotRegistered = stale token — clean it from the profile
      if (
        isRecord(errDetails) &&
        errDetails.error === "DeviceNotRegistered" &&
        typeof body.user_id === "string"
      ) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (supabaseUrl && serviceKey) {
          await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${body.user_id}`, {
            method: "PATCH",
            headers: {
              "apikey": serviceKey,
              "Authorization": `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
              "Prefer": "return=minimal",
            },
            body: JSON.stringify({ push_token: null }),
          }).catch(() => null);
        }
      }
      return json({ sent: false, error: expoResult.data.message ?? "expo_push_error", expo_result: expoResult }, 502);
    }

    return json({ sent: true, expo_result: expoResult });
  } catch (error) {
    return json({ sent: false, error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

function isExpoPushToken(token: string) {
  return /^ExponentPushToken\[[^\]]+\]$/.test(token) || /^ExpoPushToken\[[^\]]+\]$/.test(token);
}

function normalizeText(value: unknown, fallback: string, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : fallback;
}

function sanitizeData(value: unknown) {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean" || entry === null)
      .slice(0, 20),
  );
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
