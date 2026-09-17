/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  /** When `"true"`, prepends static demo bikes/accessories/services for browsing (see `src/data/demoCatalog.ts`). */
  readonly VITE_DEMO_DATA?: string
  /** When `"true"`, admin area shows extra sample users, listings, bookings, and higher stat floors (see `src/data/adminDummyData.ts`). */
  readonly VITE_ADMIN_DUMMY_DATA?: string
  /**
   * Must match the literal in `firestore.rules` (admin self-registration).
   * Deploy rules after changing. Same value as form default in Admin Register.
   */
  readonly VITE_FIREBASE_ADMIN_PROVISIONING_KEY?: string
  /**
   * When `"true"`, the parts form shows “Choose image” in production builds (requires a host
   * that serves the same `/api/upload/part-image` route as the Vite plugin, or a matching proxy).
   */
  readonly VITE_ENABLE_PART_FILE_UPLOAD?: string
  /** Override: Vite default `/api/upload/part-image`, PHP e.g. `/api/upload-part-image.php` or full `https://…` */
  readonly VITE_PART_IMAGE_UPLOAD_PATH?: string
  /** If your PHP (or API) checks `X-Upload-Token`, set the same value as server `PART_IMAGE_UPLOAD_SECRET`. */
  readonly VITE_PART_IMAGE_UPLOAD_TOKEN?: string
  /**
   * When `"true"`, bike form “Choose image” is enabled in production (needs Vite route or PHP
   * `upload-bike-image`); files go to `public/uploads/bikes/`, only URL in Firestore.
   */
  readonly VITE_ENABLE_BIKE_FILE_UPLOAD?: string
  /** Override: default `/api/upload/bike-image`, PHP e.g. `/api/upload-bike-image.php` */
  readonly VITE_BIKE_IMAGE_UPLOAD_PATH?: string
  /** Optional: sent as `X-Upload-Token` to PHP; match `BIKE_IMAGE_UPLOAD_SECRET` (or part secret) on server. */
  readonly VITE_BIKE_IMAGE_UPLOAD_TOKEN?: string
  /** PHP endpoint path/URL for customer forgot-password OTP (PHPMailer). */
  readonly VITE_PASSWORD_OTP_API_PATH?: string
  /** PHP endpoint path/URL for booking confirmation email fallback (PHPMailer). */
  readonly VITE_BOOKING_RECEIPT_API_PATH?: string
  /** Gemini API key for bike AI comparison chat. */
  readonly VITE_GEMINI_API_KEY?: string
  /** Optional Gemini model, defaults to gemini-1.5-flash. */
  readonly VITE_GEMINI_MODEL?: string
  /**
   * Google Maps Embed API key (client-side; restrict by HTTP referrer in Google Cloud).
   * Enable "Maps Embed API" for this key. Used on the customer home map.
   */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string
  /** Optional override for the embed search center, e.g. `Colombo, Sri Lanka` */
  readonly VITE_MAP_EMBED_QUERY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
