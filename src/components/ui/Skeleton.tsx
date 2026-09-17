import { cn } from '@/utils/cn'
import type { HTMLAttributes } from 'react'

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-gradient-to-r from-surface-200 via-surface-100 to-surface-200',
        className,
      )}
      {...props}
    />
  )
}
