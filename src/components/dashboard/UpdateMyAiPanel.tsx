import { BadgeCheck, Clock3, FileUp, Sparkles, X } from 'lucide-react'
import { useState, type ChangeEvent } from 'react'
import { activeHotel } from '../../config/hotel'
import { sourceStates } from '../../data/workflows'
import { ageLabel, daysSince, needsCheckIn, signalsFor, type Freshness } from '../../lib/freshness'
import { structureBusinessSignal } from '../../services/aiMarketing'
import type { ActivityEvent } from '../../types/activity'
import type { Department, SignalRecord, SignalSourceType } from '../../types/domain'

const tabs = ['Quick update', 'Upload file', 'Forward email', 'Check-in'] as const
type Tab = (typeof tabs)[number]

const sourceTypeByTab: Record<Tab, SignalSourceType> = {
  'Quick update': 'quick_update',
  'Upload file': 'file_upload',
  'Forward email': 'forwarded_email',
  'Check-in': 'adaptive_check_in',
}

const sourceLabel: Record<SignalSourceType, string> = {
  quick_update: 'Quick update',
  file_upload: 'File upload',
  forwarded_email: 'Forwarded email',
  adaptive_check_in: 'Check-in',
}

const checkInPeriods = ['Weekday lunch', 'Weekday dinner', 'Weekend', 'Next key date'] as const
type CheckInLevel = 'Strong' | 'Normal' | 'Quiet'
const MAX_UPDATE_LENGTH = 500

export function UpdateMyAiPanel({
  department,
  freshness,
  signals,
  onSignalsChange,
  onActivity,
}: {
  department: Department
  freshness: Freshness
  signals: SignalRecord[]
  onSignalsChange: (update: (current: SignalRecord[]) => SignalRecord[]) => void
  onActivity: (event: ActivityEvent) => void
}) {
  const [activeTab, setActiveTab] = useState<Tab>('Quick update')
  const [messageByDepartment, setMessageByDepartment] = useState<Record<string, string>>({})
  const [forwardedEmail, setForwardedEmail] = useState('')
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number } | null>(null)
  const [checkInLevels, setCheckInLevels] = useState<Record<string, CheckInLevel>>({})
  const [structuring, setStructuring] = useState(false)
  const [showLegend, setShowLegend] = useState(false)
  const [draft, setDraft] = useState<{ signalId: string; fields: Record<string, string> } | null>(null)

  const departmentSignals = signalsFor(department.key, signals)
  const pending = departmentSignals.find((signal) => signal.state === 'Detected') ?? null
  const recent = departmentSignals.slice(0, 4)

  const message =
    messageByDepartment[department.key] ??
    `Next week is quiet for ${department.name.toLowerCase()}. Promote ${department.offer} to local and past guests.`

  function setMessage(value: string) {
    setMessageByDepartment((prev) => ({ ...prev, [department.key]: value.slice(0, MAX_UPDATE_LENGTH) }))
  }

  function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadedFile({ name: file.name, size: file.size })
  }

  function buildMessageForActiveTab(): string | null {
    if (activeTab === 'Upload file') {
      return uploadedFile
        ? `Uploaded ${uploadedFile.name} (${(uploadedFile.size / 1024).toFixed(0)} KB) for ${department.name}. Extract demand, offers, and dates.`
        : null
    }
    if (activeTab === 'Forward email') return forwardedEmail.trim() || null
    if (activeTab === 'Check-in') {
      const answered = checkInPeriods.filter((period) => checkInLevels[period])
      if (answered.length === 0) return null
      return `30-second check-in for ${department.name}: ${answered.map((period) => `${period} ${checkInLevels[period]}`).join(', ')}.`
    }
    return message.trim() || null
  }

  const readyToStructure = buildMessageForActiveTab() !== null

  async function handleStructureUpdate() {
    const text = buildMessageForActiveTab()
    if (!text) return
    setStructuring(true)
    const result = await structureBusinessSignal({
      hotelId: activeHotel.id,
      businessArea: department.key,
      message: text,
      sourceType: sourceTypeByTab[activeTab],
    })
    const fields = Object.fromEntries(Object.entries(result.extractedFields).map(([key, value]) => [key, String(value)]))
    const signal: SignalRecord = {
      id: crypto.randomUUID(),
      departmentKey: department.key,
      sourceType: sourceTypeByTab[activeTab],
      summary: result.summary,
      fields,
      confidence: result.confidence,
      state: 'Detected',
      createdAt: new Date().toISOString(),
    }
    onSignalsChange((current) => [signal, ...current.filter((item) => !(item.departmentKey === department.key && item.state === 'Detected'))])
    setDraft({ signalId: signal.id, fields })
    setStructuring(false)
    onActivity({
      id: crypto.randomUUID(),
      title: 'Update detected',
      detail: `${sourceLabel[signal.sourceType]} for ${department.name} is awaiting your confirmation.`,
      tone: 'info',
    })
  }

  function handleConfirm() {
    if (!pending) return
    const fields = draft?.signalId === pending.id ? draft.fields : pending.fields
    onSignalsChange((current) =>
      current.map((item) => (item.id === pending.id ? { ...item, fields, state: 'Confirmed', createdAt: new Date().toISOString() } : item)),
    )
    setDraft(null)
    onActivity({
      id: crypto.randomUUID(),
      title: 'Business data confirmed',
      detail: `${department.name} update is now trusted current data.`,
      tone: 'success',
    })
  }

  function handleDiscard() {
    if (!pending) return
    onSignalsChange((current) => current.filter((item) => item.id !== pending.id))
    setDraft(null)
  }

  const pendingFields = pending ? (draft?.signalId === pending.id ? draft.fields : pending.fields) : {}

  return (
    <section className="panel update-panel" id="update-my-ai">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Keep your AI current</p>
          <h2>Update My AI</h2>
        </div>
        <BadgeCheck size={22} />
      </div>

      {needsCheckIn(freshness) && activeTab !== 'Check-in' && (
        <div className="adaptive-checkin">
          <Clock3 size={16} />
          <span>
            {department.name} data was {ageLabel(freshness.ageDays)}. A 30-second check-in keeps recommendations accurate.
          </span>
          <button type="button" onClick={() => setActiveTab('Check-in')}>Start check-in</button>
        </div>
      )}

      <div className="input-tabs">
        {tabs.map((tab) => (
          <button type="button" className={activeTab === tab ? 'selected' : ''} key={tab} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Quick update' && (
        <>
          <textarea
            aria-label="Update My AI"
            maxLength={MAX_UPDATE_LENGTH}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          <span className="char-count">{message.length}/{MAX_UPDATE_LENGTH}</span>
        </>
      )}

      {activeTab === 'Upload file' && (
        <div className="upload-dropzone compact">
          <FileUp size={22} />
          <label className="file-picker-label">
            <input type="file" accept=".png,.jpg,.jpeg,.pdf,.xlsx,.csv" onChange={handleFileSelect} hidden />
            <span className="secondary-button">Choose screenshot, PDF, Excel or CSV</span>
          </label>
          {uploadedFile && <span>{uploadedFile.name} · {(uploadedFile.size / 1024).toFixed(0)} KB</span>}
        </div>
      )}

      {activeTab === 'Forward email' && (
        <textarea
          aria-label="Forwarded report email"
          placeholder="Paste the forwarded booking or performance report email here..."
          value={forwardedEmail}
          onChange={(event) => setForwardedEmail(event.target.value)}
        />
      )}

      {activeTab === 'Check-in' && (
        <div className="check-in-grid">
          <p className="muted small">How is demand looking? Exact figures are optional.</p>
          {checkInPeriods.map((period) => (
            <div className="check-in-row" key={period}>
              <span>{period}</span>
              <div className="segmented">
                {(['Strong', 'Normal', 'Quiet'] as const).map((level) => (
                  <button
                    type="button"
                    key={level}
                    className={checkInLevels[period] === level ? 'selected' : ''}
                    onClick={() => setCheckInLevels((current) => ({ ...current, [period]: level }))}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className="primary-button full-width"
        onClick={handleStructureUpdate}
        disabled={structuring || !readyToStructure}
      >
        {structuring ? 'Structuring with AI...' : 'Structure update'} <Sparkles size={17} />
      </button>

      {pending && (
        <div className="confirmation-box">
          <div className="confirmation-heading">
            <strong>Detected — awaiting confirmation</strong>
            <span className="confidence">{pending.confidence} confidence</span>
          </div>
          <span>{pending.summary}</span>
          <div className="confirm-fields">
            {Object.entries(pendingFields).map(([key, value]) => (
              <label key={key}>
                <span>{key.replace(/_/g, ' ')}</span>
                <input
                  value={value}
                  onChange={(event) => pending && setDraft({ signalId: pending.id, fields: { ...pendingFields, [key]: event.target.value } })}
                />
              </label>
            ))}
          </div>
          <p className="muted small">Check the figures and correct anything the AI misread before confirming.</p>
          <div className="confirmation-actions">
            <button type="button" onClick={handleConfirm}>Confirm current data</button>
            <button type="button" className="ghost-link" onClick={handleDiscard}>
              <X size={14} /> Discard
            </button>
          </div>
        </div>
      )}

      <div className="recent-updates">
        <p className="eyebrow">Recent updates</p>
        {recent.length === 0 && <p className="muted small">No updates yet for {department.name}.</p>}
        {recent.map((signal) => (
          <div className="recent-update-row" key={signal.id}>
            <div>
              <strong>{signal.summary.length > 70 ? `${signal.summary.slice(0, 70)}…` : signal.summary}</strong>
              <span>
                {sourceLabel[signal.sourceType]} · {ageLabel(daysSince(signal.createdAt))} · {signal.confidence} confidence
              </span>
            </div>
            <em className={signal.state === 'Confirmed' ? 'state-confirmed' : 'state-detected'}>{signal.state}</em>
          </div>
        ))}
      </div>

      <div className="data-status-line">
        <span>Data status</span>
        <em className={`freshness-chip freshness-${freshness.state.toLowerCase()}`}>
          {freshness.state} · {ageLabel(freshness.ageDays)}
        </em>
        <button type="button" className="ghost-link" onClick={() => setShowLegend((current) => !current)} aria-expanded={showLegend}>
          {showLegend ? 'Hide' : 'What do these mean?'}
        </button>
      </div>
      {showLegend && (
        <ul className="state-legend">
          {sourceStates.map(({ state, detail, icon: Icon }) => (
            <li key={state} className={freshness.state === state ? 'current' : ''}>
              <Icon size={14} />
              <strong>{state}</strong>
              <span>{detail}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="intake-footnote">
        All information is reviewed and confirmed before it is used by the AI. Each update is stored with date, source and confidence level.
      </p>
    </section>
  )
}
