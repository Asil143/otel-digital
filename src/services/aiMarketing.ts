import type { Department, Recommendation } from '../types/domain'

export type UpdateMyAiInput = {
  hotelId: string
  businessArea: Department['key']
  message: string
  sourceType: 'quick_update' | 'file_upload' | 'forwarded_email' | 'adaptive_check_in'
}

export type StructuredSignal = {
  summary: string
  extractedFields: Record<string, string | number | boolean>
  confidence: 'High' | 'Medium' | 'Low'
  requiresConfirmation: boolean
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

function fallbackSignal(input: UpdateMyAiInput): StructuredSignal {
  return {
    summary: input.message,
    extractedFields: {
      business_area: input.businessArea,
      source_type: input.sourceType,
    },
    confidence: 'Medium',
    requiresConfirmation: true,
  }
}

export async function structureBusinessSignal(input: UpdateMyAiInput): Promise<StructuredSignal> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/structure-signal`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!response.ok) throw new Error(`AI server responded ${response.status}`)
    return (await response.json()) as StructuredSignal
  } catch (error) {
    console.warn('Falling back to local signal structuring:', error)
    return fallbackSignal(input)
  }
}

export type NextRecommendation = {
  whatWorked: string
  nextRecommendation: string
}

export type ResultsSummary = {
  campaignName: string
  status: string
  unit: string
  bookings: number
  revenue: number
  openRate: number | null
  bestChannel: string | null
  audience: string[]
}

export async function generateNextRecommendation(
  department: Department,
  summary: ResultsSummary,
): Promise<NextRecommendation & { live: boolean }> {
  const fallback: NextRecommendation = {
    whatWorked: summary.bestChannel
      ? `${summary.campaignName} has ${Math.round(summary.bookings)} ${summary.unit} so far, led by ${summary.bestChannel.toLowerCase()}.`
      : `${summary.campaignName} has ${Math.round(summary.bookings)} ${summary.unit} so far.`,
    nextRecommendation: summary.audience.length
      ? `Follow up ${summary.audience[0].toLowerCase()} who clicked but didn't book, then repeat the offer with a new creative angle next period.`
      : 'Choose a consented audience and repeat the best-performing channel next period.',
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/next-recommendation`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ department: department.name, offer: department.offer, ...summary }),
    })
    if (!response.ok) throw new Error(`AI server responded ${response.status}`)
    return { ...((await response.json()) as NextRecommendation), live: true }
  } catch (error) {
    console.warn('Falling back to local next-recommendation:', error)
    return { ...fallback, live: false }
  }
}

export type RecommendationContext = {
  sourceState: string
  latestUpdate: string | null
  activeOffers: string[]
  upcomingDates: string[]
  hotelRules: string[]
}

const outcomes: Recommendation['outcome'][] = ['Campaign', 'Corporate action', 'OTA/distribution review', 'Monitor only', 'Revenue review']
const levels = ['High', 'Medium', 'Low'] as const

function mergeRecommendation(fallback: Recommendation, candidate: Partial<Recommendation>): Recommendation {
  const stringList = (value: unknown, backup: string[]) =>
    Array.isArray(value) && value.every((item) => typeof item === 'string') && value.length > 0 ? value : backup
  return {
    title: typeof candidate.title === 'string' && candidate.title ? candidate.title : fallback.title,
    summary: typeof candidate.summary === 'string' && candidate.summary ? candidate.summary : fallback.summary,
    confidence: levels.includes(candidate.confidence as never) ? (candidate.confidence as Recommendation['confidence']) : fallback.confidence,
    priority: levels.includes(candidate.priority as never) ? (candidate.priority as Recommendation['priority']) : fallback.priority,
    outcome: outcomes.includes(candidate.outcome as never) ? (candidate.outcome as Recommendation['outcome']) : fallback.outcome,
    reasons: stringList(candidate.reasons, fallback.reasons),
    avoid: stringList(candidate.avoid, fallback.avoid),
    alternatives: stringList(candidate.alternatives, fallback.alternatives),
  }
}

export async function generateRecommendation(
  department: Department,
  context: RecommendationContext,
): Promise<{ recommendation: Recommendation; live: boolean }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/recommendation`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        department: department.name,
        offer: department.offer,
        metrics: department.metrics,
        signal: department.signal,
        ...context,
        currentRecommendation: department.recommendation.title,
      }),
    })
    if (!response.ok) throw new Error(`AI server responded ${response.status}`)
    return { recommendation: mergeRecommendation(department.recommendation, (await response.json()) as Partial<Recommendation>), live: true }
  } catch (error) {
    console.warn('Falling back to seeded recommendation:', error)
    return { recommendation: department.recommendation, live: false }
  }
}
