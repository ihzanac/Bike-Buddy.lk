import { useAuth } from '@/hooks/useAuth'

const DEFAULT_PLACE = 'Sri Lanka'

/**
 * Google Maps Embed (iframe). Set `VITE_GOOGLE_MAPS_API_KEY` and enable
 * "Maps Embed API" for that key in Google Cloud Console. Restrict the key
 * to your domains for production.
 * Map area uses the customer’s `profile.location` (and optional VITE_MAP_EMBED_QUERY).
 */
export function CustomerMapEmbed() {
  const { profile } = useAuth()
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()
  const custom = import.meta.env.VITE_MAP_EMBED_QUERY?.trim()
  const loc = profile?.location?.trim()
  /** Iframe + place search */
  const placeQuery = custom || (loc ? `${loc}, Sri Lanka` : DEFAULT_PLACE)
  /** “Open in Maps” — prefer shops/services near the customer’s area */
  const searchQuery =
    custom ||
    (loc
      ? `motorcycle bike service shop near ${loc} Sri Lanka`
      : 'motorcycle bike service shop Sri Lanka')

  const embedUrl = key
    ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${encodeURIComponent(
        placeQuery,
      )}&zoom=${loc ? 10 : 7}&maptype=roadmap&language=en`
    : `https://www.google.com/maps?q=${encodeURIComponent(placeQuery)}&output=embed`

  const openMapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`

  const mapBlock = (
    <div className="cph-map cph-map--embed" aria-label="Map showing your profile area and nearby">
      <iframe
        className="cph-map-iframe"
        title={
          loc
            ? `Google Map — ${loc} and nearby bike shops`
            : 'Google Map — bike shops in Sri Lanka'
        }
        src={embedUrl}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
      {!key ? (
        <p className="cph-map-hint" style={{ marginTop: 8 }}>
          <a className="cph-map-open" href={openMapsHref} target="_blank" rel="noopener noreferrer">
            Open a larger map in Google Maps
          </a>
        </p>
      ) : null}
    </div>
  )

  return mapBlock
}
