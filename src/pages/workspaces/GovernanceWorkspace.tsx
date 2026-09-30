import { ArrowRight, CheckCircle2, Download, Search, ShieldAlert, ShieldCheck, ShieldOff } from 'lucide-react'
import { useState } from 'react'
import { ExecutionLayer } from '../../components/operations/ExecutionLayer'
import type { AppRoute } from '../../config/routes'
import { seedRules } from '../../data/brain'
import { departments } from '../../data/departments'
import { seedOffers } from '../../data/offers'
import { recordActivity, timeAgo, useAuditLog } from '../../lib/activityLog'
import { useAssets } from '../../lib/assets'
import { areasForSegment, toCsv, useContacts } from '../../lib/audience'
import { useCampaigns } from '../../lib/campaignStore'
import { demoUsers, initials, useCurrentUser } from '../../lib/currentUser'
import { resolveFreshness, STALE_AFTER_DAYS } from '../../lib/freshness'
import { guardrailChecks, type CheckAction, type CheckStatus } from '../../lib/governance'
import { useSignals } from '../../lib/signalStore'
import { usePersistentState, writeStored } from '../../lib/usePersistentState'
import { formatDateTime, localDate } from '../../services/campaigns'
import type { HotelRule, Offer, SourceState } from '../../types/domain'

const statusLabel: Record<CheckStatus, string> = { pass: 'Passing', enforced: 'Enforced', attention: 'Needs attention', off: 'Not set' }
const statusIcon: Record<CheckStatus, typeof ShieldCheck> = { pass: CheckCircle2, enforced: ShieldCheck, attention: ShieldAlert, off: ShieldOff }

const permissions: { label: string; manager: string; department: string }[] = [
  { label: 'Update business data and confirm figures', manager: 'All areas', department: 'Own area' },
  { label: 'Create and edit campaigns', manager: 'All areas', department: 'Own area' },
  { label: 'Send campaigns for approval', manager: 'Yes', department: 'Own area' },
  { label: 'Approve channels, schedule and publish', manager: 'Yes', department: '—' },
  { label: 'Offers and key dates', manager: 'All areas', department: 'Own area' },
  { label: 'Upload files and media', manager: 'Approved on upload', department: 'Needs approval' },
  { label: 'Lock brand files and templates', manager: 'Yes', department: '—' },
  { label: 'Record consent, import and export contacts', manager: 'Yes', department: '—' },
  { label: 'Hotel facts, rules and integrations', manager: 'Yes', department: '—' },
  { label: 'Results and audit log', manager: 'Whole hotel', department: 'Own area' },
]

const confidenceCaps: { state: SourceState; cap: string; when: string }[] = [
  { state: 'Confirmed', cap: 'High', when: 'Confirmed by the area manager in the last 14 days' },
  { state: 'Approximate', cap: 'Medium', when: 'From a 30-second check-in (directional)' },
  { state: 'Detected', cap: 'Medium', when: 'Extracted by AI, not yet confirmed — not used until it is' },
  { state: 'Stale', cap: 'Low', when: `Older than ${STALE_AFTER_DAYS} days` },
  { state: 'Unavailable', cap: 'Low', when: 'No source connected' },
]

export function GovernanceWorkspace({ onNavigate }: { onNavigate: (route: AppRoute) => void }) {
  const { user, isHotelManager, canAccess, areaName } = useCurrentUser()
  const [signals] = useSignals()
  const { campaigns: allCampaigns } = useCampaigns()
  const [allAssets] = useAssets()
  const [allOffers] = usePersistentState<Offer[]>('otel:offers', seedOffers)
  const [allContacts] = useContacts()
  const [rules] = usePersistentState<HotelRule[]>('otel:hotel-rules', seedRules)
  const allAudit = useAuditLog()
  const [query, setQuery] = useState('')
  const [areaFilter, setAreaFilter] = useState('all')
  const [personFilter, setPersonFilter] = useState('all')
  const [shown, setShown] = useState(15)
  const [weekAgo] = useState(() => new Date(Date.now() - 7 * 86_400_000).toISOString())

  // ---------- Scope ----------
  const areas = departments.filter((department) => canAccess(department.key))
  const campaigns = allCampaigns.filter((campaign) => canAccess(campaign.departmentKey))
  const assets = allAssets.filter((asset) => asset.departmentKey === null || canAccess(asset.departmentKey))
  const offers = allOffers.filter((offer) => canAccess(offer.departmentKey))
  const contacts = allContacts.filter((contact) => isHotelManager || areasForSegment(contact.segment).some((area) => canAccess(area)))
  const audit = allAudit.filter((event) => isHotelManager || event.area === areaName || event.actor === user.name)

  const checks = guardrailChecks({ areas, signals, campaigns, assets, offers, contacts, rules, audit, isHotelManager })
  const attention = checks.filter((check) => check.status === 'attention')
  const passing = checks.filter((check) => check.status === 'pass' || check.status === 'enforced')

  const detected = areas.filter((area) => resolveFreshness(area, signals).latestSignal?.state === 'Detected').length
  const approvals = campaigns.filter((campaign) => campaign.status === 'Needs approval').length
  const pendingAssets = assets.filter((asset) => asset.status === 'Pending approval').length
  const recent = audit.filter((event) => (event.at ?? '') >= weekAgo)

  // ---------- Audit log ----------
  const needle = query.trim().toLowerCase()
  const people = [...new Set(audit.map((event) => event.actor ?? 'Unknown'))].sort()
  const auditAreas = [...new Set(audit.map((event) => event.area ?? 'Hotel-wide'))].sort()
  const filtered = audit
    .filter((event) => areaFilter === 'all' || (event.area ?? 'Hotel-wide') === areaFilter)
    .filter((event) => personFilter === 'all' || (event.actor ?? 'Unknown') === personFilter)
    .filter((event) => !needle || `${event.title} ${event.detail} ${event.actor ?? ''} ${event.area ?? ''}`.toLowerCase().includes(needle))
    .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))

  function runAction(action: CheckAction) {
    if (action.area) {
      writeStored('otel:active-department', action.area)
      onNavigate('departments')
    } else if (action.route) {
      onNavigate(action.route)
    }
  }

  function exportAudit() {
    const csv = toCsv([
      ['time', 'person', 'area', 'action', 'detail'],
      ...filtered.map((event) => [event.at ?? '', event.actor ?? '', event.area ?? 'Hotel-wide', event.title, event.detail]),
    ])
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `otel-audit-log-${localDate()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <section className="results-overview">
        <div className={attention.length ? 'tile-warning' : ''}>
          <span>Guardrails</span>
          <strong>
            {passing.length} of {checks.length}
          </strong>
          <em>{attention.length ? `passing · ${attention.length} need attention` : 'passing'}</em>
        </div>
        <div>
          <span>Waiting on a person</span>
          <strong>{detected + approvals + pendingAssets}</strong>
          <em>
            {detected} data update{detected === 1 ? '' : 's'} · {approvals} approval{approvals === 1 ? '' : 's'} · {pendingAssets} asset{pendingAssets === 1 ? '' : 's'}
          </em>
        </div>
        <div>
          <span>Audit events · 7 days</span>
          <strong>{recent.length}</strong>
          <em>{audit[0] ? `latest: ${audit[0].title.toLowerCase()} · ${audit[0].actor ?? 'unknown'}` : 'nothing recorded yet'}</em>
        </div>
        <div>
          <span>People</span>
          <strong>{isHotelManager ? demoUsers.length : 1}</strong>
          <em>{isHotelManager ? '1 hotel manager · 8 department managers' : `you · ${user.title}`}</em>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Production guardrails</p>
            <h2>Live checks</h2>
          </div>
          <span className="muted small">Checked against the current data{isHotelManager ? ' across the hotel' : ` for ${areaName}`}, every time this page opens.</span>
        </div>
        <div className="guardrail-checks">
          {checks.map((check) => {
            const Icon = statusIcon[check.status]
            return (
              <div className={`guardrail-check status-${check.status}`} key={check.id}>
                <Icon size={18} />
                <span className="guardrail-text">
                  <strong>{check.title}</strong>
                  <small>{check.how}</small>
                  <span className="guardrail-evidence">{check.evidence}</span>
                </span>
                <span className="guardrail-side">
                  <span className={`guardrail-status status-${check.status}`}>{statusLabel[check.status]}</span>
                  {check.action && (
                    <button type="button" className="ghost-link" onClick={() => runAction(check.action as CheckAction)}>
                      {check.action.label} <ArrowRight size={13} />
                    </button>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      <div className="power-grid">
        <section className="panel span-2 audit-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Audit trail</p>
              <h2>Audit log</h2>
            </div>
            {isHotelManager && (
              <button type="button" className="secondary-button small" onClick={exportAudit} disabled={filtered.length === 0}>
                <Download size={14} /> Export
              </button>
            )}
          </div>
          <p className="muted small">Who did what and when. Append-only: clearing a dashboard feed doesn’t remove entries.{isHotelManager ? '' : ` Showing ${areaName} and your own actions.`}</p>
          <div className="campaign-toolbar">
            <label className="campaign-search">
              <Search size={15} />
              <input type="search" placeholder="Search actions" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search audit log" />
            </label>
            {isHotelManager && (
              <>
                <select className="filter-select" aria-label="Filter audit log by area" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}>
                  <option value="all">All areas</option>
                  {auditAreas.map((area) => (
                    <option key={area}>{area}</option>
                  ))}
                </select>
                <select className="filter-select" aria-label="Filter audit log by person" value={personFilter} onChange={(event) => setPersonFilter(event.target.value)}>
                  <option value="all">Everyone</option>
                  {people.map((person) => (
                    <option key={person}>{person}</option>
                  ))}
                </select>
              </>
            )}
          </div>
          {filtered.length === 0 ? (
            <div className="contact-table-empty">No audit entries match.</div>
          ) : (
            <ol className="audit-list">
              {filtered.slice(0, shown).map((event) => (
                <li className={`audit-row tone-${event.tone}`} key={event.id}>
                  <span className="audit-time" title={event.at ? formatDateTime(event.at) : ''}>
                    {event.at ? formatDateTime(event.at) : '—'}
                    <small>{timeAgo(event.at)}</small>
                  </span>
                  <span className="audit-actor">
                    <span className="contact-avatar">{event.actor && event.actor !== 'System' ? initials(event.actor) : '·'}</span>
                    {event.actor ?? 'Unknown'}
                  </span>
                  <span className="audit-what">
                    <strong>{event.title}</strong>
                    <small>
                      {event.area ?? 'Hotel-wide'} · {event.detail}
                    </small>
                  </span>
                </li>
              ))}
            </ol>
          )}
          {filtered.length > shown && (
            <button type="button" className="ghost-link audit-more" onClick={() => setShown((current) => current + 15)}>
              Show {Math.min(15, filtered.length - shown)} more of {filtered.length - shown}
            </button>
          )}
        </section>

        <div className="stack-col">
          <ExecutionLayer onActivity={recordActivity} readOnly={!isHotelManager} />
          <section className="panel">
            <p className="eyebrow">Data trust</p>
            <h2>Confidence thresholds</h2>
            <p className="muted small">A recommendation’s confidence can never be higher than its data allows.</p>
            <div className="caps-list">
              {confidenceCaps.map((row) => {
                const count = areas.filter((area) => resolveFreshness(area, signals).state === row.state).length
                return (
                  <div className="cap-row" key={row.state}>
                    <span className={`freshness-chip freshness-${row.state.toLowerCase()}`}>{row.state}</span>
                    <span>
                      <strong>Up to {row.cap}</strong>
                      <small>{row.when}</small>
                    </span>
                    <em>
                      {count} area{count === 1 ? '' : 's'}
                    </em>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </div>

      <div className="power-grid">
        <section className="panel span-2">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Permissions</p>
              <h2>Roles and access</h2>
            </div>
          </div>
          <div className="permission-table" role="table" aria-label="Permissions by role">
            <div className="permission-row permission-head" role="row">
              <span>Action</span>
              <span className={isHotelManager ? 'you' : ''}>Hotel manager</span>
              <span className={isHotelManager ? '' : 'you'}>Department manager</span>
            </div>
            {permissions.map((row) => (
              <div className="permission-row" role="row" key={row.label}>
                <span>{row.label}</span>
                <span className={`perm ${row.manager === '—' ? 'no' : 'yes'}`}>{row.manager}</span>
                <span className={`perm ${row.department === '—' ? 'no' : row.department === 'Needs approval' ? 'partial' : 'yes'}`}>{row.department}</span>
              </div>
            ))}
          </div>
          <div className="detail-section">
            <h3>
              People <span>Sign-in isn’t connected in this demo — switch people from the sidebar</span>
            </h3>
            <div className="people-grid">
              {demoUsers.map((person) => (
                <div className={`person ${person.id === user.id ? 'current' : ''}`} key={person.id}>
                  <span className="contact-avatar">{initials(person.name)}</span>
                  <span>
                    <strong>
                      {person.name}
                      {person.id === user.id ? ' (you)' : ''}
                    </strong>
                    <small>{person.title}</small>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="panel about-build-panel">
          <p className="eyebrow">Otel Digital · V1</p>
          <h2>About this build</h2>
          <dl className="about-build-list stacked">
            <div>
              <dt>Works today</dt>
              <dd>Hotel Brain, eight business areas, offers, the campaign engine with approvals, audience consent controls, calendar, files and report extraction, results and learnings, and this governance view.</dd>
            </div>
            <div>
              <dt>Real AI</dt>
              <dd>Recommendations, report and update structuring, and next-step suggestions call Claude when the server has a key; otherwise they fall back to built-in demo data, and say so.</dd>
            </div>
            <div>
              <dt>Data</dt>
              <dd>Saved in this browser. Results are a simulated model; segment sizes and suppression counts are demo figures.</dd>
            </div>
            <div>
              <dt>Still to connect</dt>
              <dd>Sign-in and property isolation, PDF / spreadsheet / screenshot extraction (CSV works today), email, WordPress and social publishing, PMS and booking data, and real attribution.</dd>
            </div>
            <div>
              <dt>Photography</dt>
              <dd>Sample photography from Unsplash — replace with the hotel’s own approved assets before launch.</dd>
            </div>
          </dl>
        </section>
      </div>
    </>
  )
}
