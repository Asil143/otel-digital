import { AlertTriangle, ArrowRight, CheckCircle2, Download, FileDown, Lock, Search, ShieldOff, Upload } from 'lucide-react'
import { useState, type ChangeEvent } from 'react'
import { Modal } from '../../components/ui/Modal'
import { baseSuppressed, consentBases, segmentCatalogue, suppressionReasons } from '../../data/contacts'
import { departments } from '../../data/departments'
import { logActivity } from '../../lib/activityLog'
import { csvTemplate, LOW_CONSENT, previewImport, segmentStats, toCsv, UNASSIGNED, useContacts, type ImportPreview, type SegmentStats } from '../../lib/audience'
import { useCampaigns } from '../../lib/campaignStore'
import { initials, useCurrentUser } from '../../lib/currentUser'
import { formatCount, formatMoney } from '../../lib/results'
import { formatDate, localDate } from '../../services/campaigns'
import type { CampaignRecord, CampaignStage, Contact, DepartmentKey } from '../../types/domain'

type PermissionFilter = 'All' | 'Subscribed' | 'Unknown' | 'Unsubscribed' | 'Suppressed'
type PendingModal =
  | { kind: 'consent'; contact: Contact; basis: string }
  | { kind: 'suppress'; contact: Contact; reason: string }
  | { kind: 'import'; preview: ImportPreview }
  | null

const areaName = (key: DepartmentKey) => departments.find((item) => item.key === key)?.name ?? key
const statusClass = (status: string) => `campaign-status-chip status-${status.toLowerCase().replace(/\s+/g, '-')}`
const percent = (rate: number) => `${Math.round(rate * 100)}%`

function consentState(contact: Contact): PermissionFilter {
  return contact.suppressed ? 'Suppressed' : contact.permission
}

function download(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function scrollTo(id: string) {
  window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30)
}

export function AudienceWorkspace({ onOpenCampaign }: { onOpenCampaign: (campaign: CampaignRecord, stage: CampaignStage) => void }) {
  const { isHotelManager, canAccess, areaName: myArea } = useCurrentUser()
  const [contacts, setContacts] = useContacts()
  const { campaigns: allCampaigns } = useCampaigns()
  const [today] = useState(() => localDate())
  const [areaFilter, setAreaFilter] = useState<DepartmentKey | 'all'>('all')
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [segmentFilter, setSegmentFilter] = useState<string>('all')
  const [permissionFilter, setPermissionFilter] = useState<PermissionFilter>('All')
  const [pending, setPending] = useState<PendingModal>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  // ---------- Scope ----------
  const stats = segmentStats(contacts)
  const mySegments = stats.filter((segment) => segment.areas.some((area) => canAccess(area)))
  const myNames = new Set(mySegments.map((segment) => segment.name))
  const listed = mySegments
    .filter((segment) => areaFilter === 'all' || segment.areas.includes(areaFilter))
    .sort((a, b) => b.total - a.total)
  const visibleContacts = contacts.filter((contact) => myNames.has(contact.segment) || (isHotelManager && contact.segment === UNASSIGNED))
  const campaigns = allCampaigns.filter((campaign) => canAccess(campaign.departmentKey))
  const campaignsUsing = (name: string) => campaigns.filter((campaign) => campaign.audience.includes(name))

  // ---------- Summary ----------
  const segmentTotal = mySegments.reduce((sum, segment) => sum + segment.total, 0)
  const segmentConsented = mySegments.reduce((sum, segment) => sum + segment.consented, 0)
  const lowSegments = mySegments.filter((segment) => segment.rate < LOW_CONSENT)
  const awaiting = visibleContacts.filter((contact) => consentState(contact) === 'Unknown')
  const unassigned = visibleContacts.filter((contact) => contact.segment === UNASSIGNED)
  const suppressedHere = visibleContacts.filter((contact) => contact.suppressed).length
  const areaCount = new Set(mySegments.flatMap((segment) => segment.areas)).size

  // Low-consent segments that an unfinished campaign depends on
  const atRisk = lowSegments
    .map((segment) => ({ segment, using: campaignsUsing(segment.name).filter((campaign) => campaign.status !== 'Completed') }))
    .filter((entry) => entry.using.length > 0)

  const collapsed = !showAll && listed.length > 10
  const rows = collapsed ? listed.slice(0, 10) : listed
  const selected = listed.find((segment) => segment.name === selectedName) ?? mySegments.find((segment) => segment.name === selectedName) ?? listed[0] ?? null

  // ---------- Contacts table ----------
  const needle = query.trim().toLowerCase()
  // Once the last unassigned import is assigned, that filter option disappears — fall back to all segments.
  const activeSegment = segmentFilter === UNASSIGNED && unassigned.length === 0 ? 'all' : segmentFilter
  const bySegment = visibleContacts.filter((contact) => activeSegment === 'all' || contact.segment === activeSegment)
  const searched = bySegment.filter((contact) => !needle || `${contact.name} ${contact.email}`.toLowerCase().includes(needle))
  const shown = searched.filter((contact) => permissionFilter === 'All' || consentState(contact) === permissionFilter)

  function update(contact: Contact, patch: Partial<Contact>) {
    setContacts((current) => current.map((item) => (item.id === contact.id ? { ...item, ...patch } : item)))
  }

  function showContacts(options: { segment?: string; permission?: PermissionFilter }) {
    setQuery('')
    setSegmentFilter(options.segment ?? 'all')
    setPermissionFilter(options.permission ?? 'All')
    scrollTo('audience-contacts')
  }

  function recordConsent(contact: Contact, basis: string) {
    update(contact, { permission: 'Subscribed', consentBasis: basis })
    logActivity('Consent recorded', `${contact.name} · ${basis}. Now included in ${contact.segment} sends.`, 'success', 'Audience')
    setPending(null)
  }

  function unsubscribe(contact: Contact) {
    update(contact, { permission: 'Unsubscribed', consentBasis: null })
    logActivity('Contact unsubscribed', `${contact.name} removed from email, social custom audiences and every future campaign.`, 'warning', 'Audience')
  }

  function suppress(contact: Contact, reason: string) {
    update(contact, { suppressed: true, suppressionReason: reason, permission: 'Unsubscribed', consentBasis: null })
    logActivity('Contact suppressed', `${contact.name} · ${reason}. Never contacted on any channel.`, 'warning', 'Audience')
    setPending(null)
  }

  function liftSuppression(contact: Contact) {
    update(contact, { suppressed: false, suppressionReason: null })
    logActivity('Suppression lifted', `${contact.name}’s address was fixed. Consent must be recorded again before any send.`, 'info', 'Audience')
  }

  function assign(contact: Contact, segment: string) {
    update(contact, { segment })
    logActivity('Contact assigned', `${contact.name} → ${segment}.`, 'info', 'Audience')
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPending({ kind: 'import', preview: previewImport(file.name, String(reader.result ?? ''), contacts, today) })
    reader.readAsText(file)
  }

  function confirmImport(preview: ImportPreview) {
    setContacts((current) => [...preview.ready, ...current])
    const consented = preview.ready.filter((contact) => contact.permission === 'Subscribed').length
    const message = `Imported ${preview.ready.length} contact${preview.ready.length === 1 ? '' : 's'} from ${preview.fileName}: ${consented} with consent, ${preview.ready.length - consented} excluded until confirmed${preview.duplicates.length ? `, ${preview.duplicates.length} already on file skipped` : ''}.`
    setNotice(message)
    logActivity('Contacts imported', message, 'success', 'Audience')
    setPending(null)
    showContacts({ segment: preview.unassigned ? UNASSIGNED : 'all' })
  }

  function handleExport() {
    const rows = shown.map((contact) => [
      contact.name,
      contact.email,
      contact.segment,
      contact.permission,
      contact.consentBasis ?? '',
      contact.suppressed ? 'yes' : 'no',
      contact.suppressionReason ?? '',
      contact.lastActivity ?? '',
      contact.guestValue,
    ])
    download(`otel-audience-${today}.csv`, toCsv([['name', 'email', 'segment', 'consent', 'consent_basis', 'suppressed', 'suppression_reason', 'last_activity', 'guest_value'], ...rows]))
    logActivity('Audience exported', `${shown.length} contact${shown.length === 1 ? '' : 's'} downloaded as CSV (current filters).`, 'info', 'Audience')
  }

  const attention: { key: string; tag: string; tone: 'warning' | 'info'; title: string; detail: string; label: string; run: () => void }[] = [
    ...(awaiting.length
      ? [
          {
            key: 'awaiting',
            tag: 'Consent',
            tone: 'warning' as const,
            title: isHotelManager
              ? `${awaiting.length} contact${awaiting.length === 1 ? ' has' : 's have'} no recorded consent`
              : `${awaiting.length} guest${awaiting.length === 1 ? ' in your segments awaits' : 's in your segments await'} consent`,
            detail: isHotelManager
              ? 'They’re left out of every send until you record how they opted in, or mark them as opted out.'
              : 'The hotel manager records consent. Until then they’re left out of your campaigns.',
            label: isHotelManager ? 'Review' : 'View',
            run: () => showContacts({ permission: 'Unknown' }),
          },
        ]
      : []),
    ...(isHotelManager && unassigned.length
      ? [
          {
            key: 'unassigned',
            tag: 'Import',
            tone: 'info' as const,
            title: `${unassigned.length} imported contact${unassigned.length === 1 ? ' isn’t' : 's aren’t'} in a segment`,
            detail: 'Campaigns target segments, so these guests won’t receive anything until you assign one.',
            label: 'Assign',
            run: () => showContacts({ segment: UNASSIGNED }),
          },
        ]
      : []),
    ...atRisk.map(({ segment, using }) => ({
      key: `low-${segment.name}`,
      tag: 'Low consent',
      tone: 'warning' as const,
      title: `${segment.name}: only ${percent(segment.rate)} can be emailed`,
      detail: `Used by ${using.map((campaign) => campaign.name).join(', ')}. ${formatCount(segment.consented)} of ${formatCount(segment.total)} reachable — ask for opt-in at booking, check-in and enquiry.`,
      label: 'View segment',
      run: () => {
        setSelectedName(segment.name)
        setAreaFilter('all')
        setShowAll(true)
        scrollTo('audience-segments')
      },
    })),
  ]

  return (
    <>
      <section className="results-overview">
        <div>
          <span>Segments</span>
          <strong>{mySegments.length}</strong>
          <em>{isHotelManager ? `used by ${areaCount} business areas` : `used by ${myArea}`}</em>
        </div>
        <div className={lowSegments.length ? 'tile-warning' : ''}>
          <span>Consent rate</span>
          <strong>{percent(segmentTotal ? segmentConsented / segmentTotal : 0)}</strong>
          <em>
            across {mySegments.length === 1 ? 'your segment' : `${mySegments.length} segments`} · {lowSegments.length} under 50%
          </em>
        </div>
        <div className={awaiting.length ? 'tile-warning' : ''}>
          <span>Consent to confirm</span>
          <strong>{awaiting.length}</strong>
          <em>left out of every send</em>
        </div>
        <div>
          <span>Suppressed</span>
          <strong>{formatCount(baseSuppressed + suppressedHere)}</strong>
          <em>never contacted, on any channel</em>
        </div>
      </section>

      <section className="panel campaign-queue">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Consent checks</p>
            <h2>Needs attention</h2>
          </div>
          <span className="muted small">Nothing is sent to a guest without recorded consent, and suppressed guests are never contacted.</span>
        </div>
        {attention.length === 0 ? (
          <p className="queue-empty">
            <CheckCircle2 size={16} /> Nothing needs attention. Every record has a consent basis and your campaign segments are above 50% consent.
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
                <button type="button" className="secondary-button small" onClick={item.run}>
                  {item.label} <ArrowRight size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="power-grid" id="audience-segments">
        <section className="panel span-2">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Segments</p>
              <h2>{isHotelManager ? 'Hotel-wide guest segments' : `${myArea} segments`}</h2>
            </div>
            {isHotelManager && (
              <select className="filter-select" aria-label="Filter segments by business area" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value as DepartmentKey | 'all')}>
                <option value="all">All business areas</option>
                {departments.map((department) => (
                  <option key={department.key} value={department.key}>
                    {department.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <p className="muted small segment-note">List sizes are synced from your guest systems (demo figures). Reachable means consented and not suppressed.</p>
          <div className="segment-list">
            <div className="segment-row segment-head">
              <span>Segment</span>
              <span>Used by</span>
              <span>Consent</span>
              <span>Reachable</span>
            </div>
            {rows.map((segment) => (
              <button
                type="button"
                key={segment.name}
                className={`segment-row ${selected?.name === segment.name ? 'selected' : ''}`}
                aria-pressed={selected?.name === segment.name}
                onClick={() => setSelectedName(segment.name)}
              >
                <span className="segment-name">
                  <strong>{segment.name}</strong>
                  <small>{segment.rule}</small>
                </span>
                <span className="segment-areas">{segment.areas.map(areaName).join(', ')}</span>
                <ConsentBar segment={segment} />
                <span className="segment-reach">
                  <strong>{formatCount(segment.consented)}</strong>
                  <small>of {formatCount(segment.total)}</small>
                </span>
              </button>
            ))}
          </div>
          {listed.length > 10 && (
            <button type="button" className="ghost-link segment-more" onClick={() => setShowAll((current) => !current)}>
              {collapsed ? `Show all ${listed.length} segments` : 'Show the 10 largest'}
            </button>
          )}
        </section>

        <section className="panel segment-detail">
          {selected ? (
            <>
              <p className="eyebrow">Segment</p>
              <h2>{selected.name}</h2>
              <p className="muted small">Used by {selected.areas.map(areaName).join(', ')}</p>
              <div className="detail-results">
                <div>
                  <strong>{formatCount(selected.consented)}</strong>
                  <span>reachable</span>
                </div>
                <div>
                  <strong>{formatCount(selected.total)}</strong>
                  <span>on the list</span>
                </div>
                <div>
                  <strong>{percent(selected.rate)}</strong>
                  <span>consented</span>
                </div>
              </div>
              <ConsentBar segment={selected} />
              {selected.rate < LOW_CONSENT && (
                <p className="offer-warning">
                  <AlertTriangle size={13} /> Under 50% consent — sends to this segment will be small. Ask for opt-in at booking, check-in and enquiry.
                </p>
              )}
              <dl className="segment-facts">
                <dt>Rule</dt>
                <dd>{selected.rule}</dd>
                <dt>Source</dt>
                <dd>{selected.source}</dd>
                <dt>Consent basis</dt>
                <dd>{selected.consentBasis}</dd>
              </dl>

              <div className="detail-section">
                <h3>
                  Campaigns using it <span>{campaignsUsing(selected.name).length}</span>
                </h3>
                {campaignsUsing(selected.name).length === 0 ? (
                  <p className="muted small">Not in a campaign yet. Add it on a campaign’s Audience step.</p>
                ) : (
                  <div className="segment-campaigns">
                    {campaignsUsing(selected.name).map((campaign) => (
                      <button type="button" key={campaign.id} className="used-chip" onClick={() => onOpenCampaign(campaign, 'Audience')}>
                        <span className={statusClass(campaign.status)}>{campaign.status}</span>
                        <strong>{campaign.name}</strong>
                        <ArrowRight size={13} />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="detail-section">
                <h3>
                  Individual records <span>{selected.records.length} on this device</span>
                </h3>
                <p className="muted small">
                  {selected.records.length === 0
                    ? 'No individual records yet — the counts come from the synced list.'
                    : `${selected.unknown} awaiting consent · ${selected.records.filter((contact) => contact.suppressed).length} suppressed`}
                </p>
                {selected.records.length > 0 && (
                  <button type="button" className="ghost-link" onClick={() => showContacts({ segment: selected.name })}>
                    Show in contacts <ArrowRight size={13} />
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="muted">No segments for this business area.</p>
          )}
        </section>
      </div>

      <section className="panel" id="audience-contacts">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Guest records</p>
            <h2>Contacts</h2>
          </div>
          {isHotelManager ? (
            <div className="hero-actions">
              <label className="file-picker-label">
                <input type="file" accept=".csv,text/csv" onChange={handleFile} hidden data-testid="contacts-file" />
                <span className="secondary-button">
                  <Upload size={15} /> Import contacts
                </span>
              </label>
              <button type="button" className="secondary-button" onClick={() => download('otel-contacts-template.csv', csvTemplate)}>
                <FileDown size={15} /> Template
              </button>
              <button type="button" className="secondary-button" onClick={handleExport} disabled={shown.length === 0}>
                <Download size={15} /> Export {shown.length === visibleContacts.length ? 'all' : `${shown.length}`}
              </button>
            </div>
          ) : (
            <span className="scope-chip">
              <Lock size={13} /> Imports, exports and consent changes: hotel manager
            </span>
          )}
        </div>
        <p className="muted small">
          Individual records synced recently or imported on this device. Consent changes here update segment counts and every campaign audience.
        </p>
        {notice && <div className="scope-notice">{notice}</div>}

        <div className="campaign-toolbar">
          <label className="campaign-search">
            <Search size={15} />
            <input type="search" placeholder="Search by name or email" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search contacts" />
          </label>
          <select className="filter-select" aria-label="Filter contacts by segment" value={activeSegment} onChange={(event) => setSegmentFilter(event.target.value)}>
            <option value="all">All segments</option>
            {isHotelManager && unassigned.length > 0 && <option value={UNASSIGNED}>Unassigned · {unassigned.length}</option>}
            {mySegments
              .filter((segment) => segment.records.length > 0)
              .map((segment) => (
                <option key={segment.name} value={segment.name}>
                  {segment.name} · {segment.records.length}
                </option>
              ))}
          </select>
        </div>
        <div className="audience-filter-row">
          {(['All', 'Subscribed', 'Unknown', 'Unsubscribed', 'Suppressed'] as const).map((state) => (
            <button type="button" key={state} className={permissionFilter === state ? 'selected' : ''} onClick={() => setPermissionFilter(state)}>
              {state === 'Unknown' ? 'Consent to confirm' : state} · {state === 'All' ? searched.length : searched.filter((contact) => consentState(contact) === state).length}
            </button>
          ))}
        </div>

        <div className={`contact-table ${isHotelManager ? 'with-actions' : ''}`}>
          <div className="contact-table-head">
            <span>Guest</span>
            <span>Segment</span>
            <span>Last activity</span>
            <span>Consent</span>
            <span>Guest value</span>
            {isHotelManager && <span>Actions</span>}
          </div>
          {shown.map((contact) => {
            const state = consentState(contact)
            return (
              <div className="contact-table-row" key={contact.id}>
                <span className="contact-name">
                  <span className="contact-avatar">{initials(contact.name)}</span>
                  <span>
                    <strong>{contact.name}</strong>
                    <em>{contact.email}</em>
                  </span>
                </span>
                <span>
                  {contact.segment === UNASSIGNED && isHotelManager ? (
                    <select className="assign-select" aria-label={`Assign ${contact.name} to a segment`} value="" onChange={(event) => assign(contact, event.target.value)}>
                      <option value="" disabled>
                        Assign a segment…
                      </option>
                      {segmentCatalogue.map((def) => (
                        <option key={def.name} value={def.name}>
                          {def.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    contact.segment
                  )}
                </span>
                <span>{contact.lastActivity ? formatDate(contact.lastActivity) : contact.addedAt ? `Imported ${formatDate(contact.addedAt)}` : '—'}</span>
                <span className="consent-cell">
                  <span className={`permission-pill permission-${state.toLowerCase()}`}>{state === 'Unknown' ? 'To confirm' : state}</span>
                  <small>{contact.suppressed ? contact.suppressionReason : contact.permission === 'Subscribed' ? contact.consentBasis : state === 'Unknown' ? 'Not sent anything' : 'Opted out'}</small>
                </span>
                <span>{formatMoney(contact.guestValue)}</span>
                {isHotelManager && (
                  <span className="contact-actions">
                    {state === 'Unknown' && (
                      <>
                        <button type="button" className="ghost-link" onClick={() => setPending({ kind: 'consent', contact, basis: segmentCatalogue.find((def) => def.name === contact.segment)?.consentBasis ?? consentBases[0] })}>
                          Record consent
                        </button>
                        <button type="button" className="ghost-link muted-link" onClick={() => unsubscribe(contact)}>
                          Opted out
                        </button>
                      </>
                    )}
                    {state === 'Subscribed' && (
                      <button type="button" className="ghost-link muted-link" onClick={() => unsubscribe(contact)}>
                        Unsubscribe
                      </button>
                    )}
                    {state === 'Unsubscribed' && (
                      <button type="button" className="ghost-link" onClick={() => setPending({ kind: 'consent', contact, basis: consentBases[0] })}>
                        Record new opt-in
                      </button>
                    )}
                    {state === 'Suppressed' && contact.suppressionReason === 'Hard bounce' && (
                      <button type="button" className="ghost-link" onClick={() => liftSuppression(contact)}>
                        Lift (address fixed)
                      </button>
                    )}
                    {state !== 'Suppressed' && (
                      <button type="button" className="ghost-link danger" onClick={() => setPending({ kind: 'suppress', contact, reason: suppressionReasons[0] })}>
                        <ShieldOff size={13} /> Suppress
                      </button>
                    )}
                  </span>
                )}
              </div>
            )
          })}
          {shown.length === 0 && (
            <div className="contact-table-empty">
              {visibleContacts.length === 0 ? (
                'No individual records for your segments yet.'
              ) : (
                <>
                  No contacts match these filters.{' '}
                  <button type="button" className="ghost-link" onClick={() => showContacts({})}>
                    Clear filters
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {pending?.kind === 'consent' && (
        <Modal title="Record consent" onClose={() => setPending(null)}>
          <p>
            How did <strong>{pending.contact.name}</strong> agree to receive marketing? This is stored as the consent basis and included in exports.
          </p>
          <label className="modal-field">
            <span>Consent basis</span>
            <select value={pending.basis} onChange={(event) => setPending({ ...pending, basis: event.target.value })}>
              {consentBases.map((basis) => (
                <option key={basis}>{basis}</option>
              ))}
            </select>
          </label>
          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={() => setPending(null)}>
              Cancel
            </button>
            <button type="button" className="primary-button" onClick={() => recordConsent(pending.contact, pending.basis)}>
              Record consent
            </button>
          </div>
        </Modal>
      )}

      {pending?.kind === 'suppress' && (
        <Modal title={`Suppress ${pending.contact.name}?`} onClose={() => setPending(null)}>
          <p>Suppressed guests are never contacted on any channel, even when they’re in a campaign segment. Their consent is withdrawn.</p>
          <label className="modal-field">
            <span>Reason</span>
            <select value={pending.reason} onChange={(event) => setPending({ ...pending, reason: event.target.value })}>
              {suppressionReasons.map((reason) => (
                <option key={reason}>{reason}</option>
              ))}
            </select>
          </label>
          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={() => setPending(null)}>
              Cancel
            </button>
            <button type="button" className="primary-button danger" onClick={() => suppress(pending.contact, pending.reason)}>
              <ShieldOff size={14} /> Suppress contact
            </button>
          </div>
        </Modal>
      )}

      {pending?.kind === 'import' && <ImportModal preview={pending.preview} onCancel={() => setPending(null)} onConfirm={() => confirmImport(pending.preview)} />}
    </>
  )
}

function ConsentBar({ segment }: { segment: SegmentStats }) {
  const low = segment.rate < LOW_CONSENT
  return (
    <span className={`consent-bar ${low ? 'low' : ''}`} title={`${formatCount(segment.consented)} of ${formatCount(segment.total)} consented`}>
      <span className="consent-track">
        <span style={{ width: `${Math.round(segment.rate * 100)}%` }} />
      </span>
      <em>{percent(segment.rate)}</em>
    </span>
  )
}

function ImportModal({ preview, onCancel, onConfirm }: { preview: ImportPreview; onCancel: () => void; onConfirm: () => void }) {
  const consented = preview.ready.filter((contact) => contact.permission === 'Subscribed').length
  const count = preview.ready.length
  return (
    <Modal title="Import preview" onClose={onCancel} wide>
      <p className="muted small">{preview.fileName}</p>
      {preview.missingColumns.includes('email') ? (
        <p className="form-errors" role="alert">
          This file has no email column, so nothing can be imported. Download the template to see the expected columns.
        </p>
      ) : (
        <>
          <ul className="import-summary">
            <li className="good">
              <strong>{count}</strong> new contact{count === 1 ? '' : 's'} ready to import
            </li>
            {preview.duplicates.length > 0 && (
              <li>
                <strong>{preview.duplicates.length}</strong> already on file — skipped
              </li>
            )}
            {preview.invalid.length > 0 && (
              <li className="bad">
                <strong>{preview.invalid.length}</strong> row{preview.invalid.length === 1 ? '' : 's'} can’t be imported:{' '}
                {preview.invalid
                  .slice(0, 3)
                  .map((row) => `line ${row.line} (${row.reason})`)
                  .join('; ')}
                {preview.invalid.length > 3 ? '…' : ''}
              </li>
            )}
            {preview.unassigned > 0 && (
              <li>
                <strong>{preview.unassigned}</strong> don’t match a segment — assign them after importing
              </li>
            )}
            <li className={preview.hasConsentColumn ? '' : 'bad'}>
              {preview.hasConsentColumn ? (
                <>
                  <strong>{consented}</strong> with consent, <strong>{count - consented}</strong> without — those stay out of every send until consent is recorded
                </>
              ) : (
                <>No consent column found — everyone is imported as “to confirm” and left out of sends until you record consent.</>
              )}
            </li>
          </ul>
          {count > 0 && (
            <div className="import-preview-rows">
              {preview.ready.slice(0, 5).map((contact) => (
                <div key={contact.id}>
                  <strong>{contact.name}</strong>
                  <span>{contact.email}</span>
                  <span>{contact.segment}</span>
                  <span className={`permission-pill permission-${contact.permission.toLowerCase()}`}>{contact.permission === 'Unknown' ? 'To confirm' : contact.permission}</span>
                </div>
              ))}
              {count > 5 && <p className="muted small">and {count - 5} more</p>}
            </div>
          )}
        </>
      )}
      <div className="form-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="primary-button" onClick={onConfirm} disabled={count === 0}>
          Import {count} contact{count === 1 ? '' : 's'}
        </button>
      </div>
    </Modal>
  )
}
