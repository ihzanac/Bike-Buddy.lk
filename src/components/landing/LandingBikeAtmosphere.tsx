import { motion, useReducedMotion } from 'framer-motion'
import { landingImages } from '@/data/landingImages'

/** Extra framed bike layers — complements `LandingHeroBackdrop`, keeps motion subtle. */
const ACCENTS = [
  {
    src: landingImages.accentA,
    className:
      'right-[-8%] top-[14%] w-[min(48vw,580px)] max-w-[600px] aspect-[5/4] opacity-[0.2] sm:opacity-[0.26]',
    duration: 18,
    y: [-6, 8, -6],
    x: [0, 5, 0],
    scale: [1, 1.02, 1],
  },
  {
    src: landingImages.accentB,
    className:
      'left-[-14%] bottom-[4%] w-[min(44vw,480px)] max-w-[500px] aspect-[4/3] opacity-[0.14] sm:opacity-[0.2]',
    duration: 22,
    y: [5, -8, 5],
    x: [0, -6, 0],
    scale: [1, 1.03, 1],
  },
]

export function LandingBikeAtmosphere() {
  const reduce = useReducedMotion()

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {ACCENTS.map((layer, i) => (
        <motion.div
          key={layer.src}
          className={`absolute ${layer.className} overflow-hidden rounded-[2rem] border border-white/40 shadow-[0_28px_90px_-24px_rgba(15,23,42,0.35)] ring-1 ring-black/5`}
          initial={false}
          animate={
            reduce
              ? { y: 0, x: 0, scale: 1 }
              : {
                  y: layer.y,
                  x: layer.x,
                  scale: layer.scale,
                }
          }
          transition={
            reduce
              ? { duration: 0 }
              : {
                  duration: layer.duration,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 1.4,
                }
          }
        >
          <img
            src={layer.src}
            alt=""
            className="h-full w-full object-cover"
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={i === 0 ? 'high' : 'low'}
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-surface-50/75 via-transparent to-brand-50/30" />
        </motion.div>
      ))}
    </div>
  )
}
