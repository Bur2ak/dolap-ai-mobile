import type { EventPlanInput, WardrobeItem, WeatherData } from "@/types";

export interface PackingListItem {
  label: string;
  reason: string;
  item_ids: string[];
  status: "ready" | "missing";
}

export interface TravelPackingPlan {
  title: string;
  summary: string;
  items: PackingListItem[];
}

const travelKeywords = ["tatil", "seyahat", "valiz", "ucus", "otel", "plaj", "festival", "hafta sonu", "kamp"];

export function buildTravelPackingPlan(input: EventPlanInput): TravelPackingPlan | null {
  const signal = normalize([input.title, input.location, input.notes, input.event_type].filter(Boolean).join(" "));
  const isTrip = travelKeywords.some((keyword) => signal.includes(keyword));

  if (!isTrip) {
    return null;
  }

  const wardrobe = input.wardrobe.filter((item) => item.is_active);
  const top = pickByCategory(wardrobe, ["ust", "elbise"]);
  const bottom = pickByCategory(wardrobe, ["alt", "etek", "elbise"]);
  const shoes = pickByCategory(wardrobe, ["ayakkabi"]);
  const outerwear = pickByCategory(wardrobe, ["dis_giyim"]);
  const accessory = pickByCategory(wardrobe, ["canta", "aksesuar"]);
  const weatherItem = buildWeatherItem(input.weather, wardrobe);

  const items: PackingListItem[] = [
    {
      item_ids: top ? [top.id] : [],
      label: "Ana ust parca",
      reason: top ? `${label(top)} etkinlik boyunca kolay eslesir.` : "Dolapta seyahat icin ana ust parca eksik gorunuyor.",
      status: top ? "ready" : "missing",
    },
    {
      item_ids: bottom ? [bottom.id] : [],
      label: "Alt veya tek parca",
      reason: bottom ? `${label(bottom)} valizde kombin sayisini artirir.` : "Alt parca veya elbise eklemek valizi tamamlar.",
      status: bottom ? "ready" : "missing",
    },
    {
      item_ids: shoes ? [shoes.id] : [],
      label: "Yurume dostu ayakkabi",
      reason: shoes ? `${label(shoes)} seyahat gunleri icin guvenli secim.` : "Yurume dostu ayakkabi eklemek iyi olur.",
      status: shoes ? "ready" : "missing",
    },
    {
      item_ids: accessory ? [accessory.id] : [],
      label: "Tamamlayici canta/aksesuar",
      reason: accessory ? `${label(accessory)} gunluk planlari toparlar.` : "Canta veya pratik aksesuar eksigi var.",
      status: accessory ? "ready" : "missing",
    },
  ];

  if (weatherItem) {
    items.push(weatherItem);
  } else if (outerwear) {
    items.push({
      item_ids: [outerwear.id],
      label: "Ek katman",
      reason: `${label(outerwear)} aksam serinliginde valizi kurtarir.`,
      status: "ready",
    });
  }

  const readyCount = items.filter((item) => item.status === "ready").length;

  return {
    items,
    summary: `${readyCount}/${items.length} valiz parcasi dolabinda hazir gorunuyor.`,
    title: "Seyahat valiz plani",
  };
}

function buildWeatherItem(weather: WeatherData | null, wardrobe: WardrobeItem[]): PackingListItem | null {
  if (!weather) {
    return null;
  }

  const description = normalize(weather.description);
  const rainy = ["yagmur", "saganak", "rain", "drizzle"].some((keyword) => description.includes(keyword));
  const cold = weather.feels_like <= 10 || description.includes("kar") || description.includes("snow");
  const hot = weather.temp >= 27;

  if (rainy) {
    const rainPiece = wardrobe.find((item) => item.category === "dis_giyim" || item.category === "ayakkabi");
    return {
      item_ids: rainPiece ? [rainPiece.id] : [],
      label: "Yagmur onlemi",
      reason: rainPiece ? `${label(rainPiece)} yagmur ihtimaline karsi valizde dursun.` : "Yagmur icin dis giyim veya kapali ayakkabi eklemek iyi olur.",
      status: rainPiece ? "ready" : "missing",
    };
  }

  if (cold) {
    const warmPiece = wardrobe.find((item) => item.season.includes("kis") || item.category === "dis_giyim");
    return {
      item_ids: warmPiece ? [warmPiece.id] : [],
      label: "Soguk hava katmani",
      reason: warmPiece ? `${label(warmPiece)} dusuk sicakliklarda gerekli olabilir.` : "Soguk hava icin kalin katman eksigi var.",
      status: warmPiece ? "ready" : "missing",
    };
  }

  if (hot) {
    const lightPiece = wardrobe.find((item) => item.season.includes("yaz") && (item.category === "ust" || item.category === "elbise"));
    return {
      item_ids: lightPiece ? [lightPiece.id] : [],
      label: "Sicak hava yedegi",
      reason: lightPiece ? `${label(lightPiece)} sicak gunlerde valizi hafif tutar.` : "Sicak hava icin hafif bir yedek parca eklemek iyi olur.",
      status: lightPiece ? "ready" : "missing",
    };
  }

  return null;
}

function pickByCategory(items: WardrobeItem[], categories: WardrobeItem["category"][]) {
  return items.find((item) => categories.includes(item.category));
}

function label(item: WardrobeItem) {
  return item.subcategory ?? item.brand ?? item.category;
}

function normalize(value: string) {
  return value.toLocaleLowerCase("tr-TR").trim();
}
