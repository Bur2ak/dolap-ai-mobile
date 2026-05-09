export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string): boolean {
  const normalized = normalizeUsername(value);
  return normalized.length >= 3 && normalized.length <= 24 && /^[a-z0-9_]+$/.test(normalized);
}

export function normalizeOptionalHttpUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Urun linki http veya https ile baslamali.");
    }

    if (!url.hostname.includes(".")) {
      throw new Error("Gecerli bir urun linki gir.");
    }

    return url.toString();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Gecerli bir urun linki gir.");
  }
}

export function getOptionalHttpUrlError(value: string): string | undefined {
  try {
    normalizeOptionalHttpUrl(value);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : "Gecerli bir urun linki gir.";
  }
}
