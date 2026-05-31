import { applyAffiliate } from "@/lib/affiliate";
import type { MissingWardrobePiece, PriceTracking, WardrobeItem } from "@/types";

export interface PriceHistoryPoint {
  price: number;
  date: string;
}

export interface PriceInsight {
  title: string;
  body: string;
  status: "buy" | "wait" | "watch";
  lowest_price_30d: number | null;
  discount_percent_from_initial: number | null;
  price_drop_count_30d: number;
}

export interface ShoppingSearchTarget {
  label: string;
  monetization: "organic" | "affiliate_ready" | "partner_ready";
  url: string;
  note: string;
  placement_label: string;
}

export interface ShoppingPlacement {
  cta: string;
  disclosure: string;
  note: string;
  target: ShoppingSearchTarget;
}

export interface BudgetRecommendation {
  label: string;
  range: string;
  note: string;
}

export interface MissingPieceAction {
  label: string;
  note: string;
  kind: "buy" | "second_hand" | "friend" | "borrow" | "alternative";
}

export interface SecondHandListingAdvice {
  title: string;
  description: string;
  price_low: number | null;
  price_high: number | null;
  platform_notes: ShoppingSearchTarget[];
}

const marketplaceTargets = [
  {
    baseUrl: "https://www.google.com/search?tbm=shop&q=",
    label: "Google Shopping",
    monetization: "organic",
    note: "Genis fiyat karsilastirmasi",
    placement_label: "Organik",
  },
  {
    baseUrl: "https://www.trendyol.com/sr?q=",
    label: "Trendyol",
    monetization: "affiliate_ready",
    note: "Yeni urun alternatifleri",
    placement_label: "Affiliate hazir",
  },
  {
    baseUrl: "https://dolap.com/ara?q=",
    label: "Dolap",
    monetization: "partner_ready",
    note: "Ikinci el alternatif ara",
    placement_label: "Partner hazir",
  },
  {
    baseUrl: "https://www.google.com/search?q=site%3Agardrops.com+",
    label: "Gardrops",
    monetization: "partner_ready",
    note: "Ikinci el satis/listeleme aramasi",
    placement_label: "Partner hazir",
  },
  {
    baseUrl: "https://www.google.com/search?q=site%3Amodacruz.com+",
    label: "Modacruz",
    monetization: "partner_ready",
    note: "Premium ikinci el karsilastirmasi",
    placement_label: "Partner hazir",
  },
] satisfies Array<{
  baseUrl: string;
  label: string;
  monetization: ShoppingSearchTarget["monetization"];
  note: string;
  placement_label: string;
}>;

const shoppingPlacementCopy: Record<ShoppingSearchTarget["monetization"], { cta: string; disclosure: string; note: string }> = {
  affiliate_ready: {
    cta: "Yeni alternatif",
    disclosure: "Affiliate uygun",
    note: "Urun linki daha sonra affiliate parametresiyle zenginlestirilebilir.",
  },
  organic: {
    cta: "Karsilastir",
    disclosure: "Organik",
    note: "Sponsorlu degil; genis fiyat taramasi icin kullanilir.",
  },
  partner_ready: {
    cta: "Ikinci el bak",
    disclosure: "Partner uygun",
    note: "Partner entegrasyonu gelince ayni kart sponsorlu veya gelir paylasimli calisabilir.",
  },
};

const monetizedPlacementOrder: ShoppingSearchTarget["monetization"][] = [
  "affiliate_ready",
  "partner_ready",
];

const categoryBudgetRanges: Record<string, [number, number, number]> = {
  aksesuar: [350, 900, 1800],
  alt: [700, 1500, 3000],
  ayakkabi: [1200, 2600, 5000],
  canta: [700, 1800, 4500],
  dis_giyim: [1800, 4000, 8000],
  elbise: [900, 2200, 5000],
  etek: [600, 1400, 3000],
  ust: [450, 1100, 2500],
};

export function buildPriceInsight(tracking: PriceTracking, history: PriceHistoryPoint[]): PriceInsight | null {
  const currentPrice = tracking.current_price ?? history.at(-1)?.price ?? null;
  if (!currentPrice) {
    return null;
  }

  const recentHistory = getRecentHistory(history, 30);
  const comparableHistory = recentHistory.length > 0 ? recentHistory : history;
  const lowestPrice = comparableHistory.length > 0 ? Math.min(...comparableHistory.map((entry) => entry.price), currentPrice) : currentPrice;
  const initialPrice = tracking.initial_price ?? history[0]?.price ?? currentPrice;
  const discountPercent = initialPrice > currentPrice ? Math.round(((initialPrice - currentPrice) / initialPrice) * 100) : 0;
  const priceDropCount = countPriceDrops(comparableHistory);

  if (tracking.target_price && currentPrice <= tracking.target_price) {
    return {
      body:
        priceDropCount >= 2
          ? "Hedef fiyat yakalanmis ve bu urun son donemde birden fazla kez dusmus. Gercekten ihtiyacin varsa satin alma zamani."
          : "Hedef fiyat yakalanmis. Gercekten ihtiyacin varsa satin alma zamani.",
      discount_percent_from_initial: discountPercent,
      lowest_price_30d: lowestPrice,
      price_drop_count_30d: priceDropCount,
      status: "buy",
      title: "Hedef fiyat geldi",
    };
  }

  if (currentPrice <= lowestPrice && discountPercent >= 15) {
    return {
      body:
        priceDropCount >= 2
          ? "Fiyat son kayitlara gore dipte. Bu urun sik indirime giriyor; ihtiyac netse firsat, degilse hedef fiyati biraz daha asagi cekebilirsin."
          : "Fiyat son kayitlara gore dipte ve ilk fiyata gore anlamli dusmus.",
      discount_percent_from_initial: discountPercent,
      lowest_price_30d: lowestPrice,
      price_drop_count_30d: priceDropCount,
      status: "buy",
      title: "Almaya yakin",
    };
  }

  if (lowestPrice < currentPrice * 0.9) {
    return {
      body:
        priceDropCount >= 2
          ? "Bu urun daha once daha dusuk seviyeyi gormus ve tekrar eden indirim sinyali var. Acele degilse beklemek mantikli."
          : "Bu urun daha once daha dusuk seviyeyi gormus. Acele degilse indirim beklemek mantikli.",
      discount_percent_from_initial: discountPercent,
      lowest_price_30d: lowestPrice,
      price_drop_count_30d: priceDropCount,
      status: "wait",
      title: "Indirim beklenebilir",
    };
  }

  return {
    body:
      priceDropCount >= 2
        ? "Tekrar eden indirim sinyali var ama mevcut fiyat henuz yeterince iyi degil. Hedef fiyatla takipte kal."
        : "Net indirim sinyali yok. Hedef fiyat belirleyip takipte tutmak daha iyi.",
    discount_percent_from_initial: discountPercent,
    lowest_price_30d: lowestPrice,
    price_drop_count_30d: priceDropCount,
    status: "watch",
    title: "Takipte kal",
  };
}

export function buildShoppingSearchTargets(query: string): ShoppingSearchTarget[] {
  const safeQuery = query.trim();
  if (!safeQuery) {
    return [];
  }

  const encodedQuery = encodeURIComponent(safeQuery);
  return marketplaceTargets.map((target) => ({
    label: target.label,
    monetization: target.monetization,
    note: target.note,
    placement_label: target.placement_label,
    url: applyAffiliate(`${target.baseUrl}${encodedQuery}`, target.label),
  }));
}

export function buildShoppingPlacements(query: string): ShoppingPlacement[] {
  return buildShoppingSearchTargets(query)
    .filter((target) => target.monetization !== "organic")
    .sort((a, b) => monetizedPlacementOrder.indexOf(a.monetization) - monetizedPlacementOrder.indexOf(b.monetization))
    .map((target) => ({
      ...shoppingPlacementCopy[target.monetization],
      target,
    }));
}

export function buildBudgetRecommendations(piece: MissingWardrobePiece): BudgetRecommendation[] {
  const [budget, mid, premium] = categoryBudgetRanges[piece.category] ?? [500, 1500, 3500];
  const colorText = piece.suggested_colors.length > 0 ? `${piece.suggested_colors[0]} tonlarinda` : "notr renkte";

  return [
    {
      label: "Uygun",
      note: `${colorText} basic alternatif bak.`,
      range: `~${budget} TL`,
    },
    {
      label: "Orta",
      note: "Daha uzun omurlu kumas ve kolay kombinlenen kesim hedefle.",
      range: `~${mid} TL`,
    },
    {
      label: "Premium / ikinci el",
      note: "Yeni urun pahaliysa ikinci elde daha kaliteli parca ara.",
      range: `~${premium} TL`,
    },
  ];
}

export function buildMissingPieceActionPlan(piece: MissingWardrobePiece): MissingPieceAction[] {
  const colorText = piece.suggested_colors[0] ? `${piece.suggested_colors[0]} tonunda` : "uyumlu renkte";
  const urgencyNote = piece.priority === "high" ? "Bu eksik kombin kapsamini belirgin etkiliyor." : "Acele etmeden en mantikli yolu sec.";

  return [
    {
      kind: "buy",
      label: "Satin al",
      note: `${colorText} yeni alternatifleri butceye gore karsilastir. ${urgencyNote}`,
    },
    {
      kind: "second_hand",
      label: "Ikinci elden bak",
      note: "Dolap, Gardrops veya Modacruz tarafinda daha kaliteli parcayi daha dusuk fiyata yakalayabilirsin.",
    },
    {
      kind: "friend",
      label: "Arkadas dolabina bak",
      note: "Paylasima acik arkadas dolaplarinda benzer kategori, renk veya kumas arayabilirsin.",
    },
    {
      kind: "borrow",
      label: "Odunc/kirala",
      note: "Tek seferlik etkinlik icinse satin almak yerine odunc istemek daha mantikli olabilir.",
    },
    {
      kind: "alternative",
      label: "Alternatif kombin",
      note: "Eksik parcayi almadan once dolaptaki yakin renk ve kategoriyle kombin dene.",
    },
  ];
}

export function buildSecondHandListingAdvice(item: WardrobeItem): SecondHandListingAdvice {
  const label = [item.brand, item.subcategory ?? item.category, item.colors[0]].filter(Boolean).join(" ").trim() || item.category;
  const priceRange = getSecondHandPriceRange(item);
  const condition = item.wear_count <= 1 ? "az kullanildi" : item.wear_count <= 8 ? "temiz kullanildi" : "kullanim izleri fiyata yansitildi";
  const seasonText = item.season.length > 0 ? `${item.season.join(", ")} sezonu icin uygun` : "gunluk kombinlere uygun";
  const fabricText = item.fabric ? `${item.fabric} dokulu` : "dolaptan cikarma";

  return {
    description: `${condition}. ${seasonText}. ${fabricText}. Renk: ${item.colors.join(", ") || "belirtilmedi"}.`,
    platform_notes: buildShoppingSearchTargets(label).filter((target) => target.label === "Dolap" || target.label === "Gardrops" || target.label === "Modacruz"),
    price_high: priceRange?.high ?? null,
    price_low: priceRange?.low ?? null,
    title: label,
  };
}

function getSecondHandPriceRange(item: WardrobeItem) {
  if (!item.purchase_price) {
    return null;
  }

  const baseRate = item.wear_count > 10 ? 0.32 : item.wear_count > 3 ? 0.42 : 0.52;
  const low = Math.max(Math.round(item.purchase_price * Math.max(baseRate - 0.08, 0.22)), 50);
  const high = Math.max(Math.round(item.purchase_price * Math.min(baseRate + 0.1, 0.7)), low + 50);
  return { high, low };
}

function getRecentHistory(history: PriceHistoryPoint[], days: number) {
  const cutoff = Date.now() - days * 86_400_000;
  return history.filter((entry) => {
    const time = new Date(entry.date).getTime();
    return Number.isFinite(time) && time >= cutoff;
  });
}

function countPriceDrops(history: PriceHistoryPoint[]) {
  return history.reduce((count, entry, index) => {
    const previous = history[index - 1];
    return previous && entry.price < previous.price ? count + 1 : count;
  }, 0);
}
