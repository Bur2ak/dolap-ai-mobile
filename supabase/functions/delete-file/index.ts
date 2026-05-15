import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.19";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { path } = await req.json();

    if (typeof path !== "string" || !path.trim()) {
      return json({ error: "path gerekli" }, 400);
    }

    // Sadece kendi dosyalarını silebilir
    if (!path.startsWith(`${user.id}/`)) {
      return json({ error: "Forbidden" }, 403);
    }

    const accountId = Deno.env.get("CLOUDFLARE_R2_ACCOUNT_ID")!;
    const accessKeyId = Deno.env.get("CLOUDFLARE_R2_ACCESS_KEY_ID")!;
    const secretAccessKey = Deno.env.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY")!;
    const bucketName = Deno.env.get("CLOUDFLARE_R2_BUCKET_NAME")!;

    const r2 = new AwsClient({
      accessKeyId,
      secretAccessKey,
      region: "auto",
      service: "s3",
    });

    const objectUrl = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${path}`;

    const response = await r2.fetch(objectUrl, { method: "DELETE" });

    if (!response.ok && response.status !== 404) {
      return json({ error: `R2 silme hatasi: ${response.status}` }, 500);
    }

    return json({ success: true, path });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Bilinmeyen hata" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
