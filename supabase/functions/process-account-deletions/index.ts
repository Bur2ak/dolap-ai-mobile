import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const wardrobeImagesBucket = "wardrobe-images";

interface ProfileDeletionRow {
  id: string;
  deletion_requested_at: string | null;
  deletion_scheduled_for: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const cronSecret = Deno.env.get("ACCOUNT_DELETION_CRON_SECRET");
    const authorization = req.headers.get("authorization") ?? "";

    if (!cronSecret) {
      return json({ error: "ACCOUNT_DELETION_CRON_SECRET is missing" }, 500);
    }

    if (authorization !== `Bearer ${cronSecret}`) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Supabase service env values are missing" }, 500);
    }

    const body = await readJson(req);
    const dryRun = body.dryRun !== false;
    const today = new Date().toISOString().slice(0, 10);
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
      },
    });
    const { data, error } = await supabase
      .from("profiles")
      .select("id, deletion_requested_at, deletion_scheduled_for")
      .not("deletion_requested_at", "is", null)
      .lte("deletion_scheduled_for", today)
      .order("deletion_scheduled_for", { ascending: true })
      .limit(50);

    if (error) {
      throw error;
    }

    const profiles = (data ?? []) as ProfileDeletionRow[];
    const results = [];

    for (const profile of profiles) {
      const storagePaths = await listUserStoragePaths(supabase, profile.id);

      if (dryRun) {
        results.push({ id: profile.id, deleted: false, dry_run: true, storage_files: storagePaths.length });
        continue;
      }

      const storageDeleted = await deleteUserStoragePaths(supabase, storagePaths);
      const { error: deleteError } = await supabase.auth.admin.deleteUser(profile.id);
      if (deleteError) {
        results.push({ id: profile.id, deleted: false, storage_deleted: storageDeleted, error: deleteError.message });
        continue;
      }

      results.push({ id: profile.id, deleted: true, storage_deleted: storageDeleted });
    }

    return json({
      dry_run: dryRun,
      due_count: profiles.length,
      deleted_count: results.filter((result) => result.deleted).length,
      storage_deleted_count: results.reduce((sum, result) => sum + (typeof result.storage_deleted === "number" ? result.storage_deleted : 0), 0),
      results,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

async function listUserStoragePaths(supabase: ReturnType<typeof createClient>, userId: string) {
  return listStoragePathsRecursive(supabase, userId);
}

async function listStoragePathsRecursive(supabase: ReturnType<typeof createClient>, directory: string): Promise<string[]> {
  const paths = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data, error } = await supabase.storage.from(wardrobeImagesBucket).list(directory, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      throw error;
    }

    const items = (data ?? []).filter((item) => item.name);
    const files = items.filter((item) => item.id);
    const folders = items.filter((item) => !item.id);

    paths.push(...files.map((item) => `${directory}/${item.name}`));

    for (const folder of folders) {
      paths.push(...(await listStoragePathsRecursive(supabase, `${directory}/${folder.name}`)));
    }

    if (items.length < limit) {
      break;
    }

    offset += limit;
  }

  return paths;
}

async function deleteUserStoragePaths(supabase: ReturnType<typeof createClient>, paths: string[]) {
  if (paths.length === 0) {
    return 0;
  }

  let deleted = 0;
  for (let index = 0; index < paths.length; index += 100) {
    const chunk = paths.slice(index, index + 100);
    const { error } = await supabase.storage.from(wardrobeImagesBucket).remove(chunk);
    if (error) {
      throw error;
    }
    deleted += chunk.length;
  }

  return deleted;
}

async function readJson(req: Request): Promise<Record<string, unknown>> {
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
