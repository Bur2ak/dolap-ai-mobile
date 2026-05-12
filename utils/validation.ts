export function isValidEmail(value: string): boolean {
  const normalized = normalizeEmail(value);
  return normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export function getEmailInputError(value: string): string | undefined {
  if (!value.trim()) {
    return undefined;
  }

  return isValidEmail(normalizeEmail(value)) ? undefined : "Gecerli bir email adresi gir.";
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase().replace(/^@+/, "");
}

export function isValidUsername(value: string): boolean {
  const normalized = normalizeUsername(value);
  return normalized.length >= 3 && normalized.length <= 24 && /^[a-z0-9_]+$/.test(normalized);
}

export function getUsernameInputError(value: string): string | undefined {
  const normalized = normalizeUsername(value);
  if (!normalized) {
    return undefined;
  }

  return isValidUsername(normalized) ? undefined : "3-24 karakter; harf, rakam ve alt cizgi kullan.";
}

export function getPasswordInputError(value: string): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.length >= 8 ? undefined : "Sifre en az 8 karakter olmali.";
}

export function getConfirmPasswordInputError(password: string, confirmPassword: string): string | undefined {
  if (!confirmPassword) {
    return undefined;
  }

  return password === confirmPassword ? undefined : "Sifreler eslesmiyor.";
}

export function normalizeOptionalHttpUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > 500) {
    throw new Error("Urun linki cok uzun.");
  }

  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Urun linki http veya https ile baslamali.");
    }

    if (!url.hostname.includes(".") || url.username || url.password) {
      throw new Error("Gecerli bir urun linki gir.");
    }

    url.hash = "";
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
