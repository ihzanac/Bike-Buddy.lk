import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => {
    const selectId = id ?? props.name
    return (
      <label className="block space-y-1.5 text-sm font-medium text-surface-800">
        {label ? <span>{label}</span> : null}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full rounded-xl border border-surface-200 bg-white px-3 py-2.5 text-sm text-surface-900 shadow-inner shadow-surface-900/5 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-200',
            error && 'border-red-400 focus:border-red-500 focus:ring-red-200',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        {error ? <p className="text-xs font-normal text-red-600">{error}</p> : null}
      </label>
    )
  },
)
Select.displayName = 'Select'
