import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthResult {
  userId: string;
  error: null;
}
export interface AuthError {
  userId: null;
  error: Response;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export async function requireAuth(req: Request): Promise<AuthResult | AuthError> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { userId: null, error: json({ error: "Unauthorized" }, 401) };
  }

  const jwt = authHeader.slice(7);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    return { userId: null, error: json({ error: "Server misconfigured" }, 500) };
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user?.id) {
    return { userId: null, error: json({ error: "Unauthorized" }, 401) };
  }

  return { userId: data.user.id, error: null };
}

export async function fetchUserWardrobe(userId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await admin
    .from("wardrobe_items")
    .select("id, category, subcategory, colors, dominant_color_hex, season, brand, fabric, usage_context, wear_count, last_worn, is_lendable, is_shareable, purchase_price")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(120);

  if (error) throw new Error(`Wardrobe fetch failed: ${error.message}`);
  return data ?? [];
}

export async function fetchFriendShareableWardrobe(ownerId: string, requesterId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Verify friendship
  const { data: friendship } = await admin
    .from("friendships")
    .select("id")
    .or(
      `and(requester_id.eq.${requesterId},addressee_id.eq.${ownerId}),and(requester_id.eq.${ownerId},addressee_id.eq.${requesterId})`,
    )
    .eq("status", "accepted")
    .maybeSingle();

  if (!friendship) return null; // not friends

  const { data, error } = await admin
    .from("wardrobe_items")
    .select("id, category, subcategory, colors, dominant_color_hex, season, brand, fabric, usage_context, wear_count")
    .eq("user_id", ownerId)
    .eq("is_active", true)
    .eq("is_shareable", true)
    .limit(80);

  if (error) throw new Error(`Friend wardrobe fetch failed: ${error.message}`);
  return data ?? [];
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
