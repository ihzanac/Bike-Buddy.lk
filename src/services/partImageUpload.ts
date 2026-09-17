/**
 * Part images: the file never goes to Firebase Storage. A server saves it on disk and
 * returns a public URL; only that string is stored in Firestore `imageUrl`.
 *
 * - **Vite dev / preview:** `plugins/vite-plugin-part-image-upload.ts` → `POST /api/upload/part-image`
 * - **PHP (Apache/XAMPP, etc.):** `public/api/upload-part-image.php` → same idea, files under `public/uploads/parts/`
 *   Set `VITE_PART_IMAGE_UPLOAD_PATH=/api/upload-part-image.php` (or full URL) and `VITE_ENABLE_PART_FILE_UPLOAD=true`.
 */
export const canUseLocalPartImageUpload =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_PART_FILE_UPLOAD === 'true'

const uploadPath = () => import.meta.env.VITE_PART_IMAGE_UPLOAD_PATH || '/api/upload/part-image'

export async function uploadPartImageToLocalServer(file: File, ownerId: string): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  if (ownerId.trim()) fd.append('ownerId', ownerId.trim())
  const token = import.meta.env.VITE_PART_IMAGE_UPLOAD_TOKEN?.trim()
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
