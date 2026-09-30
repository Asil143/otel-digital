import type { ActivityEvent } from '../types/activity'
import { readStored, usePersistentState, writeStored } from './usePersistentState'

export const ACTIVITY_KEY = 'otel:activity-log'
const MAX_EVENTS = 50

export function logActivity(title: string, detail: string, tone: ActivityEvent['tone'] = 'info', area?: string) {
  const event: ActivityEvent = { id: crypto.randomUUID(), title, detail, tone, area, at: new Date().toISOString() }
  writeStored(ACTIVITY_KEY, [event, ...readStored<ActivityEvent[]>(ACTIVITY_KEY, [])].slice(0, MAX_EVENTS))
}

export function recordActivity(event: ActivityEvent) {
  logActivity(event.title, event.detail, event.tone, event.area)
}

export function useActivityLog() {
  const [events, setEvents] = usePersistentState<ActivityEvent[]>(ACTIVITY_KEY, [])
  return { events, clear: () => setEvents([]) }
}

export function timeAgo(iso?: string): string {
  if (!iso) return ''
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}
