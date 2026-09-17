/** Revenue label helper (thousands LKR → compact string). */
export function formatTotalRevenueLkr(revenueKSum: number): string {
  if (revenueKSum >= 1000) {
    const m = revenueKSum / 1000
    return `${m % 1 === 0 ? m : m.toFixed(1)}M`
  }
  return `${revenueKSum}K`
}
