import type { ActivityEvent } from '../types/activity'
import { demoUsers } from './currentUser'
import { readStored, usePersistentState, writeStored } from './usePersistentState'

/** The dashboard feed: recent events, and the hotel manager can clear it. */
export const ACTIVITY_KEY = 'otel:activity-log'
/** The audit trail: append-only, never cleared from the UI. */
export const AUDIT_KEY = 'otel:audit-log'
const MAX_EVENTS = 50
const MAX_AUDIT = 1000

// History behind the demo data, so the audit trail isn't empty on a fresh visit.
export const seedAudit: ActivityEvent[] = [
  { id: 'audit-seed-11', title: 'Asset submitted', detail: 'Beach Club summer reel is waiting for the hotel manager to approve.', tone: 'info', area: 'Beach Club', actor: 'Noah Fischer', at: '2026-09-27T16:30:00' },
  { id: 'audit-seed-10', title: 'Campaign live', detail: 'Midweek Getaway went live on email, social and website.', tone: 'success', area: 'Rooms', actor: 'System', at: '2026-09-26T08:00:00' },
  { id: 'audit-seed-09', title: 'Asset submitted', detail: 'Wedding brochure is waiting for the hotel manager to approve.', tone: 'info', area: 'Events & Weddings', actor: 'Priya Anand', at: '2026-09-25T10:15:00' },
  { id: 'audit-seed-08', title: 'Campaign scheduled', detail: 'Midweek Getaway will go out 26 Sept, 08:00.', tone: 'success', area: 'Rooms', actor: 'Hannah Smith', at: '2026-09-24T10:20:00' },
  { id: 'audit-seed-07', title: 'Campaign approved', detail: 'Midweek Getaway: designs, socials, emails and website approved.', tone: 'success', area: 'Rooms', actor: 'Hannah Smith', at: '2026-09-24T10:05:00' },
  { id: 'audit-seed-06', title: 'Sent for approval', detail: 'Midweek Spa Escape is with the hotel manager for review.', tone: 'success', area: 'Spa & Wellness', actor: 'Sarah Mitchell', at: '2026-09-23T14:35:00' },
  { id: 'audit-seed-05', title: 'Sent for approval', detail: 'Midweek Getaway is with the hotel manager for review.', tone: 'success', area: 'Rooms', actor: 'James Carter', at: '2026-09-23T14:30:00' },
  { id: 'audit-seed-04', title: 'Campaign created', detail: 'Midweek Getaway, Midweek Spa Escape, 1961 Tuesday and the spring weddings campaign created from AI recommendations.', tone: 'success', area: 'Hotel-wide', actor: 'Hannah Smith', at: '2026-09-22T09:10:00' },
  { id: 'audit-seed-03', title: 'Asset added', detail: 'Spa treatment price list added to the approved library.', tone: 'success', area: 'Spa & Wellness', actor: 'Sarah Mitchell', at: '2026-09-12T09:05:00' },
  { id: 'audit-seed-02', title: 'Hotel rule added', detail: 'Run one offer per business area at a time.', tone: 'info', area: 'Hotel-wide', actor: 'Hannah Smith', at: '2026-09-01T09:05:00' },
  { id: 'audit-seed-01', title: 'Brand assets locked', detail: 'Logo pack, brand image library and both templates locked for brand consistency.', tone: 'info', area: 'Hotel-wide', actor: 'Hannah Smith', at: '2026-09-01T09:00:00' },
]

function currentActor(): string {
  const id = readStored<string>('otel:current-user', 'hotel-manager')
  return demoUsers.find((user) => user.id === id)?.name ?? 'Unknown user'
}

export function logActivity(title: string, detail: string, tone: ActivityEvent['tone'] = 'info', area?: string) {
  const event: ActivityEvent = { id: crypto.randomUUID(), title, detail, tone, area, at: new Date().toISOString(), actor: currentActor() }
  writeStored(ACTIVITY_KEY, [event, ...readStored<ActivityEvent[]>(ACTIVITY_KEY, [])].slice(0, MAX_EVENTS))
  writeStored(AUDIT_KEY, [event, ...readStored<ActivityEvent[]>(AUDIT_KEY, seedAudit)].slice(0, MAX_AUDIT))
}

export function recordActivity(event: ActivityEvent) {
  logActivity(event.title, event.detail, event.tone, event.area)
}

export function useActivityLog() {
  const [events, setEvents] = usePersistentState<ActivityEvent[]>(ACTIVITY_KEY, [])
  // Clearing the feed never touches the audit trail.
  return { events, clear: () => setEvents([]) }
}

export function useAuditLog() {
  const [events] = usePersistentState<ActivityEvent[]>(AUDIT_KEY, seedAudit)
  return events
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
