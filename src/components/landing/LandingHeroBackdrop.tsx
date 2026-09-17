import { motion, useReducedMotion } from 'framer-motion'
import { landingImages } from '@/data/landingImages'

/** Full-bleed motorcycle backdrop with strong left scrim so hero copy stays readable. */
export function LandingHeroBackdrop() {
  const reduce = useReducedMotion()

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <motion.img
        src={landingImages.backdrop}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-[0.34] sm:opacity-[0.4] md:opacity-[0.44]"
        style={{ objectPosition: '68% 38%' }}
        initial={false}
        animate={reduce ? undefined : { scale: [1, 1.04, 1] }}
        transition={
          reduce
            ? undefined
            : { duration: 28, repeat: Infinity, ease: 'easeInOut' }
        }
        loading="eager"
        decoding="async"
        fetchPriority="high"
      />
      {/* Readability: heavy wash on copy side, lighter on image side */}
      <div className="absolute inset-0 bg-gradient-to-r from-surface-50 from-[8%] via-surface-50/95 via-[42%] to-surface-50/20 md:via-[48%] md:to-surface-50/10" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/88 from-0% via-transparent via-35% to-[#e8f4ef]/95" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_70%_45%,transparent_0%,rgba(248,250,252,0.5)_55%,rgba(248,250,252,0.92)_100%)]" />
    </div>
  )
}
