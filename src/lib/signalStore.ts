import { departments } from '../data/departments'
import type { SignalRecord, SignalSourceType } from '../types/domain'
import { usePersistentState } from './usePersistentState'

const DAY = 86_400_000
const seededAt = Date.now()

function sourceTypeFor(summary: string): SignalSourceType {
  if (/screenshot|export|report|pdf|log/i.test(summary)) return 'file_upload'
  if (/trading update|notes/i.test(summary)) return 'quick_update'
  return 'file_upload'
}

// One confirmed update per area backs the freshness and KPIs shown on first load.
export const seedSignals: SignalRecord[] = departments.map((department) => ({
  id: `seed-${department.key}`,
  departmentKey: department.key,
  sourceType: department.signalState === 'Approximate' ? 'adaptive_check_in' : sourceTypeFor(department.signal),
  summary: department.signal,
  fields: Object.fromEntries(department.metrics.map((metric) => [metric.label, metric.value])),
  confidence: department.recommendation.confidence,
  state: department.signalState === 'Detected' ? 'Detected' : 'Confirmed',
  createdAt: new Date(seededAt - department.signalAgeDays * DAY).toISOString(),
}))

export function useSignals() {
  return usePersistentState<SignalRecord[]>('otel:signals', seedSignals)
}

export function isSeedSignal(signal: SignalRecord | null | undefined): boolean {
  return Boolean(signal?.id.startsWith('seed-'))
}

// True when confirmed data has arrived after the recommendation was last made.
export function hasNewerData(latest: SignalRecord | null | undefined, recommendedAt?: string): boolean {
  if (!latest || latest.state !== 'Confirmed' || isSeedSignal(latest)) return false
  return !recommendedAt || latest.createdAt > recommendedAt
}
