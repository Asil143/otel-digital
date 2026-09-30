import {
  ArrowRight,
  BedDouble,
  Check,
  CircleDashed,
  FileText,
  Globe2,
  Image,
  Layers3,
  Lock,
  PenLine,
  Plus,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  Unlock,
  Upload,
  Users,
} from 'lucide-react'
import { useState, type ChangeEvent } from 'react'
import { Modal } from '../../components/ui/Modal'
import { activeHotel } from '../../config/hotel'
import type { AppRoute } from '../../config/routes'
import { seedAssets, seedRules } from '../../data/brain'
import { seedContacts } from '../../data/contacts'
import { departments } from '../../data/departments'
import { seedKeyDates, seedOffers } from '../../data/offers'
import { productionGuardrails } from '../../data/workflows'
import { logActivity } from '../../lib/activityLog'
import { useCurrentUser } from '../../lib/currentUser'
import { useSignals } from '../../lib/signalStore'
import { ageLabel, cappedConfidence, resolveFreshness } from '../../lib/freshness'
import { formatCount, resultUnit } from '../../lib/results'
import { readStored, usePersistentState, writeStored } from '../../lib/usePersistentState'
import { useResults } from '../../lib/useResults'
import { addDays, localDate } from '../../services/campaigns'
import type {
  AssetKind,
  Contact,
  DepartmentKey,
  HotelAccount,
  HotelRule,
  KeyDate,
  Learning,
  MediaAsset,
  Offer,
} from '../../types/domain'

const hotelHeroImage = 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1800&q=80'

function areaName(key: DepartmentKey | null): string {
  return key ? departments.find((department) => department.key === key)?.name ?? key : 'Hotel-wide'
}

function kindFromFile(fileName: string): AssetKind {
  if (/\.(png|jpe?g|webp|gif)$/i.test(fileName)) return 'Image'
  if (/menu/i.test(fileName)) return 'Menu'
  if (/\.(pdf)$/i.test(fileName)) return 'Brochure'
  return 'Brand'
}

function readFeedback(keys: DepartmentKey[]): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const key of keys) {
    const counts = readStored<Record<string, number>>(`otel:${key}:design-feedback`, {})
    for (const [reason, count] of Object.entries(counts)) totals[reason] = (totals[reason] ?? 0) + count
  }
  return totals
}

export function BrainWorkspace({ onNavigate }: { onNavigate: (route: AppRoute) => void }) {
  const { isHotelManager, canAccess, allowedAreas, user } = useCurrentUser()
  const [hotel, setHotel] = usePersistentState<HotelAccount>('otel:hotel-account', activeHotel)
  const [rules, setRules] = usePersistentState<HotelRule[]>('otel:hotel-rules', seedRules)
  const [assets, setAssets] = usePersistentState<MediaAsset[]>('otel:assets', seedAssets)
  const [allLearnings, setLearnings] = usePersistentState<Learning[]>('otel:learnings', [])
  const [offers] = usePersistentState<Offer[]>('otel:offers', seedOffers)
  const [contacts] = usePersistentState<Contact[]>('otel:audience-contacts', seedContacts)
  const [keyDates] = usePersistentState<KeyDate[]>('otel:key-dates', seedKeyDates)
  const [signals] = useSignals()
  const { forDepartment } = useResults()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<HotelAccount>(hotel)
  const [newRule, setNewRule] = useState('')
  const [feedbackVersion, setFeedbackVersion] = useState(0)
  const [today] = useState(() => localDate())

  const areas = departments.filter((department) => canAccess(department.key))
  const visibleAssets = assets.filter((asset) => asset.departmentKey === null || canAccess(asset.departmentKey))
  const learnings = allLearnings.filter((learning) => canAccess(learning.departmentKey))
  const feedback = Object.entries(readFeedback(allowedAreas)).filter(([, count]) => count > 0)
  void feedbackVersion

  function jump(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function openArea(key: DepartmentKey) {
    writeStored('otel:active-department', key)
    onNavigate('departments')
  }

  // ---------- Brain health ----------
  const factsMissing = [
    !hotel.name.trim() && 'name',
    !hotel.location.trim() && 'location',
    !hotel.brandPromise.trim() && 'brand promise',
    !hotel.brandTone.trim() && 'voice & tone',
  ].filter(Boolean) as string[]
  const approvedAssets = visibleAssets.filter((asset) => asset.status === 'Approved').length
  const pendingAssets = visibleAssets.filter((asset) => asset.status === 'Pending approval').length
  const areasWithOffer = areas.filter((area) => offers.some((offer) => offer.departmentKey === area.key && offer.status === 'Active'))
  const upcomingEvents = keyDates.filter(
    (date) => date.kind === 'Event' && date.date >= today && date.date <= addDays(today, 60) && (date.departmentKey === 'all' || canAccess(date.departmentKey)),
  )
  const freshness = areas.map((area) => ({ area, freshness: resolveFreshness(area, signals) }))
  const freshAreas = freshness.filter((item) => item.freshness.state === 'Confirmed')
  const firstStale = freshness.find((item) => item.freshness.state !== 'Confirmed')
  const subscribed = contacts.filter((contact) => contact.permission === 'Subscribed').length
  const unknown = contacts.filter((contact) => contact.permission === 'Unknown').length

  const health = [
    {
      label: 'Hotel facts & brand voice',
      done: factsMissing.length === 0,
      detail: factsMissing.length ? `Missing ${factsMissing.join(', ')}` : 'Name, location, promise and voice are set',
      action: isHotelManager ? { label: 'Edit details', run: () => { setDraft(hotel); setEditing(true) } } : null,
    },
    {
      label: 'Hotel rules for the AI',
      done: rules.length > 0,
      detail: rules.length ? `${rules.length} rule${rules.length === 1 ? '' : 's'} applied to every recommendation` : 'No rules yet',
      action: { label: 'Review rules', run: () => jump('brain-rules') },
    },
    {
      label: 'Approved brand assets',
      done: pendingAssets === 0 && approvedAssets > 0,
      detail: `${approvedAssets} approved${pendingAssets ? ` · ${pendingAssets} awaiting approval` : ''}`,
      action: { label: 'Review assets', run: () => jump('brain-assets') },
    },
    {
      label: isHotelManager ? 'An active offer in every area' : 'An active offer',
      done: areasWithOffer.length === areas.length,
      detail: `${areasWithOffer.length} of ${areas.length} area${areas.length === 1 ? '' : 's'} covered`,
      action: { label: 'Open Offers', run: () => onNavigate('offers') },
    },
    {
      label: 'Key dates in the next 60 days',
      done: upcomingEvents.length > 0,
      detail: upcomingEvents.length ? `${upcomingEvents.length} upcoming event${upcomingEvents.length === 1 ? '' : 's'}` : 'None planned',
      action: { label: 'Open Calendar', run: () => onNavigate('calendar') },
    },
    {
      label: 'Current demand data',
      done: freshAreas.length === areas.length,
      detail: `${freshAreas.length} of ${areas.length} area${areas.length === 1 ? '' : 's'} confirmed and current`,
      action: firstStale ? { label: `Update ${firstStale.area.name}`, run: () => openArea(firstStale.area.key) } : null,
    },
    {
      label: 'Marketing consent',
      done: unknown === 0,
      detail: `${subscribed} of ${contacts.length} contacts consented${unknown ? ` · ${unknown} to confirm` : ''}`,
      action: { label: 'Open Audience', run: () => onNavigate('audience') },
    },
  ]
  const healthDone = health.filter((item) => item.done).length
  const healthPercent = Math.round((healthDone / health.length) * 100)

  // ---------- Actions ----------
  function saveFacts() {
    setHotel(draft)
    setEditing(false)
    logActivity('Hotel details updated', `${draft.name} property facts and brand voice saved.`, 'success', 'Hotel Brain')
  }

  function addRule() {
    const text = newRule.trim()
    if (!text) return
    setRules((current) => [...current, { id: crypto.randomUUID(), text, createdAt: new Date().toISOString() }])
    setNewRule('')
    logActivity('Hotel rule added', `"${text}" now applies to every recommendation.`, 'success', 'Hotel Brain')
  }

  function removeRule(rule: HotelRule) {
    setRules((current) => current.filter((item) => item.id !== rule.id))
    logActivity('Hotel rule removed', `"${rule.text}" no longer applies.`, 'warning', 'Hotel Brain')
  }

  function addAsset(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const departmentKey = isHotelManager ? null : allowedAreas[0]
    setAssets((current) => [
      {
        id: crypto.randomUUID(),
        name: file.name,
        kind: kindFromFile(file.name),
        departmentKey,
        status: isHotelManager ? 'Approved' : 'Pending approval',
        locked: false,
        addedAt: new Date().toISOString(),
      },
      ...current,
    ])
    logActivity(
      isHotelManager ? 'Asset added' : 'Asset submitted',
      isHotelManager ? `${file.name} added to the approved library.` : `${file.name} is waiting for the hotel manager to approve.`,
      isHotelManager ? 'success' : 'info',
      areaName(departmentKey),
    )
  }

  function updateAsset(asset: MediaAsset, changes: Partial<MediaAsset>, title: string, detail: string) {
    setAssets((current) => current.map((item) => (item.id === asset.id ? { ...item, ...changes } : item)))
    logActivity(title, detail, 'info', areaName(asset.departmentKey))
  }

  function forgetFeedback(reason: string) {
    for (const key of allowedAreas) {
      const counts = readStored<Record<string, number>>(`otel:${key}:design-feedback`, {})
      if (reason in counts) {
        const next = { ...counts }
        delete next[reason]
        writeStored(`otel:${key}:design-feedback`, next)
      }
    }
    setFeedbackVersion((current) => current + 1)
    logActivity('Design preference removed', `The AI will no longer avoid "${reason}".`, 'warning', 'Hotel Brain')
  }

  function forgetLearning(learning: Learning) {
    setLearnings((current) => current.filter((item) => item.id !== learning.id))
    logActivity('Learning removed', learning.text, 'warning', areaName(learning.departmentKey))
  }

  // ---------- Audiences (live from contacts) ----------
  const segments = Object.values(
    contacts.reduce<Record<string, { name: string; total: number; consented: number }>>((groups, contact) => {
      const group = groups[contact.segment] ?? { name: contact.segment, total: 0, consented: 0 }
      group.total += 1
      if (contact.permission === 'Subscribed') group.consented += 1
      groups[contact.segment] = group
      return groups
    }, {}),
  ).sort((a, b) => b.total - a.total)

  const stats = [
    { icon: BedDouble, value: String(hotel.roomCount), label: 'Bedrooms' },
    { icon: Layers3, value: String(departments.length), label: 'Business areas' },
    { icon: Tag, value: String(offers.filter((offer) => offer.status === 'Active').length), label: 'Active offers' },
    { icon: Users, value: String(contacts.length), label: 'Guest contacts' },
    { icon: Globe2, value: hotel.currency, label: hotel.timezone },
  ]

  return (
    <>
      <section className="property-hero">
        <div className="property-banner" style={{ backgroundImage: `url(${hotelHeroImage})` }}>
          <span className="property-pill">Your Hotel Brain</span>
          {isHotelManager ? (
            <button type="button" className="property-edit" onClick={() => { setDraft(hotel); setEditing(true) }}>
              <PenLine size={15} /> Edit hotel details
            </button>
          ) : (
            <span className="property-edit locked" title="Only the hotel manager can edit hotel details">
              <Lock size={14} /> Hotel manager edits
            </span>
          )}
          <div className="property-title">
            <h2>{hotel.name}</h2>
            <p>{hotel.location} · Property facts every campaign draws from</p>
          </div>
        </div>
        <div className="property-stats">
          {stats.map(({ icon: Icon, value, label }) => (
            <div key={label}>
              <Icon size={20} />
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div className="property-brand">
          <div>
            <span>Brand promise</span>
            <blockquote>“{hotel.brandPromise}”</blockquote>
          </div>
          <div>
            <span>Voice & tone</span>
            <p>{hotel.brandTone}</p>
            <em>Every campaign, email and post is written in this voice.</em>
          </div>
        </div>
      </section>

      <section className="panel brain-health">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{isHotelManager ? 'Brain health' : `Brain health · ${areas[0]?.name}`}</p>
            <h2>What the AI knows — {healthPercent}% complete</h2>
          </div>
          <span className="health-score">{healthDone} of {health.length}</span>
        </div>
        <div className="health-bar" aria-hidden="true"><i style={{ width: `${healthPercent}%` }} /></div>
        <div className="health-list">
          {health.map((item) => (
            <div key={item.label} className={`health-item ${item.done ? 'done' : ''}`}>
              {item.done ? <Check size={16} /> : <CircleDashed size={16} />}
              <div>
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </div>
              {item.action && !item.done && (
                <button type="button" className="ghost-link" onClick={item.action.run}>
                  {item.action.label} <ArrowRight size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="brain-grid">
        <section className="panel" id="brain-rules">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Hotel-wide rules</p>
              <h2>Rules the AI must follow</h2>
            </div>
            <ShieldCheck size={20} />
          </div>
          <p className="muted small">Sent with every recommendation request and shown on each recommendation.</p>
          <div className="brand-row-list">
            {rules.map((rule) => (
              <div className="brand-asset-row" key={rule.id}>
                <ShieldCheck size={14} />
                <span>{rule.text}</span>
                {isHotelManager && (
                  <button type="button" className="icon-action" aria-label={`Remove rule: ${rule.text}`} onClick={() => removeRule(rule)}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            {rules.length === 0 && <p className="muted small">No rules yet.</p>}
          </div>
          {isHotelManager ? (
            <form
              className="inline-add"
              onSubmit={(event) => {
                event.preventDefault()
                addRule()
              }}
            >
              <input aria-label="New hotel rule" placeholder="e.g. Never discount weekend stays" value={newRule} onChange={(event) => setNewRule(event.target.value)} />
              <button type="submit" className="secondary-button" disabled={!newRule.trim()}>
                <Plus size={15} /> Add rule
              </button>
            </form>
          ) : (
            <p className="scope-chip"><Lock size={13} /> Rules are set by the hotel manager</p>
          )}
          <details className="platform-guardrails">
            <summary>Always enforced by Otel Digital ({productionGuardrails.length})</summary>
            <ul>
              {productionGuardrails.map((rule) => <li key={rule}>{rule}</li>)}
            </ul>
          </details>
        </section>

        <section className="panel" id="brain-assets">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Approved assets</p>
              <h2>Asset library</h2>
            </div>
            <Image size={20} />
          </div>
          <p className="muted small">
            {isHotelManager ? 'Only approved assets can be used in campaigns. Locked assets cannot be edited per campaign.' : 'Add assets for your area; the hotel manager approves them before use.'}
          </p>
          <div className="brand-row-list">
            {visibleAssets.map((asset) => (
              <div className="brand-asset-row asset-row" key={asset.id}>
                {asset.locked ? <Lock size={14} /> : <FileText size={14} />}
                <span>
                  {asset.name}
                  <small>{asset.kind} · {areaName(asset.departmentKey)}</small>
                </span>
                {asset.status === 'Pending approval' ? (
                  isHotelManager ? (
                    <button
                      type="button"
                      className="small-approve"
                      onClick={() => updateAsset(asset, { status: 'Approved' }, 'Asset approved', `${asset.name} can now be used in campaigns.`)}
                    >
                      Approve
                    </button>
                  ) : (
                    <em className="pending-chip">Awaiting approval</em>
                  )
                ) : isHotelManager ? (
                  <button
                    type="button"
                    className="icon-action"
                    aria-label={asset.locked ? `Unlock ${asset.name}` : `Lock ${asset.name}`}
                    title={asset.locked ? 'Locked — click to unlock' : 'Editable — click to lock'}
                    onClick={() =>
                      updateAsset(asset, { locked: !asset.locked }, asset.locked ? 'Asset unlocked' : 'Asset locked', `${asset.name} is now ${asset.locked ? 'editable per campaign' : 'locked for brand consistency'}.`)
                    }
                  >
                    {asset.locked ? <Lock size={14} /> : <Unlock size={14} />}
                  </button>
                ) : (
                  <em>{asset.locked ? 'Locked' : 'Approved'}</em>
                )}
              </div>
            ))}
          </div>
          <label className="file-picker-label add-asset">
            <input type="file" onChange={addAsset} hidden />
            <span className="secondary-button"><Upload size={15} /> {isHotelManager ? 'Add asset' : 'Submit an asset'}</span>
          </label>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Audiences</p>
              <h2>Guest segments</h2>
            </div>
            <Users size={20} />
          </div>
          <p className="muted small">From your contact records. Only consented contacts receive marketing.</p>
          <div className="brand-row-list">
            {segments.map((segment) => (
              <div className="brand-asset-row" key={segment.name}>
                <Users size={14} />
                <span>{segment.name}</span>
                <em>{segment.name === 'Suppression list' ? 'Always excluded' : `${segment.consented} of ${segment.total} consented`}</em>
              </div>
            ))}
          </div>
          <button type="button" className="ghost-link" onClick={() => onNavigate('audience')}>
            Manage contacts <ArrowRight size={13} />
          </button>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Learning</p>
              <h2>What the AI has learned</h2>
            </div>
            <Sparkles size={20} />
          </div>
          <p className="muted small">From design feedback and saved campaign results. Remove anything that is wrong and the AI stops using it.</p>
          <div className="brand-row-list">
            {feedback.map(([reason, count]) => (
              <div className="brand-asset-row" key={reason}>
                <span className="insight-kind avoid">Avoid</span>
                <span>"{reason}" in designs <small>flagged {count}×</small></span>
                <button type="button" className="icon-action" aria-label={`Forget: ${reason}`} onClick={() => forgetFeedback(reason)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {learnings.map((learning) => (
              <div className="brand-asset-row" key={learning.id}>
                <span className={`insight-kind ${learning.kind.toLowerCase()}`}>{learning.kind}</span>
                <span>{learning.text} <small>{learning.campaignName} · {areaName(learning.departmentKey)}</small></span>
                <button type="button" className="icon-action" aria-label={`Forget: ${learning.text}`} onClick={() => forgetLearning(learning)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {feedback.length === 0 && learnings.length === 0 && (
              <p className="muted small">Nothing yet. Give design feedback or save insights from a campaign's Results to teach the AI.</p>
            )}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Business areas</p>
            <h2>{isHotelManager ? 'What the brain knows about each area' : `What the brain knows about ${areas[0]?.name}`}</h2>
          </div>
        </div>
        <div className="department-status-grid four">
          {areas.map((department) => {
            const areaFreshness = resolveFreshness(department, signals)
            const confidence = cappedConfidence(department.recommendation.confidence, areaFreshness.state)
            const results = forDepartment(department.key)
            const live = results.find((result) => result.state === 'live') ?? results.find((result) => result.state === 'completed')
            const pending = results.find((result) => result.state === 'projection')
            const latest = areaFreshness.latestSignal
            return (
              <article className="department-status-card" key={department.key} onClick={() => openArea(department.key)}>
                <div className="department-status-image" style={{ backgroundImage: `url(${department.image})` }}>
                  <span className={`department-freshness freshness-${areaFreshness.state.toLowerCase()}`}>
                    {areaFreshness.state} · {ageLabel(areaFreshness.ageDays)}
                  </span>
                </div>
                <div className="department-status-body">
                  <h3>{department.name}</h3>
                  <p className="department-status-headline">{department.subline}</p>
                  <p>
                    <strong>AI says:</strong> {department.recommendation.title} <span className="muted-inline">({department.recommendation.outcome}, {confidence.toLowerCase()} confidence)</span>
                  </p>
                  {latest?.state === 'Confirmed' && (
                    <p className="stale-rec-note">New data confirmed since this recommendation — open the area to refresh it.</p>
                  )}
                  <p>
                    <strong>Campaign:</strong>{' '}
                    {live
                      ? `${live.campaign.name} — ${live.campaign.status.toLowerCase()}, ${formatCount(live.shown.bookings)} ${resultUnit(department)} ${live.state === 'live' ? 'so far' : 'total'}`
                      : pending
                        ? `${pending.campaign.name} — ${pending.campaign.status.toLowerCase()}`
                        : 'None — not recommended right now'}
                  </p>
                  <div className="department-status-divider"></div>
                  <p className="department-status-source">
                    Source: {latest && latest.state === 'Confirmed' ? `${latest.summary} (${ageLabel(areaFreshness.ageDays)})` : department.signal}
                  </p>
                  <div className="department-status-footer">
                    <span>Managed by {department.manager}{department.manager === user.name ? ' (you)' : ''}</span>
                    <span className="department-status-arrow" aria-hidden="true"><ArrowRight size={15} /></span>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {editing && (
        <Modal title="Edit hotel details" onClose={() => setEditing(false)} wide>
          <div className="hotel-facts-form">
            <label className="span-two"><span>Hotel name</span><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
            <label><span>Location</span><input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} /></label>
            <label><span>Bedrooms</span><input type="number" min={1} value={draft.roomCount} onChange={(e) => setDraft({ ...draft, roomCount: Number(e.target.value) })} /></label>
            <label><span>Currency</span><input value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value })} /></label>
            <label><span>Timezone</span><input value={draft.timezone} onChange={(e) => setDraft({ ...draft, timezone: e.target.value })} /></label>
            <label className="span-full"><span>Brand promise</span><input value={draft.brandPromise} onChange={(e) => setDraft({ ...draft, brandPromise: e.target.value })} /></label>
            <label className="span-full"><span>Voice & tone</span><input value={draft.brandTone} onChange={(e) => setDraft({ ...draft, brandTone: e.target.value })} /></label>
            <div className="hotel-facts-actions">
              <button type="button" className="secondary-button" onClick={() => setEditing(false)}>Cancel</button>
              <button type="button" className="primary-button" onClick={saveFacts}>Save hotel details</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
