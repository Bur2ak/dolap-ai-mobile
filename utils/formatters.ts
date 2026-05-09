export function formatCurrency(value: number): string {
  return `${Math.round(value).toLocaleString("tr-TR")} TL`;
}

export function parseCurrencyInput(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) {
    return null;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Fiyat yalnizca sayi olmali. Ornek: 499 veya 499,90");
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Gecerli bir fiyat gir.");
  }

  return parsed;
}

export function getCurrencyInputError(value: string): string | undefined {
  try {
    parseCurrencyInput(value);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : "Gecerli bir fiyat gir.";
  }
}

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("tr-TR");
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatDateTimeLocal(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${formatDateOnly(date)}T${hours}:${minutes}`;
}

export function formatRelativeDueDate(value: string | null): string {
  if (!value) {
    return "Iade tarihi yok";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(value);
  dueDate.setHours(0, 0, 0, 0);
  const diffDays = Math.round((dueDate.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0) {
    return `${Math.abs(diffDays)} gun gecikti`;
  }

  if (diffDays === 0) {
    return "Bugun iade";
  }

  if (diffDays === 1) {
    return "Yarin iade";
  }

  return `${diffDays} gun kaldi`;
}

export function getCostPerWearLabel(price: number | null, wearCount: number) {
  if (!price) {
    return {
      helper: "Fiyat eklenince hesaplanir.",
      value: "Yok",
    };
  }

  if (wearCount <= 0) {
    return {
      helper: "Ilk giyimde kullanim basi maliyet.",
      value: formatCurrency(price),
    };
  }

  return {
    helper: `${formatCurrency(price)} / ${wearCount} giyilme`,
    value: formatCurrency(price / wearCount),
  };
}
