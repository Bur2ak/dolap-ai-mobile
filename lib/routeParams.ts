export function getStringParam(value: string | string[] | undefined): string | undefined {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const trimmed = rawValue?.trim();

  return trimmed || undefined;
}

export function getUuidParam(value: string | string[] | undefined): string | undefined {
  const param = getStringParam(value);
  if (!param || !isUuid(param)) {
    return undefined;
  }

  return param;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function getSafeInternalReturnTo(value: string | string[] | undefined, fallback = "/(tabs)") {
  const returnTo = getStringParam(value);

  if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//") || returnTo.startsWith("/(auth)")) {
    return fallback;
  }

  return returnTo;
}
