import type { WardrobeItem } from "@/types";

export interface SimilarWardrobeMatch {
  item: WardrobeItem;
  score: number;
  reasons: string[];
}

export interface SimilarWardrobeSummary {
  title: string;
  body: string;
  matches: SimilarWardrobeMatch[];
}

export function buildSimilarWardrobeSummary(itemIds: string[], wardrobe: WardrobeItem[]): SimilarWardrobeSummary {
  const explicitMatches = itemIds
    .map((itemId) => wardrobe.find((item) => item.id === itemId))
    .filter((item): item is WardrobeItem => Boolean(item))
    .map((item) => ({
      item,
      reasons: ["AI benzer parca olarak isaretledi."],
      score: 100,
    }));

  const inferredMatches = inferMatches(explicitMatches.map((match) => match.item), wardrobe);
  const matches = mergeMatches([...explicitMatches, ...inferredMatches]).slice(0, 4);

  if (matches.length >= 2) {
    return {
      body: "Dolabinda bu alisverise yakin parcalar var. Yeni almadan once bunlarla kombin denemek mantikli olabilir.",
      matches,
      title: "Dolabinda benzerler var",
    };
  }

  if (matches.length === 1) {
    return {
      body: "Dolabinda bir yakin parca gorunuyor. Yeni urun onu tekrarliyorsa beklemek daha iyi olabilir.",
      matches,
      title: "Bir benzer parca bulundu",
    };
  }

  return {
    body: "Dolabinda net benzer parca bulunamadi. Karar verirken kombin potansiyeli ve fiyat bilgisini one al.",
    matches,
    title: "Net benzer bulunamadi",
  };
}

function inferMatches(explicitItems: WardrobeItem[], wardrobe: WardrobeItem[]): SimilarWardrobeMatch[] {
  if (explicitItems.length === 0) {
    return [];
  }

  return wardrobe
    .filter((item) => !explicitItems.some((explicit) => explicit.id === item.id))
    .map((item) => scoreAgainstReferences(item, explicitItems))
    .filter((match) => match.score >= 35)
    .sort((a, b) => b.score - a.score);
}

function scoreAgainstReferences(item: WardrobeItem, references: WardrobeItem[]): SimilarWardrobeMatch {
  const best = references
    .map((reference) => {
      const reasons: string[] = [];
      let score = 0;

      if (item.category === reference.category) {
        score += 35;
        reasons.push("Ayni kategori");
      }

      const sharedColors = item.colors.filter((color) => reference.colors.some((referenceColor) => normalize(referenceColor) === normalize(color)));
      if (sharedColors.length > 0) {
        score += Math.min(sharedColors.length * 20, 35);
        reasons.push(`Benzer renk: ${sharedColors.slice(0, 2).join(", ")}`);
      }

      const sharedSeasons = item.season.filter((season) => reference.season.includes(season));
      if (sharedSeasons.length > 0) {
        score += Math.min(sharedSeasons.length * 8, 18);
        reasons.push(`Ortak sezon: ${sharedSeasons.slice(0, 2).join(", ")}`);
      }

      if (item.brand && reference.brand && normalize(item.brand) === normalize(reference.brand)) {
        score += 12;
        reasons.push("Ayni marka");
      }

      return { item, reasons, score };
    })
    .sort((a, b) => b.score - a.score)[0];

  return best ?? { item, reasons: [], score: 0 };
}

function mergeMatches(matches: SimilarWardrobeMatch[]) {
  const byId = new Map<string, SimilarWardrobeMatch>();

  for (const match of matches) {
    const current = byId.get(match.item.id);
    if (!current || match.score > current.score) {
      byId.set(match.item.id, match);
    }
  }

  return [...byId.values()].sort((a, b) => b.score - a.score);
}

function normalize(value: string) {
  return value.toLocaleLowerCase("tr-TR");
}
