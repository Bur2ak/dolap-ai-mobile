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
