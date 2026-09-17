/**
 * Bike listing images: files stay on your server disk (`public/uploads/bikes/...`).
 * Only the returned public URL is stored in Firestore `bikes.images` — not Firebase Storage.
 *
 * - **Vite dev / preview:** `POST /api/upload/bike-image` (see `vite-plugin-bike-image-upload.ts`)
 * - **PHP:** `public/api/upload-bike-image.php` — set `VITE_BIKE_IMAGE_UPLOAD_PATH` and
 *   `VITE_ENABLE_BIKE_FILE_UPLOAD=true` for production static hosting.
 */
export const canUseLocalBikeImageUpload =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_BIKE_FILE_UPLOAD === 'true'

const uploadPath = () => import.meta.env.VITE_BIKE_IMAGE_UPLOAD_PATH || '/api/upload/bike-image'

export async function uploadBikeImageToLocalServer(file: File, ownerId: string): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  if (ownerId.trim()) fd.append('ownerId', ownerId.trim())
  const token = import.meta.env.VITE_BIKE_IMAGE_UPLOAD_TOKEN?.trim()
  const headers: HeadersInit = {}
  if (token) headers['X-Upload-Token'] = token
  const res = await fetch(uploadPath(), { method: 'POST', body: fd, headers })
  if (!res.ok) {
    let msg = res.statusText
    try {
      const j = (await res.json()) as { error?: string }
      if (j.error) msg = j.error
    } catch {
      // ignore
    }
    throw new Error(msg)
  }
  const data = (await res.json()) as { url?: string }
  const url = data.url?.trim()
  if (!url) throw new Error('Server did not return an image URL.')
  return url
}
