import type { WardrobeItem } from "@/types";

export interface PairOutfitPlan {
  title: string;
  body: string;
  own_item_ids: string[];
  friend_item_ids: string[];
  palette: string[];
}

export interface GroupStyleCue {
  title: string;
  body: string;
  accent_color: string | null;
}

export interface FriendStyleInspiration {
  title: string;
  body: string;
  search_cues: string[];
}

const neutralColors = ["siyah", "beyaz", "gri", "bej", "krem", "lacivert"];
const accentColors = ["bordo", "yesil", "mavi", "kirmizi", "pembe", "mor", "sari"];

export function buildPairOutfitPlan(ownItems: WardrobeItem[], friendItems: WardrobeItem[]): PairOutfitPlan | null {
  const ownActive = ownItems.filter((item) => item.is_active);
  const friendActive = friendItems.filter((item) => item.is_active);

  if (ownActive.length < 2 || friendActive.length < 1) {
    return null;
  }

  const friendAnchor = pickAnchor(friendActive);
  const palette = friendAnchor.colors.length > 0 ? friendAnchor.colors.map(normalize) : [normalize(friendAnchor.dominant_color_hex ?? "notr")];
  const matchingOwnItems = pickMatchingOwnItems(ownActive, palette);
  const fallbackOwnItems = ownActive.filter((item) => !matchingOwnItems.some((selected) => selected.id === item.id)).slice(0, 3 - matchingOwnItems.length);
  const ownSelection = [...matchingOwnItems, ...fallbackOwnItems].slice(0, 3);

  if (!friendAnchor || ownSelection.length === 0) {
    return null;
  }

  const friendLabel = getItemLabel(friendAnchor);
  const ownLabel = ownSelection.map(getItemLabel).join(", ");

  return {
    body: `${friendLabel} ile sende ${ownLabel} ayni renk ailesinden veya dengeli kontrasttan gider.`,
    friend_item_ids: [friendAnchor.id],
    own_item_ids: ownSelection.map((item) => item.id),
    palette: palette.filter(Boolean).slice(0, 3),
    title: "Cift/partner uyumu",
  };
}

export function buildGroupStyleCue(friendItems: WardrobeItem[]): GroupStyleCue | null {
  const activeItems = friendItems.filter((item) => item.is_active);
  if (activeItems.length < 3) {
    return null;
  }

  const allColors = activeItems.flatMap((item) => item.colors.map(normalize)).filter(Boolean);
  const dominantColor = mostCommon(allColors);
  const accentColor = accentColors.find((color) => color !== dominantColor) ?? null;
  const neutralHeavy = neutralColors.some((color) => dominantColor.includes(color));

  return {
    accent_color: accentColor,
    body: neutralHeavy
      ? `Arkadas dolabi ${dominantColor} agirlikli. Sen ${accentColor ?? "renkli"} bir vurgu ile gruba uyumlu ama farkli gorunebilirsin.`
      : `Arkadas dolabinda ${dominantColor} tonu one cikiyor. Sen notr bir parca ile grubu dengeleyebilirsin.`,
    title: "Grup etkinlik ipucu",
  };
}

export function buildFriendStyleInspiration(friendItems: WardrobeItem[]): FriendStyleInspiration | null {
  const activeItems = friendItems.filter((item) => item.is_active);
  if (activeItems.length < 2) {
    return null;
  }

  const colors = activeItems.flatMap((item) => item.colors.map(normalize)).filter(Boolean);
  const contexts = activeItems.flatMap((item) => item.usage_context.map(normalize)).filter(Boolean);
  const fabrics = activeItems.map((item) => normalize(item.fabric ?? "")).filter(Boolean);
  const dominantColor = mostCommon(colors);
  const dominantContext = mostCommon(contexts);
  const dominantFabric = mostCommon(fabrics);
  const cues = uniqueStrings([dominantColor, dominantContext, dominantFabric]).slice(0, 3);

  return {
    body: [
      dominantColor !== "notr" ? `${dominantColor} tonlari one cikiyor` : "notr tonlar agirlikta",
      dominantContext !== "notr" ? `${dominantContext} kullanim alani baskin` : "gunluk kombin dili baskin",
      dominantFabric !== "notr" ? `${dominantFabric} dokusu tekrar ediyor` : null,
    ]
      .filter(Boolean)
      .join(". "),
    search_cues: cues.length > 0 ? cues : ["notr", "gunluk"],
    title: "Arkadasinin tarzindan ilham al",
  };
}

function pickAnchor(items: WardrobeItem[]) {
  return (
    items.find((item) => item.category === "ust" || item.category === "elbise") ??
    items.find((item) => item.category === "dis_giyim") ??
    items[0]
  );
}

function pickMatchingOwnItems(items: WardrobeItem[], palette: string[]) {
  const matching = items.filter((item) => item.colors.some((color) => palette.some((target) => normalize(color).includes(target))));
  const neutral = items.filter((item) => item.colors.some((color) => neutralColors.some((target) => normalize(color).includes(target))));
  return uniqueItems([...matching, ...neutral]).slice(0, 3);
}

function uniqueItems(items: WardrobeItem[]) {
  const seenIds = new Set<string>();
  return items.filter((item) => {
    if (seenIds.has(item.id)) {
      return false;
    }

    seenIds.add(item.id);
    return true;
  });
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (!value || value === "notr" || seen.has(value)) {
      return false;
    }

    seen.add(value);
    return true;
  });
}

function mostCommon(values: string[]) {
  const counts = values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "notr";
}

function getItemLabel(item: WardrobeItem) {
  return item.subcategory ?? item.brand ?? item.category;
}

function normalize(value: string) {
  return value.toLocaleLowerCase("tr-TR").trim();
}
