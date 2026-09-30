import { ArrowRight, Check, CheckCircle2, FileSpreadsheet, FileText, Film, Image as ImageIcon, LayoutTemplate, Lock, Palette, Plus, ScanSearch, Search, Tag, Trash2, Unlock, Upload, UtensilsCrossed, X } from 'lucide-react'
import { useState, type ChangeEvent } from 'react'
import { Modal } from '../../components/ui/Modal'
import { activeHotel } from '../../config/hotel'
import type { AppRoute } from '../../config/routes'
import { departments } from '../../data/departments'
import { sampleReports } from '../../data/reports'
import { logActivity, timeAgo } from '../../lib/activityLog'
import { assetKinds, formatBytes, kindFromFile, makePreview, MAX_UPLOAD_BYTES, parseReportCsv, readableReport, useAssets } from '../../lib/assets'
import { useCurrentUser } from '../../lib/currentUser'
import { useSignals } from '../../lib/signalStore'
import { writeStored } from '../../lib/usePersistentState'
import { structureBusinessSignal } from '../../services/aiMarketing'
import { formatDate, localDate } from '../../services/campaigns'
import type { AssetKind, DepartmentKey, MediaAsset, SignalRecord } from '../../types/domain'

const kindIcon: Record<AssetKind, typeof FileText> = {
  Brand: Palette,
  Image: ImageIcon,
  Video: Film,
  Template: LayoutTemplate,
  Brochure: FileText,
  Menu: UtensilsCrossed,
  'Price list': Tag,
  Report: FileSpreadsheet,
}
const areaName = (key: DepartmentKey | null) => (key ? departments.find((department) => department.key === key)?.name ?? key : 'Hotel-wide')

type PendingUpload = { key: string; file: File; name: string; kind: AssetKind; departmentKey: DepartmentKey | null; error?: string }
type Extraction =
  | { stage: 'idle' }
  | { stage: 'reading'; fileName: string }
  | { stage: 'review'; fileName: string; size?: number; fields: [string, string][]; confidence: SignalRecord['confidence']; source: 'ai' | 'csv' | 'sample'; note: string }
  | { stage: 'confirmed'; fileName: string; count: number; area: DepartmentKey }

export function FilesWorkspace({ onNavigate }: { onNavigate: (route: AppRoute) => void }) {
  const { user, isHotelManager, canAccess, allowedAreas } = useCurrentUser()
  const [assets, setAssets] = useAssets()
  const [signals, setSignals] = useSignals()
  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState<AssetKind | 'All'>('All')
  const [areaFilter, setAreaFilter] = useState<DepartmentKey | 'hotel' | 'all'>('all')
  const [pendingOnly, setPendingOnly] = useState(false)
  const [uploads, setUploads] = useState<PendingUpload[] | null>(null)
  const [pendingDelete, setPendingDelete] = useState<MediaAsset | null>(null)
  const [chosenArea, setChosenArea] = useState<DepartmentKey>(allowedAreas.includes('spa') ? 'spa' : allowedAreas[0])
  const [extraction, setExtraction] = useState<Extraction>({ stage: 'idle' })
  const [monthAgo] = useState(() => new Date(Date.now() - 30 * 86_400_000).toISOString())
  const extractArea = canAccess(chosenArea) ? chosenArea : allowedAreas[0]
  const sample = sampleReports[extractArea]

  // ---------- Library scope ----------
  const mine = assets.filter((asset) => asset.departmentKey === null || canAccess(asset.departmentKey))
  const needle = query.trim().toLowerCase()
  const inScope = mine
    .filter((asset) => areaFilter === 'all' || (areaFilter === 'hotel' ? asset.departmentKey === null : asset.departmentKey === areaFilter))
    .filter((asset) => !needle || `${asset.name} ${asset.kind} ${areaName(asset.departmentKey)} ${asset.addedBy ?? ''}`.toLowerCase().includes(needle))
    .filter((asset) => !pendingOnly || asset.status === 'Pending approval')
  const visible = inScope.filter((asset) => kindFilter === 'All' || asset.kind === kindFilter)
  const pending = mine.filter((asset) => asset.status === 'Pending approval')
  const approved = mine.filter((asset) => asset.status === 'Approved')
  const locked = mine.filter((asset) => asset.locked)
  const recentReports = signals
    .filter((signal) => signal.sourceType === 'file_upload' && signal.state === 'Confirmed' && canAccess(signal.departmentKey))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const reports30 = recentReports.filter((signal) => signal.createdAt >= monthAgo)
  const totalBytes = mine.reduce((sum, asset) => sum + (asset.size ?? 0), 0)

  const canDelete = (asset: MediaAsset) => !asset.locked && (isHotelManager || (asset.departmentKey !== null && canAccess(asset.departmentKey)))

  function update(asset: MediaAsset, changes: Partial<MediaAsset>, title: string, detail: string, tone: 'info' | 'success' | 'warning' = 'info') {
    setAssets((current) => current.map((item) => (item.id === asset.id ? { ...item, ...changes } : item)))
    logActivity(title, detail, tone, areaName(asset.departmentKey))
  }

  function reject(asset: MediaAsset) {
    setAssets((current) => current.filter((item) => item.id !== asset.id))
    logActivity('Asset rejected', `${asset.name} was not approved and has been removed.`, 'warning', areaName(asset.departmentKey))
  }

  function remove(asset: MediaAsset) {
    setAssets((current) => current.filter((item) => item.id !== asset.id))
    logActivity('Asset deleted', `${asset.name} was removed from the library.`, 'warning', areaName(asset.departmentKey))
    setPendingDelete(null)
  }

  // ---------- Uploads ----------
  function chooseUploads(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return
    const defaultArea = isHotelManager ? (areaFilter !== 'all' && areaFilter !== 'hotel' ? areaFilter : null) : allowedAreas[0]
    setUploads(
      files.map((file) => ({
        key: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        name: file.name,
        kind: kindFromFile(file.name, file.type),
        departmentKey: defaultArea,
        error: file.size > MAX_UPLOAD_BYTES ? `Larger than ${formatBytes(MAX_UPLOAD_BYTES)}` : file.size === 0 ? 'Empty file' : undefined,
      })),
    )
  }

  async function saveUploads(list: PendingUpload[]) {
    const ok = list.filter((item) => !item.error && item.name.trim())
    const added: MediaAsset[] = []
    for (const item of ok) {
      added.push({
        id: crypto.randomUUID(),
        name: item.name.trim(),
        kind: item.kind,
        departmentKey: isHotelManager ? item.departmentKey : allowedAreas[0],
        status: isHotelManager ? 'Approved' : 'Pending approval',
        locked: false,
        addedAt: new Date().toISOString(),
        addedBy: user.name,
        size: item.file.size,
        preview: await makePreview(item.file),
      })
    }
    setAssets((current) => [...added, ...current])
    const names = added.map((asset) => asset.name).join(', ')
    logActivity(
      isHotelManager ? 'Assets added' : 'Assets submitted',
      isHotelManager ? `${names} added to the approved library.` : `${names} waiting for the hotel manager to approve.`,
      isHotelManager ? 'success' : 'info',
      areaName(added[0]?.departmentKey ?? null),
    )
    setUploads(null)
    setPendingOnly(false)
    setKindFilter('All')
  }

  // ---------- Extraction ----------
  function reset() {
    setExtraction({ stage: 'idle' })
  }

  function useSample() {
    setExtraction({
      stage: 'review',
      fileName: sample.file,
      fields: Object.entries(sample.fields),
      confidence: sample.confidence,
      source: 'sample',
      note: `Sample ${sample.type.toLowerCase()} for ${areaName(extractArea)} — demo figures. Edit anything before confirming.`,
    })
  }

  async function chooseReport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setExtraction({ stage: 'reading', fileName: file.name })
    if (!readableReport(file.name)) {
      setExtraction({
        stage: 'review',
        fileName: file.name,
        size: file.size,
        fields: Object.entries(sample.fields),
        confidence: 'Low',
        source: 'sample',
        note: 'PDFs, spreadsheets and screenshots are read by the AI server, which isn’t connected in this demo — these are sample figures. Check every value against your report before confirming.',
      })
      return
    }
    const text = (await file.text()).slice(0, 6000)
    const ai = await structureBusinessSignal({ hotelId: activeHotel.id, businessArea: extractArea, message: `Report file: ${file.name}\n\n${text}`, sourceType: 'file_upload' })
    if (ai.live && Object.keys(ai.extractedFields).length) {
      setExtraction({
        stage: 'review',
        fileName: file.name,
        size: file.size,
        fields: Object.entries(ai.extractedFields).map(([key, value]) => [key, String(value)]),
        confidence: ai.confidence,
        source: 'ai',
        note: `Read by the AI from ${file.name}. ${ai.summary}`,
      })
      return
    }
    const parsed = parseReportCsv(text)
    if (parsed) {
      setExtraction({
        stage: 'review',
        fileName: file.name,
        size: file.size,
        fields: Object.entries(parsed),
        confidence: 'Medium',
        source: 'csv',
        note: `Read directly from the columns in ${file.name}. The AI server isn’t connected, so nothing was interpreted — check the labels make sense.`,
      })
      return
    }
    setExtraction({
      stage: 'review',
      fileName: file.name,
      size: file.size,
      fields: [['summary', text.split('\n')[0]?.slice(0, 120) ?? '']],
      confidence: 'Low',
      source: 'csv',
      note: 'No table was found in this file. Add the figures by hand before confirming.',
    })
  }

  function confirm(review: Extract<Extraction, { stage: 'review' }>) {
    const fields = Object.fromEntries(review.fields.filter(([key, value]) => key.trim() && value.trim()).map(([key, value]) => [key.trim(), value.trim()]))
    const signalId = crypto.randomUUID()
    setSignals((current) => [
      {
        id: signalId,
        departmentKey: extractArea,
        sourceType: 'file_upload',
        summary: `${review.fileName} extracted and confirmed in Files & Media`,
        fields,
        confidence: review.confidence,
        state: 'Confirmed',
        createdAt: new Date().toISOString(),
      },
      ...current,
    ])
    setAssets((current) => [
      {
        id: crypto.randomUUID(),
        name: review.fileName,
        kind: 'Report',
        departmentKey: extractArea,
        status: 'Approved',
        locked: false,
        addedAt: new Date().toISOString(),
        addedBy: user.name,
        size: review.size,
        signalId,
      },
      ...current.filter((asset) => !(asset.name === review.fileName && asset.departmentKey === extractArea)),
    ])
    logActivity('Report confirmed', `${review.fileName}: ${Object.keys(fields).length} figures are now trusted data for ${areaName(extractArea)}.`, 'success', areaName(extractArea))
    setExtraction({ stage: 'confirmed', fileName: review.fileName, count: Object.keys(fields).length, area: extractArea })
  }

  function openArea(key: DepartmentKey) {
    writeStored('otel:active-department', key)
    onNavigate('departments')
  }

  const previous = signals.find((signal) => signal.departmentKey === extractArea && signal.state === 'Confirmed')?.fields ?? {}

  return (
    <>
      <section className="results-overview">
        <div>
          <span>Approved assets</span>
          <strong>{approved.length}</strong>
          <em>{locked.length} locked for brand consistency</em>
        </div>
        <div className={pending.length && isHotelManager ? 'tile-warning' : ''}>
          <span>Awaiting approval</span>
          <strong>{pending.length}</strong>
          <em>{isHotelManager ? (pending.length ? 'need your review' : 'nothing to review') : 'with the hotel manager'}</em>
        </div>
        <div>
          <span>Reports feeding the AI</span>
          <strong>{reports30.length}</strong>
          <em>{recentReports[0] ? `latest: ${areaName(recentReports[0].departmentKey)} · ${timeAgo(recentReports[0].createdAt)}` : 'confirmed in the last 30 days'}</em>
        </div>
        <div>
          <span>Library</span>
          <strong>{formatBytes(totalBytes) || '0 KB'}</strong>
          <em>{mine.length} files · previews only in this demo</em>
        </div>
      </section>

      {pending.length > 0 && (
        <section className="panel campaign-queue">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Approvals</p>
              <h2>Awaiting approval</h2>
            </div>
            <span className="muted small">Only approved assets can be used in campaigns.</span>
          </div>
          <ul className="queue-list">
            {pending.map((asset) => {
              const Icon = kindIcon[asset.kind]
              return (
                <li key={asset.id}>
                  <span className="attention-tag tone-warning">
                    <Icon size={12} /> {asset.kind}
                  </span>
                  <span className="queue-text">
                    <strong>{asset.name}</strong>
                    <span>
                      {areaName(asset.departmentKey)} · submitted by {asset.addedBy ?? 'a department manager'} {timeAgo(asset.addedAt)}
                      {asset.size ? ` · ${formatBytes(asset.size)}` : ''}
                    </span>
                  </span>
                  {isHotelManager ? (
                    <span className="queue-actions">
                      <button type="button" className="secondary-button small" onClick={() => reject(asset)}>
                        <X size={14} /> Reject
                      </button>
                      <button type="button" className="primary-button small" onClick={() => update(asset, { status: 'Approved' }, 'Asset approved', `${asset.name} can now be used in campaigns.`, 'success')}>
                        <Check size={14} /> Approve
                      </button>
                    </span>
                  ) : (
                    <span className="muted small">With the hotel manager</span>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <div className="power-grid">
        <section className="panel span-2">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Files & Media</p>
              <h2>Library</h2>
            </div>
            <label className="file-picker-label">
              <input type="file" multiple onChange={chooseUploads} hidden data-testid="library-upload" />
              <span className="primary-button small">
                <Upload size={14} /> {isHotelManager ? 'Upload files' : 'Submit files'}
              </span>
            </label>
          </div>
          <p className="muted small">
            Shared with Hotel Brain. Images, videos, menus, brochures, price lists, brand files and confirmed reports.{' '}
            {isHotelManager ? 'What you upload is approved straight away.' : 'What you submit is used once the hotel manager approves it.'}
          </p>

          <div className="campaign-toolbar">
            <label className="campaign-search">
              <Search size={15} />
              <input type="search" placeholder="Search files" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search files" />
            </label>
            {isHotelManager && (
              <select className="filter-select" aria-label="Filter files by business area" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value as DepartmentKey | 'hotel' | 'all')}>
                <option value="all">All areas</option>
                <option value="hotel">Hotel-wide</option>
                {departments.map((department) => (
                  <option key={department.key} value={department.key}>
                    {department.name}
                  </option>
                ))}
              </select>
            )}
            <label className="inline-check">
              <input type="checkbox" checked={pendingOnly} onChange={(event) => setPendingOnly(event.target.checked)} /> Awaiting approval only
            </label>
          </div>
          <div className="audience-filter-row">
            {(['All', ...assetKinds] as const).map((kind) => {
              const count = kind === 'All' ? inScope.length : inScope.filter((asset) => asset.kind === kind).length
              if (kind !== 'All' && count === 0 && kindFilter !== kind) return null
              return (
                <button type="button" key={kind} className={kindFilter === kind ? 'selected' : ''} onClick={() => setKindFilter(kind)}>
                  {kind} · {count}
                </button>
              )
            })}
          </div>

          {visible.length === 0 ? (
            <div className="contact-table-empty">
              No files match these filters.{' '}
              <button
                type="button"
                className="ghost-link"
                onClick={() => {
                  setQuery('')
                  setKindFilter('All')
                  setAreaFilter('all')
                  setPendingOnly(false)
                }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="library-grid">
              {visible.map((asset) => {
                const Icon = kindIcon[asset.kind]
                const fed = asset.signalId ? signals.find((signal) => signal.id === asset.signalId) : undefined
                return (
                  <article className={`library-card ${asset.status === 'Pending approval' ? 'pending' : ''}`} key={asset.id}>
                    <div className={`library-thumb kind-${asset.kind.toLowerCase().replace(/\s+/g, '-')}`}>
                      {asset.preview ? <img src={asset.preview} alt="" loading="lazy" /> : <Icon size={26} />}
                      {asset.locked && (
                        <span className="library-lock" title="Locked for brand consistency">
                          <Lock size={12} />
                        </span>
                      )}
                    </div>
                    <div className="library-body">
                      <strong title={asset.name}>{asset.name}</strong>
                      <small>
                        {asset.kind} · {areaName(asset.departmentKey)}
                      </small>
                      <small>
                        {[formatBytes(asset.size), formatDate(localDate(asset.addedAt)), asset.addedBy].filter(Boolean).join(' · ')}
                      </small>
                      {fed && <small className="library-fed">Fed {areaName(fed.departmentKey)} data · {Object.keys(fed.fields).length} figures</small>}
                    </div>
                    <div className="library-foot">
                      <span className={asset.status === 'Approved' ? 'library-status approved' : 'library-status pending-chip'}>{asset.status === 'Approved' ? (asset.locked ? 'Locked' : 'Approved') : 'Awaiting approval'}</span>
                      <span className="library-actions">
                        {isHotelManager && asset.status === 'Approved' && (
                          <button
                            type="button"
                            aria-label={asset.locked ? `Unlock ${asset.name}` : `Lock ${asset.name}`}
                            title={asset.locked ? 'Unlock — allow per-campaign edits' : 'Lock for brand consistency'}
                            onClick={() => update(asset, { locked: !asset.locked }, asset.locked ? 'Asset unlocked' : 'Asset locked', `${asset.name} is now ${asset.locked ? 'editable per campaign' : 'locked for brand consistency'}.`)}
                          >
                            {asset.locked ? <Unlock size={13} /> : <Lock size={13} />}
                          </button>
                        )}
                        {canDelete(asset) && (
                          <button type="button" aria-label={`Delete ${asset.name}`} title="Delete" onClick={() => setPendingDelete(asset)}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </span>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section className="panel extraction-panel" id="extract-report">
          <p className="eyebrow">Update the AI from a report</p>
          <h2>Extract figures</h2>
          <p className="muted small">Upload a trading report, booking export or diary screenshot. You check every figure before the AI uses it.</p>
          <label className="stacked-label">
            <span>Business area</span>
            <select
              aria-label="Report business area"
              value={extractArea}
              disabled={!isHotelManager || extraction.stage === 'review'}
              onChange={(event) => {
                setChosenArea(event.target.value as DepartmentKey)
                reset()
              }}
            >
              {departments
                .filter((department) => canAccess(department.key))
                .map((department) => (
                  <option key={department.key} value={department.key}>
                    {department.name}
                  </option>
                ))}
            </select>
          </label>

          {(extraction.stage === 'idle' || extraction.stage === 'reading') && (
            <div className="upload-dropzone compact">
              <ScanSearch size={24} />
              <label className="file-picker-label">
                <input type="file" accept=".csv,.txt,.pdf,.xlsx,.xls,.png,.jpg,.jpeg" onChange={chooseReport} hidden data-testid="report-upload" />
                <span className="secondary-button">{extraction.stage === 'reading' ? `Reading ${extraction.fileName}…` : 'Choose a report'}</span>
              </label>
              <span>CSV and text reports are read on the spot. PDFs, spreadsheets and screenshots need the AI server.</span>
              <button type="button" className="ghost-link" onClick={useSample} disabled={extraction.stage === 'reading'}>
                or try the sample report ({sample.file})
              </button>
            </div>
          )}

          {extraction.stage === 'review' && (
            <div className="extraction-review">
              <div className="review-head">
                <span className={`source-badge source-${extraction.source}`}>{extraction.source === 'ai' ? 'Read by AI' : extraction.source === 'csv' ? 'Read from file' : 'Sample figures'}</span>
                <span className="confidence">{extraction.confidence} confidence</span>
              </div>
              <strong className="review-file">{extraction.fileName}</strong>
              <p className="muted small">{extraction.note}</p>
              <div className="field-grid">
                {extraction.fields.map(([key, value], index) => (
                  <label key={index}>
                    <span>
                      {key}
                      {previous[key] && previous[key] !== value && <em className="was">was {previous[key]}</em>}
                    </span>
                    <span className="field-input">
                      <input
                        value={value}
                        aria-label={key}
                        onChange={(event) =>
                          setExtraction({ ...extraction, fields: extraction.fields.map((pair, i) => (i === index ? [pair[0], event.target.value] : pair)) })
                        }
                      />
                      <button type="button" aria-label={`Remove ${key}`} onClick={() => setExtraction({ ...extraction, fields: extraction.fields.filter((_, i) => i !== index) })}>
                        <X size={13} />
                      </button>
                    </span>
                  </label>
                ))}
              </div>
              <AddField onAdd={(key, value) => setExtraction({ ...extraction, fields: [...extraction.fields, [key, value]] })} existing={extraction.fields.map(([key]) => key)} />
              <div className="form-actions">
                <button type="button" className="secondary-button" onClick={reset}>
                  Discard
                </button>
                <button type="button" className="primary-button" onClick={() => confirm(extraction)} disabled={extraction.fields.every(([, value]) => !value.trim())}>
                  Confirm trusted data
                </button>
              </div>
            </div>
          )}

          {extraction.stage === 'confirmed' && (
            <div className="confirmed-banner stacked">
              <span>
                <CheckCircle2 size={17} /> {extraction.count} figures from {extraction.fileName} are now trusted data for {areaName(extraction.area)}.
              </span>
              <span className="muted small">Recommendations and KPIs use them from now on, and the report is saved in the library.</span>
              <span className="confirmed-actions">
                <button type="button" className="secondary-button small" onClick={() => openArea(extraction.area)}>
                  Open {areaName(extraction.area)} <ArrowRight size={14} />
                </button>
                <button type="button" className="ghost-link" onClick={reset}>
                  <Plus size={13} /> Extract another
                </button>
              </span>
            </div>
          )}

          <div className="detail-section">
            <h3>
              Recent reports <span>{recentReports.length}</span>
            </h3>
            {recentReports.length === 0 ? (
              <p className="muted small">No reports confirmed yet.</p>
            ) : (
              <ul className="recent-reports">
                {recentReports.slice(0, 5).map((signal) => (
                  <li key={signal.id}>
                    <button type="button" onClick={() => openArea(signal.departmentKey)}>
                      <strong>{signal.summary.replace(' extracted and confirmed in Files & Media', '')}</strong>
                      <small>
                        {areaName(signal.departmentKey)} · {Object.keys(signal.fields).length} figures · {timeAgo(signal.createdAt)}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {uploads && (
        <Modal title={isHotelManager ? 'Add to the library' : 'Submit for approval'} onClose={() => setUploads(null)} wide>
          <p className="muted small">
            {isHotelManager ? 'Check the type and area for each file.' : `These go to the hotel manager for approval, filed under ${areaName(allowedAreas[0])}.`} Only a small preview is kept in this demo.
          </p>
          <div className="upload-rows">
            {uploads.map((item, index) => (
              <div className={`upload-row ${item.error ? 'has-error' : ''}`} key={item.key}>
                <input value={item.name} aria-label="File name" onChange={(event) => setUploads(uploads.map((row, i) => (i === index ? { ...row, name: event.target.value } : row)))} />
                <select aria-label="File type" value={item.kind} onChange={(event) => setUploads(uploads.map((row, i) => (i === index ? { ...row, kind: event.target.value as AssetKind } : row)))}>
                  {assetKinds.map((kind) => (
                    <option key={kind}>{kind}</option>
                  ))}
                </select>
                <select
                  aria-label="Business area"
                  value={isHotelManager ? item.departmentKey ?? 'hotel' : allowedAreas[0]}
                  disabled={!isHotelManager}
                  onChange={(event) => setUploads(uploads.map((row, i) => (i === index ? { ...row, departmentKey: event.target.value === 'hotel' ? null : (event.target.value as DepartmentKey) } : row)))}
                >
                  {isHotelManager && <option value="hotel">Hotel-wide</option>}
                  {departments
                    .filter((department) => canAccess(department.key))
                    .map((department) => (
                      <option key={department.key} value={department.key}>
                        {department.name}
                      </option>
                    ))}
                </select>
                <small>{item.error ?? formatBytes(item.file.size)}</small>
              </div>
            ))}
          </div>
          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={() => setUploads(null)}>
              Cancel
            </button>
            <button type="button" className="primary-button" onClick={() => saveUploads(uploads)} disabled={uploads.every((item) => item.error)}>
              {isHotelManager ? 'Add' : 'Submit'} {uploads.filter((item) => !item.error).length} file{uploads.filter((item) => !item.error).length === 1 ? '' : 's'}
            </button>
          </div>
        </Modal>
      )}

      {pendingDelete && (
        <Modal title="Delete this file?" onClose={() => setPendingDelete(null)}>
          <p>
            <strong>{pendingDelete.name}</strong> ({pendingDelete.kind}, {areaName(pendingDelete.departmentKey)}) will be removed from the library.
            {pendingDelete.signalId ? ' The figures it fed stay in the business data.' : ''}
          </p>
          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={() => setPendingDelete(null)}>
              Keep it
            </button>
            <button type="button" className="primary-button danger" onClick={() => remove(pendingDelete)}>
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

function AddField({ onAdd, existing }: { onAdd: (key: string, value: string) => void; existing: string[] }) {
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const clash = existing.includes(key.trim())
  return (
    <div className="add-field">
      <input placeholder="New figure" value={key} onChange={(event) => setKey(event.target.value)} aria-label="New field name" />
      <input placeholder="Value" value={value} onChange={(event) => setValue(event.target.value)} aria-label="New field value" />
      <button
        type="button"
        className="secondary-button small"
        disabled={!key.trim() || !value.trim() || clash}
        title={clash ? 'That figure is already listed' : undefined}
        onClick={() => {
          onAdd(key.trim(), value.trim())
          setKey('')
          setValue('')
        }}
      >
        <Plus size={13} /> Add
      </button>
    </div>
  )
}
