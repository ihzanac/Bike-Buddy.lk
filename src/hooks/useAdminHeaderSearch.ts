import { useOutletContext } from 'react-router-dom'

export type AdminLayoutOutletContext = {
  adminSearchQuery: string
  adminItemsPerPage?: number
  adminViewMode?: 'table' | 'cards' | 'list'
}

/** Text from the admin shell header search (see `AdminLayout` + `<Outlet context />`). */
export function useAdminHeaderSearch(): string {
  const ctx = useOutletContext<AdminLayoutOutletContext | null>()
  return (ctx?.adminSearchQuery ?? '').trim()
}
