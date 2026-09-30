import type { Confidence, Department, SignalRecord, SourceState } from '../types/domain'

export const STALE_AFTER_DAYS = 14

export type Freshness = {
  state: SourceState
  ageDays: number
  latestSignal: SignalRecord | null
}

export function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
}

export function ageLabel(days: number): string {
  if (days === 0) return 'updated today'
  if (days === 1) return 'updated yesterday'
  return `updated ${days} days ago`
}

export function signalsFor(departmentKey: Department['key'], signals: SignalRecord[]): SignalRecord[] {
  return signals
    .filter((signal) => signal.departmentKey === departmentKey)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function resolveFreshness(department: Department, signals: SignalRecord[]): Freshness {
  const latest = signalsFor(department.key, signals)[0] ?? null
  if (!latest) {
    return { state: department.signalState, ageDays: department.signalAgeDays, latestSignal: null }
  }
  const ageDays = daysSince(latest.createdAt)
  const state: SourceState =
    latest.state === 'Detected'
      ? 'Detected'
      : ageDays > STALE_AFTER_DAYS
        ? 'Stale'
        : latest.sourceType === 'adaptive_check_in'
          ? 'Approximate'
          : 'Confirmed'
  return { state, ageDays, latestSignal: latest }
}

export function needsCheckIn(freshness: Freshness): boolean {
  return freshness.state === 'Stale' || freshness.state === 'Unavailable'
}

const rank: Record<Confidence, number> = { Low: 0, Medium: 1, High: 2 }

export function cappedConfidence(confidence: Confidence, state: SourceState): Confidence {
  const ceiling: Record<SourceState, Confidence> = {
    Confirmed: 'High',
    Approximate: 'Medium',
    Detected: 'Medium',
    Stale: 'Low',
    Unavailable: 'Low',
  }
  return rank[confidence] > rank[ceiling[state]] ? ceiling[state] : confidence
}
