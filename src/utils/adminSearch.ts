/** Case-insensitive substring match across joined fields; empty query passes. */
export function rowMatchesAdminQuery(
  parts: readonly (string | number | undefined | null)[],
  q: string,
): boolean {
  const t = String(q).trim().toLowerCase()
  if (!t) return true
  const hay = parts.map((p) => String(p ?? '')).join(' ').toLowerCase()
  return hay.includes(t)
}
