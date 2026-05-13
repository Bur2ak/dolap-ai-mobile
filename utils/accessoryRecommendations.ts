import type { WardrobeItem, WeatherData } from "@/types";

export interface AccessoryRecommendation {
  title: string;
  body: string;
  item_ids: string[];
  priority: "high" | "medium" | "low";
}

const warmColors = ["bej", "kahverengi", "krem", "altin", "taba", "camel"];
const coolColors = ["siyah", "gri", "lacivert", "gumus", "mavi", "beyaz"];

export function buildAccessoryRecommendations(items: WardrobeItem[], weather: WeatherData | null): AccessoryRecommendation[] {
  const activeItems = items.filter((item) => item.is_active);
  const accessories = activeItems.filter((item) => item.category === "aksesuar" || item.category === "canta");
  const shoes = activeItems.filter((item) => item.category === "ayakkabi");
  const outerwear = activeItems.filter((item) => item.category === "dis_giyim");
  const recommendations: AccessoryRecommendation[] = [];

  if (accessories.length === 0) {
    recommendations.push({
      body: "Dolapta canta, kemer, taki veya sapka gibi tamamlayici parca yok. Kombinlerin daha bitmis gorunmesi icin bir aksesuar eklemek iyi olur.",
      item_ids: [],
      priority: "high",
      title: "Tamamlayici aksesuar eksik",
    });
  } else {
    const statementPiece = pickStatementAccessory(accessories);
    const neutralPiece = pickNeutralAccessory(accessories);
    recommendations.push({
      body: statementPiece
        ? `${getItemLabel(statementPiece)} sade kombinleri hizlica odakli hale getirir.`
        : `${getItemLabel(neutralPiece ?? accessories[0])} gunluk kombinlerde risksiz tamamlayici olur.`,
      item_ids: [statementPiece?.id ?? neutralPiece?.id ?? accessories[0].id],
      priority: "medium",
      title: statementPiece ? "Odak aksesuar onerisi" : "Guvenli aksesuar onerisi",
    });
  }

  const weatherRecommendation = getWeatherAccessoryRecommendation(weather, accessories, shoes, outerwear);
  if (weatherRecommendation) {
    recommendations.push(weatherRecommendation);
  }

  const colorBridge = buildColorBridgeRecommendation(activeItems, accessories);
  if (colorBridge) {
    recommendations.push(colorBridge);
  }

  return recommendations.slice(0, 3);
}

function getWeatherAccessoryRecommendation(
  weather: WeatherData | null,
  accessories: WardrobeItem[],
  shoes: WardrobeItem[],
  outerwear: WardrobeItem[],
): AccessoryRecommendation | null {
  if (!weather) {
    return null;
  }

  const description = normalize(weather.description);
  const rainy = includesAny(description, ["yagmur", "saganak", "rain", "drizzle"]);
  const cold = weather.feels_like <= 8 || includesAny(description, ["kar", "snow"]);
  const hot = weather.temp >= 27;

  if (rainy) {
    return {
      body: shoes.length > 0 || outerwear.length > 0 ? "Yagmur riski var; koyu ayakkabi ve dis giyimle kombini koru." : "Yagmur riski var; dolaba yagmura uygun ayakkabi veya ince dis giyim eklemek iyi olur.",
      item_ids: [...shoes.slice(0, 1), ...outerwear.slice(0, 1)].map((item) => item.id),
      priority: "high",
      title: "Yagmur icin pratik tamamlayici",
    };
  }

  if (cold) {
    const warmAccessory = accessories.find((item) => item.season.includes("kis") || includesAny(item.colors.join(" "), warmColors));
    return {
      body: warmAccessory ? `${getItemLabel(warmAccessory)} soguk havada kombini daha dengeli tamamlar.` : "Soguk hava icin atki, bere veya kalin bir canta/aksesuar eksigi gorunuyor.",
      item_ids: warmAccessory ? [warmAccessory.id] : [],
      priority: "medium",
      title: "Soguk hava tamamlayicisi",
    };
  }

  if (hot) {
    const lightAccessory = accessories.find((item) => item.season.includes("yaz") || includesAny(item.colors.join(" "), ["beyaz", "krem", "bej"]));
    return {
      body: lightAccessory ? `${getItemLabel(lightAccessory)} sicak havada kombini ferah tutar.` : "Sicak havalar icin acik renkli hafif bir aksesuar eklemek kombinleri rahatlatir.",
      item_ids: lightAccessory ? [lightAccessory.id] : [],
      priority: "low",
      title: "Sicak hava aksesuari",
    };
  }

  return null;
}

function buildColorBridgeRecommendation(items: WardrobeItem[], accessories: WardrobeItem[]): AccessoryRecommendation | null {
  if (accessories.length === 0 || items.length < 4) {
    return null;
  }

  const dominantColor = mostCommon(items.flatMap((item) => item.colors));
  const bridgePalette = warmColors.some((color) => dominantColor.includes(color)) ? coolColors : warmColors;
  const bridgeItem = accessories.find((item) => item.colors.some((color) => bridgePalette.some((target) => normalize(color).includes(target))));

  if (!bridgeItem) {
    return null;
  }

  return {
    body: `${dominantColor} agirlikli dolapta ${getItemLabel(bridgeItem)} kontrast veya gecis parcasi gibi calisir.`,
    item_ids: [bridgeItem.id],
    priority: "low",
    title: "Renk dengeleyici",
  };
}

function pickStatementAccessory(items: WardrobeItem[]) {
  return items.find((item) => item.colors.some((color) => ![...warmColors, ...coolColors].some((neutral) => normalize(color).includes(neutral))));
}

function pickNeutralAccessory(items: WardrobeItem[]) {
  return items.find((item) => item.colors.some((color) => [...warmColors, ...coolColors].some((neutral) => normalize(color).includes(neutral))));
}

function mostCommon(values: string[]) {
  const counts = values.reduce<Record<string, number>>((acc, value) => {
    const normalized = normalize(value);
    if (normalized) {
      acc[normalized] = (acc[normalized] ?? 0) + 1;
    }
    return acc;
  }, {});

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "notr";
}

function getItemLabel(item: WardrobeItem) {
  return item.subcategory ?? item.brand ?? item.category;
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(normalize(keyword)));
}

function normalize(value: string) {
  return value.toLocaleLowerCase("tr-TR").trim();
}
