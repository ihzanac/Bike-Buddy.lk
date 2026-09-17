import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

type Props = {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ title, description, action, className }: Props) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-surface-200 bg-surface-50 px-6 py-16 text-center',
        className,
      )}
    >
      <h3 className="font-display text-lg font-semibold text-surface-900">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-surface-600">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}
