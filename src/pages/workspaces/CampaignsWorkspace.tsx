import { AlertTriangle, ArrowRight, Check, CheckCircle2, Copy, Globe2, LayoutGrid, Mail, MessageSquareText, Plus, Rows3, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { seedRules } from '../../data/brain'
import { departments } from '../../data/departments'
import { logActivity } from '../../lib/activityLog'
import { nextStep, overlappingCampaigns, pendingApprovals, daysPastEnd, type NextStep } from '../../lib/campaignFlow'
import { useCurrentUser } from '../../lib/currentUser'
import { formatCount, formatMoney, type CampaignResults } from '../../lib/results'
import { readStored, usePersistentState } from '../../lib/usePersistentState'
import { useResults } from '../../lib/useResults'
import { addDays, campaignStatuses, completeCampaign, formatDate, formatDateTime, localDate, requiredApprovals, timelineSteps } from '../../services/campaigns'
import type { ApprovalChannel, CampaignChannel, CampaignRecord, CampaignStage, CampaignStatus, DepartmentKey, HotelRule, Learning } from '../../types/domain'

const channelIcon: Record<CampaignChannel, typeof Mail> = { Email: Mail, Social: MessageSquareText, Website: Globe2 }
const approvalStage: Record<ApprovalChannel, CampaignStage> = { Designs: 'Designs', Socials: 'Socials', Emails: 'Emails', Website: 'Website' }
// Most urgent first: approvals, then what's running, then drafts, then history.
const statusOrder: CampaignStatus[] = ['Needs approval', 'Approved', 'Live', 'Scheduled', 'Draft', 'Completed']
const statusClass = (status: CampaignStatus) => `campaign-status-chip status-${status.toLowerCase().replace(/\s+/g, '-')}`
const areaName = (key: DepartmentKey) => departments.find((item) => item.key === key)?.name ?? key

function ownerLabel(step: NextStep): string | null {
  if (step.owner === 'you') return 'Your move'
  if (step.owner === 'hotel-manager') return 'Hotel manager'
  return null
}

export function CampaignsWorkspace({
  onOpenCampaign,
  onCreateCampaign,
}: {
  onOpenCampaign: (campaign: CampaignRecord, stage?: CampaignStage) => void
  onCreateCampaign: (departmentKey: DepartmentKey, fromCampaignId?: string) => void
}) {
  const { campaigns: allCampaigns, upsert, remove, results } = useResults()
  const { canAccess, isHotelManager, allowedAreas, areaName: myArea } = useCurrentUser()
  const [learnings] = usePersistentState<Learning[]>('otel:learnings', [])
  const [rules] = usePersistentState<HotelRule[]>('otel:hotel-rules', seedRules)
  const [view, setView] = usePersistentState<'cards' | 'timeline'>('otel:campaigns-view', 'cards')
  const [today] = useState(() => localDate())
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'All'>('All')
  const [areaFilter, setAreaFilter] = useState<DepartmentKey | 'all'>('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<CampaignRecord | null>(null)

  const campaigns = allCampaigns.filter((campaign) => canAccess(campaign.departmentKey))
  const resultFor = (campaign: CampaignRecord): CampaignResults | null => results.find((item) => item.campaign.id === campaign.id) ?? null
  const stepFor = (campaign: CampaignRecord) =>
    nextStep(campaign, { isHotelManager, today, result: resultFor(campaign), department: departments.find((item) => item.key === campaign.departmentKey), learnings })

  const queue = campaigns
    .map((campaign) => ({ campaign, step: stepFor(campaign) }))
    .filter((entry) => entry.step.owner === 'you')
    .sort((a, b) => a.step.priority - b.step.priority || a.campaign.startDate.localeCompare(b.campaign.startDate))

  const needle = query.trim().toLowerCase()
  const inScope = campaigns
    .filter((campaign) => areaFilter === 'all' || campaign.departmentKey === areaFilter)
    .filter((campaign) => !needle || [campaign.name, campaign.offer, campaign.objective, areaName(campaign.departmentKey)].some((text) => text.toLowerCase().includes(needle)))
  const visible = inScope
    .filter((campaign) => statusFilter === 'All' || campaign.status === statusFilter)
    .sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status) || a.startDate.localeCompare(b.startDate))
  const selected = campaigns.find((campaign) => campaign.id === selectedId) ?? visible[0] ?? null

  const live = campaigns.filter((campaign) => campaign.status === 'Live')
  const endingSoon = live.filter((campaign) => campaign.endDate >= today && campaign.endDate <= addDays(today, 14))
  const pipeline = campaigns.filter((campaign) => ['Draft', 'Needs approval', 'Approved', 'Scheduled'].includes(campaign.status))
  const awaitingApproval = campaigns.filter((campaign) => campaign.status === 'Needs approval')
  const earned = results.filter((result) => result.state !== 'projection' && canAccess(result.campaign.departmentKey))
  const revenue = earned.reduce((sum, result) => sum + result.shown.revenue, 0)

  const conflictAreas = [...new Set(campaigns.filter((campaign) => overlappingCampaigns(campaign, campaigns).length > 0).map((campaign) => campaign.departmentKey))]
  const oneOfferRule = rules.find((rule) => /one offer/i.test(rule.text))

  function act(campaign: CampaignRecord, step: NextStep) {
    if (step.action === 'complete') {
      upsert(completeCampaign(campaign))
      logActivity('Campaign completed', `${campaign.name} finished. Review results and save what worked.`, 'success', areaName(campaign.departmentKey))
      setSelectedId(campaign.id)
      return
    }
    if (step.action === 'rerun') {
      onCreateCampaign(campaign.departmentKey, campaign.id)
      return
    }
    onOpenCampaign(campaign, step.stage)
  }

  function newCampaign() {
    if (areaFilter !== 'all') return onCreateCampaign(areaFilter)
    const recent = readStored<DepartmentKey>('otel:active-department', allowedAreas[0])
    onCreateCampaign(allowedAreas.includes(recent) ? recent : allowedAreas[0])
  }

  function confirmDelete(campaign: CampaignRecord) {
    remove(campaign.id)
    logActivity('Draft deleted', `${campaign.name} and its content were removed.`, 'warning', areaName(campaign.departmentKey))
    setPendingDelete(null)
    setSelectedId(null)
  }

  return (
    <>
      <section className="results-overview">
        <div className={queue.length ? 'tile-action' : ''}>
          <span>Waiting on you</span>
          <strong>{queue.length}</strong>
          <em>{queue[0] ? `first: ${queue[0].step.title.toLowerCase()} · ${queue[0].campaign.name}` : 'nothing needs you right now'}</em>
        </div>
        <div>
          <span>Live now</span>
          <strong>{live.length}</strong>
          <em>{endingSoon.length ? `${endingSoon.length} ending in the next 14 days` : live.length ? 'none ending in 14 days' : 'nothing live'}</em>
        </div>
        <div>
          <span>In the pipeline</span>
          <strong>{pipeline.length}</strong>
          <em>{awaitingApproval.length} awaiting the hotel manager</em>
        </div>
        <div>
          <span>Revenue so far</span>
          <strong>{formatMoney(revenue)}</strong>
          <em>live + completed · simulated</em>
        </div>
      </section>

      {conflictAreas.length > 0 && (
        <div className="offer-conflict-banner campaign-conflict-banner">
          <AlertTriangle size={17} />
          <span>
            <strong>{conflictAreas.map(areaName).join(' and ')}</strong> {conflictAreas.length === 1 ? 'has' : 'have'} campaigns running at the same time.{' '}
            {oneOfferRule ? `Your hotel rule: “${oneOfferRule.text}”.` : 'Overlapping campaigns compete for the same guests.'} Move the dates or delete one of the drafts.
          </span>
        </div>
      )}

      <section className="panel campaign-queue">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{isHotelManager ? 'Hotel manager' : myArea}</p>
            <h2>Waiting on you</h2>
          </div>
          <span className="muted small">
            {isHotelManager ? 'Approvals, scheduling and closing campaigns across every area.' : 'Drafts to finish and results to review. The hotel manager approves and publishes.'}
          </span>
        </div>
        {queue.length === 0 ? (
          <p className="queue-empty">
            <CheckCircle2 size={16} /> Nothing is waiting on you.{' '}
            {isHotelManager ? 'Campaigns sent for approval will appear here.' : 'New drafts and finished campaigns will appear here.'}
          </p>
        ) : (
          <ul className="queue-list">
            {queue.map(({ campaign, step }) => (
              <li key={campaign.id}>
                <span className={statusClass(campaign.status)}>{campaign.status}</span>
                <span className="queue-text">
                  <small>{areaName(campaign.departmentKey)}</small>
                  <strong>{campaign.name}</strong>
                  <span>
                    {step.title} — {step.detail}
                  </span>
                </span>
                <button type="button" className="primary-button small" onClick={() => act(campaign, step)}>
                  {step.label} <ArrowRight size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="power-grid">
        <section className="panel span-2">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Campaigns</p>
              <h2>{isHotelManager ? 'Every business area' : `${myArea} campaigns`}</h2>
            </div>
            <div className="campaign-toolbar-actions">
              <div className="view-toggle" role="group" aria-label="View">
                <button type="button" className={view === 'cards' ? 'selected' : ''} aria-pressed={view === 'cards'} onClick={() => setView('cards')}>
                  <LayoutGrid size={14} /> Cards
                </button>
                <button type="button" className={view === 'timeline' ? 'selected' : ''} aria-pressed={view === 'timeline'} onClick={() => setView('timeline')}>
                  <Rows3 size={14} /> Timeline
                </button>
              </div>
              <button type="button" className="primary-button small" onClick={newCampaign}>
                <Plus size={14} /> New campaign
              </button>
            </div>
          </div>

          <div className="campaign-toolbar">
            <label className="campaign-search">
              <Search size={15} />
              <input type="search" placeholder="Search by name, offer or area" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search campaigns" />
            </label>
            {isHotelManager && (
              <select className="filter-select" aria-label="Filter by business area" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value as DepartmentKey | 'all')}>
                <option value="all">All business areas</option>
                {departments.map((department) => (
                  <option key={department.key} value={department.key}>
                    {department.name} · {campaigns.filter((campaign) => campaign.departmentKey === department.key).length}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="audience-filter-row">
            {(['All', ...campaignStatuses] as const).map((status) => {
              const count = status === 'All' ? inScope.length : inScope.filter((campaign) => campaign.status === status).length
              return (
                <button type="button" key={status} className={statusFilter === status ? 'selected' : ''} onClick={() => setStatusFilter(status)}>
                  {status} · {count}
                </button>
              )
            })}
          </div>

          {visible.length === 0 ? (
            <div className="contact-table-empty">
              {campaigns.length === 0 ? (
                <>
                  No campaigns yet. <button type="button" className="ghost-link" onClick={newCampaign}>Create the first one</button>
                </>
              ) : (
                <>
                  No campaigns match {needle ? `“${query.trim()}”` : 'these filters'}.{' '}
                  <button
                    type="button"
                    className="ghost-link"
                    onClick={() => {
                      setQuery('')
                      setStatusFilter('All')
                      setAreaFilter('all')
                    }}
                  >
                    Clear filters
                  </button>
                </>
              )}
            </div>
          ) : view === 'cards' ? (
            <div className="campaign-card-grid">
              {visible.map((campaign) => {
                const department = departments.find((item) => item.key === campaign.departmentKey)
                const result = resultFor(campaign)
                const step = stepFor(campaign)
                const overlaps = overlappingCampaigns(campaign, campaigns)
                const overdue = daysPastEnd(campaign, today)
                const owner = ownerLabel(step)
                return (
                  <button
                    type="button"
                    key={campaign.id}
                    className={`campaign-card ${selected?.id === campaign.id ? 'selected' : ''}`}
                    onClick={() => setSelectedId(campaign.id)}
                    aria-pressed={selected?.id === campaign.id}
                  >
                    <span className="campaign-card-image" style={{ backgroundImage: `url(${department?.image})` }}>
                      <em className={statusClass(campaign.status)}>{campaign.status}</em>
                    </span>
                    <span className="campaign-card-body">
                      <small>{department?.name}</small>
                      <strong>{campaign.name}</strong>
                      <span>{campaign.offer}</span>
                      {result && (
                        <span className={`campaign-card-result ${result.state}`}>
                          {result.state === 'projection'
                            ? `Projected ${formatCount(result.projected.bookings)} ${result.unit}`
                            : `${formatCount(result.shown.bookings)} ${result.unit} ${result.state === 'live' ? 'so far' : 'total'}`}
                        </span>
                      )}
                      <span className={`card-next owner-${step.owner}`}>
                        {owner && <b>{owner}</b>}
                        {step.title}
                      </span>
                      {overdue > 0 && (
                        <span className="card-flag">
                          <AlertTriangle size={12} /> Ended {overdue} day{overdue === 1 ? '' : 's'} ago, still live
                        </span>
                      )}
                      {overlaps.length > 0 && (
                        <span className="card-flag">
                          <AlertTriangle size={12} /> Overlaps {overlaps.map((item) => item.name).join(', ')}
                        </span>
                      )}
                      <span className="campaign-card-footer">
                        {formatDate(campaign.startDate)} – {formatDate(campaign.endDate)}
                        <span className="channel-icons">
                          {campaign.channels.map((channel) => {
                            const Icon = channelIcon[channel]
                            return <Icon key={channel} size={14} aria-label={channel} />
                          })}
                        </span>
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <CampaignTimeline campaigns={visible} all={campaigns} today={today} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
          )}
        </section>

        <section className="panel campaign-detail">
          {selected ? (
            <CampaignDetail
              campaign={selected}
              result={resultFor(selected)}
              step={stepFor(selected)}
              overlaps={overlappingCampaigns(selected, campaigns)}
              onAct={(step) => act(selected, step)}
              onOpen={(stage) => onOpenCampaign(selected, stage)}
              onRerun={() => onCreateCampaign(selected.departmentKey, selected.id)}
              onDelete={() => setPendingDelete(selected)}
            />
          ) : (
            <p className="muted">Select a campaign to see where it is and what happens next.</p>
          )}
        </section>
      </div>

      {pendingDelete && (
        <Modal title="Delete this draft?" onClose={() => setPendingDelete(null)}>
          <p>
            <strong>{pendingDelete.name}</strong> ({areaName(pendingDelete.departmentKey)}) and its emails, social posts and website copy will be removed. This can’t be undone.
          </p>
          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={() => setPendingDelete(null)}>
              Keep draft
            </button>
            <button type="button" className="primary-button danger" onClick={() => confirmDelete(pendingDelete)}>
              <Trash2 size={14} /> Delete draft
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

function CampaignDetail({
  campaign,
  result,
  step,
  overlaps,
  onAct,
  onOpen,
  onRerun,
  onDelete,
}: {
  campaign: CampaignRecord
  result: CampaignResults | null
  step: NextStep
  overlaps: CampaignRecord[]
  onAct: (step: NextStep) => void
  onOpen: (stage?: CampaignStage) => void
  onRerun: () => void
  onDelete: () => void
}) {
  const required = requiredApprovals(campaign)
  const pending = pendingApprovals(campaign)
  const lastDone = timelineSteps.reduce((last, item, index) => (campaign.timeline[item] ? index : last), -1)
  const owner = ownerLabel(step)
  const resultLabel = !result ? '' : result.state === 'projection' ? 'Projected if it runs as planned' : result.state === 'live' ? `So far · day ${result.dayCount} of ${result.totalDays}` : 'Final results'

  return (
    <>
      <p className="eyebrow">{areaName(campaign.departmentKey)}</p>
      <div className="detail-title">
        <h2>{campaign.name}</h2>
        <span className={statusClass(campaign.status)}>{campaign.status}</span>
      </div>
      <p className="muted small">
        {campaign.offer} · {formatDate(campaign.startDate)} – {formatDate(campaign.endDate)}
      </p>

      <div className={`next-step-box owner-${step.owner}`} key={campaign.id}>
        {owner && <span className="next-step-owner">{owner}</span>}
        <strong>{step.title}</strong>
        <p>{step.detail}</p>
        <button type="button" className={step.owner === 'you' ? 'primary-button small' : 'secondary-button small'} onClick={() => onAct(step)}>
          {step.label} <ArrowRight size={14} />
        </button>
      </div>

      {overlaps.length > 0 && (
        <p className="offer-warning">
          <AlertTriangle size={13} /> Runs at the same time as {overlaps.map((item) => `${item.name} (${item.status.toLowerCase()})`).join(', ')} in this area.
        </p>
      )}

      <div className="detail-section">
        <h3>
          Approvals <span>{required.length - pending.length} of {required.length}</span>
        </h3>
        <div className="approval-chips">
          {required.map((channel) => (
            <button type="button" key={channel} className={campaign.approvals[channel] ? 'approved' : ''} onClick={() => onOpen(approvalStage[channel])}>
              {campaign.approvals[channel] ? <Check size={13} /> : <span className="dot" />} {channel}
            </button>
          ))}
        </div>
      </div>

      {result && (
        <div className="detail-section">
          <h3>
            Results <span>{resultLabel}</span>
          </h3>
          <div className="detail-results">
            <div>
              <strong>{formatCount(result.state === 'projection' ? result.projected.bookings : result.shown.bookings)}</strong>
              <span>{result.unit}</span>
            </div>
            <div>
              <strong>{formatMoney(result.state === 'projection' ? result.projected.revenue : result.shown.revenue)}</strong>
              <span>revenue{result.state === 'projection' ? ' (projected)' : ''}</span>
            </div>
            <div>
              <strong>{formatCount(result.eligible)}</strong>
              <span>guests who can be contacted</span>
            </div>
          </div>
          {result.state !== 'projection' && (
            <button type="button" className="ghost-link" onClick={() => onOpen('Results')}>
              See the full results and insights
            </button>
          )}
        </div>
      )}

      <div className="detail-section">
        <h3>Progress</h3>
        <ol className="workflow-stepper campaign-list-timeline">
          {timelineSteps.map((item, index) => {
            const stamp = campaign.timeline[item]
            const state = stamp ? 'done' : index < lastDone ? 'skipped' : ''
            return (
              <li key={item} className={state}>
                <span className="step-marker">{stamp ? <Check size={13} /> : index + 1}</span>
                <span className="step-text">
                  {item}
                  {stamp && <small>{formatDateTime(stamp)}</small>}
                  {state === 'skipped' && <small>Skipped</small>}
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="detail-actions">
        <button type="button" className="secondary-button" onClick={() => onOpen(step.stage)}>
          Open in campaign engine <ArrowRight size={14} />
        </button>
        {step.action !== 'rerun' && campaign.status !== 'Draft' && (
          <button type="button" className="secondary-button" onClick={onRerun}>
            <Copy size={14} /> {campaign.status === 'Completed' ? 'Run again' : 'Duplicate as new draft'}
          </button>
        )}
        {campaign.status === 'Draft' && (
          <button type="button" className="ghost-link danger" onClick={onDelete}>
            <Trash2 size={14} /> Delete draft
          </button>
        )}
      </div>
    </>
  )
}

function shortRange(start: string, end: string, today: string): string {
  const short = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const year = end.slice(0, 4) === today.slice(0, 4) ? '' : ` ’${end.slice(2, 4)}`
  return `${short(start)} – ${short(end)}${year}`
}

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000)
}

function CampaignTimeline({
  campaigns,
  all,
  today,
  selectedId,
  onSelect,
}: {
  campaigns: CampaignRecord[]
  all: CampaignRecord[]
  today: string
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const earliest = [today, ...campaigns.map((campaign) => campaign.startDate)].sort()[0]
  const latest = [addDays(today, 30), ...campaigns.map((campaign) => campaign.endDate)].sort().at(-1) as string
  const rangeStart = `${earliest.slice(0, 7)}-01`
  const lastMonth = new Date(`${latest.slice(0, 7)}-01T00:00:00`)
  const rangeEnd = localDate(new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0))
  const span = daysBetween(rangeStart, rangeEnd) + 1
  const pct = (date: string) => Math.min(100, Math.max(0, (daysBetween(rangeStart, date) / span) * 100))

  const months: { key: string; label: string; left: number; width: number }[] = []
  for (let cursor = new Date(`${rangeStart}T00:00:00`); localDate(cursor) <= rangeEnd; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) {
    const start = localDate(cursor)
    const next = localDate(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
    const label = cursor.toLocaleDateString('en-GB', { month: 'short' }) + (cursor.getMonth() === 0 || start === rangeStart ? ` ${String(cursor.getFullYear()).slice(2)}` : '')
    months.push({ key: start, label, left: pct(start), width: pct(next > rangeEnd ? addDays(rangeEnd, 1) : next) - pct(start) })
  }
  const todayLeft = pct(today)

  return (
    <div className="campaign-timeline">
      <div className="timeline-row timeline-head">
        <span />
        <div className="timeline-track">
          {months.map((month) => (
            <span key={month.key} className="timeline-month" style={{ left: `${month.left}%`, width: `${month.width}%` }}>
              {month.label}
            </span>
          ))}
        </div>
      </div>
      {campaigns.map((campaign) => {
        const left = pct(campaign.startDate)
        const width = Math.max(1.2, pct(addDays(campaign.endDate, 1)) - left)
        const overlaps = overlappingCampaigns(campaign, all).length > 0
        // Narrow bars can't hold their dates; put the label beside the bar instead.
        const labelOutside = width < 16 && left + width < 78
        const range = shortRange(campaign.startDate, campaign.endDate, today)
        return (
          <button
            type="button"
            key={campaign.id}
            className={`timeline-row ${selectedId === campaign.id ? 'selected' : ''}`}
            onClick={() => onSelect(campaign.id)}
            aria-pressed={selectedId === campaign.id}
          >
            <span className="timeline-label">
              <strong>{campaign.name}</strong>
              <small>
                {areaName(campaign.departmentKey)}
                {overlaps && (
                  <em>
                    <AlertTriangle size={11} /> overlap
                  </em>
                )}
              </small>
            </span>
            <span className="timeline-track">
              {months.map((month) => (
                <span key={month.key} className="timeline-gridline" style={{ left: `${month.left}%` }} />
              ))}
              <span className="timeline-today" style={{ left: `${todayLeft}%` }} />
              <span
                className={`timeline-bar status-${campaign.status.toLowerCase().replace(/\s+/g, '-')}`}
                style={{ left: `${left}%`, width: `${width}%` }}
                title={`${campaign.status} · ${formatDate(campaign.startDate)} – ${formatDate(campaign.endDate)}`}
              >
                {!labelOutside && range}
              </span>
              {labelOutside && (
                <span className="timeline-bar-label" style={{ left: `calc(${left + width}% + 6px)` }}>
                  {range}
                </span>
              )}
            </span>
          </button>
        )
      })}
      <p className="muted small timeline-legend">
        <span className="legend-today" aria-hidden="true" />
        <span>Today ({formatDate(today)}). Bars show each campaign’s window, coloured by status. Key dates and quiet periods are on the Calendar.</span>
      </p>
    </div>
  )
}
