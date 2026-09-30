import { ArrowRight, CalendarPlus, CheckCircle2, ChevronLeft, ChevronRight, Globe2, LayoutGrid, List, Lock, Mail, MessageSquareText, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import type { AppRoute } from '../../config/routes'
import { departments } from '../../data/departments'
import { seedKeyDates } from '../../data/offers'
import { logActivity } from '../../lib/activityLog'
import { campaignSends, coveringCampaigns, covers, dateRange, daysBetween, lastDay, planningGaps, relativeDay, unapprovedFor, type Send, type SendChannel } from '../../lib/calendar'
import { useCampaigns } from '../../lib/campaignStore'
import { useCurrentUser } from '../../lib/currentUser'
import { usePersistentState } from '../../lib/usePersistentState'
import { addDays, formatDate, localDate } from '../../services/campaigns'
import type { CampaignRecord, CampaignStage, DepartmentKey, KeyDate } from '../../types/domain'

const kinds: KeyDate['kind'][] = ['Event', 'Quiet period', 'Deadline']
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const sendIcon: Record<SendChannel, typeof Mail> = { Email: Mail, Reminder: Mail, Social: MessageSquareText, Website: Globe2 }
type Layer = 'Key dates' | 'Sends' | 'Campaign windows'
const layers: Layer[] = ['Key dates', 'Sends', 'Campaign windows']

const areaName = (key: DepartmentKey | 'all') => (key === 'all' ? 'All areas' : departments.find((department) => department.key === key)?.name ?? key)
const kindClass = (kind: KeyDate['kind']) => `kind-chip kind-${kind.split(' ')[0].toLowerCase()}`
const statusClass = (status: string) => `campaign-status-chip status-${status.toLowerCase().replace(/\s+/g, '-')}`
const monthLabel = (month: string) => new Date(`${month}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
const longDay = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

function shiftMonth(month: string, delta: number): string {
  const date = new Date(`${month}-01T12:00:00`)
  return localDate(new Date(date.getFullYear(), date.getMonth() + delta, 1)).slice(0, 7)
}

function monthGrid(month: string): string[] {
  const first = new Date(`${month}-01T12:00:00`)
  const offset = (first.getDay() + 6) % 7 // Monday first
  const start = addDays(`${month}-01`, -offset)
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7
  return Array.from({ length: cells }, (_, index) => addDays(start, index))
}

type Draft = { id: string | null; name: string; kind: KeyDate['kind']; departmentKey: DepartmentKey | 'all'; date: string; endDate: string }

export function CalendarWorkspace({
  onOpenCampaign,
  onCreateCampaign,
  onNavigate,
}: {
  onOpenCampaign: (campaign: CampaignRecord, stage?: CampaignStage) => void
  onCreateCampaign: (departmentKey: DepartmentKey, keyDateId?: string) => void
  onNavigate: (route: AppRoute) => void
}) {
  const [keyDates, setKeyDates] = usePersistentState<KeyDate[]>('otel:key-dates', seedKeyDates)
  const { campaigns: allCampaigns } = useCampaigns()
  const { canAccess, isHotelManager, allowedAreas } = useCurrentUser()
  const [today] = useState(() => localDate())
  const [view, setView] = usePersistentState<'month' | 'agenda'>('otel:calendar-view', 'month')
  const [month, setMonth] = useState(() => today.slice(0, 7))
  const [selectedDay, setSelectedDay] = useState(today)
  const [areaFilter, setAreaFilter] = useState<DepartmentKey | 'all'>('all')
  const [hidden, setHidden] = useState<Layer[]>([])
  const [showPast, setShowPast] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [pendingDelete, setPendingDelete] = useState<KeyDate | null>(null)

  // ---------- Scope ----------
  const inArea = (key: DepartmentKey | 'all') => (key === 'all' ? true : canAccess(key) && (areaFilter === 'all' || key === areaFilter))
  const myDates = keyDates.filter((date) => inArea(date.departmentKey))
  const campaigns = allCampaigns.filter((campaign) => inArea(campaign.departmentKey))
  const sends = campaigns.flatMap((campaign) => campaignSends(campaign, today))
  const show = (layer: Layer) => !hidden.includes(layer)
  const canEdit = (date: KeyDate) => isHotelManager || (date.departmentKey !== 'all' && canAccess(date.departmentKey))

  // ---------- Summary ----------
  const in30 = addDays(today, 30)
  const upcomingDates = myDates.filter((date) => lastDay(date) >= today && date.date <= in30).sort((a, b) => a.date.localeCompare(b.date))
  const nextDate = upcomingDates.find((date) => date.date >= today) ?? upcomingDates[0]
  const sends14 = sends.filter((send) => send.date >= today && send.date <= addDays(today, 14))
  const gaps = planningGaps(myDates, campaigns, today)
  const deadlines = myDates.filter((date) => date.kind === 'Deadline' && date.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  const nextDeadline = deadlines[0]
  const atRiskDeadlines = deadlines
    .filter((date) => daysBetween(today, date.date) <= 14)
    .map((date) => ({ date, unapproved: unapprovedFor(date, campaigns) }))
    .filter((entry) => entry.unapproved.length > 0)

  // ---------- Per-day lookups ----------
  const datesOn = (day: string) => myDates.filter((date) => covers(date.date, lastDay(date), day))
  const sendsOn = (day: string) => sends.filter((send) => send.date === day)
  const runningOn = (day: string) => campaigns.filter((campaign) => covers(campaign.startDate, campaign.endDate, day))

  // ---------- Key date form ----------
  function openForm(date?: KeyDate, day?: string) {
    setErrors([])
    setDraft(
      date
        ? { id: date.id, name: date.name, kind: date.kind, departmentKey: date.departmentKey, date: date.date, endDate: date.endDate ?? '' }
        : { id: null, name: '', kind: 'Event', departmentKey: isHotelManager ? (areaFilter === 'all' ? 'all' : areaFilter) : allowedAreas[0], date: day && day >= today ? day : today, endDate: '' },
    )
  }

  function saveDraft(current: Draft) {
    const problems: string[] = []
    const name = current.name.trim()
    if (!name) problems.push('Name the date.')
    if (!current.date) problems.push('Choose a date.')
    if (!current.id && current.date < today) problems.push('Pick today or a later date — past dates don’t affect recommendations.')
    if (current.endDate && current.endDate < current.date) problems.push('The end date must be on or after the start date.')
    if (keyDates.some((date) => date.id !== current.id && date.name.toLowerCase() === name.toLowerCase() && date.date === current.date)) problems.push('That date is already on the calendar.')
    setErrors(problems)
    if (problems.length) return
    const area = isHotelManager ? current.departmentKey : allowedAreas[0]
    const record: KeyDate = {
      id: current.id ?? crypto.randomUUID(),
      name,
      kind: current.kind,
      departmentKey: area,
      date: current.date,
      ...(current.endDate && current.endDate !== current.date && current.kind !== 'Deadline' ? { endDate: current.endDate } : {}),
    }
    if (current.id) {
      setKeyDates((list) => list.map((date) => (date.id === current.id ? record : date)))
      logActivity('Key date updated', `${name} · ${dateRange(record)} (${areaName(area)}).`, 'info', areaName(area))
    } else {
      setKeyDates((list) => [...list, record])
      logActivity('Key date added', `${name} · ${dateRange(record)} (${areaName(area)}). Recommendations now take it into account.`, 'success', areaName(area))
    }
    setSelectedDay(record.date)
    setMonth(record.date.slice(0, 7))
    setDraft(null)
  }

  function confirmDelete(date: KeyDate) {
    setKeyDates((list) => list.filter((item) => item.id !== date.id))
    logActivity('Key date removed', `${date.name} (${dateRange(date)}) was removed. Recommendations stop using it.`, 'warning', areaName(date.departmentKey))
    setPendingDelete(null)
  }

  function goTo(day: string) {
    setSelectedDay(day)
    setMonth(day.slice(0, 7))
    setView('month')
  }

  const attention = [
    ...atRiskDeadlines.map(({ date, unapproved }) => ({
      key: date.id,
      tag: 'Deadline',
      tone: 'warning' as const,
      title: `${date.name} ${relativeDay(date.date, today).toLowerCase()}`,
      detail: `Not approved yet: ${unapproved.map((campaign) => `${campaign.name} (${campaign.status.toLowerCase()})`).join(', ')}.`,
      label: 'Go to campaigns',
      run: () => onNavigate('campaigns'),
    })),
    ...gaps.map((date) => ({
      key: date.id,
      tag: 'No campaign',
      tone: 'info' as const,
      title: `${date.name} · ${dateRange(date)}`,
      detail: `${areaName(date.departmentKey)} — nothing is planned for this ${date.kind.toLowerCase()} yet. The AI already factors it into recommendations.`,
      label: date.departmentKey !== 'all' && canAccess(date.departmentKey) ? 'Create campaign' : 'View day',
      run: () => (date.departmentKey !== 'all' && canAccess(date.departmentKey) ? onCreateCampaign(date.departmentKey, date.id) : goTo(date.date)),
    })),
  ]

  // ---------- Agenda ----------
  type AgendaEntry = { key: string; date: string; kind: 'date'; item: KeyDate } | { key: string; date: string; kind: 'send'; item: Send } | { key: string; date: string; kind: 'window'; item: CampaignRecord; edge: 'starts' | 'ends' }
  const agenda: AgendaEntry[] = [
    ...(show('Key dates') ? myDates.map((item) => ({ key: item.id, date: item.date, kind: 'date' as const, item })) : []),
    ...(show('Sends') ? sends.map((item) => ({ key: item.id, date: item.date, kind: 'send' as const, item })) : []),
    ...(show('Campaign windows')
      ? campaigns.flatMap((item) => [
          { key: `${item.id}-start`, date: item.startDate, kind: 'window' as const, item, edge: 'starts' as const },
          { key: `${item.id}-end`, date: item.endDate, kind: 'window' as const, item, edge: 'ends' as const },
        ])
      : []),
  ]
    .filter((entry) => showPast || (entry.kind === 'date' ? lastDay(entry.item) >= today : entry.date >= today))
    .sort((a, b) => a.date.localeCompare(b.date))
  const agendaByMonth = agenda.reduce<Record<string, AgendaEntry[]>>((groups, entry) => {
    const key = entry.date.slice(0, 7)
    groups[key] = [...(groups[key] ?? []), entry]
    return groups
  }, {})

  return (
    <>
      <section className="results-overview">
        <div>
          <span>Key dates · 30 days</span>
          <strong>{upcomingDates.length}</strong>
          <em>{nextDate ? `next: ${nextDate.name} · ${relativeDay(nextDate.date, today).toLowerCase()}` : 'none coming up'}</em>
        </div>
        <div>
          <span>Sends · 14 days</span>
          <strong>{sends14.length}</strong>
          <em>
            {sends14.filter((send) => send.state !== 'planned').length} scheduled · {sends14.filter((send) => send.state === 'planned').length} awaiting approval
          </em>
        </div>
        <div className={gaps.length ? 'tile-warning' : ''}>
          <span>Needs a plan</span>
          <strong>{gaps.length}</strong>
          <em>events and quiet periods with no campaign</em>
        </div>
        <div className={atRiskDeadlines.length ? 'tile-warning' : ''}>
          <span>Next deadline</span>
          <strong>{nextDeadline ? relativeDay(nextDeadline.date, today) : 'None'}</strong>
          <em>{nextDeadline ? nextDeadline.name : 'no deadlines set'}</em>
        </div>
      </section>

      <section className="panel campaign-queue">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Planning checks</p>
            <h2>Needs a plan</h2>
          </div>
          <span className="muted small">Upcoming events and quiet periods (next 60 days) with no campaign, and deadlines with campaigns still unapproved.</span>
        </div>
        {attention.length === 0 ? (
          <p className="queue-empty">
            <CheckCircle2 size={16} /> Every upcoming event and quiet period has a campaign, and no deadline is at risk.
          </p>
        ) : (
          <ul className="queue-list">
            {attention.map((item) => (
              <li key={item.key}>
                <span className={`attention-tag tone-${item.tone}`}>{item.tag}</span>
                <span className="queue-text">
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </span>
                <button type="button" className={item.label === 'Create campaign' ? 'primary-button small' : 'secondary-button small'} onClick={item.run}>
                  {item.label} <ArrowRight size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="power-grid">
        <section className="panel span-2 calendar-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Planner</p>
              <h2>{view === 'month' ? monthLabel(month) : 'Coming up'}</h2>
            </div>
            <div className="campaign-toolbar-actions">
              {view === 'month' && (
                <div className="month-nav">
                  <button type="button" className="icon-button" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>
                    <ChevronLeft size={16} />
                  </button>
                  <button type="button" className="secondary-button small" onClick={() => goTo(today)}>
                    Today
                  </button>
                  <button type="button" className="icon-button" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
              <div className="view-toggle" role="group" aria-label="View">
                <button type="button" className={view === 'month' ? 'selected' : ''} aria-pressed={view === 'month'} onClick={() => setView('month')}>
                  <LayoutGrid size={14} /> Month
                </button>
                <button type="button" className={view === 'agenda' ? 'selected' : ''} aria-pressed={view === 'agenda'} onClick={() => setView('agenda')}>
                  <List size={14} /> Agenda
                </button>
              </div>
              <button type="button" className="primary-button small" onClick={() => openForm(undefined, view === 'month' ? selectedDay : undefined)}>
                <Plus size={14} /> Add key date
              </button>
            </div>
          </div>

          <div className="campaign-toolbar">
            {isHotelManager && (
              <select className="filter-select" aria-label="Filter calendar by business area" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value as DepartmentKey | 'all')}>
                <option value="all">All business areas</option>
                {departments.map((department) => (
                  <option key={department.key} value={department.key}>
                    {department.name}
                  </option>
                ))}
              </select>
            )}
            <div className="layer-toggles" role="group" aria-label="Show on calendar">
              {layers.map((layer) => (
                <button
                  type="button"
                  key={layer}
                  className={show(layer) ? 'selected' : ''}
                  aria-pressed={show(layer)}
                  onClick={() => setHidden((current) => (current.includes(layer) ? current.filter((item) => item !== layer) : [...current, layer]))}
                >
                  <span className={`layer-dot layer-${layer.split(' ')[0].toLowerCase()}`} /> {layer}
                </button>
              ))}
            </div>
            {view === 'agenda' && (
              <label className="inline-check">
                <input type="checkbox" checked={showPast} onChange={(event) => setShowPast(event.target.checked)} /> Show past
              </label>
            )}
          </div>

          {view === 'month' ? (
            <div className="month-grid" role="grid" aria-label={monthLabel(month)}>
              {weekdays.map((day) => (
                <span className="month-weekday" key={day}>
                  {day}
                </span>
              ))}
              {monthGrid(month).map((day) => {
                const dates = show('Key dates') ? datesOn(day) : []
                const quiet = dates.some((date) => date.kind === 'Quiet period')
                const items: { key: string; className: string; text: string; title: string }[] = [
                  ...dates
                    .filter((date) => date.date === day || (day.endsWith('-01') || new Date(`${day}T12:00:00`).getDay() === 1))
                    .map((date) => ({
                      key: date.id,
                      className: `cal-item kd-${date.kind.split(' ')[0].toLowerCase()}${date.date === day ? '' : ' continued'}`,
                      text: date.date === day ? date.name : `… ${date.name}`,
                      title: `${date.kind}: ${date.name} · ${dateRange(date)} · ${areaName(date.departmentKey)}`,
                    })),
                  ...(show('Campaign windows')
                    ? campaigns
                        .filter((campaign) => campaign.startDate === day || campaign.endDate === day)
                        .map((campaign) => ({
                          key: `${campaign.id}-${campaign.startDate === day ? 's' : 'e'}`,
                          className: 'cal-item window',
                          text: `${campaign.startDate === day ? '▸' : '▪'} ${campaign.name}${campaign.startDate === day ? '' : ' ends'}`,
                          title: `${campaign.name} ${campaign.startDate === day ? 'starts' : 'ends'} · ${campaign.status}`,
                        }))
                    : []),
                  ...(() => {
                    const daySends = show('Sends') ? sendsOn(day) : []
                    if (daySends.length === 0) return []
                    // One chip per day: cells are too narrow for a line per send. The day panel lists them.
                    const state = daySends.every((send) => send.state === 'sent') ? 'sent' : daySends.some((send) => send.state === 'planned') ? 'planned' : 'scheduled'
                    return [
                      {
                        key: `${day}-sends`,
                        className: `cal-item send send-${state}`,
                        text: `✉ ${daySends.length} send${daySends.length === 1 ? '' : 's'}`,
                        title: daySends.map((send) => `${send.label} · ${send.campaign.name} (${send.state})`).join('\n'),
                      },
                    ]
                  })(),
                ]
                const outside = !day.startsWith(month)
                return (
                  <button
                    type="button"
                    key={day}
                    role="gridcell"
                    className={`month-day ${outside ? 'outside' : ''} ${day === today ? 'today' : ''} ${day === selectedDay ? 'selected' : ''} ${quiet ? 'quiet' : ''} ${day < today ? 'past' : ''}`}
                    aria-label={`${longDay(day)}${items.length ? `, ${items.length} item${items.length === 1 ? '' : 's'}` : ''}`}
                    aria-selected={day === selectedDay}
                    onClick={() => setSelectedDay(day)}
                  >
                    <span className="month-day-number">{Number(day.slice(8))}</span>
                    {items.slice(0, 3).map((item) => (
                      <span key={item.key} className={item.className} title={item.title}>
                        <span className="cal-text">{item.text}</span>
                      </span>
                    ))}
                    {items.length > 3 && <span className="cal-more">+{items.length - 3} more</span>}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="agenda">
              {Object.keys(agendaByMonth).length === 0 && <div className="contact-table-empty">Nothing coming up with these filters.</div>}
              {Object.entries(agendaByMonth).map(([key, entries]) => (
                <div className="calendar-month" key={key}>
                  <h3>{monthLabel(key)}</h3>
                  {entries.map((entry) => {
                    if (entry.kind === 'date') {
                      const date = entry.item
                      const covering = coveringCampaigns(date, campaigns)
                      return (
                        <div className={`calendar-row ${lastDay(date) < today ? 'past' : ''}`} key={entry.key}>
                          <span className="calendar-day">
                            {formatDate(date.date)}
                            <small>{relativeDay(date.date, today)}</small>
                          </span>
                          <span>
                            <strong>{date.name}</strong>
                            <em>
                              {areaName(date.departmentKey)}
                              {date.endDate ? ` · until ${formatDate(date.endDate)}` : ''}
                              {date.kind !== 'Deadline' && (covering.length ? ` · covered by ${covering.map((campaign) => campaign.name).join(', ')}` : ' · no campaign yet')}
                            </em>
                          </span>
                          <span className={kindClass(date.kind)}>{date.kind}</span>
                          <KeyDateActions date={date} canEdit={canEdit(date)} onEdit={() => openForm(date)} onDelete={() => setPendingDelete(date)} />
                        </div>
                      )
                    }
                    if (entry.kind === 'send') {
                      const send = entry.item
                      const Icon = sendIcon[send.channel]
                      return (
                        <button type="button" className="calendar-row send-row" key={entry.key} onClick={() => onOpenCampaign(send.campaign, send.stage)}>
                          <span className="calendar-day">
                            {formatDate(send.date)}
                            <small>{relativeDay(send.date, today)}</small>
                          </span>
                          <span>
                            <strong>
                              <Icon size={13} /> {send.label}
                            </strong>
                            <em>
                              {areaName(send.campaign.departmentKey)} · {send.campaign.name}
                            </em>
                          </span>
                          <span className={`send-state send-${send.state}`}>{send.state === 'planned' ? 'Awaiting approval' : send.state === 'scheduled' ? 'Scheduled' : 'Sent'}</span>
                          <ArrowRight size={14} className="row-arrow" />
                        </button>
                      )
                    }
                    const campaign = entry.item
                    return (
                      <button type="button" className="calendar-row campaign-window" key={entry.key} onClick={() => onOpenCampaign(campaign, entry.edge === 'ends' ? 'Results' : 'Strategy')}>
                        <span className="calendar-day">
                          {formatDate(entry.date)}
                          <small>{relativeDay(entry.date, today)}</small>
                        </span>
                        <span>
                          <strong>
                            {campaign.name} {entry.edge}
                          </strong>
                          <em>
                            {areaName(campaign.departmentKey)} · {formatDate(campaign.startDate)} – {formatDate(campaign.endDate)}
                          </em>
                        </span>
                        <span className={statusClass(campaign.status)}>{campaign.status}</span>
                        <ArrowRight size={14} className="row-arrow" />
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel day-detail">
          <p className="eyebrow">{relativeDay(selectedDay, today)}</p>
          <h2>{longDay(selectedDay)}</h2>

          {(() => {
            const dates = datesOn(selectedDay)
            const daySends = sendsOn(selectedDay)
            const running = runningOn(selectedDay)
            const empty = dates.length === 0 && daySends.length === 0 && running.length === 0
            return (
              <>
                {empty && <p className="muted small">Nothing on this day{areaFilter !== 'all' ? ` for ${areaName(areaFilter)}` : ''}.</p>}
                {dates.length > 0 && (
                  <div className="detail-section">
                    <h3>
                      Key dates <span>{dates.length}</span>
                    </h3>
                    {dates.map((date) => {
                      const covering = coveringCampaigns(date, campaigns)
                      const unapproved = date.kind === 'Deadline' ? unapprovedFor(date, campaigns) : []
                      return (
                        <div className="day-date" key={date.id}>
                          <div className="day-date-head">
                            <span className={kindClass(date.kind)}>{date.kind}</span>
                            <KeyDateActions date={date} canEdit={canEdit(date)} onEdit={() => openForm(date)} onDelete={() => setPendingDelete(date)} />
                          </div>
                          <strong>{date.name}</strong>
                          <small>
                            {areaName(date.departmentKey)} · {dateRange(date)}
                          </small>
                          {date.kind === 'Deadline' ? (
                            <p className={unapproved.length ? 'offer-warning' : 'muted small'}>
                              {unapproved.length ? `Not approved yet: ${unapproved.map((campaign) => campaign.name).join(', ')}` : 'Every campaign due by this date is approved.'}
                            </p>
                          ) : covering.length ? (
                            <p className="muted small">Covered by {covering.map((campaign) => `${campaign.name} (${campaign.status.toLowerCase()})`).join(', ')}</p>
                          ) : (
                            <p className="offer-warning">No campaign planned for it yet.</p>
                          )}
                          {date.kind !== 'Deadline' && covering.length === 0 && date.departmentKey !== 'all' && canAccess(date.departmentKey) && (
                            <button type="button" className="secondary-button small" onClick={() => onCreateCampaign(date.departmentKey as DepartmentKey, date.id)}>
                              <CalendarPlus size={14} /> Create campaign for it
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                {daySends.length > 0 && (
                  <div className="detail-section">
                    <h3>
                      Going out <span>{daySends.length}</span>
                    </h3>
                    {daySends.map((send) => {
                      const Icon = sendIcon[send.channel]
                      return (
                        <button type="button" className="day-send" key={send.id} onClick={() => onOpenCampaign(send.campaign, send.stage)}>
                          <Icon size={14} />
                          <span>
                            <strong>{send.label}</strong>
                            <small>{send.campaign.name}</small>
                          </span>
                          <span className={`send-state send-${send.state}`}>{send.state === 'planned' ? 'Awaiting approval' : send.state === 'scheduled' ? 'Scheduled' : 'Sent'}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
                {running.length > 0 && (
                  <div className="detail-section">
                    <h3>
                      Campaigns running <span>{running.length}</span>
                    </h3>
                    <div className="segment-campaigns">
                      {running.map((campaign) => (
                        <button type="button" key={campaign.id} className="used-chip" onClick={() => onOpenCampaign(campaign, 'Strategy')}>
                          <span className={statusClass(campaign.status)}>{campaign.status}</span>
                          <strong>{campaign.name}</strong>
                          <ArrowRight size={13} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <button type="button" className="ghost-link" onClick={() => openForm(undefined, selectedDay)} disabled={selectedDay < today}>
                  <Plus size={13} /> {selectedDay < today ? 'Past day — key dates can’t be added' : 'Add a key date on this day'}
                </button>
              </>
            )
          })()}
        </section>
      </div>

      {draft && (
        <Modal title={draft.id ? 'Edit key date' : 'Add a key date'} onClose={() => setDraft(null)}>
          <p className="muted small">Key dates feed the AI recommendations for the business area, and show up here next to campaign sends.</p>
          <div className="stacked-form key-date-form">
            <label>
              <span>Name</span>
              <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Christmas market weekend" autoFocus />
            </label>
            <label>
              <span>Type</span>
              <select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as KeyDate['kind'] })}>
                {kinds.map((kind) => (
                  <option key={kind}>{kind}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Business area</span>
              <select value={isHotelManager ? draft.departmentKey : allowedAreas[0]} disabled={!isHotelManager} onChange={(event) => setDraft({ ...draft, departmentKey: event.target.value as DepartmentKey | 'all' })}>
                {isHotelManager && <option value="all">All areas (hotel-wide)</option>}
                {departments
                  .filter((department) => canAccess(department.key))
                  .map((department) => (
                    <option key={department.key} value={department.key}>
                      {department.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className="two-up">
              <label>
                <span>{draft.kind === 'Deadline' ? 'Date' : 'Starts'}</span>
                <input type="date" value={draft.date} min={draft.id ? undefined : today} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
              </label>
              {draft.kind !== 'Deadline' && (
                <label>
                  <span>Ends (optional)</span>
                  <input type="date" value={draft.endDate} min={draft.date} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} />
                </label>
              )}
            </div>
            {errors.length > 0 && (
              <ul className="form-errors" role="alert">
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )}
            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={() => saveDraft(draft)}>
                {draft.id ? 'Save changes' : 'Add date'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {pendingDelete && (
        <Modal title="Remove this key date?" onClose={() => setPendingDelete(null)}>
          <p>
            <strong>{pendingDelete.name}</strong> ({dateRange(pendingDelete)}, {areaName(pendingDelete.departmentKey)}) will be removed. Recommendations stop taking it into account.
          </p>
          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={() => setPendingDelete(null)}>
              Keep it
            </button>
            <button type="button" className="primary-button danger" onClick={() => confirmDelete(pendingDelete)}>
              <Trash2 size={14} /> Remove
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

function KeyDateActions({ date, canEdit, onEdit, onDelete }: { date: KeyDate; canEdit: boolean; onEdit: () => void; onDelete: () => void }) {
  if (!canEdit) {
    return (
      <span className="row-lock" title="Hotel-wide date — managed by the hotel manager">
        <Lock size={13} />
      </span>
    )
  }
  return (
    <span className="key-date-actions">
      <button type="button" aria-label={`Edit ${date.name}`} onClick={onEdit}>
        <Pencil size={13} />
      </button>
      <button type="button" aria-label={`Delete ${date.name}`} onClick={onDelete}>
        <Trash2 size={13} />
      </button>
    </span>
  )
}
