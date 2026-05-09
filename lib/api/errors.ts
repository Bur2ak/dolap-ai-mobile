export function throwApiError(error: unknown, fallbackMessage = "Islem tamamlanamadi. Tekrar dene."): never {
  throw new Error(getApiErrorMessage(error, fallbackMessage));
}

export function getApiErrorMessage(error: unknown, fallbackMessage = "Islem tamamlanamadi. Tekrar dene.") {
  const code = getErrorString(error, "code");
  const status = getErrorNumber(error, "status");
  const message = getErrorString(error, "message");

  if (code === "23505") {
    return "Bu kayit zaten mevcut.";
  }

  if (code === "42501" || status === 401 || status === 403) {
    return "Bu islem icin yetkin yok. Giris durumunu ve gizlilik ayarlarini kontrol et.";
  }

  if (code === "PGRST116") {
    return "Kayit bulunamadi veya erisim iznin yok.";
  }

  if (message?.toLowerCase().includes("network request failed") || message?.toLowerCase().includes("failed to fetch")) {
    return "Ag baglantisi kurulamadi. Internetini kontrol edip tekrar dene.";
  }

  if (message?.toLowerCase().includes("invalid login credentials")) {
    return "E-posta veya sifre hatali.";
  }

  if (message?.toLowerCase().includes("email not confirmed")) {
    return "E-posta adresini dogrulaman gerekiyor.";
  }

  if (message?.toLowerCase().includes("user already registered") || message?.toLowerCase().includes("already registered")) {
    return "Bu e-posta ile zaten bir hesap var.";
  }

  if (message?.toLowerCase().includes("password")) {
    return "Sifre yeterince guclu degil veya kabul edilmedi.";
  }

  if (message?.toLowerCase().includes("jwt")) {
    return "Oturum dogrulanamadi. Cikis yapip tekrar giris yapmayi dene.";
  }

  return message || fallbackMessage;
}

function getErrorString(error: unknown, key: string) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function getErrorNumber(error: unknown, key: string) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const value = (error as Record<string, unknown>)[key];
  return typeof value === "number" ? value : null;
}
