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
    const apiKey = Deno.env.get("REMOVE_BG_API_KEY");
    if (!apiKey) {
      return json({ imageBase64: null, mimeType: null, skipped: true, reason: "REMOVE_BG_API_KEY is missing" });
    }

    const { imageBase64 } = await req.json();
    if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
      return json({ error: "imageBase64 is required" }, 400);
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
