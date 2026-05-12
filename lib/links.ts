import * as Linking from "expo-linking";

import { publicEnv } from "@/lib/env";

type QueryValue = string | number | boolean | null | undefined;

export function createPublicAppLink(path: string, queryParams?: Record<string, QueryValue>) {
  const siteUrl = getConfiguredSiteUrl();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const cleanQuery = normalizeQueryParams(queryParams);

  if (!siteUrl) {
    return Linking.createURL(cleanPath, cleanQuery ? { queryParams: cleanQuery } : undefined);
  }

  const url = new URL(cleanPath, `${siteUrl}/`);
  Object.entries(cleanQuery ?? {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return url.toString();
}

function getConfiguredSiteUrl() {
  return publicEnv.siteUrl;
}

function normalizeQueryParams(queryParams?: Record<string, QueryValue>) {
  if (!queryParams) {
    return null;
  }

  const entries = Object.entries(queryParams)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => [key, String(value)] as const);

  return entries.length > 0 ? Object.fromEntries(entries) : null;
}
