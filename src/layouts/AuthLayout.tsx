import { Outlet } from 'react-router-dom'

/** Auth screens supply their own full-viewport background. */
export function AuthLayout() {
  return <Outlet />
}
