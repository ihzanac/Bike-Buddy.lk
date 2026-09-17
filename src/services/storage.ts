import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { requireStorage } from '@/services/firebase'

export async function uploadShopImage(params: {
  ownerId: string
  folder: 'bikes' | 'accessories'
  entityId: string
  file: File
}) {
  const storage = requireStorage()
  const safeName = params.file.name.replace(/[^\w.-]+/g, '_')
  const path = `shops/${params.ownerId}/${params.folder}/${params.entityId}/${Date.now()}_${safeName}`
  const r = ref(storage, path)
  await uploadBytes(r, params.file, { contentType: params.file.type })
  return getDownloadURL(r)
}

export async function uploadShopLogo(ownerId: string, file: File) {
  const storage = requireStorage()
  const safeName = file.name.replace(/[^\w.-]+/g, '_')
  const path = `shops/${ownerId}/profile/logo_${Date.now()}_${safeName}`
  const r = ref(storage, path)
  await uploadBytes(r, file, { contentType: file.type || 'image/jpeg' })
  return getDownloadURL(r)
}

