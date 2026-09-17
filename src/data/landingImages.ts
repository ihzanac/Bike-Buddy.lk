/** High-res Unsplash sources for the public home (decorative). Swap for `/public/...` when self-hosting. */
const q = (w: number) => `auto=format&fit=crop&w=${w}&q=85`

export const landingImages = {
  /** Full-page atmosphere — wide bike, right-weighted crop */
  backdrop:
    `https://images.unsplash.com/photo-1558981806-ec527fa84f87?${q(2400)}`,
  /** Hero preview card — sport / street */
  heroCard: `https://images.unsplash.com/photo-1625047509168-a702264f9551?${q(1400)}`,
  /** Top hero grid (`PublicIndexPage` main section) — wide scenic */
  heroSection: `https://images.unsplash.com/photo-1469037783299-1bd8d200feb8?${q(2200)}`,
  /** Floating accent layer A */
  accentA: `https://images.unsplash.com/photo-1568772585407-9361f9bf3f87?${q(1800)}`,
  /** Floating accent layer B */
  accentB: `https://images.unsplash.com/photo-1449426468159-d96dbf08f19f?${q(1600)}`,
  /** Explore card — bikes */
  exploreBikes: `https://images.unsplash.com/photo-1558981806-ec527fa84f87?${q(900)}`,
  /** Explore card — parts / chrome detail */
  exploreParts: `https://images.unsplash.com/photo-1558618666-fcd25c85cd64?${q(900)}`,
  /** Bottom CTA strip */
  ctaBand: `https://images.unsplash.com/photo-1568772585407-9361f9bf3f87?${q(2000)}`,
} as const
