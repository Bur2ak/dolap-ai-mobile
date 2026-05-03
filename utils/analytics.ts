import type { DistributionPoint, WardrobeAnalytics, WardrobeItem } from "@/types";

export function calculateWardrobeAnalytics(items: WardrobeItem[]): WardrobeAnalytics {
  const totalValue = items.reduce((sum, item) => sum + (item.purchase_price ?? 0), 0);
  const wornItems = items.filter((item) => item.wear_count > 0 && item.purchase_price);
  const totalCostPerWear = wornItems.reduce((sum, item) => sum + (item.purchase_price ?? 0) / item.wear_count, 0);
  const avgCostPerWear = wornItems.length > 0 ? totalCostPerWear / wornItems.length : 0;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlySpending = items
    .filter((item) => item.created_at?.slice(0, 7) === currentMonth)
    .reduce((sum, item) => sum + (item.purchase_price ?? 0), 0);

  const neverWorn = items.filter((item) => item.wear_count === 0);
  const mostWorn = [...items].sort((a, b) => b.wear_count - a.wear_count).slice(0, 5);
  const suggestionsToRemove = [...neverWorn]
    .sort((a, b) => Number(b.purchase_price ?? 0) - Number(a.purchase_price ?? 0))
    .slice(0, 5);

  return {
    total_items: items.length,
    total_value: totalValue,
    avg_cost_per_wear: avgCostPerWear,
    monthly_spending: monthlySpending,
    most_worn: mostWorn,
    never_worn: neverWorn.slice(0, 5),
    category_distribution: toDistribution(items.map((item) => item.category)),
    color_distribution: toColorDistribution(items),
    suggestions_to_remove: suggestionsToRemove,
  };
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
