import type { SustainabilityInsight, WardrobeItem } from "@/types";
import { formatCurrency } from "@/utils/formatters";

const DAY_MS = 86_400_000;

export function getSustainabilityInsight(item: WardrobeItem, now = new Date()): SustainabilityInsight {
  const createdDays = getDaysSince(item.created_at, now);
  const lastWornDays = item.last_worn ? getDaysSince(item.last_worn, now) : null;
  const costPerWear = item.purchase_price && item.wear_count > 0 ? item.purchase_price / item.wear_count : null;
  const signals = buildSignals(item, createdDays, lastWornDays, costPerWear);
  const score = calculateScore(item, createdDays, lastWornDays, costPerWear);
  const status = getStatus(score);

  return {
    body: getBody(status, item),
    score,
    signals,
    status,
    title: getTitle(status),
  };
}

function calculateScore(item: WardrobeItem, createdDays: number, lastWornDays: number | null, costPerWear: number | null) {
  let score = 40;

  score += Math.min(item.wear_count * 8, 35);

  if (costPerWear !== null) {
    if (costPerWear <= 75) {
      score += 15;
    } else if (costPerWear <= 150) {
      score += 8;
    } else if (costPerWear >= 350) {
      score -= 10;
    }
  }

  if (item.wear_count === 0 && createdDays >= 30) {
    score -= 18;
  }

  if (lastWornDays !== null && lastWornDays >= 120) {
    score -= 15;
  }

  if (lastWornDays !== null && lastWornDays <= 21) {
    score += 8;
  }

  if (item.category === "aksesuar" || item.category === "canta" || item.category === "ayakkabi") {
    score += 4;
  }

  return clamp(Math.round(score), 0, 100);
}

function buildSignals(item: WardrobeItem, createdDays: number, lastWornDays: number | null, costPerWear: number | null) {
  const signals = [`${item.wear_count} giyim`, `${createdDays} gundur dolapta`];

  if (lastWornDays === null) {
    signals.push("Henuz giyilmedi");
  } else if (lastWornDays === 0) {
    signals.push("Bugun giyildi");
  } else {
    signals.push(`${lastWornDays} gun once giyildi`);
  }

  if (costPerWear !== null) {
    signals.push(`${formatCurrency(costPerWear)} / giyim`);
  } else if (item.purchase_price) {
    signals.push("Maliyet icin ilk giyim bekleniyor");
  }

  return signals.slice(0, 4);
}

function getStatus(score: number): SustainabilityInsight["status"] {
  if (score >= 75) {
    return "excellent";
  }

  if (score >= 55) {
    return "good";
  }

  if (score >= 35) {
    return "needs_use";
  }

  return "at_risk";
}

function getTitle(status: SustainabilityInsight["status"]) {
  switch (status) {
    case "excellent":
      return "Uzun omurlu kullanim";
    case "good":
      return "Iyi gidiyor";
    case "needs_use":
      return "Daha cok kullan";
    case "at_risk":
      return "Dolapta atil kalabilir";
  }
}

function getBody(status: SustainabilityInsight["status"], item: WardrobeItem) {
  if (status === "excellent") {
    return "Bu parca dolabinda guclu bir yatirim gibi calisiyor; kullanim basi etkisi dusuyor.";
  }

  if (status === "good") {
    return "Kullanim dengesi iyi. Benzer kombinlerde tekrar kullanarak omrunu daha verimli hale getirebilirsin.";
  }

  if (status === "needs_use") {
    return item.wear_count === 0
      ? "Bu parca henuz dolaba geri donus saglamadi. Bir sonraki kombin onerisine eklemeyi deneyebilirsin."
      : "Bu parcayi daha sik rotasyona sokarsan maliyet ve surdurulebilirlik skoru iyilesir.";
  }

  return "Uzun suredir kullanilmiyorsa satma, bagislama veya arkadas dolabinda paylasma iyi bir sonraki adim olabilir.";
}

function getDaysSince(value: string, now: Date) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY_MS));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
