import type { MissingWardrobePiece, PriceTracking } from "@/types";

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
}

export interface ShoppingSearchTarget {
  label: string;
  url: string;
  note: string;
}

export interface BudgetRecommendation {
  label: string;
  range: string;
  note: string;
}

const marketplaceTargets = [
  { baseUrl: "https://www.google.com/search?tbm=shop&q=", label: "Google Shopping", note: "Genis fiyat karsilastirmasi" },
  { baseUrl: "https://www.trendyol.com/sr?q=", label: "Trendyol", note: "Yeni urun alternatifleri" },
  { baseUrl: "https://dolap.com/ara?q=", label: "Dolap", note: "Ikinci el alternatif ara" },
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

  if (tracking.target_price && currentPrice <= tracking.target_price) {
    return {
      body: "Hedef fiyat yakalanmis. Gercekten ihtiyacin varsa satin alma zamani.",
      discount_percent_from_initial: discountPercent,
      lowest_price_30d: lowestPrice,
      status: "buy",
      title: "Hedef fiyat geldi",
    };
  }

  if (currentPrice <= lowestPrice && discountPercent >= 15) {
    return {
      body: "Fiyat son kayitlara gore dipte ve ilk fiyata gore anlamli dusmus.",
      discount_percent_from_initial: discountPercent,
      lowest_price_30d: lowestPrice,
      status: "buy",
      title: "Almaya yakin",
    };
  }

  if (lowestPrice < currentPrice * 0.9) {
    return {
      body: "Bu urun daha once daha dusuk seviyeyi gormus. Acele degilse indirim beklemek mantikli.",
      discount_percent_from_initial: discountPercent,
      lowest_price_30d: lowestPrice,
      status: "wait",
      title: "Indirim beklenebilir",
    };
  }

  return {
    body: "Net indirim sinyali yok. Hedef fiyat belirleyip takipte tutmak daha iyi.",
    discount_percent_from_initial: discountPercent,
    lowest_price_30d: lowestPrice,
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
    note: target.note,
    url: `${target.baseUrl}${encodedQuery}`,
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

function getRecentHistory(history: PriceHistoryPoint[], days: number) {
  const cutoff = Date.now() - days * 86_400_000;
  return history.filter((entry) => {
    const time = new Date(entry.date).getTime();
    return Number.isFinite(time) && time >= cutoff;
  });
}
