import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ROUTES } from '@/utils/constants'
import '@/styles/publicLanding.css'

const customHeroBg =
  '/@fs/C:/Users/ihzan/.cursor/projects/g-System-bike-00/assets/c__Users_ihzan_AppData_Roaming_Cursor_User_workspaceStorage_8da3a04312d796d9a726238bb194c606_images_image-0ca09c0a-b221-41e9-a3cc-46fca70c4ee4.png'
const r15CardImage =
  'https://www.yamaha-motor-india.com/theme/v4/images/webp_images/r_series_all/r15v4/r15v4-sp.webp?v=50'

const featuredBikes = [
  { name: 'Yamaha R15 V4', tag: 'Sport', price: 'From LKR 1,350,000', image: r15CardImage },
  { name: 'KTM Duke 250', tag: 'Street', price: 'From LKR 1,980,000', image: 'https://www.updatenp.com/wp-content/uploads/2017/06/ktm-duke-250-1024x542.png' },
  {
    name: 'Honda Hornet 2.0',
    tag: 'Commuter',
    price: 'From LKR 1,120,000',
    image: 'https://cdn.prod.website-files.com/619e376b8bd48359093e2b50/6666fc61a15905ac1a65e941_about-image-1.webp',
  },
] as const

const sellingPoints = [
  { t: 'Verified sellers', d: 'Every shop profile is owner-linked and reviewed before listing.' },
  { t: 'Real price ranges', d: 'Transparent tags from budget commuters to premium performance.' },
  { t: 'Service + parts', d: 'Book maintenance and source parts in one connected platform.' },
] as const

const stats = [
  { k: '150+', l: 'Bikes listed' },
  { k: '40+', l: 'Approved shops' },
  { k: '24/7', l: 'Browse anytime' },
] as const

export function PublicIndexPage() {
  const reduce = useReducedMotion()

  return (
    <div className="relative overflow-hidden bg-slate-950">
      <div className="absolute inset-0">
        <img src={customHeroBg} alt="" className="h-full w-full object-cover opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/75 via-slate-950/70 to-slate-950/95" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_0%,rgba(59,130,246,0.25),transparent_60%)]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6 lg:px-10 lg:pt-14">
        <section className="rounded-3xl border border-white/15 bg-white/5 p-6 backdrop-blur-md sm:p-8 lg:p-10">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]"
          >
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-sky-300/35 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-sky-100">
                Professional Bike Marketplace
              </p>
              <h1 className="mt-5 font-display text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
                Buy Your Next
                <span className="block bg-gradient-to-r from-sky-300 via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
                  Dream Bike
                </span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-200 sm:text-lg">
                Explore premium and budget motorcycles from verified sellers, compare specs, book service, and source
                trusted parts - all in one modern buying experience.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to={ROUTES.bikes}
                  className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-400"
                >
                  Browse Bikes
                </Link>
                <Link
                  to={ROUTES.register}
                  className="inline-flex items-center justify-center rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  Create Account
                </Link>
                <Link
                  to={ROUTES.login}
                  className="inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-slate-200 hover:text-white"
                >
                  Login
                </Link>
              </div>

              <div className="mt-8 grid grid-cols-3 gap-3">
                {stats.map((s) => (
                  <div key={s.l} className="rounded-2xl border border-white/15 bg-slate-900/45 p-3">
                    <p className="font-display text-2xl font-bold text-white">{s.k}</p>
                    <p className="text-xs text-slate-300">{s.l}</p>
                  </div>
                ))}
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.55, delay: 0.1 }}
              className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/10 p-4 shadow-2xl"
            >
              <img
                src="https://mototech.ch/media-assets/thumb/images/_imageTextColumnImage/Ducati-Panigale-2024-rot.webp?v=1776771627"
                alt=""
                className="aspect-[4/3] w-full rounded-2xl object-cover"
              />
              <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/20 bg-slate-900/70 p-4 backdrop-blur-md">
                <p className="text-xs uppercase tracking-[0.16em] text-sky-200">Featured this week</p>
                <p className="mt-1 font-display text-xl font-semibold text-white">High-performance picks</p>
                <p className="text-sm text-slate-300">Track-inspired bikes and daily sport rides from approved sellers.</p>
              </div>
            </motion.div>
          </motion.div>
        </section>

        <section className="mt-10">
          <div className="grid gap-4 md:grid-cols-3">
            {sellingPoints.map((p, i) => (
              <motion.article
                key={p.t}
                initial={{ opacity: 0, y: reduce ? 0 : 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-md"
              >
                <h3 className="font-display text-lg font-semibold text-white">{p.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-200">{p.d}</p>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">Featured Bikes</h2>
            <Link to={ROUTES.bikes} className="text-sm font-semibold text-sky-300 hover:text-sky-200">
              View full catalog →
            </Link>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {featuredBikes.map((b, i) => (
              <motion.article
                key={b.name}
                initial={{ opacity: 0, y: reduce ? 0 : 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                className="group overflow-hidden rounded-2xl border border-white/15 bg-slate-900/60 backdrop-blur-md"
              >
                <div className="relative overflow-hidden">
                  <img
                    src={b.image}
                    alt={b.name}
                    className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-slate-950/75 px-3 py-1 text-xs font-semibold text-sky-200">
                    {b.tag}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="font-display text-xl font-semibold text-white">{b.name}</h3>
                  <p className="mt-1 text-sm text-slate-300">{b.price}</p>
                  <div className="mt-4 flex gap-2">
                    <Link
                      to={ROUTES.bikes}
                      className="inline-flex rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-400"
                    >
                      View Details
                    </Link>
                    <Link
                      to={ROUTES.login}
                      className="inline-flex rounded-lg border border-white/25 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
                    >
                      Contact Seller
                    </Link>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-3xl border border-white/15 bg-gradient-to-r from-sky-900/40 to-indigo-900/40 p-6 backdrop-blur-md sm:p-8">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_300px]">
            <div>
              <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">Need service or spare parts too?</h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-200 sm:text-base">
                After choosing your bike, continue with workshop booking and genuine parts from approved shops.
                Keep your ownership journey in one account.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to={ROUTES.register}
                  className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                >
                  Start now
                </Link>
                <Link
                  to={ROUTES.accessories}
                  className="inline-flex items-center justify-center rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/20"
                >
                  Browse parts
                </Link>
              </div>
            </div>
            <div className="rounded-2xl border border-white/20 bg-slate-950/45 p-4">
              <img
                src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSBR8HwFrZKBauJykyajempqj8cqf_TLFu3rw&s"
                alt=""
                className="h-40 w-full rounded-xl object-cover"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
/*
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ROUTES } from '@/utils/constants'
import { cn } from '@/utils/cn'
import { LandingBikeAtmosphere } from '@/components/landing/LandingBikeAtmosphere'
import { LandingHeroBackdrop } from '@/components/landing/LandingHeroBackdrop'
import { landingImages } from '@/data/landingImages'
import '@/styles/publicLanding.css'

const customHeroBg =
  '/@fs/C:/Users/ihzan/.cursor/projects/g-System-bike-00/assets/c__Users_ihzan_AppData_Roaming_Cursor_User_workspaceStorage_8da3a04312d796d9a726238bb194c606_images_image-0ca09c0a-b221-41e9-a3cc-46fca70c4ee4.png'

const heroContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.09, delayChildren: 0.04 },
  },
}

const heroItem = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' as const } },
}

type CardProps = {
  icon: string
  title: string
  body: string
  to: string
  cta: string
  className?: string
  /** Optional full-bleed photo inside the card (bikes / parts). * /
  imageUrl?: string
}

function ExploreCard({ icon, title, body, to, cta, className, imageUrl }: CardProps) {
  return (
    <Link
      to={to}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border border-surface-200 bg-white p-6 shadow-sm transition',
        'hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
        className,
      )}
    >
      {imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt=""
            className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover opacity-[0.18] transition duration-500 group-hover:scale-105 group-hover:opacity-[0.28]"
            style={{ objectPosition: '62% center' }}
            loading="lazy"
            decoding="async"
          />
          <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-br from-white/96 via-white/90 to-white/97" />
        </>
      ) : null}
      <span className="relative z-10 text-3xl" aria-hidden>
        {icon}
      </span>
      <h3 className="relative z-10 mt-4 font-display text-lg font-bold text-surface-900">{title}</h3>
      <p className="relative z-10 mt-2 flex-1 text-sm leading-relaxed text-surface-800">{body}</p>
      <span className="relative z-10 mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
        {cta}
        <span className="transition group-hover:translate-x-0.5" aria-hidden>
          →
        </span>
      </span>
    </Link>
  )
}

const steps = [
  { n: '1', title: 'Pick a path', body: 'Shop bikes and parts, or jump straight into booking a service slot.' },
  { n: '2', title: 'Choose a shop', body: 'Listings come from verified owners so you know who you are dealing with.' },
  { n: '3', title: 'Stay in control', body: 'Sign in to track bookings, messages, and your profile in one place.' },
] as const

const exploreCards: CardProps[] = [
  {
    icon: '🛠️',
    title: 'Book a service',
    body: 'Find a slot, share your bike details, and keep the conversation in one thread.',
    to: ROUTES.register,
    cta: 'Get started',
  },
  {
    icon: '🏍️',
    title: 'Shop bikes',
    body: 'Compare models, prices, and photos from partner sale shops in a clean grid.',
    to: ROUTES.bikes,
    cta: 'View bikes',
    className: 'ring-1 ring-brand-100/80',
    imageUrl: landingImages.exploreBikes,
  },
  {
    icon: '🧩',
    title: 'Spare parts & gear',
    body: 'Helmets, locks, lights, and consumables — filter by category and budget.',
    to: ROUTES.accessories,
    cta: 'Browse parts',
    imageUrl: landingImages.exploreParts,
  },
]

const trustPills = [
  'Verified sellers',
  'Price transparency',
  'Island-wide support',
  'Fast service booking',
] as const

const featuredHighlights = [
  {
    kpi: '150+',
    title: 'Bikes in catalog',
    body: 'From commuter daily rides to premium performance machines.',
    tone: 'from-brand-600/15 via-white to-white',
  },
  {
    kpi: '40+',
    title: 'Partner workshops',
    body: 'Trusted service points with owner-managed schedules and updates.',
    tone: 'from-emerald-500/15 via-white to-white',
  },
  {
    kpi: '24/7',
    title: 'Anytime browsing',
    body: 'Compare listings, check specs, and plan bookings at your convenience.',
    tone: 'from-amber-500/15 via-white to-white',
  },
] as const

const brandRow = ['Yamaha', 'Honda', 'KTM', 'Bajaj', 'TVS', 'Suzuki', 'Hero', 'Aprilia'] as const

const testimonials = [
  {
    quote: 'Booked service in minutes and got updates without chasing calls.',
    name: 'Kasun M.',
    role: 'Daily rider · Colombo',
  },
  {
    quote: 'Comparing bikes and checking parts from one place saved me a lot of time.',
    name: 'Shenali P.',
    role: 'Buyer · Batticaloa',
  },
  {
    quote: 'The shop listings feel more trustworthy than random marketplace posts.',
    name: 'Arun K.',
    role: 'Enthusiast · Kandy',
  },
] as const

function LandingBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-gradient-to-b from-surface-100 via-surface-50 to-[#eef8f3]" />
      <LandingHeroBackdrop />
      <div className="absolute inset-0 bg-gradient-to-br from-white/50 via-transparent to-brand-50/55" />
      <LandingBikeAtmosphere />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_65%_at_50%_-15%,var(--color-brand-100),transparent_55%)]" />
      <div className="absolute -left-[20%] top-[8%] h-[min(520px,55vw)] w-[min(520px,55vw)] rounded-full bg-[radial-gradient(circle,var(--color-brand-200)_0%,transparent_68%)] opacity-50 blur-2xl sm:-left-[10%]" />
      <div className="absolute -right-[15%] top-[20%] h-[min(480px,50vw)] w-[min(480px,50vw)] rounded-full bg-[radial-gradient(circle,var(--color-brand-300)_0%,transparent_65%)] opacity-35 blur-3xl" />
      <div className="absolute bottom-[-8%] left-1/2 h-72 w-[min(110%,900px)] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,var(--color-brand-100)_0%,transparent_70%)] opacity-60 blur-2xl" />
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-surface-100/80 via-transparent to-transparent" />
      <svg className="absolute inset-0 h-full w-full text-slate-900/[0.055]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="public-landing-dots" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.15" fill="currentColor" />
          </pattern>
          <pattern id="public-landing-grid" width="56" height="56" patternUnits="userSpaceOnUse">
            <path
              d="M56 0H0V56"
              fill="none"
              stroke="rgb(15 23 42 / 0.045)"
              strokeWidth="0.75"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#public-landing-dots)" />
        <rect width="100%" height="100%" fill="url(#public-landing-grid)" />
      </svg>
      <div className="absolute -right-1/4 top-0 h-full w-1/2 skew-x-[-12deg] bg-gradient-to-l from-white/25 via-transparent to-transparent" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-300/50 to-transparent" />
    </div>
  )
}

const viewAnim = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-48px' },
  transition: { duration: 0.5, ease: 'easeOut' as const },
}

/** Public landing at `/` — marketing-style hero, explore cards, and clear auth CTAs. * /
export function PublicIndexPage() {
  const reduce = useReducedMotion()

  return (
    <div className="relative overflow-hidden">
      <LandingBackground />

      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14 lg:pb-28 lg:pt-16">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[2rem]" aria-hidden>
          <img src={customHeroBg} alt="" className="h-full w-full object-cover opacity-[0.28]" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/55 via-white/58 to-white/62" />
        </div>
        <section
          className={cn(
            'relative isolate overflow-hidden rounded-3xl border border-surface-200/70',
            'bg-surface-50/30 py-10 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.12)] ring-1 ring-white/70',
            'sm:py-12 lg:py-14',
          )}
        >
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-3xl" aria-hidden>
            <img
              src={customHeroBg}
              alt=""
              className="absolute inset-0 h-full min-h-[100%] w-full object-cover sm:min-h-[480px]"
              style={{ objectPosition: '58% 42%' }}
              width={2200}
              height={1238}
              loading="eager"
              decoding="async"
              fetchPriority="high"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-white from-[0%] via-white/88 via-[42%] to-white/20 lg:via-[48%] lg:to-white/15" />
            <div className="absolute inset-0 bg-gradient-to-b from-white/75 via-transparent to-brand-50/45" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_65%_at_12%_35%,rgba(255,255,255,0.97)_0%,transparent_58%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_50%_at_100%_20%,transparent_0%,rgba(248,250,252,0.4)_100%)]" />
          </div>

          <div className="relative z-[1] grid items-center gap-12 px-4 sm:px-6 lg:px-10">
          <motion.div variants={heroContainer} initial="hidden" animate="visible">
            <motion.p
              variants={heroItem}
              className="inline-flex items-center gap-2 rounded-full border border-brand-200/80 bg-brand-50/90 px-3 py-1 text-xs font-semibold text-brand-900"
            >
              <span className="bb-landing-pulse-dot h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
              Service & marketplace · Sri Lanka
            </motion.p>
            <motion.h1
              variants={heroItem}
              className="mt-5 font-display text-4xl font-bold leading-[1.1] tracking-tight text-surface-900 sm:text-5xl lg:text-[3.25rem]"
            >
              Ride more.
              <motion.span
                className="block text-brand-700"
                initial={{ opacity: 0, x: reduce ? 0 : -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35, duration: 0.5, ease: 'easeOut' }}
              >
                Worry less.
              </motion.span>
            </motion.h1>
            <motion.p
              variants={heroItem}
              className="mt-5 max-w-xl text-base leading-relaxed text-surface-800 sm:text-lg"
            >
              <span className="font-semibold text-surface-900">BikeHub</span> connects you with verified workshops and
              sellers — book service, compare bikes, and grab spare parts without the runaround.
            </motion.p>

            <motion.div variants={heroItem} className="mt-8 flex flex-wrap items-center gap-3">
              <motion.span
                className="inline-flex"
                whileHover={reduce ? undefined : { scale: 1.03 }}
                whileTap={reduce ? undefined : { scale: 0.98 }}
              >
                <Link
                  to={ROUTES.register}
                  className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  Create free account
                </Link>
              </motion.span>
              <motion.span
                className="inline-flex"
                whileHover={reduce ? undefined : { scale: 1.02 }}
                whileTap={reduce ? undefined : { scale: 0.98 }}
              >
                <Link
                  to={ROUTES.bikes}
                  className="inline-flex items-center justify-center rounded-xl border border-surface-200 bg-white px-6 py-3 text-sm font-semibold text-surface-900 shadow-sm transition hover:border-brand-200 hover:bg-brand-50/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  Browse catalog
                </Link>
              </motion.span>
              <Link
                to={ROUTES.login}
                className="inline-flex items-center justify-center px-4 py-3 text-sm font-semibold text-surface-800 underline-offset-4 hover:text-brand-800 hover:underline"
              >
                Log in
              </Link>
            </motion.div>

            <motion.div variants={heroItem} className="mt-6 flex flex-wrap gap-2">
              {trustPills.map((pill) => (
                <span
                  key={pill}
                  className="inline-flex items-center rounded-full border border-surface-200/80 bg-white/80 px-3 py-1 text-xs font-semibold text-surface-800 shadow-[0_6px_18px_-14px_rgba(15,23,42,0.45)] backdrop-blur"
                >
                  {pill}
                </span>
              ))}
            </motion.div>

            <motion.dl
              variants={heroItem}
              className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-surface-200/80 pt-8 sm:gap-6"
            >
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.4 }}
              >
                <dt className="text-xs font-medium uppercase tracking-wide text-surface-800">Verified focus</dt>
                <dd className="mt-1 font-display text-xl font-bold text-surface-900 sm:text-2xl">Shops</dd>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.62, duration: 0.4 }}
              >
                <dt className="text-xs font-medium uppercase tracking-wide text-surface-800">One account</dt>
                <dd className="mt-1 font-display text-xl font-bold text-surface-900 sm:text-2xl">Bookings</dd>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.69, duration: 0.4 }}
              >
                <dt className="text-xs font-medium uppercase tracking-wide text-surface-800">Always open</dt>
                <dd className="mt-1 font-display text-xl font-bold text-surface-900 sm:text-2xl">24/7</dd>
              </motion.div>
            </motion.dl>
          </motion.div>

          </div>
        </section>

        <motion.section
          className="mt-10"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.45 }}
          aria-label="Platform highlights"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredHighlights.map((h, i) => (
              <motion.article
                key={h.title}
                className={cn(
                  'rounded-2xl border border-surface-200 bg-gradient-to-br p-5 shadow-sm',
                  h.tone,
                )}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <p className="font-display text-3xl font-bold text-surface-900">{h.kpi}</p>
                <h3 className="mt-2 font-display text-lg font-semibold text-surface-900">{h.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-surface-800">{h.body}</p>
              </motion.article>
            ))}
          </div>
        </motion.section>

        <motion.section
          className="mt-8 overflow-hidden rounded-2xl border border-surface-200/80 bg-white/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          aria-label="Featured brands"
        >
          <div className="bb-brand-marquee">
            {[...brandRow, ...brandRow].map((b, i) => (
              <span key={`${b}-${i}`} className="bb-brand-chip">
                {b}
              </span>
            ))}
          </div>
        </motion.section>

        <motion.section
          className="mt-20 lg:mt-28"
          aria-labelledby="explore-heading"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.45 }}
        >
          <motion.div {...viewAnim} transition={{ ...viewAnim.transition, delay: 0 }}>
            <h2 id="explore-heading" className="font-display text-2xl font-bold text-surface-900 sm:text-3xl">
              Explore the marketplace
            </h2>
            <p className="mt-2 text-surface-800">
              Start with what you need today — every link keeps you on trusted, owner-listed inventory.
            </p>
          </motion.div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {exploreCards.map((c, i) => (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, delay: 0.08 * i, ease: 'easeOut' }}
              >
                <ExploreCard {...c} />
              </motion.div>
            ))}
          </div>
        </motion.section>

        <motion.section
          className="mt-20 rounded-3xl border border-surface-200 bg-white/80 p-8 shadow-sm backdrop-blur-sm sm:p-10 lg:mt-24"
          aria-labelledby="steps-heading"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.55 }}
        >
          <h2 id="steps-heading" className="font-display text-2xl font-bold text-surface-900 sm:text-3xl">
            How it works
          </h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-6">
            {steps.map((s, i) => (
              <motion.li
                key={s.n}
                className="relative flex gap-4 sm:block sm:pt-2"
                initial={{ opacity: 0, x: reduce ? 0 : -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ duration: 0.45, delay: 0.1 * i }}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-600 font-display text-sm font-bold text-white shadow-sm sm:mb-4">
                  {s.n}
                </span>
                <div>
                  <h3 className="font-display font-semibold text-surface-900">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-surface-800">{s.body}</p>
                </div>
              </motion.li>
            ))}
          </ol>
        </motion.section>

        <motion.section
          className="mt-16 lg:mt-20"
          aria-labelledby="reviews-heading"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5 }}
        >
          <h2 id="reviews-heading" className="font-display text-2xl font-bold text-surface-900 sm:text-3xl">
            Riders love the experience
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t, i) => (
              <motion.article
                key={t.name}
                className="rounded-2xl border border-surface-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
              >
                <p className="text-sm leading-relaxed text-surface-800">“{t.quote}”</p>
                <p className="mt-4 font-semibold text-surface-900">{t.name}</p>
                <p className="text-xs text-surface-800">{t.role}</p>
              </motion.article>
            ))}
          </div>
        </motion.section>

        <motion.section
          className="mt-16 lg:mt-20"
          aria-label="Get started"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.55 }}
        >
          <div className="relative overflow-hidden rounded-3xl bg-surface-900 px-6 py-10 text-center sm:px-10 sm:py-14">
            <img
              src={landingImages.ctaBand}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.22] sm:opacity-[0.26]"
              style={{ objectPosition: '55% 40%' }}
              loading="lazy"
              decoding="async"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-surface-900 from-0% via-surface-900/88 via-45% to-surface-900/95" />
            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-brand-500/25 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-brand-400/20 blur-3xl" />
            <h2 className="relative font-display text-2xl font-bold text-white sm:text-3xl">Ready when you are</h2>
            <p className="relative mx-auto mt-3 max-w-lg text-sm text-surface-100 sm:text-base">
              Create an account to book service from your dashboard, or browse bikes and parts first — no pressure.
            </p>
            <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
              <motion.span whileHover={reduce ? undefined : { scale: 1.04 }} whileTap={reduce ? undefined : { scale: 0.98 }}>
                <Link
                  to={ROUTES.register}
                  className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-semibold text-surface-900 shadow-sm transition hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Register free
                </Link>
              </motion.span>
              <motion.span whileHover={reduce ? undefined : { scale: 1.03 }} whileTap={reduce ? undefined : { scale: 0.98 }}>
                <Link
                  to={ROUTES.bikes}
                  className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Browse bikes
                </Link>
              </motion.span>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  )
}
*/
