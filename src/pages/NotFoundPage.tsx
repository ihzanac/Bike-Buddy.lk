import { Link } from 'react-router-dom'
import { ROUTES } from '@/utils/constants'
import { Button } from '@/components/ui/Button'

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
      <div className="font-display text-6xl font-bold text-brand-700">404</div>
      <h1 className="mt-4 text-2xl font-semibold text-surface-900">Page not found</h1>
      <p className="mt-2 text-sm text-surface-600">
        The page you are looking for does not exist or was moved.
      </p>
      <Link className="mt-8" to={ROUTES.home}>
        <Button>Go home</Button>
      </Link>
    </div>
  )
}
