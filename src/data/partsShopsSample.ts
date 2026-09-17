/** Aggregate revenue label (sum of per-shop `revenueK`, thousands LKR). */
export function formatPartsRevenueLkr(revenueKSum: number): string {
  if (revenueKSum >= 1000) {
    const m = revenueKSum / 1000
    return `${m % 1 === 0 ? m : m.toFixed(1)}M`
  }
  return `${revenueKSum}K`
}
