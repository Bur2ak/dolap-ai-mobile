import { supabase } from "@/lib/supabase";

export type SupabaseAuthLinkType = "recovery" | "signup" | "magiclink" | "invite" | null;

export async function syncSupabaseSessionFromUrl(url: string): Promise<SupabaseAuthLinkType> {
  const params = getUrlParams(url);
  const code = params.get("code");
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      throw error;
    }
  } else if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      throw error;
    }
  }

  const type = params.get("type");
  if (type === "recovery" || type === "signup" || type === "magiclink" || type === "invite") {
    return type;
  }

  return null;
}

function getUrlParams(url: string) {
  const params = new URLSearchParams();
  try {
    const parsed = new URL(url);
    appendParams(params, parsed.search.replace(/^\?/, ""));
    appendParams(params, parsed.hash.replace(/^#/, ""));
  } catch {
    const [, query = ""] = url.split("?");
    const [queryString = "", hashString = ""] = query.split("#");
    const [, hashOnly = ""] = url.split("#");

    appendParams(params, queryString);
    appendParams(params, hashString || hashOnly);
  }

  return params;
}

function appendParams(target: URLSearchParams, source: string) {
  if (!source) {
    return;
  }

  const sourceParams = new URLSearchParams(source);
  sourceParams.forEach((value, key) => {
    target.set(key, value);
  });
}
