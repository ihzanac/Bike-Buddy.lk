import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id ?? props.name
    return (
      <label className="block space-y-1.5 text-sm font-medium text-surface-800">
        {label ? <span>{label}</span> : null}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-xl border border-surface-200 bg-white px-3 py-2.5 text-sm text-surface-900 shadow-inner shadow-surface-900/5 outline-none transition placeholder:text-surface-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-200',
            error && 'border-red-400 focus:border-red-500 focus:ring-red-200',
            className,
          )}
          {...props}
        />
        {error ? <p className="text-xs font-normal text-red-600">{error}</p> : null}
      </label>
    )
  },
)
Input.displayName = 'Input'
