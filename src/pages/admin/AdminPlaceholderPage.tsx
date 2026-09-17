import { Link } from 'react-router-dom'
import { ROUTES } from '@/utils/constants'

type Props = {
  title: string
  icon: string
  description: string
  hint?: string
}

export function AdminPlaceholderPage({ title, icon, description, hint }: Props) {
  return (
    <>
      <div className="bb-hero">
        <h2>
          {icon} {title}
        </h2>
        <p>{description}</p>
      </div>
      <div className="bb-placeholder">
        <p>
          {hint ?? 'This screen matches your legacy admin layout. Wire it to Firestore when you are ready.'}
        </p>
        <p style={{ marginTop: 16 }}>
          <Link to={ROUTES.admin} style={{ color: '#1e3a8a', fontWeight: 700 }}>
            ← Back to dashboard
          </Link>
        </p>
      </div>
    </>
  )
}
