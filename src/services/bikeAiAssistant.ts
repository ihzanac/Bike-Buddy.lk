import type { AdminBike } from '@/data/adminBikeSaleData'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-pro'
const FALLBACK_MODELS = ['gemini-1.5-flash', 'gemini-1.5-flash-8b']
let discoveredModels: string[] | null = null

type ShopLite = {
  name: string
  location?: string
}

export type ExternalResource = {
  title: string
  url: string
  source: 'google' | 'youtube' | 'images'
  thumbnailUrl?: string
}

export type ExternalResourceBundle = {
  query: string
  items: ExternalResource[]
}

function bikeSummary(b: AdminBike): string {
  const specs = b.specs.map((s) => `${s.label}: ${s.value}`).join(', ')
  return `${b.name} | Price: ${b.price} | ${specs}`
}

function uniqueUrls(urls: string[]): string[] {
  return Array.from(new Set(urls))
}

function parseUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)"'<>]+/g) ?? []
  return uniqueUrls(matches.map((u) => u.replace(/[),.;]+$/, '')))
}

function isLikelyGoogleContentLink(url: string): boolean {
  if (/google\./i.test(url) || /youtube\.com|youtu\.be/i.test(url)) return false
  return /^https?:\/\//i.test(url)
}

function normalizeYoutubeWatchUrl(url: string): string | null {
  const m1 = url.match(/https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([\w-]{6,})/i)
  if (m1) return `https://www.youtube.com/watch?v=${m1[1]}`
  const m2 = url.match(/https?:\/\/youtu\.be\/([\w-]{6,})/i)
  if (m2) return `https://www.youtube.com/watch?v=${m2[1]}`
  return null
}

function youtubeThumb(url: string): string | undefined {
  const m = url.match(/[?&]v=([\w-]{6,})/)
  if (!m) return undefined
  return `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg`
}

async function fetchGoogleStyleSnippet(query: string): Promise<string> {
  try {
    const res = await fetch(`https://r.jina.ai/http://www.google.com/search?q=${encodeURIComponent(query)}`)
    if (!res.ok) return ''
    const text = await res.text()
    return text.slice(0, 1400)
  } catch {
    return ''
  }
}

async function fetchYouTubeStyleSnippet(query: string): Promise<string> {
  try {
    const res = await fetch(
      `https://r.jina.ai/http://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    )
    if (!res.ok) return ''
    const text = await res.text()
    return text.slice(0, 1400)
  } catch {
    return ''
  }
}

async function fetchWebContext(queries: string[]): Promise<string> {
  const chunks = await Promise.all(
    queries.flatMap((q) => [fetchGoogleStyleSnippet(q), fetchYouTubeStyleSnippet(`${q} review`)]) ,
  )
  const labeled = chunks
    .filter(Boolean)
    .map((chunk, i) => `${i % 2 === 0 ? '[Google]' : '[YouTube]'}\n${chunk}`)
  return labeled.join('\n\n---\n\n').slice(0, 6500)
}

export async function fetchExternalBikeResources(query: string): Promise<ExternalResourceBundle> {
  const googleText = await fetchGoogleStyleSnippet(query)
  const youtubeText = await fetchYouTubeStyleSnippet(`${query} review`)

  const googleLinks = parseUrls(googleText).filter(isLikelyGoogleContentLink).slice(0, 4)
  const youtubeLinks = parseUrls(youtubeText)
    .map((u) => normalizeYoutubeWatchUrl(u))
    .filter((u): u is string => Boolean(u))
    .slice(0, 4)

  const items: ExternalResource[] = [
    ...googleLinks.map((url, i) => ({
      title: `Google Result ${i + 1}`,
      url,
      source: 'google' as const,
    })),
    ...youtubeLinks.map((url, i) => ({
      title: `YouTube Video ${i + 1}`,
      url,
      source: 'youtube' as const,
      thumbnailUrl: youtubeThumb(url),
    })),
    {
      title: 'Google Images',
      url: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`,
      source: 'images',
    },
  ]

  return { query, items }
}

function getTextFromGemini(raw: string): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Gemini returned invalid response.')
  }
  const text =
    typeof parsed === 'object' &&
    parsed &&
    'candidates' in parsed &&
    Array.isArray((parsed as { candidates?: unknown[] }).candidates)
      ? (((parsed as { candidates: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates[0]
          ?.content?.parts?.[0]?.text ??
          '') as string)
      : ''
  if (!text.trim()) throw new Error('Gemini returned empty response.')
  return text.trim()
}

async function runGemini(prompt: string, temperature = 0.35, maxOutputTokens = 1100): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key missing. Set VITE_GEMINI_API_KEY in .env and restart dev server.')
  }

  if (!discoveredModels) {
    try {
      const listRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      )
      if (listRes.ok) {
        const listRaw = await listRes.text()
        const parsed = JSON.parse(listRaw) as {
          models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>
        }
        discoveredModels =
          parsed.models
            ?.filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
            .map((m) => (m.name ?? '').replace(/^models\//, ''))
            .filter(Boolean) ?? []
      } else {
        discoveredModels = []
      }
    } catch {
      discoveredModels = []
    }
  }

  const candidatesFromApi = discoveredModels.filter((m) => /gemini/i.test(m))
  const tried = [
    GEMINI_MODEL,
    ...FALLBACK_MODELS,
    ...candidatesFromApi,
    'gemini-2.0-flash',
    'gemini-1.5-flash-latest',
  ].filter((m, i, arr) => Boolean(m) && arr.indexOf(m) === i)
  let lastError = ''

  for (const model of tried) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature, maxOutputTokens },
      }),
    })
    const raw = await res.text()
    if (res.ok) {
      return getTextFromGemini(raw)
    }
    lastError = `Model ${model} failed (${res.status}): ${raw.slice(0, 160)}`
    // If model is not found/unsupported, try fallback model automatically.
    if (res.status === 404) continue
    // For non-404 errors, still allow trying fallbacks once, then fail.
  }

  throw new Error(lastError || 'Gemini request failed for all configured models.')
}

export async function compareTwoBikesWithAi(params: {
  bikeA: AdminBike
  bikeB: AdminBike
  allBikes?: AdminBike[]
  shop?: ShopLite | null
}): Promise<string> {
  const { bikeA, bikeB, allBikes = [], shop } = params
  const webContext = await fetchWebContext([
    `${bikeA.name} vs ${bikeB.name} specs mileage top speed`,
    `${bikeA.name} common issues maintenance`,
    `${bikeB.name} common issues maintenance`,
  ])
  const shopLine = shop ? `${shop.name}${shop.location ? ` (${shop.location})` : ''}` : 'Selected shop not available'
  const catalogContext = allBikes.length
    ? `Catalog shortlist in this shop:\n${allBikes.map((b) => `- ${bikeSummary(b)}`).join('\n')}`
    : 'Catalog shortlist unavailable.'

  const prompt = [
    'You are a motorcycle comparison expert for Sri Lanka buyers.',
    `Compare these two bikes in detail:`,
    `Bike A: ${bikeSummary(bikeA)}`,
    `Bike B: ${bikeSummary(bikeB)}`,
    `Shop context: ${shopLine}`,
    catalogContext,
    'Use this external web-style snippet as extra context when useful (it can be noisy; verify logically):',
    'Sources include Google search snippets and YouTube search results for real-world owner/reviewer context.',
    webContext || '[No web snippet available]',
    'Output format:',
    '1) Quick winner by use-case (city, highway, budget, performance)',
    '2) Detailed side-by-side comparison table in markdown-like plain text',
    '3) Ownership cost notes (fuel, service, parts)',
    '4) Final recommendation with 3 clear buyer profiles + confidence notes',
    'Keep answer concise but specific; avoid fake certainty if unknown.',
  ].join('\n')
  return runGemini(prompt, 0.35, 1200)
}

export async function askBikeAssistant(params: {
  question: string
  bikes: AdminBike[]
  shop?: ShopLite | null
}): Promise<string> {
  const { question, bikes, shop } = params
  const q = question.trim()
  if (!q) throw new Error('Question is empty.')
  const webContext = await fetchWebContext([`${q} motorcycle sri lanka`, `${q} bike comparison`])
  const catalog = bikes.map((b) => `- ${bikeSummary(b)}`).join('\n')
  const prompt = [
    'You are an advanced motorcycle buying assistant.',
    `User question: ${q}`,
    `Shop context: ${shop ? `${shop.name}${shop.location ? ` (${shop.location})` : ''}` : 'N/A'}`,
    `Available bikes in the current UI:\n${catalog || '[none]'}`,
    'External search snippets (use cautiously):',
    'Sources include Google search snippets and YouTube search results.',
    webContext || '[No external snippets]',
    'Respond with:',
    '- direct answer',
    '- shortlist recommendation (if relevant)',
    '- clear next step for buyer',
  ].join('\n')
  return runGemini(prompt, 0.4, 1000)
}

export async function rankBestValueBikes(params: {
  bikes: AdminBike[]
  budgetLkr?: number
  shop?: ShopLite | null
}): Promise<string> {
  const { bikes, budgetLkr, shop } = params
  const filtered = typeof budgetLkr === 'number' ? bikes.filter((b) => b.priceN <= budgetLkr) : bikes
  if (filtered.length === 0) {
    return 'No bikes match that budget in the current shop. Try increasing budget or selecting another shop.'
  }
  const prompt = [
    'Rank bikes by overall value for money for Sri Lanka buyer.',
    `Budget: ${typeof budgetLkr === 'number' ? `LKR ${budgetLkr.toLocaleString('en-LK')}` : 'No budget cap'}`,
    `Shop: ${shop ? shop.name : 'N/A'}`,
    'Bikes:',
    filtered.map((b) => `- ${bikeSummary(b)}`).join('\n'),
    'Output:',
    '1) Top 3 ranking',
    '2) Why each ranked',
    '3) Who should buy each',
  ].join('\n')
  return runGemini(prompt, 0.3, 850)
}
