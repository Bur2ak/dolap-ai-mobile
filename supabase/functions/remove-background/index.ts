import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";
import { enforceDailyLimit, enforceRateLimit } from "../_shared/limits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAILY_BG_LIMIT = 60;
const RATE_PER_MINUTE = 20;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ imageBase64: null, mimeType: null, skipped: true, error: "Method not allowed" }, 405);
  }

  try {
    const auth = await requireAuth(req);
    if (auth.error) return auth.error;

    const rate = await enforceRateLimit(auth.userId, RATE_PER_MINUTE);
    if (rate.error) return rate.error;

    const limit = await enforceDailyLimit(auth.userId, "daily_bg_removal", DAILY_BG_LIMIT);
    if (limit.error) return limit.error;

    const apiKey = Deno.env.get("REMOVE_BG_API_KEY");
    if (!apiKey) {
      return json({ imageBase64: null, mimeType: null, skipped: true, reason: "REMOVE_BG_API_KEY is missing" });
    }

    const { imageBase64 } = await req.json();
    if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
      return json({ error: "imageBase64 is required" }, 400);
    }

    if (imageBase64.length > 12_000_000) {
      return json({ error: "imageBase64 is too large" }, 413);
    }

    const formData = new FormData();
    formData.append("image_file_b64", imageBase64);
    formData.append("size", "auto");
    formData.append("format", "png");

    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      return json({ imageBase64: null, mimeType: null, skipped: true, status: response.status });
    }

    const output = await response.arrayBuffer();
    return json({
      imageBase64: arrayBufferToBase64(output),
      mimeType: "image/png",
      skipped: false,
    });
  } catch (error) {
    return json({ imageBase64: null, mimeType: null, skipped: true, error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
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
