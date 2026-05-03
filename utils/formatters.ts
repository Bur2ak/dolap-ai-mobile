export function formatCurrency(value: number): string {
  return `${Math.round(value).toLocaleString("tr-TR")} TL`;
}

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("tr-TR");
}
