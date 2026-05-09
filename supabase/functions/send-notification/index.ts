import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = req.headers.get("Authorization");

    if (serviceRoleKey && authorization !== `Bearer ${serviceRoleKey}`) {
      return json({ sent: false, error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const pushToken = typeof body.push_token === "string" ? body.push_token : "";
    const title = typeof body.title === "string" ? body.title : "Shipirio";
    const messageBody = typeof body.body === "string" ? body.body : "";
    const data = isRecord(body.data) ? body.data : {};

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
