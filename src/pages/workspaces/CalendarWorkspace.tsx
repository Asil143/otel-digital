import { Lock, Megaphone, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { logActivity } from '../../lib/activityLog'
import { useCampaigns } from '../../lib/campaignStore'
import { useCurrentUser } from '../../lib/currentUser'
import { departments } from '../../data/departments'
import { seedKeyDates } from '../../data/offers'
import { usePersistentState } from '../../lib/usePersistentState'
import { formatDate, localDate } from '../../services/campaigns'
import type { CampaignRecord, DepartmentKey, KeyDate } from '../../types/domain'

type Entry =
  | { type: 'date'; date: string; item: KeyDate }
  | { type: 'campaign'; date: string; item: CampaignRecord }

const kinds: KeyDate['kind'][] = ['Event', 'Quiet period', 'Deadline']

function areaName(key: DepartmentKey | 'all'): string {
  return key === 'all' ? 'All areas' : departments.find((department) => department.key === key)?.name ?? key
}

export function CalendarWorkspace() {
  const [keyDates, setKeyDates] = usePersistentState<KeyDate[]>('otel:key-dates', seedKeyDates)
  const { campaigns: allCampaigns } = useCampaigns()
  const { canAccess, isHotelManager, allowedAreas } = useCurrentUser()
  const campaigns = allCampaigns.filter((campaign) => canAccess(campaign.departmentKey))
  const visibleDates = keyDates.filter((date) => date.departmentKey === 'all' || canAccess(date.departmentKey))
  const [draft, setDraft] = useState<Omit<KeyDate, 'id'>>(() => ({ departmentKey: 'all', name: '', date: localDate(), kind: 'Event' }))
  const [error, setError] = useState<string | null>(null)
  const draftArea = isHotelManager ? draft.departmentKey : allowedAreas[0]

  const entries = useMemo(() => {
    const list: Entry[] = [
      ...visibleDates.map((item) => ({ type: 'date' as const, date: item.date, item })),
      ...campaigns.map((item) => ({ type: 'campaign' as const, date: item.startDate, item })),
    ]
    return list.sort((a, b) => a.date.localeCompare(b.date))
  }, [visibleDates, campaigns])

  const grouped = entries.reduce<Record<string, Entry[]>>((groups, entry) => {
    const month = new Date(`${entry.date}T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    groups[month] = [...(groups[month] ?? []), entry]
    return groups
  }, {})

  function addDate() {
    if (!draft.name.trim()) {
      setError('Name the date.')
      return
    }
    setError(null)
    setKeyDates((current) => [...current, { ...draft, departmentKey: draftArea, id: crypto.randomUUID(), name: draft.name.trim() }])
    logActivity('Key date added', `${draft.name.trim()} on ${formatDate(draft.date)} (${areaName(draftArea)}). Recommendations now take it into account.`, 'success', areaName(draftArea))
    setDraft({ ...draft, name: '' })
  }

  return (
    <div className="power-grid">
      <section className="panel span-2">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Planner</p>
            <h2>Key dates and campaign windows</h2>
          </div>
        </div>
        <p className="muted small">Key dates feed the AI recommendations. Campaign windows come from the campaign engine.</p>
        {Object.entries(grouped).map(([month, monthEntries]) => (
          <div className="calendar-month" key={month}>
            <h3>{month}</h3>
            {monthEntries.map((entry) =>
              entry.type === 'date' ? (
                <div className="calendar-row" key={entry.item.id}>
                  <span className="calendar-day">{formatDate(entry.date)}</span>
                  <span>
                    <strong>{entry.item.name}</strong>
                    <em>{areaName(entry.item.departmentKey)}</em>
                  </span>
                  <span className={`kind-chip kind-${entry.item.kind.split(' ')[0].toLowerCase()}`}>{entry.item.kind}</span>
                  {isHotelManager || entry.item.departmentKey !== 'all' ? (
                  <button type="button" aria-label={`Delete ${entry.item.name}`} onClick={() => {
                    setKeyDates((current) => current.filter((item) => item.id !== entry.item.id))
                    logActivity('Key date removed', `${entry.item.name} (${formatDate(entry.item.date)}) was removed from the calendar.`, 'warning', areaName(entry.item.departmentKey))
                  }}>
                    <Trash2 size={14} />
                  </button>
                  ) : (
                    <span className="row-lock" title="Hotel-wide date — managed by the hotel manager"><Lock size={13} /></span>
                  )}
                </div>
              ) : (
                <div className="calendar-row campaign-window" key={entry.item.id}>
                  <span className="calendar-day">{formatDate(entry.date)}</span>
                  <span>
                    <strong><Megaphone size={13} /> {entry.item.name}</strong>
                    <em>{areaName(entry.item.departmentKey)} · until {formatDate(entry.item.endDate)}</em>
                  </span>
                  <span className="kind-chip kind-campaign">{entry.item.status}</span>
                  <span></span>
                </div>
              ),
            )}
          </div>
        ))}
      </section>

      <section className="panel">
        <p className="eyebrow">New key date</p>
        <h2>Add a date</h2>
        <div className="stacked-form">
          <label>
            <span>Name</span>
            <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Christmas market weekend" />
          </label>
          <label>
            <span>Date</span>
            <input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
          </label>
          <label>
            <span>Business area</span>
            <select value={draftArea} disabled={!isHotelManager} onChange={(event) => setDraft({ ...draft, departmentKey: event.target.value as DepartmentKey | 'all' })}>
              {isHotelManager && <option value="all">All areas</option>}
              {departments.filter((department) => canAccess(department.key)).map((department) => (
                <option key={department.key} value={department.key}>{department.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Type</span>
            <select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as KeyDate['kind'] })}>
              {kinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
            </select>
          </label>
          {error && <p className="form-errors" role="alert">{error}</p>}
          <button type="button" className="primary-button" onClick={addDate}>
            <Plus size={15} /> Add date
          </button>
        </div>
      </section>
    </div>
  )
}
