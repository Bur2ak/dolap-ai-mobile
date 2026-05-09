import type { CareRecommendation, WardrobeItem } from "@/types";

export function getCareRecommendations(item: WardrobeItem): CareRecommendation[] {
  const recommendations: CareRecommendation[] = [
    {
      title: "Etiketi kontrol et",
      body: "Yikama ve kurutma derecesi icin uretici etiketini esas al.",
      priority: "important",
    },
  ];
  const text = normalize([item.category, item.subcategory, item.brand, ...item.colors].filter(Boolean).join(" "));

  if (item.colors.some((color) => normalize(color).includes("beyaz"))) {
    recommendations.push({
      title: "Beyazlari ayir",
      body: "Renk transferini onlemek icin koyu ve renkli parcalarla birlikte yikama.",
      priority: "important",
    });
  }

  if (item.colors.some((color) => ["siyah", "lacivert", "koyu"].some((keyword) => normalize(color).includes(keyword)))) {
    recommendations.push({
      title: "Ters cevirerek yika",
      body: "Koyu renklerde solmayi azaltmak icin ters cevirip dusuk isida yika.",
      priority: "normal",
    });
  }

  if (textIncludes(text, ["yun", "kazak", "triko", "hirka"])) {
    recommendations.push({
      title: "Sererek kurut",
      body: "Triko ve yun parcalar askiya asilirsa formu bozulabilir; havlu ustunde sererek kurut.",
      priority: "important",
    });
  }

  if (textIncludes(text, ["ipek", "saten", "dantel", "abiye"])) {
    recommendations.push({
      title: "Hassas temizlik",
      body: "Hassas dokularda elde yikama veya kuru temizleme daha guvenli olabilir.",
      priority: "important",
    });
  }

  if (textIncludes(text, ["deri", "suet"])) {
    recommendations.push({
      title: "Islatma",
      body: "Deri ve suet parcalari makinede yikama; nemli bez ve uygun bakim urunu kullan.",
      priority: "important",
    });
  }

  if (item.category === "ayakkabi") {
    recommendations.push({
      title: "Havalandir",
      body: "Kullanimdan sonra formunu korumasi icin havalandir ve direkt isidan uzak tut.",
      priority: "normal",
    });
  }

  if (item.category === "canta" || item.category === "aksesuar") {
    recommendations.push({
      title: "Tozdan koru",
      body: "Canta ve aksesuarlari toz torbasinda veya kapali alanda saklamak yuzeyi korur.",
      priority: "normal",
    });
  }

  if (item.category === "dis_giyim") {
    recommendations.push({
      title: "Sezon sonu bakimi",
      body: "Kaldirmadan once temizletip genis askida saklamak omuz formunu korur.",
      priority: "normal",
    });
  }

  return uniqueByTitle(recommendations).slice(0, 4);
}

function textIncludes(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(normalize(keyword)));
}

function normalize(value: string) {
  return value.toLocaleLowerCase("tr-TR");
}

function uniqueByTitle(recommendations: CareRecommendation[]) {
  const seen = new Set<string>();
  return recommendations.filter((recommendation) => {
    if (seen.has(recommendation.title)) {
      return false;
    }

    seen.add(recommendation.title);
    return true;
  });
}
