import type { CapsuleOutfitIdea, CapsuleWardrobePlan, WardrobeItem } from "@/types";

const NEUTRAL_COLORS = ["siyah", "beyaz", "gri", "bej", "lacivert", "krem", "kahverengi", "denim", "mavi"];

export function buildCapsuleWardrobePlan(items: WardrobeItem[]): CapsuleWardrobePlan {
  const activeItems = items.filter((item) => item.is_active);
  const coreItems = pickCoreItems(activeItems);
  const outfitIdeas = buildOutfitIdeas(coreItems);
  const coverageScore = calculateCoverageScore(coreItems, outfitIdeas);

  return {
    core_item_ids: coreItems.map((item) => item.id),
    coverage_score: coverageScore,
    outfit_ideas: outfitIdeas,
    summary:
      coreItems.length >= 5
        ? `${coreItems.length} parca ile ${outfitIdeas.length} farkli kombin cekirdegi hazir.`
        : "Kapsul dolap icin biraz daha ust, alt ve ayakkabi eklemek iyi olur.",
    title: coreItems.length >= 5 ? "Kapsul gardrop hazir" : "Kapsul gardrop olusuyor",
  };
}

function pickCoreItems(items: WardrobeItem[]) {
  const selected: WardrobeItem[] = [];
  const addBest = (candidates: WardrobeItem[]) => {
    const best = candidates
      .filter((item) => !selected.some((selectedItem) => selectedItem.id === item.id))
      .sort((a, b) => scoreItem(b) - scoreItem(a))[0];

    if (best) {
      selected.push(best);
    }
  };

  addBest(items.filter((item) => item.category === "ust"));
  addBest(items.filter((item) => item.category === "alt"));
  addBest(items.filter((item) => item.category === "ayakkabi"));
  addBest(items.filter((item) => item.category === "dis_giyim"));
  addBest(items.filter((item) => item.category === "elbise"));
  addBest(items.filter((item) => item.category === "aksesuar" || item.category === "canta"));

  const remaining = items
    .filter((item) => !selected.some((selectedItem) => selectedItem.id === item.id))
    .sort((a, b) => scoreItem(b) - scoreItem(a));

  return [...selected, ...remaining].slice(0, 8);
}

function buildOutfitIdeas(items: WardrobeItem[]): CapsuleOutfitIdea[] {
  const tops = byCategory(items, "ust");
  const bottoms = byCategory(items, "alt");
  const dresses = byCategory(items, "elbise");
  const shoes = byCategory(items, "ayakkabi");
  const outerwear = byCategory(items, "dis_giyim");
  const accessories = items.filter((item) => item.category === "aksesuar" || item.category === "canta");
  const ideas: CapsuleOutfitIdea[] = [];

  if (tops[0] && bottoms[0]) {
    ideas.push(makeIdea("Gunluk kapsul", "diger", [tops[0], bottoms[0], shoes[0], accessories[0]], "Temel ust-alt eslesmesi dolabin en kolay tekrar eden cekirdegi."));
  }

  if (tops[0] && bottoms[1]) {
    ideas.push(makeIdea("Is kapsulu", "is", [tops[0], bottoms[1], outerwear[0], shoes[0]], "Ayni ust parca, daha duzenli bir alt ve dis giyimle is moduna kayar."));
  }

  if (dresses[0]) {
    ideas.push(makeIdea("Tek parca kapsul", "bulusma", [dresses[0], shoes[0], accessories[0], outerwear[0]], "Elbise tek basina hizli karar verir; aksesuar ve ayakkabi tonu degistirir."));
  }

  if (tops[1] && bottoms[0]) {
    ideas.push(makeIdea("Hafta sonu kapsulu", "alisveris", [tops[1], bottoms[0], shoes[0], accessories[0]], "Ikinci ust parca ayni altla yeni bir gunluk kombin uretir."));
  }

  return ideas.filter((idea) => idea.item_ids.length >= 2).slice(0, 4);
}

function makeIdea(name: string, event: string, items: Array<WardrobeItem | undefined>, reason: string): CapsuleOutfitIdea {
  return {
    event,
    item_ids: items.filter((item): item is WardrobeItem => Boolean(item)).map((item) => item.id),
    name,
    reason,
  };
}

function byCategory(items: WardrobeItem[], category: WardrobeItem["category"]) {
  return items.filter((item) => item.category === category);
}

function scoreItem(item: WardrobeItem) {
  const neutralBonus = item.colors.some((color) => NEUTRAL_COLORS.some((neutral) => normalize(color).includes(neutral))) ? 18 : 0;
  const seasonBonus = Math.min(item.season.length * 4, 12);
  const categoryBonus = item.category === "ust" || item.category === "alt" || item.category === "ayakkabi" ? 12 : 6;
  const wearBonus = Math.min(item.wear_count * 3, 18);
  const metadataBonus = [item.subcategory, item.brand, item.dominant_color_hex].filter(Boolean).length * 2;

  return neutralBonus + seasonBonus + categoryBonus + wearBonus + metadataBonus;
}

function calculateCoverageScore(items: WardrobeItem[], ideas: CapsuleOutfitIdea[]) {
  const categories = new Set(items.map((item) => item.category));
  let score = 20;

  if (categories.has("ust")) {
    score += 15;
  }

  if (categories.has("alt") || categories.has("elbise")) {
    score += 15;
  }

  if (categories.has("ayakkabi")) {
    score += 15;
  }

  if (categories.has("dis_giyim")) {
    score += 10;
  }

  if (categories.has("aksesuar") || categories.has("canta")) {
    score += 10;
  }

  score += Math.min(ideas.length * 7, 25);

  return Math.min(score, 100);
}

function normalize(value: string) {
  return value.toLocaleLowerCase("tr-TR");
}
