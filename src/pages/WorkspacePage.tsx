import {
  ArrowUpRight,
  BedDouble,
  Check,
  DatabaseZap,
  Download,
  FileText,
  FileUp,
  Globe2,
  Image,
  Layers3,
  Lock,
  Mail,
  MessageSquareText,
  PenLine,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Tag,
  Upload,
  Users,
} from 'lucide-react'
import { useState, type ChangeEvent } from 'react'
import { segments as audienceSegments, seedContacts } from '../data/contacts'
import { activeHotel } from '../config/hotel'
import type { AppRoute } from '../config/routes'
import { departments } from '../data/departments'
import { productionGuardrails } from '../data/workflows'
import { usePersistentState } from '../lib/usePersistentState'
import { extractBusinessData } from '../services/mockApi'
import type { CampaignRecord, Contact, DepartmentKey, HotelAccount, Learning, Offer, UserRole } from '../types/domain'
import { seedOffers } from '../data/offers'
import { Modal } from '../components/ui/Modal'
import { ExecutionLayer } from '../components/operations/ExecutionLayer'
import { CalendarWorkspace } from './workspaces/CalendarWorkspace'
import { CampaignsWorkspace } from './workspaces/CampaignsWorkspace'
import { OffersWorkspace } from './workspaces/OffersWorkspace'

type WorkspaceRoute = Exclude<AppRoute, 'demo' | 'departments'>

const routeMeta: Record<WorkspaceRoute, { title: string; eyebrow: string; summary: string }> = {
  brain: {
    title: 'Hotel Brain',
    eyebrow: activeHotel.name,
    summary: 'Editable hotel facts, the approved brand asset library, master audiences, and hotel-wide rules every department draws from.',
  },
  offers: {
    title: 'Offers',
    eyebrow: 'Offers and packages',
    summary: 'Keep offers current for every business area. Active offers feed recommendations and campaign creation.',
  },
  campaigns: {
    title: 'Campaigns',
    eyebrow: 'Universal engine',
    summary: 'Every department uses the same campaign lifecycle from recommendation to approval, publishing, results, and learning.',
  },
  audience: {
    title: 'Audience',
    eyebrow: 'Consent-safe segments',
    summary: 'Import, review, and activate compliant guest audiences with suppression and unsubscribe controls.',
  },
  calendar: {
    title: 'Calendar',
    eyebrow: 'Demand planning',
    summary: 'See key dates, quiet periods, approval deadlines, scheduled sends, and publishing windows.',
  },
  files: {
    title: 'Files & Media',
    eyebrow: 'Approved assets and reports',
    summary: 'Store imagery, videos, menus, brochures, price lists, brand files, and uploaded reports for AI extraction.',
  },
  results: {
    title: 'Results',
    eyebrow: 'Learning loop',
    summary: 'Track commercial impact, engagement, source confidence, and next best recommendations.',
  },
  governance: {
    title: 'Governance',
    eyebrow: 'Production controls',
    summary: 'Permissions, approvals, audit events, confidence thresholds, consent gates, and publishing rules.',
  },
}

export function WorkspacePage({ route, onNavigate }: { route: WorkspaceRoute; onNavigate: (route: AppRoute) => void }) {
  const [selected, setSelected] = useState(0)
  const [hotel] = usePersistentState<HotelAccount>('otel:hotel-account', activeHotel)
  const meta = routeMeta[route]
  const eyebrow = route === 'brain' ? hotel.name : meta.eyebrow

  function openCampaign(campaign: CampaignRecord) {
    try {
      window.localStorage.setItem('otel:active-department', JSON.stringify(campaign.departmentKey))
      window.localStorage.setItem('otel:active-campaign-stage', JSON.stringify('Strategy'))
    } catch {
      // Navigation still works; the dashboard just opens on its last department.
    }
    onNavigate('departments')
  }

  return (
    <main className="workspace">
      <header className="page-header">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{meta.title}</h1>
        <p className="page-summary">{meta.summary}</p>
      </header>

      {route === 'brain' && <BrainWorkspace selected={selected} setSelected={setSelected} />}
      {route === 'offers' && <OffersWorkspace />}
      {route === 'campaigns' && <CampaignsWorkspace onOpenCampaign={openCampaign} />}
      {route === 'audience' && <AudienceWorkspace />}
      {route === 'calendar' && <CalendarWorkspace />}
      {route === 'files' && <FilesWorkspace />}
      {route === 'results' && <ResultsWorkspace />}
      {route === 'governance' && <GovernanceWorkspace />}
    </main>
  )
}

const hotelHeroImage = 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1800&q=80'

const brandAssets = [
  { name: 'Logo pack (SVG, PNG)', locked: true },
  { name: 'Brand image library', locked: true },
  { name: 'Email template pack', locked: true },
  { name: 'Signature hero template', locked: true },
  { name: 'Wedding brochure', locked: false },
]

const masterAudiences = [
  { name: 'Past guests (all stays)', contacts: 24800 },
  { name: 'Local audience within 15 miles', contacts: 18500 },
  { name: 'Loyalty members', contacts: 6200 },
  { name: 'Suppression list (always excluded)', contacts: 940 },
]

function readDepartmentLockedTemplates(): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const department of departments) {
    try {
      const raw = window.localStorage.getItem(`otel:${department.key}:locked-templates`)
      result[department.key] = raw ? (JSON.parse(raw) as string[]) : ['signature']
    } catch {
      result[department.key] = ['signature']
    }
  }
  return result
}

function readAggregatedFeedback(): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const department of departments) {
    try {
      const raw = window.localStorage.getItem(`otel:${department.key}:design-feedback`)
      const counts = raw ? (JSON.parse(raw) as Record<string, number>) : {}
      for (const [reason, count] of Object.entries(counts)) {
        totals[reason] = (totals[reason] ?? 0) + count
      }
    } catch {
      // No feedback saved yet for this department.
    }
  }
  return totals
}

function BrainWorkspace({ selected, setSelected }: { selected: number; setSelected: (index: number) => void }) {
  const [hotel, setHotel] = usePersistentState<HotelAccount>('otel:hotel-account', activeHotel)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<HotelAccount>(hotel)
  const lockedByDepartment = readDepartmentLockedTemplates()
  const hotelWideLocked = Object.values(lockedByDepartment).every((list) => list.includes('signature'))
  const aggregatedFeedback = readAggregatedFeedback()
  const learnedPreferences = Object.entries(aggregatedFeedback).filter(([, count]) => count >= 1)
  const [campaignLearnings] = usePersistentState<Learning[]>('otel:learnings', [])
  const [role] = usePersistentState<UserRole>('otel:current-role', 'Department manager')
  const canEditHotel = role === 'Hotel manager'
  const [offers] = usePersistentState<Offer[]>('otel:offers', seedOffers)
  const [contacts] = usePersistentState<Contact[]>('otel:audience-contacts', seedContacts)

  function saveFacts() {
    setHotel(draft)
    setEditing(false)
  }

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
          {canEditHotel ? (
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

      <div className="power-grid three">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Approved assets</p>
            <h2>Brand asset library</h2>
          </div>
          <Image size={20} />
        </div>
        <div className="brand-row-list">
          {brandAssets.map((asset) => (
            <div className="brand-asset-row" key={asset.name}>
              {asset.locked ? <Lock size={14} /> : <FileText size={14} />}
              <span>{asset.name}</span>
              <em>{asset.locked ? 'Hotel-locked' : 'Editable'}</em>
            </div>
          ))}
        </div>
        <p className="muted small">Full library, uploads, and extraction live in Files & Media.</p>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Audiences</p>
            <h2>Master audience list</h2>
          </div>
          <Users size={20} />
        </div>
        <div className="brand-row-list">
          {masterAudiences.map((segment) => (
            <div className="brand-asset-row" key={segment.name}>
              <Users size={14} />
              <span>{segment.name}</span>
              <em>{segment.contacts.toLocaleString()}</em>
            </div>
          ))}
        </div>
        <p className="muted small">Every department campaign draws from this shared, consent-checked list.</p>
      </section>

      <section className="panel span-2">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Hotel-wide rules</p>
            <h2>Guardrails and learning</h2>
          </div>
          <ShieldCheck size={20} />
        </div>
        <div className="check-stack">
          {productionGuardrails.map((rule) => (
            <span key={rule}><Check size={15} /> {rule}</span>
          ))}
        </div>
        <div className="brand-asset-row">
          <Lock size={14} />
          <span>Signature hero template</span>
          <em>{hotelWideLocked ? 'Locked in every business area' : 'Unlocked in at least one area'}</em>
        </div>
        {learnedPreferences.length > 0 ? (
          <div className="learned-preferences">
            <p className="eyebrow">Learned across departments</p>
            {learnedPreferences.map(([reason, count]) => (
              <span key={reason} className="learning-banner compact">
                <Sparkles size={14} /> Avoid "{reason}" ({count}x flagged)
              </span>
            ))}
          </div>
        ) : (
          <p className="muted small">No cross-department design feedback saved yet.</p>
        )}
        <div className="learned-preferences">
          <p className="eyebrow">Learned from campaign results</p>
          {campaignLearnings.length === 0 && (
            <p className="muted small">Save insights from a campaign's Results stage and they appear here for future recommendations.</p>
          )}
          {campaignLearnings.slice(0, 6).map((learning) => (
            <div className="brand-asset-row" key={learning.id}>
              <span className={`insight-kind ${learning.kind.toLowerCase()}`}>{learning.kind}</span>
              <span>{learning.text}</span>
              <em>{departments.find((department) => department.key === learning.departmentKey)?.name}</em>
            </div>
          ))}
        </div>
      </section>

      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Business areas</p>
            <h2>Hotel departments</h2>
          </div>
        </div>
        <p className="muted small department-grid-intro">Review each department's status, data gaps and recommended action.</p>
        <div className="department-status-grid four">
          {departments.map((department, index) => (
            <article
              className={`department-status-card${selected === index ? ' selected' : ''}`}
              key={department.key}
              onClick={() => setSelected(index)}
            >
              <div className="department-status-image" style={{ backgroundImage: `url(${department.image})` }}>
                <span className="department-status-badge">
                  <DatabaseZap size={14} />
                </span>
              </div>
              <div className="department-status-body">
                <h3>{department.name}</h3>
                <p className="department-status-headline">{department.subline}</p>
                <p>
                  <strong>Why:</strong> {department.recommendation.summary}
                </p>
                <p>
                  <strong>Action:</strong> {department.recommendation.title}.
                </p>
                <div className="department-status-divider"></div>
                <p className="department-status-source">Source: {department.signal}</p>
                <div className="department-status-footer">
                  <span>{department.metrics[0].value} {department.metrics[0].label.toLowerCase()}</span>
                  <span className="department-status-arrow"><ArrowUpRight size={15} /></span>
                </div>
              </div>
            </article>
          ))}
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

function parseContactsCsv(text: string): Contact[] {
  const lines = text.trim().split(/\r?\n/)
  const [header, ...rows] = lines
  const columns = header.split(',').map((col) => col.trim().toLowerCase())
  const nameIndex = columns.indexOf('name')
  const emailIndex = columns.indexOf('email')
  const segmentIndex = columns.indexOf('segment')

  return rows
    .filter((row) => row.trim().length > 0)
    .map((row, index) => {
      const cells = row.split(',').map((cell) => cell.trim())
      return {
        id: `imported-${Date.now()}-${index}`,
        name: cells[nameIndex] || 'Unnamed contact',
        email: cells[emailIndex] || '',
        segment: cells[segmentIndex] || 'Uncategorised',
        lastActivity: 'Just imported',
        permission: 'Unknown' as const,
        guestValue: 0,
      }
    })
}

function AudienceWorkspace() {
  const [contacts, setContacts] = usePersistentState<Contact[]>('otel:audience-contacts', seedContacts)
  const [segmentFilter, setSegmentFilter] = useState('All contacts')
  const [permissionFilter, setPermissionFilter] = useState<'All permissions' | 'Subscribed' | 'Unsubscribed' | 'Unknown'>('All permissions')
  const [importNotice, setImportNotice] = useState<string | null>(null)

  const filtered = contacts.filter((contact) => {
    const matchesSegment = segmentFilter === 'All contacts' || contact.segment === segmentFilter
    const matchesPermission = permissionFilter === 'All permissions' || contact.permission === permissionFilter
    return matchesSegment && matchesPermission
  })

  const subscribedCount = contacts.filter((contact) => contact.permission === 'Subscribed').length
  const unknownCount = contacts.filter((contact) => contact.permission === 'Unknown').length
  const segmentCount = new Set(contacts.map((contact) => contact.segment)).size

  function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const imported = parseContactsCsv(String(reader.result ?? ''))
      if (imported.length === 0) {
        setImportNotice('No contacts found in that file. Expect columns: name, email, segment.')
        return
      }
      setContacts((current) => [...imported, ...current])
      setImportNotice(`Imported ${imported.length} contact${imported.length === 1 ? '' : 's'} from ${file.name}. Permission set to Unknown until confirmed.`)
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  function handleExport() {
    const header = 'name,email,segment,last_activity,permission,guest_value'
    const rows = contacts.map((c) => [c.name, c.email, c.segment, c.lastActivity, c.permission, c.guestValue].join(','))
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'otel-audience-export.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="power-grid">
      <section className="panel span-2">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Contacts, segments & consent</p>
            <h2>Audience</h2>
          </div>
          <div className="hero-actions">
            <label className="file-picker-label">
              <input type="file" accept=".csv" onChange={handleImport} hidden />
              <span className="secondary-button"><Upload size={15} /> Import contacts</span>
            </label>
            <button type="button" className="secondary-button" onClick={handleExport}>
              <Download size={15} /> Export
            </button>
          </div>
        </div>

        {importNotice && (
          <div className="scope-notice">{importNotice}</div>
        )}

        <div className="audience-stats">
          <div>
            <span>Total contacts</span>
            <strong>{contacts.length}</strong>
            <em>In your hotel's audience</em>
          </div>
          <div>
            <span>Subscribed</span>
            <strong>{subscribedCount}</strong>
            <em>Explicit marketing consent</em>
          </div>
          <div>
            <span>Segments</span>
            <strong>{segmentCount}</strong>
            <em>Across saved contact records</em>
          </div>
          <div>
            <span>Permission to confirm</span>
            <strong>{unknownCount}</strong>
            <em>Not included in sends</em>
          </div>
        </div>

        <div className="audience-filter-row">
          {['All contacts', ...audienceSegments].map((segment) => (
            <button
              type="button"
              key={segment}
              className={segmentFilter === segment ? 'selected' : ''}
              onClick={() => setSegmentFilter(segment)}
            >
              {segment}
            </button>
          ))}
        </div>
        <div className="audience-filter-row">
          {(['All permissions', 'Subscribed', 'Unsubscribed', 'Unknown'] as const).map((permission) => (
            <button
              type="button"
              key={permission}
              className={permissionFilter === permission ? 'selected' : ''}
              onClick={() => setPermissionFilter(permission)}
            >
              {permission}
            </button>
          ))}
        </div>

        <div className="contact-table">
          <div className="contact-table-head">
            <span>Guest</span>
            <span>Segment</span>
            <span>Last activity</span>
            <span>Permission</span>
            <span>Guest value</span>
          </div>
          {filtered.map((contact) => (
            <div className="contact-table-row" key={contact.id}>
              <span className="contact-name">
                <span className="contact-avatar">{contact.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
                <span>
                  <strong>{contact.name}</strong>
                  <em>{contact.email}</em>
                </span>
              </span>
              <span>{contact.segment}</span>
              <span>{contact.lastActivity}</span>
              <span className={`permission-pill permission-${contact.permission.toLowerCase()}`}>{contact.permission}</span>
              <span>£{contact.guestValue.toLocaleString()}</span>
            </div>
          ))}
          {filtered.length === 0 && <div className="contact-table-empty">No contacts match these filters.</div>}
        </div>
      </section>
      <section className="panel">
        <p className="eyebrow">Eligible campaign audience</p>
        <h2>Check consent before sending</h2>
        <div className="check-stack">
          <span><ShieldCheck size={15} /> {subscribedCount} of {contacts.length} contacts have marketing consent</span>
          <span><Check size={15} /> Suppression list is always excluded</span>
          <span><Mail size={15} /> Verify segment matches campaign before sending</span>
        </div>
      </section>
    </div>
  )
}

const defaultLibraryFiles = [
  { name: 'Spa diary screenshot', done: true },
  { name: 'Rooms pickup report', done: true },
  { name: 'Restaurant menu PDF', done: true },
  { name: 'Brand image library', done: false },
  { name: 'Email template pack', done: false },
  { name: 'Wedding brochure', done: false },
]

const extractionSamples: Record<DepartmentKey, { file: string; type: string; fields: Record<string, string>; confidence: string }> = {
  rooms: {
    file: 'rooms-pickup-report-october.xlsx',
    type: 'Excel report',
    confidence: 'High',
    fields: {
      period: '12 Oct 2026 - 30 Oct 2026',
      occupancy: '68%',
      revpar: '£78',
      directBookings: '142',
      quietDemand: 'Monday - Thursday',
    },
  },
  spa: {
    file: 'spa-diary-screenshot.png',
    type: 'Diary screenshot',
    confidence: 'High',
    fields: {
      period: '14 Oct 2026 - 4 Nov 2026',
      quietDays: 'Tuesday, Wednesday',
      activeOffer: 'Midweek Spa Day £79',
      availability: 'High afternoon availability',
      bookings: '342',
    },
  },
  restaurant: {
    file: 'restaurant-trading-update.pdf',
    type: 'PDF report',
    confidence: 'Medium',
    fields: {
      period: '6 Oct 2026 - 27 Oct 2026',
      servicePeriod: 'Weekday dinner',
      quietDay: 'Tuesday',
      covers: '824',
      averageSpend: '£32',
    },
  },
  events: {
    file: 'wedding-enquiry-log.csv',
    type: 'CSV export',
    confidence: 'Medium',
    fields: {
      period: 'Spring 2027',
      enquiries: '38',
      confirmedDates: '14',
      openWeekdays: '9',
      avgPackage: '£8,400',
    },
  },
  hair_beauty: {
    file: 'salon-booking-export.xlsx',
    type: 'Excel report',
    confidence: 'High',
    fields: {
      period: 'Rolling 4 weeks',
      bookings: '206',
      avgTicket: '£54',
      rebookingRate: '61%',
      peakDay: 'Saturday (full)',
    },
  },
  golf: {
    file: 'tee-sheet-export.pdf',
    type: 'PDF report',
    confidence: 'Low',
    fields: {
      period: 'Last 18 days',
      roundsPlayed: '312',
      teeTimeFill: '74%',
      societyBookings: '4',
      lastUpdate: '18 days ago',
    },
  },
  meetings: {
    file: 'mice-pipeline-notes.pdf',
    type: 'PDF report',
    confidence: 'Medium',
    fields: {
      period: 'Current quarter',
      dayDelegates: '58',
      roomHireDays: '11',
      avgPackage: '£62/head',
      pipelineEnquiries: '7',
    },
  },
  beach_club: {
    file: 'beach-club-sales-export.csv',
    type: 'CSV export',
    confidence: 'Medium',
    fields: {
      period: 'Current season',
      dayPassesSold: '164',
      otaShare: '9%',
      directShare: '91%',
      avgSpend: '£46',
    },
  },
}

function FilesWorkspace() {
  const [activeArea, setActiveArea] = useState<DepartmentKey>('spa')
  const [status, setStatus] = useState<'idle' | 'extracting' | 'review' | 'confirmed'>('idle')
  const [selectedFile, setSelectedFile] = useState('Spa diary screenshot')
  const [extractedFields, setExtractedFields] = useState<Record<string, string> | null>(null)
  const [confidence, setConfidence] = useState(sampleConfidence(activeArea))
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number; type: string } | null>(null)
  const [libraryFiles, setLibraryFiles] = useState(defaultLibraryFiles)
  const sample = extractionSamples[activeArea]

  function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadedFile({ name: file.name, size: file.size, type: file.type || 'unknown' })
    setStatus('idle')
    setExtractedFields(null)
  }

  async function runExtraction() {
    setStatus('extracting')
    const result = await extractBusinessData(activeArea)
    setExtractedFields(result.fields)
    setConfidence(result.confidence)
    setStatus('review')
    if (uploadedFile) {
      setLibraryFiles((current) => [
        { name: uploadedFile.name, done: true },
        ...current.filter((entry) => entry.name !== uploadedFile.name),
      ])
    }
  }

  return (
    <div className="power-grid">
      <section className="panel span-2 extraction-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Upload and extract</p>
            <h2>Fallback data capture</h2>
          </div>
          <FileUp size={22} />
        </div>

        <div className="department-tabs">
          {departments.map((department) => (
            <button
              type="button"
              className={department.key === activeArea ? 'selected' : ''}
              key={department.key}
              onClick={() => {
                setActiveArea(department.key)
                setStatus('idle')
                setExtractedFields(null)
                setConfidence(sampleConfidence(department.key))
              }}
            >
              {department.name}
            </button>
          ))}
        </div>

        <div className="upload-dropzone">
          <ScanSearch size={28} />
          <label className="file-picker-label">
            <input type="file" accept=".png,.jpg,.jpeg,.pdf,.xlsx,.csv" onChange={handleFileSelect} hidden />
            <span className="secondary-button">Choose file</span>
          </label>
          <strong>{uploadedFile?.name ?? sample.file}</strong>
          <span>
            {uploadedFile
              ? `${(uploadedFile.size / 1024).toFixed(0)} KB selected for ${departments.find((department) => department.key === activeArea)?.name}`
              : `${sample.type} sample selected for ${departments.find((department) => department.key === activeArea)?.name}`}
          </span>
          <button type="button" className="primary-button" onClick={runExtraction}>
            {status === 'extracting' ? 'Extracting...' : 'Run extraction'}
          </button>
        </div>

        {(status === 'review' || status === 'confirmed') && (
          <div className="extraction-review">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Detected - awaiting confirmation</p>
                <h2>Review extracted fields</h2>
              </div>
              <span className="confidence">{confidence} confidence</span>
            </div>
            <div className="field-grid">
              {Object.entries(extractedFields ?? sample.fields).map(([label, value]) => (
                <label key={label}>
                  <span>{label}</span>
                  <input defaultValue={value} />
                </label>
              ))}
            </div>
            <button type="button" className="primary-button" onClick={() => setStatus('confirmed')}>
              Confirm trusted data
            </button>
          </div>
        )}

        {status === 'confirmed' && (
          <div className="confirmed-banner">
            <Check size={17} />
            Confirmed data is now available to recommendations and campaign planning.
          </div>
        )}
      </section>

      <section className="panel">
        <p className="eyebrow">Files & Media</p>
        <h2>Library status</h2>
        <div className="timeline-list">
          {libraryFiles.map(({ name, done }) => (
            <button
              type="button"
              className={`${done ? 'done' : ''} ${selectedFile === name ? 'selected-row' : ''}`}
              key={name}
              onClick={() => setSelectedFile(name)}
            >
              <FileText size={15} /> {name}
            </button>
          ))}
        </div>
        <div className="selected-file">
          <strong>Selected</strong>
          <span>{selectedFile}</span>
        </div>
      </section>
    </div>
  )
}

function sampleConfidence(department: DepartmentKey) {
  return extractionSamples[department].confidence
}

function ResultsWorkspace() {
  const [selectedDepartment, setSelectedDepartment] = useState(departments[0].key)
  const [learnings] = usePersistentState<Learning[]>('otel:learnings', [])
  const selectedIndex = Math.max(0, departments.findIndex((department) => department.key === selectedDepartment))
  const selected = departments[selectedIndex]
  const scale = 1 + selectedIndex * 0.07
  const isCampaignArea = selected.recommendation.outcome === 'Campaign'
  const channels = [
    { label: 'Email', icon: Mail, value: Math.round(1240 * scale), unit: 'opens' },
    { label: 'Website', icon: Globe2, value: Math.round(1856 * scale), unit: 'visits' },
    { label: 'Social', icon: MessageSquareText, value: Math.round(9800 * scale), unit: 'reach' },
  ]

  return (
    <div className="power-grid">
      <section className="panel span-2">
        <div className="results-matrix">
          {departments.map((department) => {
            const saved = learnings.filter((learning) => learning.departmentKey === department.key).length
            return (
              <button
                type="button"
                className={selectedDepartment === department.key ? 'selected' : ''}
                key={department.key}
                onClick={() => setSelectedDepartment(department.key)}
              >
                <img src={department.image} alt="" />
                <strong>{department.name}</strong>
                <span>{department.resultMetric}</span>
                <em className={saved ? '' : 'muted-em'}>{saved ? `${saved} learning${saved === 1 ? '' : 's'} saved` : 'No learnings saved yet'}</em>
              </button>
            )
          })}
        </div>
      </section>
      <section className="panel">
        <p className="eyebrow">Channel impact</p>
        <h2>{selected.name}</h2>
        {isCampaignArea ? (
          channels.map(({ label, icon: Icon, value, unit }) => (
            <div className="channel-row" key={label}>
              <Icon size={18} />
              <div>
                <strong>{label}</strong>
                <span>{value.toLocaleString()} {unit}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="muted">No campaign has run here yet — the AI recommended "{selected.recommendation.outcome}" instead.</p>
        )}
        <p className="muted small">Demo figures. Live attribution needs a connected booking and analytics source.</p>
      </section>
    </div>
  )
}

function GovernanceWorkspace() {
  return (
    <div className="power-grid">
      <section className="panel span-2">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Hotel-wide rules</p>
            <h2>Publishing guardrails</h2>
          </div>
        </div>
        <div className="governance-list">
          {productionGuardrails.map((item) => (
            <div className="guardrail-row" key={item}>
              <ShieldCheck size={17} /> {item}
            </div>
          ))}
        </div>
      </section>
      <ExecutionLayer onActivity={() => undefined} />

      <section className="panel span-2 about-build-panel">
        <p className="eyebrow">Otel Digital · V1</p>
        <h2>About this build</h2>
        <p className="muted">This workspace brings the product spec to life with connected screens and realistic sample data.</p>
        <dl className="about-build-list">
          <div>
            <dt>Works today</dt>
            <dd>Hotel facts editing, department dashboards, campaign creation and editing, design review, approvals, publish simulation, audience segments, results.</dd>
          </div>
          <div>
            <dt>Real AI</dt>
            <dd>Recommendation generation and business-signal structuring call Claude live when a server key is configured; otherwise this falls back to seeded demo data automatically.</dd>
          </div>
          <div>
            <dt>Data storage</dt>
            <dd>Local browser storage. Clearing browser data removes your edits. No shared database yet.</dd>
          </div>
          <div>
            <dt>Still to connect</dt>
            <dd>Authentication, tenant/property isolation, real file extraction, email/WordPress/social publishing, live booking or PMS data, and real campaign attribution.</dd>
          </div>
          <div>
            <dt>Photography</dt>
            <dd>Sample photography from Unsplash. Replace with the hotel's own approved assets before launch.</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
