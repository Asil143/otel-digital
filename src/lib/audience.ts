import { segmentCatalogue, seedContacts, type SegmentDef } from '../data/contacts'
import { departments } from '../data/departments'
import type { Contact, ConsentPermission, DepartmentKey } from '../types/domain'
import { usePersistentState } from './usePersistentState'

export const CONTACTS_KEY = 'otel:contacts-v2'
export const UNASSIGNED = 'Unassigned'
export const LOW_CONSENT = 0.5

export function useContacts() {
  return usePersistentState<Contact[]>(CONTACTS_KEY, seedContacts)
}

/** Can this contact receive marketing right now? */
export function reachable(contact: Pick<Contact, 'permission' | 'suppressed'>): boolean {
  return contact.permission === 'Subscribed' && !contact.suppressed
}

export type SegmentStats = SegmentDef & {
  areas: DepartmentKey[]
  /** Guests who can be sent marketing: consented and not suppressed. */
  consented: number
  rate: number
  records: Contact[]
  unknown: number
}

const seedById = new Map(seedContacts.map((contact) => [contact.id, contact]))

export function areasForSegment(name: string): DepartmentKey[] {
  return departments.filter((department) => department.audience.includes(name)).map((department) => department.key)
}

/**
 * Segment sizes = the synced list size, adjusted by what changed in the individual
 * records on this device (imports, consent confirmed or withdrawn, suppressions).
 */
export function segmentStats(contacts: Contact[]): SegmentStats[] {
  const byId = new Map(contacts.map((contact) => [contact.id, contact]))
  return segmentCatalogue.map((def) => {
    const records = contacts.filter((contact) => contact.segment === def.name)
    let total = def.total
    let consented = def.consented
    for (const contact of records) {
      const seed = seedById.get(contact.id)
      if (!seed || seed.segment !== def.name) {
        total += 1
        consented += Number(reachable(contact))
      } else {
        consented += Number(reachable(contact)) - Number(reachable(seed))
      }
    }
    for (const seed of seedContacts) {
      if (seed.segment !== def.name) continue
      const now = byId.get(seed.id)
      if (!now || now.segment !== def.name) {
        total -= 1
        consented -= Number(reachable(seed))
      }
    }
    consented = Math.max(0, Math.min(total, consented))
    return {
      ...def,
      total,
      consented,
      rate: total ? consented / total : 0,
      areas: areasForSegment(def.name),
      records,
      unknown: records.filter((contact) => contact.permission === 'Unknown' && !contact.suppressed).length,
    }
  })
}

export function statsFor(name: string, stats: SegmentStats[]): SegmentStats | undefined {
  return stats.find((item) => item.name === name)
}

/** Guests a campaign can actually reach: consented, not suppressed, summed over its segments. */
export function eligibleFor(audience: string[], stats: SegmentStats[]): number {
  return audience.reduce((sum, name) => sum + (statsFor(name, stats)?.consented ?? 0), 0)
}

// ---------- CSV ----------

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(cell.trim())
      cell = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(cell.trim())
      if (row.some((value) => value !== '')) rows.push(row)
      row = []
      cell = ''
    } else cell += char
  }
  row.push(cell.trim())
  if (row.some((value) => value !== '')) rows.push(row)
  return rows
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const text = value == null ? '' : String(value)
          return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
        })
        .join(','),
    )
    .join('\n')
}

export const csvTemplate = toCsv([
  ['name', 'email', 'segment', 'consent', 'consent_basis', 'last_activity', 'guest_value'],
  ['Alex Morgan', 'alex.morgan@example.com', 'Past spa guests', 'yes', 'Opted in at booking', '2026-08-14', '240'],
  ['Sam Reid', 'sam.reid@example.com', 'Local diners within 15 miles', '', '', '', ''],
])

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function readConsent(value: string | undefined): ConsentPermission {
  const text = (value ?? '').trim().toLowerCase()
  if (['yes', 'y', 'true', '1', 'subscribed', 'opted in', 'opt-in', 'consented'].includes(text)) return 'Subscribed'
  if (['no', 'n', 'false', '0', 'unsubscribed', 'opted out', 'opt-out'].includes(text)) return 'Unsubscribed'
  return 'Unknown'
}

export type ImportPreview = {
  fileName: string
  ready: Contact[]
  duplicates: string[]
  invalid: { line: number; reason: string }[]
  unassigned: number
  hasConsentColumn: boolean
  missingColumns: string[]
}

export function previewImport(fileName: string, text: string, existing: Contact[], today: string): ImportPreview {
  const [header = [], ...rows] = parseCsv(text)
  const columns = header.map((col) => col.toLowerCase().replace(/\s+/g, '_'))
  const col = (...names: string[]) => columns.findIndex((name) => names.includes(name))
  const nameAt = col('name', 'full_name', 'guest')
  const emailAt = col('email', 'email_address')
  const segmentAt = col('segment', 'audience', 'list')
  const consentAt = col('consent', 'permission', 'marketing_consent', 'opt_in')
  const basisAt = col('consent_basis', 'basis', 'consent_source')
  const activityAt = col('last_activity', 'last_stay', 'last_visit')
  const valueAt = col('guest_value', 'value', 'spend')
  const missingColumns = [emailAt < 0 && 'email', nameAt < 0 && 'name'].filter(Boolean) as string[]

  const known = new Set(existing.map((contact) => contact.email.toLowerCase()))
  const segmentNames = new Map(segmentCatalogue.map((def) => [def.name.toLowerCase(), def.name]))
  const ready: Contact[] = []
  const duplicates: string[] = []
  const invalid: ImportPreview['invalid'] = []

  if (emailAt < 0) return { fileName, ready, duplicates, invalid, unassigned: 0, hasConsentColumn: consentAt >= 0, missingColumns }

  rows.forEach((cells, index) => {
    const line = index + 2
    const email = (cells[emailAt] ?? '').toLowerCase()
    if (!email) return invalid.push({ line, reason: 'No email address' })
    if (!EMAIL.test(email)) return invalid.push({ line, reason: `“${cells[emailAt]}” isn’t a valid email` })
    if (known.has(email)) return duplicates.push(email)
    known.add(email)
    const permission = consentAt >= 0 ? readConsent(cells[consentAt]) : 'Unknown'
    const segment = segmentNames.get((cells[segmentAt] ?? '').toLowerCase()) ?? UNASSIGNED
    const activity = cells[activityAt] ?? ''
    const value = Number((cells[valueAt] ?? '').replace(/[£,]/g, ''))
    ready.push({
      id: `imp-${crypto.randomUUID().slice(0, 8)}`,
      name: (nameAt >= 0 && cells[nameAt]) || email.split('@')[0],
      email,
      segment,
      lastActivity: /^\d{4}-\d{2}-\d{2}$/.test(activity) ? activity : null,
      permission,
      consentBasis: permission === 'Subscribed' ? (basisAt >= 0 && cells[basisAt]) || 'Imported opt-in (as supplied)' : null,
      guestValue: Number.isFinite(value) ? value : 0,
      addedAt: today,
    })
  })

  return {
    fileName,
    ready,
    duplicates,
    invalid,
    unassigned: ready.filter((contact) => contact.segment === UNASSIGNED).length,
    hasConsentColumn: consentAt >= 0,
    missingColumns,
  }
}
