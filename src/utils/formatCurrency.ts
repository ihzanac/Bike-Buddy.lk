export function formatLkr(n: number): string {
  return `LKR ${Math.max(0, Math.round(n)).toLocaleString('en-LK')}`
}
