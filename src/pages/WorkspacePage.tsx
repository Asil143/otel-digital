import {
  Check,
  Download,
  FileText,
  FileUp,
  Lock,
  Mail,
  ScanSearch,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import { useState, type ChangeEvent } from 'react'
import { segments as audienceSegments, seedContacts } from '../data/contacts'
import { seedAssets } from '../data/brain'
import { activeHotel } from '../config/hotel'
import type { AppRoute } from '../config/routes'
import { departments } from '../data/departments'
import { productionGuardrails } from '../data/workflows'
import { usePersistentState, writeStored } from '../lib/usePersistentState'
import { logActivity, recordActivity } from '../lib/activityLog'
import { useCurrentUser } from '../lib/currentUser'
import { useSignals } from '../lib/signalStore'
import { formatCount, formatMoney, mergeDaily, resultUnit, sumTotals } from '../lib/results'
import { useResults } from '../lib/useResults'
import { ResultsChart } from '../components/operations/ResultsChart'
import { extractBusinessData } from '../services/mockApi'
import type { CampaignRecord, CampaignStage, Contact, DepartmentKey, HotelAccount, Learning, MediaAsset, SignalRecord } from '../types/domain'
import { ExecutionLayer } from '../components/operations/ExecutionLayer'
import { CalendarWorkspace } from './workspaces/CalendarWorkspace'
import { CampaignsWorkspace } from './workspaces/CampaignsWorkspace'
import { OffersWorkspace } from './workspaces/OffersWorkspace'
import { BrainWorkspace } from './workspaces/BrainWorkspace'

type WorkspaceRoute = Exclude<AppRoute, 'demo' | 'departments'>

const routeMeta: Record<WorkspaceRoute, { title: string; eyebrow: string; summary: string }> = {
  brain: {
    title: 'Hotel Brain',
    eyebrow: activeHotel.name,
    summary: 'Everything the AI knows about your hotel: property facts, the rules it must follow, approved assets, audiences, and what it has learned.',
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
  const [hotel] = usePersistentState<HotelAccount>('otel:hotel-account', activeHotel)
  const meta = routeMeta[route]
  const eyebrow = route === 'brain' ? hotel.name : meta.eyebrow

  function openCampaign(campaign: CampaignRecord, stage: CampaignStage = 'Strategy') {
    writeStored('otel:active-department', campaign.departmentKey)
    writeStored('otel:active-campaign-stage', stage)
    onNavigate('departments')
  }

  return (
    <main className="workspace">
      <header className="page-header">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{meta.title}</h1>
        <p className="page-summary">{meta.summary}</p>
      </header>

      {route === 'brain' && <BrainWorkspace onNavigate={onNavigate} />}
      {route === 'offers' && (
        <OffersWorkspace
          onOpenCampaign={openCampaign}
          onCreateCampaign={(offer) => {
            writeStored('otel:active-department', offer.departmentKey)
            writeStored('otel:pending-create', offer.id)
            onNavigate('departments')
          }}
        />
      )}
      {route === 'campaigns' && <CampaignsWorkspace onOpenCampaign={openCampaign} />}
      {route === 'audience' && <AudienceWorkspace />}
      {route === 'calendar' && <CalendarWorkspace />}
      {route === 'files' && <FilesWorkspace />}
      {route === 'results' && <ResultsWorkspace onOpenCampaign={openCampaign} />}
      {route === 'governance' && <GovernanceWorkspace />}
    </main>
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
  const { isHotelManager: canManageContacts } = useCurrentUser()
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
      logActivity('Contacts imported', `${imported.length} contact${imported.length === 1 ? '' : 's'} from ${file.name}, awaiting consent confirmation.`, 'info', 'Audience')
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
    logActivity('Audience exported', `${contacts.length} contacts downloaded as CSV.`, 'info', 'Audience')
  }

  return (
    <div className="power-grid">
      <section className="panel span-2">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Contacts, segments & consent</p>
            <h2>Audience</h2>
          </div>
          {canManageContacts ? (
            <div className="hero-actions">
              <label className="file-picker-label">
                <input type="file" accept=".csv" onChange={handleImport} hidden />
                <span className="secondary-button"><Upload size={15} /> Import contacts</span>
              </label>
              <button type="button" className="secondary-button" onClick={handleExport}>
                <Download size={15} /> Export
              </button>
            </div>
          ) : (
            <span className="scope-chip"><Lock size={13} /> Imports and exports: hotel manager</span>
          )}
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
  const { canAccess, allowedAreas } = useCurrentUser()
  const [chosenArea, setActiveArea] = useState<DepartmentKey>('spa')
  const activeArea = canAccess(chosenArea) ? chosenArea : allowedAreas[0]
  const [status, setStatus] = useState<'idle' | 'extracting' | 'review' | 'confirmed'>('idle')
  const [extractedFields, setExtractedFields] = useState<Record<string, string> | null>(null)
  const [confidence, setConfidence] = useState(sampleConfidence(activeArea))
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number; type: string } | null>(null)
  const [assets, setAssets] = usePersistentState<MediaAsset[]>('otel:assets', seedAssets)
  const libraryFiles = assets.filter((asset) => asset.departmentKey === null || canAccess(asset.departmentKey))
  const [, setSignals] = useSignals()
  const sample = extractionSamples[activeArea]
  const areaName = departments.find((department) => department.key === activeArea)?.name ?? activeArea

  function confirmExtraction() {
    const fields = extractedFields ?? sample.fields
    const fileName = uploadedFile?.name ?? sample.file
    setSignals((current) => [
      {
        id: crypto.randomUUID(),
        departmentKey: activeArea,
        sourceType: 'file_upload',
        summary: `${fileName} extracted and confirmed in Files & Media`,
        fields,
        confidence: confidence as SignalRecord['confidence'],
        state: 'Confirmed',
        createdAt: new Date().toISOString(),
      },
      ...current,
    ])
    setAssets((current) => [
      { id: crypto.randomUUID(), name: fileName, kind: 'Report', departmentKey: activeArea, status: 'Approved', locked: false, addedAt: new Date().toISOString() },
      ...current.filter((asset) => !(asset.name === fileName && asset.departmentKey === activeArea)),
    ])
    setStatus('confirmed')
    logActivity('Report confirmed', `${fileName}: ${Object.keys(fields).length} figures are now trusted data for ${areaName}.`, 'success', areaName)
  }

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
          {departments.filter((department) => canAccess(department.key)).map((department) => (
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
                  <input
                    value={value}
                    onChange={(event) => setExtractedFields({ ...(extractedFields ?? sample.fields), [label]: event.target.value })}
                  />
                </label>
              ))}
            </div>
            <button type="button" className="primary-button" onClick={confirmExtraction} disabled={status === 'confirmed'}>
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
        <h2>Library</h2>
        <p className="muted small">Shared with Hotel Brain. Confirmed reports are added here automatically.</p>
        <div className="brand-row-list">
          {libraryFiles.map((asset) => (
            <div className="brand-asset-row asset-row" key={asset.id}>
              <FileText size={14} />
              <span>
                {asset.name}
                <small>{asset.kind} · {asset.departmentKey ? departments.find((department) => department.key === asset.departmentKey)?.name : 'Hotel-wide'}</small>
              </span>
              <em className={asset.status === 'Approved' ? '' : 'pending-chip'}>{asset.status === 'Approved' ? 'Approved' : 'Awaiting approval'}</em>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function sampleConfidence(department: DepartmentKey) {
  return extractionSamples[department].confidence
}

function ResultsWorkspace({ onOpenCampaign }: { onOpenCampaign: (campaign: CampaignRecord, stage: CampaignStage) => void }) {
  const { results: allResults } = useResults()
  const { canAccess, isHotelManager, allowedAreas } = useCurrentUser()
  const results = allResults.filter((result) => canAccess(result.campaign.departmentKey))
  const visibleDepartments = departments.filter((department) => canAccess(department.key))
  const [allLearnings] = usePersistentState<Learning[]>('otel:learnings', [])
  const learnings = allLearnings.filter((learning) => canAccess(learning.departmentKey))
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentKey>(() => {
    const firstMeasured = results.find((result) => result.state !== 'projection')
    return firstMeasured?.campaign.departmentKey ?? allowedAreas[0]
  })

  const measured = results.filter((result) => result.state !== 'projection')
  const hotelTotals = sumTotals(measured.map((result) => result.shown))
  const selected = visibleDepartments.find((department) => department.key === selectedDepartment) ?? visibleDepartments[0]
  const selectedResults = results.filter((result) => result.campaign.departmentKey === selected.key)
  const selectedMeasured = selectedResults.filter((result) => result.state !== 'projection')
  const unit = resultUnit(selected)
  const channelTotals = (['Email', 'Social', 'Website'] as const)
    .map((channel) => {
      const items = selectedMeasured.flatMap((result) => result.channels).filter((item) => item.channel === channel)
      return {
        channel,
        reach: items.reduce((sum, item) => sum + item.reach, 0),
        label: items[0]?.reachLabel ?? '',
        bookings: items.reduce((sum, item) => sum + item.bookings, 0),
      }
    })
    .filter((item) => item.reach > 0)
  const selectedTotal = sumTotals(selectedMeasured.map((result) => result.shown))

  return (
    <>
      <section className="results-overview">
        <div>
          <span>Attributed revenue</span>
          <strong>{formatMoney(hotelTotals.revenue)}</strong>
          <em>{isHotelManager ? 'across all live and completed campaigns' : `${selected.name} campaigns`}</em>
        </div>
        <div>
          <span>Campaigns live</span>
          <strong>{results.filter((result) => result.state === 'live').length}</strong>
          <em>{results.filter((result) => result.state === 'completed').length} completed</em>
        </div>
        <div>
          <span>Emails opened</span>
          <strong>{formatCount(hotelTotals.opens)}</strong>
          <em>{formatCount(hotelTotals.sends)} sent</em>
        </div>
        <div>
          <span>Learnings saved</span>
          <strong>{learnings.length}</strong>
          <em>feeding future recommendations</em>
        </div>
      </section>

      <div className="power-grid">
        <section className="panel span-2">
          <div className="results-matrix">
            {visibleDepartments.map((department) => {
              const areaResults = results.filter((result) => result.campaign.departmentKey === department.key)
              const areaMeasured = areaResults.filter((result) => result.state !== 'projection')
              const areaTotals = sumTotals(areaMeasured.map((result) => result.shown))
              const pending = areaResults.find((result) => result.state === 'projection')
              const saved = learnings.filter((learning) => learning.departmentKey === department.key).length
              const areaUnit = resultUnit(department)
              return (
                <button
                  type="button"
                  className={selectedDepartment === department.key ? 'selected' : ''}
                  key={department.key}
                  onClick={() => setSelectedDepartment(department.key)}
                >
                  <img src={department.image} alt="" />
                  <strong>{department.name}</strong>
                  <span>
                    {areaMeasured.length
                      ? `${formatCount(areaTotals.bookings)} ${areaUnit} · ${formatMoney(areaTotals.revenue)}`
                      : pending
                        ? `Not live · projected ${formatCount(pending.projected.bookings)} ${areaUnit}`
                        : `No campaign · ${department.recommendation.outcome}`}
                  </span>
                  <em className={saved ? '' : 'muted-em'}>{saved ? `${saved} learning${saved === 1 ? '' : 's'} saved` : 'No learnings saved yet'}</em>
                </button>
              )
            })}
          </div>
        </section>

        <section className="panel">
          <p className="eyebrow">Results</p>
          <h2>{selected.name}</h2>
          {selectedMeasured.length > 0 ? (
            <>
              <p className="muted small">
                {formatCount(selectedTotal.bookings)} {unit} and {formatMoney(selectedTotal.revenue)} from {selectedMeasured.length} campaign
                {selectedMeasured.length === 1 ? '' : 's'}.
              </p>
              <ResultsChart daily={mergeDaily(selectedMeasured)} unit={unit} />
              {channelTotals.map((item) => (
                <div className="channel-row" key={item.channel}>
                  <strong>{item.channel}</strong>
                  <div>
                    <span>{formatCount(item.reach)} {item.label}</span>
                    <span>{formatCount(item.bookings)} {unit}</span>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <p className="muted">
              {selectedResults.length
                ? 'Nothing live here yet. Open the campaign to see its projection.'
                : `No campaign — the AI recommended "${selected.recommendation.outcome}" instead.`}
            </p>
          )}
          <div className="results-campaign-list">
            {selectedResults.map((result) => (
              <button type="button" key={result.campaign.id} onClick={() => onOpenCampaign(result.campaign, 'Results')}>
                <span className={`campaign-status-chip status-${result.campaign.status.toLowerCase().replace(/\s+/g, '-')}`}>{result.campaign.status}</span>
                <strong>{result.campaign.name}</strong>
                <em>Open results →</em>
              </button>
            ))}
          </div>
          <p className="muted small">Demo model. Live attribution needs a connected booking source.</p>
        </section>
      </div>
    </>
  )
}

function GovernanceWorkspace() {
  const { isHotelManager } = useCurrentUser()
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
      <ExecutionLayer onActivity={recordActivity} readOnly={!isHotelManager} />

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
