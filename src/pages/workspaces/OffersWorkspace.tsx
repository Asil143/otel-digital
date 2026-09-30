import { AlertTriangle, ArrowRight, Pencil, Plus, Trash2, WandSparkles } from 'lucide-react'
import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { seedRules } from '../../data/brain'
import { departments } from '../../data/departments'
import { seedOffers } from '../../data/offers'
import { logActivity } from '../../lib/activityLog'
import { useCurrentUser } from '../../lib/currentUser'
import { campaignsForOffer, inProgress, offerTiming, overlappingOffers } from '../../lib/offers'
import { formatCount, resultUnit } from '../../lib/results'
import { usePersistentState } from '../../lib/usePersistentState'
import { useResults } from '../../lib/useResults'
import { addDays, formatDate, localDate } from '../../services/campaigns'
import type { CampaignChannel, CampaignRecord, CampaignStage, DepartmentKey, HotelRule, Offer } from '../../types/domain'

const statuses: Offer['status'][] = ['Active', 'Draft', 'Archived']
const allChannels: CampaignChannel[] = ['Email', 'Social', 'Website']

function areaName(key: DepartmentKey): string {
  return departments.find((department) => department.key === key)?.name ?? key
}

function emptyOffer(departmentKey: DepartmentKey, today: string): Offer {
  return { id: '', departmentKey, name: '', price: '', startDate: today, endDate: addDays(today, 28), status: 'Draft', terms: '', channels: undefined }
}

type PendingChange = { offer: Offer; kind: 'archive' | 'delete'; campaigns: CampaignRecord[] }

export function OffersWorkspace({
  onOpenCampaign,
  onCreateCampaign,
}: {
  onOpenCampaign: (campaign: CampaignRecord, stage: CampaignStage) => void
  onCreateCampaign: (offer: Offer) => void
}) {
  const [offers, setOffers] = usePersistentState<Offer[]>('otel:offers', seedOffers)
  const [rules] = usePersistentState<HotelRule[]>('otel:hotel-rules', seedRules)
  const { campaigns, results } = useResults()
  const { canAccess, allowedAreas, isHotelManager, areaName: myArea } = useCurrentUser()
  const [today] = useState(() => localDate())
  const [departmentFilter, setDepartmentFilter] = useState<DepartmentKey | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<Offer['status'] | 'All'>('All')
  const [draft, setDraft] = useState<Offer>(() => emptyOffer(allowedAreas[0], localDate()))
  const [errors, setErrors] = useState<string[]>([])
  const [pending, setPending] = useState<PendingChange | null>(null)

  const areas = departments.filter((department) => canAccess(department.key))
  const draftArea = canAccess(draft.departmentKey) ? draft.departmentKey : allowedAreas[0]
  const mine = offers.filter((offer) => canAccess(offer.departmentKey))
  const visible = mine
    .filter((offer) => departmentFilter === 'all' || offer.departmentKey === departmentFilter)
    .filter((offer) => statusFilter === 'All' || offer.status === statusFilter)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))

  const activeMine = mine.filter((offer) => offer.status === 'Active')
  const running = activeMine.filter((offer) => offerTiming(offer, today).phase === 'running')
  const startingSoon = activeMine.filter((offer) => offer.startDate > today && offer.startDate <= addDays(today, 30))
  const endingSoon = running.filter((offer) => offerTiming(offer, today).daysLeft <= 14)
  const conflictAreas = [...new Set(activeMine.filter((offer) => overlappingOffers(offer, offers).length > 0).map((offer) => offer.departmentKey))]
  const oneOfferRule = rules.find((rule) => /one offer/i.test(rule.text))

  function save() {
    const problems: string[] = []
    if (!draft.name.trim()) problems.push('Name the offer.')
    if (!draft.price.trim()) problems.push('Add a price or value.')
    if (draft.endDate < draft.startDate) problems.push('End date must be after the start date.')
    if (draft.channels && draft.channels.length === 0) problems.push('Choose at least one eligible channel.')
    setErrors(problems)
    if (problems.length > 0) return
    const cleaned: Offer = { ...draft, departmentKey: draftArea, name: draft.name.trim(), terms: draft.terms?.trim() || undefined }
    if (draft.id) {
      setOffers((current) => current.map((offer) => (offer.id === draft.id ? cleaned : offer)))
      logActivity('Offer updated', `${cleaned.name} (${cleaned.price}) saved.`, 'info', areaName(draftArea))
    } else {
      setOffers((current) => [...current, { ...cleaned, id: crypto.randomUUID() }])
      logActivity('Offer added', `${cleaned.name} (${cleaned.price}) is ${cleaned.status.toLowerCase()} and available in Create campaign.`, 'success', areaName(draftArea))
    }
    setDraft(emptyOffer(draftArea, today))
  }

  function applyStatus(offer: Offer, status: Offer['status']) {
    setOffers((current) => current.map((item) => (item.id === offer.id ? { ...item, status } : item)))
    logActivity('Offer status changed', `${offer.name} is now ${status.toLowerCase()}.`, 'info', areaName(offer.departmentKey))
  }

  function remove(offer: Offer) {
    setOffers((current) => current.filter((item) => item.id !== offer.id))
    logActivity('Offer deleted', `${offer.name} was removed.`, 'warning', areaName(offer.departmentKey))
  }

  function requestChange(offer: Offer, kind: PendingChange['kind']) {
    const usedBy = campaignsForOffer(offer, campaigns).filter(inProgress)
    if (usedBy.length) {
      setPending({ offer, kind, campaigns: usedBy })
      return
    }
    if (kind === 'archive') applyStatus(offer, 'Archived')
    else remove(offer)
  }

  function toggleDraftChannel(channel: CampaignChannel) {
    const current = draft.channels ?? allChannels
    const next = current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel]
    setDraft({ ...draft, channels: next.length === allChannels.length ? undefined : next })
  }

  return (
    <>
      <section className="results-overview">
        <div>
          <span>Running now</span>
          <strong>{running.length}</strong>
          <em>active offers within their dates</em>
        </div>
        <div>
          <span>Starting in 30 days</span>
          <strong>{startingSoon.length}</strong>
          <em>{startingSoon[0] ? `next: ${startingSoon[0].name}` : 'none scheduled'}</em>
        </div>
        <div>
          <span>Ending in 14 days</span>
          <strong>{endingSoon.length}</strong>
          <em>{endingSoon[0] ? `soonest: ${endingSoon[0].name}` : 'none'}</em>
        </div>
        <div className={conflictAreas.length ? 'tile-warning' : ''}>
          <span>Overlapping offers</span>
          <strong>{conflictAreas.length}</strong>
          <em>{conflictAreas.length ? `area${conflictAreas.length === 1 ? '' : 's'} running two at once` : 'one offer per area'}</em>
        </div>
      </section>

      {conflictAreas.length > 0 && (
        <div className="offer-conflict-banner">
          <AlertTriangle size={17} />
          <span>
            <strong>{conflictAreas.map(areaName).join(' and ')}</strong> {conflictAreas.length === 1 ? 'runs' : 'run'} more than one offer at the same time.{' '}
            {oneOfferRule ? `Your hotel rule: “${oneOfferRule.text}”.` : 'Running several offers at once dilutes the message — the AI avoids recommending it.'} Archive one or move its dates.
          </span>
        </div>
      )}

      <div className="power-grid">
        <section className="panel span-2">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Offers catalogue</p>
              <h2>{isHotelManager ? 'Offers by business area' : `${myArea} offers`}</h2>
            </div>
          </div>
          <div className="audience-filter-row">
            {isHotelManager && (
              <select className="filter-select" aria-label="Filter by business area" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value as DepartmentKey | 'all')}>
                <option value="all">All business areas</option>
                {departments.map((department) => (
                  <option key={department.key} value={department.key}>{department.name}</option>
                ))}
              </select>
            )}
            {(['All', ...statuses] as const).map((status) => (
              <button type="button" key={status} className={statusFilter === status ? 'selected' : ''} onClick={() => setStatusFilter(status)}>
                {status}
              </button>
            ))}
          </div>

          <div className="offer-list">
            {visible.map((offer) => {
              const timing = offerTiming(offer, today)
              const overlaps = overlappingOffers(offer, offers)
              const used = campaignsForOffer(offer, campaigns)
              const endedButActive = offer.status === 'Active' && timing.phase === 'ended'
              const canStart = offer.status === 'Active' && timing.phase !== 'ended' && !used.some(inProgress)
              return (
                <article className={`offer-card status-${offer.status.toLowerCase()}`} key={offer.id}>
                  <div className="offer-card-main">
                    <div className="offer-card-title">
                      <strong>{offer.name}</strong>
                      <span className={`timing-chip phase-${timing.phase}`}>{timing.label}</span>
                    </div>
                    <p className="offer-meta">
                      {areaName(offer.departmentKey)} · {offer.price} · {formatDate(offer.startDate)} – {formatDate(offer.endDate)}
                    </p>
                    {offer.terms && <p className="offer-terms">{offer.terms}</p>}
                    {offer.channels && <p className="offer-eligibility">Eligible: {offer.channels.join(', ')} only</p>}
                    {overlaps.length > 0 && (
                      <p className="offer-warning"><AlertTriangle size={13} /> Overlaps with {overlaps.map((item) => item.name).join(', ')}</p>
                    )}
                    {endedButActive && (
                      <p className="offer-warning">
                        <AlertTriangle size={13} /> Ended but still marked Active.
                        <button type="button" className="ghost-link" onClick={() => requestChange(offer, 'archive')}>Archive it</button>
                      </p>
                    )}
                    <div className="offer-used-in">
                      {used.length === 0 && <span className="muted small">Not used in a campaign yet</span>}
                      {used.map((campaign) => {
                        const result = results.find((item) => item.campaign.id === campaign.id)
                        const department = departments.find((item) => item.key === campaign.departmentKey)
                        return (
                          <button type="button" key={campaign.id} className="used-chip" onClick={() => onOpenCampaign(campaign, result && result.state !== 'projection' ? 'Results' : 'Strategy')}>
                            <span className={`campaign-status-chip status-${campaign.status.toLowerCase().replace(/\s+/g, '-')}`}>{campaign.status}</span>
                            {campaign.name}
                            {result && result.state !== 'projection' && department && (
                              <em>{formatCount(result.shown.bookings)} {resultUnit(department)}</em>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="offer-card-actions">
                    <select
                      className={`status-select status-${offer.status.toLowerCase()}`}
                      value={offer.status}
                      aria-label={`Status for ${offer.name}`}
                      onChange={(event) => {
                        const status = event.target.value as Offer['status']
                        if (status === 'Archived') requestChange(offer, 'archive')
                        else applyStatus(offer, status)
                      }}
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                    {canStart && (
                      <button type="button" className="secondary-button small" onClick={() => onCreateCampaign(offer)}>
                        <WandSparkles size={14} /> Create campaign
                      </button>
                    )}
                    <span className="row-actions">
                      <button type="button" aria-label={`Edit ${offer.name}`} onClick={() => setDraft(offer)}><Pencil size={14} /></button>
                      <button type="button" aria-label={`Delete ${offer.name}`} onClick={() => requestChange(offer, 'delete')}><Trash2 size={14} /></button>
                    </span>
                  </div>
                </article>
              )
            })}
            {visible.length === 0 && <div className="contact-table-empty">No offers match these filters.</div>}
          </div>
        </section>

        <section className="panel offer-form-panel">
          <p className="eyebrow">{draft.id ? 'Edit offer' : 'New offer'}</p>
          <h2>{draft.id ? draft.name || 'Edit offer' : 'Add an offer'}</h2>
          <div className="stacked-form">
            <label>
              <span>Offer name</span>
              <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Midweek Spa Day" />
            </label>
            <label>
              <span>Business area</span>
              <select value={draftArea} disabled={!isHotelManager} onChange={(event) => setDraft({ ...draft, departmentKey: event.target.value as DepartmentKey })}>
                {areas.map((department) => (
                  <option key={department.key} value={department.key}>{department.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Price or value</span>
              <input value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} placeholder="£79" />
            </label>
            <div className="two-up">
              <label>
                <span>Start</span>
                <input type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} />
              </label>
              <label>
                <span>End</span>
                <input type="date" value={draft.endDate} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} />
              </label>
            </div>
            <label>
              <span>Terms</span>
              <textarea value={draft.terms ?? ''} onChange={(event) => setDraft({ ...draft, terms: event.target.value })} placeholder="What's included, days it applies, exclusions" />
            </label>
            <fieldset className="chip-fieldset">
              <legend>Eligible channels</legend>
              {allChannels.map((channel) => {
                const on = (draft.channels ?? allChannels).includes(channel)
                return (
                  <label key={channel} className={`choice-chip ${on ? 'selected' : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => toggleDraftChannel(channel)} />
                    {channel}
                  </label>
                )
              })}
            </fieldset>
            <label>
              <span>Status</span>
              <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Offer['status'] })}>
                {statuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
            {errors.length > 0 && (
              <ul className="form-errors" role="alert">
                {errors.map((error) => <li key={error}>{error}</li>)}
              </ul>
            )}
            <div className="form-actions">
              {draft.id && <button type="button" className="secondary-button" onClick={() => setDraft(emptyOffer(draftArea, today))}>Cancel</button>}
              <button type="button" className="primary-button" onClick={save}>
                <Plus size={15} /> {draft.id ? 'Save offer' : 'Add offer'}
              </button>
            </div>
          </div>
        </section>
      </div>

      {pending && (
        <Modal title={pending.kind === 'archive' ? 'Archive this offer?' : 'Delete this offer?'} onClose={() => setPending(null)}>
          <p>
            <strong>{pending.offer.name}</strong> is used by {pending.campaigns.length === 1 ? 'a campaign' : `${pending.campaigns.length} campaigns`} that
            {pending.campaigns.length === 1 ? ' is' : ' are'} still in progress:
          </p>
          <ul className="pending-campaigns">
            {pending.campaigns.map((campaign) => (
              <li key={campaign.id}>
                <span className={`campaign-status-chip status-${campaign.status.toLowerCase().replace(/\s+/g, '-')}`}>{campaign.status}</span> {campaign.name}
              </li>
            ))}
          </ul>
          <p className="muted small">The campaign keeps its content, but the offer will no longer be available for new campaigns or recommendations.</p>
          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={() => setPending(null)}>Keep offer</button>
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                if (pending.kind === 'archive') applyStatus(pending.offer, 'Archived')
                else remove(pending.offer)
                setPending(null)
              }}
            >
              {pending.kind === 'archive' ? 'Archive anyway' : 'Delete anyway'} <ArrowRight size={14} />
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
