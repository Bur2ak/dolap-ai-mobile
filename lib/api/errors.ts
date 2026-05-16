export function throwApiError(error: unknown, fallbackMessage = "Islem tamamlanamadi. Tekrar dene."): never {
  throw new Error(getApiErrorMessage(error, fallbackMessage));
}

export function getApiErrorMessage(error: unknown, fallbackMessage = "Islem tamamlanamadi. Tekrar dene.") {
  const code = getErrorString(error, "code");
  const status = getErrorNumber(error, "status");
  const message = getErrorString(error, "message");
  const normalizedMessage = message?.toLowerCase() ?? "";

  if (code === "23505") {
    // Provide specific messages based on which unique constraint was violated
    if (normalizedMessage.includes("username")) {
      return "Bu kullanici adi baska biri tarafindan alindi. Farkli bir kullanici adi dene.";
    }
    if (normalizedMessage.includes("email")) {
      return "Bu e-posta adresiyle zaten bir hesap var.";
    }
    return "Bu kayit zaten mevcut.";
  }

  if (status === 429 || normalizedMessage.includes("too many requests") || normalizedMessage.includes("rate limit")) {
    return "Cok fazla istek gonderildi. Biraz bekleyip tekrar dene.";
  }

  if (code === "42501" || status === 401 || status === 403) {
    return "Bu islem icin yetkin yok. Giris durumunu ve gizlilik ayarlarini kontrol et.";
  }

  if (code === "PGRST116") {
    return "Kayit bulunamadi veya erisim iznin yok.";
  }

  if (
    normalizedMessage.includes("network request failed") ||
    normalizedMessage.includes("failed to fetch") ||
    normalizedMessage.includes("load failed")
  ) {
    return "Ag baglantisi kurulamadi. Internetini kontrol edip tekrar dene.";
  }

  if (normalizedMessage.includes("timeout") || normalizedMessage.includes("aborted")) {
    return "Istek zaman asimina ugradi. Birazdan tekrar dene.";
  }

  if (normalizedMessage.includes("invalid login credentials")) {
    return "E-posta veya sifre hatali.";
  }

  if (normalizedMessage.includes("email not confirmed")) {
    return "E-posta adresini dogrulaman gerekiyor.";
  }

  if (normalizedMessage.includes("user already registered") || normalizedMessage.includes("already registered")) {
    return "Bu e-posta ile zaten bir hesap var.";
  }

  if (normalizedMessage.includes("password")) {
    return "Sifre yeterince guclu degil veya kabul edilmedi.";
  }

  if (normalizedMessage.includes("jwt")) {
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
