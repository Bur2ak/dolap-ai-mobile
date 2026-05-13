import type { ClothingCategory, DistributionPoint, MissingWardrobePiece, StyleProfile, WardrobeAnalytics, WardrobeGoal, WardrobeItem } from "@/types";
import { getSustainabilityInsight } from "@/utils/sustainability";

const validCategories = new Set<ClothingCategory>(["ust", "alt", "elbise", "etek", "dis_giyim", "ayakkabi", "canta", "aksesuar", "ic_giyim", "spor", "diger"]);
const validSeasons = new Set(["ilkbahar", "yaz", "sonbahar", "kis"]);

export function calculateWardrobeAnalytics(items: WardrobeItem[]): WardrobeAnalytics {
  const safeItems = items.map(normalizeAnalyticsItem).filter((item): item is WardrobeItem => item !== null);
  const totalValue = safeItems.reduce((sum, item) => sum + (item.purchase_price ?? 0), 0);
  const wornItems = safeItems.filter((item) => item.wear_count > 0 && item.purchase_price);
  const totalCostPerWear = wornItems.reduce((sum, item) => sum + (item.purchase_price ?? 0) / item.wear_count, 0);
  const avgCostPerWear = wornItems.length > 0 ? totalCostPerWear / wornItems.length : 0;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const inactiveSince = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const monthlySpending = safeItems
    .filter((item) => item.created_at?.slice(0, 7) === currentMonth)
    .reduce((sum, item) => sum + (item.purchase_price ?? 0), 0);

  const neverWorn = safeItems.filter((item) => item.wear_count === 0);
  const inactiveItems = safeItems.filter((item) => !item.last_worn || getSafeTimestamp(item.last_worn) < inactiveSince);
  const mostWorn = [...safeItems].sort((a, b) => b.wear_count - a.wear_count).slice(0, 5);
  const highValueUnused = [...neverWorn]
    .filter((item) => item.purchase_price)
    .sort((a, b) => Number(b.purchase_price ?? 0) - Number(a.purchase_price ?? 0))
    .slice(0, 5);
  const suggestionsToRemove = [...neverWorn]
    .sort((a, b) => Number(b.purchase_price ?? 0) - Number(a.purchase_price ?? 0))
    .slice(0, 5);
  const utilizationScore = safeItems.length > 0 ? Math.round((safeItems.filter((item) => item.wear_count > 0).length / safeItems.length) * 100) : 0;
  const sustainabilityInsights = safeItems.map((item) => ({ insight: getSustainabilityInsight(item), item }));
  const sustainabilityScore =
    sustainabilityInsights.length > 0
      ? Math.round(sustainabilityInsights.reduce((sum, entry) => sum + entry.insight.score, 0) / sustainabilityInsights.length)
      : 0;
  const sustainabilityFocusItems = sustainabilityInsights
    .filter((entry) => entry.insight.status === "needs_use" || entry.insight.status === "at_risk")
    .sort((a, b) => a.insight.score - b.insight.score)
    .map((entry) => entry.item)
    .slice(0, 4);

  return {
    total_items: safeItems.length,
    total_value: roundMoney(totalValue),
    avg_cost_per_wear: roundMoney(avgCostPerWear),
    monthly_spending: roundMoney(monthlySpending),
    utilization_score: utilizationScore,
    sustainability_score: sustainabilityScore,
    inactive_items_count: inactiveItems.length,
    most_worn: mostWorn,
    never_worn: neverWorn.slice(0, 5),
    category_distribution: toDistribution(safeItems.map((item) => item.category)),
    color_distribution: toColorDistribution(safeItems),
    season_distribution: toDistribution(safeItems.flatMap((item) => item.season)),
    brand_distribution: toDistribution(safeItems.map((item) => item.brand ?? "").filter(Boolean)).slice(0, 6),
    fabric_distribution: toDistribution(safeItems.map((item) => item.fabric ?? "").filter(Boolean)).slice(0, 6),
    usage_context_distribution: toDistribution(safeItems.flatMap((item) => item.usage_context)).slice(0, 8),
    style_profile: calculateStyleProfile(safeItems),
    missing_pieces: calculateMissingPieces(safeItems),
    weekly_goals: calculateWeeklyGoals(safeItems, utilizationScore, sustainabilityScore),
    sustainability_focus_items: sustainabilityFocusItems,
    high_value_unused: highValueUnused,
    suggestions_to_remove: suggestionsToRemove,
  };
}

function normalizeAnalyticsItem(item: WardrobeItem): WardrobeItem | null {
  if (!item || typeof item.id !== "string" || typeof item.user_id !== "string") {
    return null;
  }

  const purchasePrice = Number(item.purchase_price);
  const wearCount = Number(item.wear_count);
  const category = validCategories.has(item.category) ? item.category : "diger";
  const seasons = Array.isArray(item.season)
    ? item.season.filter((season, index, allSeasons) => typeof season === "string" && validSeasons.has(season) && allSeasons.indexOf(season) === index)
    : [];
  const colors = Array.isArray(item.colors)
    ? [...new Set(item.colors.filter((color) => typeof color === "string" && color.trim().length > 0).map((color) => color.trim().toLocaleLowerCase("tr-TR")))].slice(0, 8)
    : [];

  return {
    ...item,
    brand: typeof item.brand === "string" && item.brand.trim() ? item.brand.trim().slice(0, 80) : null,
    fabric: typeof item.fabric === "string" && item.fabric.trim() ? item.fabric.trim().slice(0, 80) : null,
    category,
    colors,
    created_at: normalizeDate(item.created_at),
    dominant_color_hex: typeof item.dominant_color_hex === "string" && /^#[0-9a-f]{6}$/i.test(item.dominant_color_hex.trim()) ? item.dominant_color_hex.trim() : null,
    last_worn: normalizeNullableDate(item.last_worn),
    purchase_price: Number.isFinite(purchasePrice) && purchasePrice >= 0 && purchasePrice <= 10_000_000 ? roundMoney(purchasePrice) : null,
    season: seasons as WardrobeItem["season"],
    subcategory: typeof item.subcategory === "string" && item.subcategory.trim() ? item.subcategory.trim().slice(0, 80) : null,
    updated_at: normalizeDate(item.updated_at),
    usage_context: Array.isArray(item.usage_context)
      ? [...new Set(item.usage_context.filter((entry) => typeof entry === "string" && entry.trim().length > 0).map((entry) => entry.trim().toLocaleLowerCase("tr-TR")))].slice(0, 8)
      : [],
    wear_count: Number.isFinite(wearCount) ? Math.max(0, Math.min(10_000, Math.trunc(wearCount))) : 0,
  };
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string") {
    return new Date().toISOString();
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function normalizeNullableDate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? value : null;
}

function getSafeTimestamp(value: string) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function roundMoney(value: number) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

function calculateWeeklyGoals(items: WardrobeItem[], utilizationScore: number, sustainabilityScore: number): WardrobeGoal[] {
  if (items.length === 0) {
    return [
      {
        action_label: "Ilk parcayi ekle",
        action_route: "/item/add",
        body: "Dolap analizi ve kombin onerileri icin once 3-5 temel parca ekleyelim.",
        current: 0,
        id: "add-first-items",
        priority: "high",
        target: 3,
        title: "Dolabi baslat",
      },
    ];
  }

  const goals: WardrobeGoal[] = [];
  const unwornCount = items.filter((item) => item.wear_count === 0).length;
  const pricedCount = items.filter((item) => item.purchase_price).length;
  const shareableCount = items.filter((item) => item.is_shareable).length;
  const lendableCount = items.filter((item) => item.is_lendable).length;
  const needsMetadataCount = items.filter((item) => item.colors.length === 0 || item.season.length === 0 || !item.subcategory).length;

  if (unwornCount > 0 || utilizationScore < 70) {
    goals.push({
      action_label: "Kombin oner",
      action_route: "/(tabs)/outfit",
      body: "Henuz az kullanilan parcalardan en az birini bu hafta kombine sok.",
      current: Math.max(0, Math.min(3, 3 - unwornCount)),
      id: "wear-forgotten-items",
      priority: "high",
      target: 3,
      title: "Unutulan parcayi giy",
    });
  }

  if (pricedCount < items.length) {
    goals.push({
      action_label: "Fiyat ekle",
      action_route: "/(tabs)",
      body: "Kullanim basi maliyet daha net olsun diye fiyati eksik parcalari tamamla.",
      current: pricedCount,
      id: "complete-prices",
      priority: "medium",
      target: items.length,
      title: "Maliyet verisini tamamla",
    });
  }

  if (needsMetadataCount > 0) {
    goals.push({
      action_label: "Dolabi duzenle",
      action_route: "/(tabs)",
      body: "Renk, sezon veya alt kategori eksikleri kombin kalitesini dusurebilir.",
      current: items.length - needsMetadataCount,
      id: "complete-metadata",
      priority: "medium",
      target: items.length,
      title: "Etiketleri guclendir",
    });
  }

  if (shareableCount === 0 && items.length >= 2) {
    goals.push({
      action_label: "Paylasimi ac",
      action_route: "/social/friends",
      body: "Arkadas dolabi ve kombin oylama akislari icin en az bir parcayi paylasilabilir yap.",
      current: 0,
      id: "share-first-item",
      priority: "low",
      target: 1,
      title: "Sosyal dolabi hazirla",
    });
  }

  if (lendableCount === 0 && items.length >= 4) {
    goals.push({
      action_label: "Odunc ayarla",
      action_route: "/(tabs)",
      body: "Kullanmadigin ama iyi durumdaki bir parcayi odunc verilebilir olarak isaretle.",
      current: 0,
      id: "lendable-first-item",
      priority: "low",
      target: 1,
      title: "Odunc havuzu olustur",
    });
  }

  if (sustainabilityScore < 55) {
    goals.push({
      action_label: "Analizi incele",
      action_route: "/(tabs)/analytics",
      body: "Atil parcalari sat, bagisla veya tekrar kombinle secenekleriyle azalt.",
      current: sustainabilityScore,
      id: "raise-sustainability",
      priority: "high",
      target: 75,
      title: "Surdurulebilirlik skorunu yukselt",
    });
  }

  return goals.sort((a, b) => priorityWeight(a.priority) - priorityWeight(b.priority)).slice(0, 4);
}

function toDistribution(values: string[]): DistributionPoint[] {
  const counts = values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function toColorDistribution(items: WardrobeItem[]): DistributionPoint[] {
  const counts = new Map<string, DistributionPoint>();

  for (const item of items) {
    const label = item.colors[0] ?? "belirsiz";
    const current = counts.get(label);
    counts.set(label, {
      label,
      value: (current?.value ?? 0) + 1,
      color: item.dominant_color_hex ?? current?.color,
    });
  }

  return [...counts.values()].sort((a, b) => b.value - a.value).slice(0, 8);
}

function calculateStyleProfile(items: WardrobeItem[]): StyleProfile {
  if (items.length === 0) {
    return {
      label: "Yeni dolap",
      confidence: 0,
      summary: "Stil profili icin once birkac parca eklemek gerekiyor.",
      signals: ["Dolap verisi henuz az"],
    };
  }

  const text = items.map((item) => normalize([item.category, item.subcategory, item.brand, ...item.colors].filter(Boolean).join(" ")));
  const scores = [
    scoreStyle("Minimal", text, ["siyah", "beyaz", "gri", "bej", "basic", "duz", "minimal", "keten", "nude"]),
    scoreStyle("Sportif", text, ["spor", "sneaker", "esofman", "tayt", "hoodie", "sweat", "forma", "kosu"]),
    scoreStyle("Klasik", text, ["gomlek", "blazer", "ceket", "kaban", "pantolon", "klasik", "ofis", "loafer", "deri"]),
    scoreStyle("Streetwear", text, ["oversize", "cargo", "denim", "jean", "sneaker", "hoodie", "sweat", "siyah"]),
    scoreStyle("Feminen", text, ["elbise", "etek", "topuklu", "pembe", "romantik", "saten", "canta"]),
    scoreStyle("Renkli", text, ["kirmizi", "yesil", "sari", "turuncu", "mor", "pembe", "desenli", "renkli"]),
  ].sort((a, b) => b.score - a.score);

  const best = scores[0];
  const confidence = Math.min(95, Math.round((best.score / Math.max(items.length, 1)) * 100));
  const topColors = toColorDistribution(items)
    .slice(0, 3)
    .map((point) => point.label);
  const topCategory = toDistribution(items.map((item) => item.category))[0]?.label;

  return {
    label: best.score > 0 ? best.label : "Karismis",
    confidence,
    summary: buildStyleSummary(best.label, confidence, topColors, topCategory),
    signals: [
      topCategory ? `En yogun kategori: ${formatAnalyticsCategory(topCategory)}` : "Kategori dagilimi olusuyor",
      topColors.length ? `Baskin renkler: ${topColors.join(", ")}` : "Renk verisi olusuyor",
      `${items.filter((item) => item.wear_count > 0).length}/${items.length} parca giyilmis`,
    ],
  };
}

function calculateMissingPieces(items: WardrobeItem[]): MissingWardrobePiece[] {
  if (items.length === 0) {
    return [
      {
        category: "ust",
        label: "Basic ust",
        priority: "high",
        reason: "Dolabi baslatmak icin her kombinle calisacak sade bir ust iyi temel olur.",
        suggested_colors: ["beyaz", "siyah", "gri"],
      },
      {
        category: "alt",
        label: "Notr alt parca",
        priority: "high",
        reason: "Ustlerle eslesecek pantolon veya etek dolabin omurgasini kurar.",
        suggested_colors: ["siyah", "lacivert", "bej"],
      },
    ];
  }

  const countByCategory = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1;
    return acc;
  }, {});
  const hasCategory = (category: ClothingCategory) => (countByCategory[category] ?? 0) > 0;
  const missing: MissingWardrobePiece[] = [];
  const palette = getNeutralPalette(items);

  if (!hasCategory("ust")) {
    missing.push({
      category: "ust",
      label: "Basic ust",
      priority: "high",
      reason: "Alt parcalari kombinlemek icin sade bir ust eksik gorunuyor.",
      suggested_colors: palette,
    });
  }

  if (!hasCategory("alt") && !hasCategory("elbise")) {
    missing.push({
      category: "alt",
      label: "Gunluk alt parca",
      priority: "high",
      reason: "Dolapta ustleri tasiyacak pantolon, etek veya sort gibi bir temel yok.",
      suggested_colors: palette,
    });
  }

  if (!hasCategory("ayakkabi")) {
    missing.push({
      category: "ayakkabi",
      label: "Cok yonlu ayakkabi",
      priority: "medium",
      reason: "Kombin onerilerinin tamamlanmasi icin en az bir ayakkabi eklemek faydali olur.",
      suggested_colors: ["beyaz", "siyah", "bej"],
    });
  }

  if (!hasCategory("dis_giyim") && items.some((item) => item.season.includes("kis") || item.season.includes("sonbahar"))) {
    missing.push({
      category: "dis_giyim",
      label: "Dis giyim",
      priority: "medium",
      reason: "Kis/sonbahar parcalari var ama uzerine tamamlayici mont, kaban veya ceket eksik.",
      suggested_colors: palette,
    });
  }

  if (!hasCategory("aksesuar") && items.length >= 6) {
    missing.push({
      category: "aksesuar",
      label: "Tamamlayici aksesuar",
      priority: "low",
      reason: "Dolap temeli olusmus; canta, kemer veya takiyla kombinler daha bitmis gorunebilir.",
      suggested_colors: palette,
    });
  }

  return missing.slice(0, 4);
}

function scoreStyle(label: string, itemTexts: string[], keywords: string[]) {
  const score = itemTexts.reduce((total, itemText) => total + keywords.filter((keyword) => itemText.includes(keyword)).length, 0);
  return { label, score };
}

function normalize(value: string) {
  return value.toLocaleLowerCase("tr-TR");
}

function buildStyleSummary(label: string, confidence: number, colors: string[], category?: string) {
  if (confidence === 0) {
    return "Dolap karakteri henuz net degil; daha fazla parca ekledikce profil guclenir.";
  }

  const colorText = colors.length ? `${colors.join(", ")} renkleri` : "mevcut renk paleti";
  const categoryText = category ? `${formatAnalyticsCategory(category)} kategorisi` : "dolap dengesi";

  return `${label} tarafa yakin bir stil gorunuyor. ${colorText} ve ${categoryText} bu profili destekliyor.`;
}

function getNeutralPalette(items: WardrobeItem[]) {
  const topColors = toColorDistribution(items)
    .slice(0, 2)
    .map((point) => point.label)
    .filter((label) => label !== "belirsiz");

  return [...new Set([...topColors, "siyah", "beyaz", "bej"])].slice(0, 3);
}

function formatAnalyticsCategory(value: string) {
  return value.replace("_", " ");
}

function priorityWeight(priority: WardrobeGoal["priority"]) {
  if (priority === "high") {
    return 0;
  }

  if (priority === "medium") {
    return 1;
  }

  return 2;
}
