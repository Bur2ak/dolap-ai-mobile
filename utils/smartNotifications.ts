import type { SmartNotificationPlan, WardrobeItem, WeatherData } from "@/types";

export function buildSmartOutfitNotification(weather: WeatherData | null, items: WardrobeItem[]): SmartNotificationPlan {
  if (!weather) {
    return {
      body: "Shipirio sana bugunku planina gore dolabindan kombin onerebilir.",
      reason: "Hava verisi hazir degil; genel kombin hatirlaticisi kullanilacak.",
      route: "/(tabs)/outfit",
      title: "Bugun ne giyeceksin?",
    };
  }

  const description = normalize(weather.description);
  const hasRain = textIncludes(description, ["yagmur", "saganak", "drizzle", "rain"]);
  const hasSnow = textIncludes(description, ["kar", "snow"]);
  const hasOuterwear = items.some((item) => item.category === "dis_giyim");
  const hasShoes = items.some((item) => item.category === "ayakkabi");
  const hasLightItems = items.some((item) => item.season.includes("yaz") || item.category === "elbise");
  const hasColdItems = items.some((item) => item.season.includes("kis") || item.category === "dis_giyim");
  const cityText = weather.city ? `${weather.city}: ` : "";

  if (hasRain) {
    return {
      body: `${cityText}yagmur gorunuyor. ${hasShoes ? "Ayakkabi secimini" : "Ayakkabi eklemeyi"} ve dis giyimi kontrol et.`,
      reason: "Hava aciklamasi yagmur riski tasiyor.",
      route: "/(tabs)/outfit",
      title: "Yagmur kombini hazirla",
    };
  }

  if (hasSnow || weather.feels_like <= 6) {
    return {
      body: `${cityText}hissedilen ${weather.feels_like} derece. ${hasColdItems ? "Kalin parcalari" : "Kis parcalarini"} one al.`,
      reason: "Hissedilen sicaklik dusuk.",
      route: "/(tabs)/outfit",
      title: "Soguk hava uyarisi",
    };
  }

  if (weather.temp >= 27) {
    return {
      body: `${cityText}${weather.temp} derece. ${hasLightItems ? "Hafif parcalarla" : "Yazlik parca ekleyerek"} ferah bir kombin kur.`,
      reason: "Sicak hava icin hafif parcalar daha uygun.",
      route: "/(tabs)/outfit",
      title: "Sicak hava kombini",
    };
  }

  if (weather.humidity >= 75) {
    return {
      body: `${cityText}nem yuksek. Katmanli ama nefes alan parcalari tercih et.`,
      reason: "Yuksek nem konforu etkileyebilir.",
      route: "/(tabs)/outfit",
      title: "Nemli hava icin hafif secim",
    };
  }

  if (!hasOuterwear && weather.feels_like <= 14) {
    return {
      body: `${cityText}hava serin. Dolabina tamamlayici bir dis giyim eklemek iyi olabilir.`,
      reason: "Serin havaya karsilik dolapta dis giyim gorunmuyor.",
      route: "/(tabs)/analytics",
      title: "Dolap eksigi olabilir",
    };
  }

  return {
    body: `${cityText}hava dengeli. Bugun az kullandigin bir parcayi kombine sokmayi dene.`,
    reason: "Hava kosullari ekstra kisit getirmiyor.",
    route: "/(tabs)/outfit",
    title: "Bugun tekrar giy",
  };
}

function textIncludes(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(normalize(keyword)));
}

function normalize(value: string) {
  return value.toLocaleLowerCase("tr-TR");
}
