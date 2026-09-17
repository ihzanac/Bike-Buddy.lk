import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/utils/cn'
import { formatLkr } from '@/utils/formatCurrency'

type Props = {
  to: string
  title: string
  subtitle?: string
  price: number
  imageUrl?: string
  badge?: string
  className?: string
}

export function ProductCard({
  to,
  title,
  subtitle,
  price,
  imageUrl,
  badge,
  className,
}: Props) {
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
      <Link to={to} className={cn('block', className)}>
        <Card className="overflow-hidden p-0">
          <div className="relative aspect-[4/3] bg-surface-100">
            {imageUrl ? (
              <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-sm font-semibold text-surface-400">
                No image
              </div>
            )}
            {badge ? (
              <div className="absolute left-3 top-3">
                <Badge tone="success">{badge}</Badge>
              </div>
            ) : null}
          </div>
          <div className="space-y-2 p-5 text-left">
            <div className="font-display text-lg font-semibold text-surface-900">{title}</div>
            {subtitle ? <p className="line-clamp-2 text-sm text-surface-600">{subtitle}</p> : null}
            <div className="text-base font-bold text-brand-700">{formatLkr(price)}</div>
          </div>
        </Card>
      </Link>
    </motion.div>
  )
}
