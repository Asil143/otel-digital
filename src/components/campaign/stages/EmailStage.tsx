import { Check, Lock, Send, TriangleAlert } from 'lucide-react'
import { activeHotel } from '../../../config/hotel'
import { addDays, formatDate, formatDateTime, withApproval } from '../../../services/campaigns'
import type { EmailContent } from '../../../types/domain'
import { ApproveControl, ChannelMissing, PreviewToggle, type StageProps } from './shared'

const editableFields: { key: keyof EmailContent; label: string; multiline?: boolean; limit?: number }[] = [
  { key: 'subject', label: 'Subject line', limit: 60 },
  { key: 'previewText', label: 'Preview text', limit: 90 },
  { key: 'headline', label: 'Headline' },
  { key: 'body', label: 'Main message', multiline: true },
  { key: 'offerDetails', label: 'Offer details', multiline: true },
  { key: 'ctaText', label: 'Button text', limit: 24 },
  { key: 'senderName', label: 'Sender name' },
]

export function EmailStage({
  campaign,
  department,
  currentRole,
  onChange,
  onActivity,
  goToStage,
  previewMode,
  setPreviewMode,
}: StageProps & { previewMode: 'desktop' | 'mobile'; setPreviewMode: (mode: 'desktop' | 'mobile') => void }) {
  if (!campaign.channels.includes('Email')) {
    return <ChannelMissing campaign={campaign} channel="Email" label="Email" onChange={onChange} />
  }

  const email = campaign.email

  const checks = [
    { label: 'Subject line under 60 characters', ok: email.subject.trim().length > 0 && email.subject.length <= 60 },
    { label: 'Preview text added', ok: email.previewText.trim().length > 0 },
    { label: 'Button text fits a mobile tap target', ok: email.ctaText.trim().length > 0 && email.ctaText.length <= 24 },
    { label: 'Booking link set', ok: campaign.website.link.trim().length > 0 },
    { label: 'Unsubscribe footer included', ok: true, locked: true },
    { label: 'Mobile responsive, no horizontal overflow', ok: true, locked: true },
    { label: 'Responsive images and readable text size', ok: true, locked: true },
  ]
  const allChecksPass = checks.every((check) => check.ok)

  function updateEmail(changes: Partial<EmailContent>) {
    onChange(withApproval({ ...campaign, email: { ...email, ...changes, testSentAt: null } }, 'Emails', false))
  }

  function sendTest() {
    onChange({ ...campaign, email: { ...email, testSentAt: new Date().toISOString() } })
    onActivity('Test email sent', 'Test sent to your inbox (simulated — the email provider is not connected in this demo).', 'success')
  }

  return (
    <div className="email-stage">
      <div className="email-form">
        <h3>Email content</h3>
        <p className="muted small">You edit the words. The responsive HTML is generated from the approved template.</p>
        {editableFields.map(({ key, label, multiline, limit }) => {
          const value = String(email[key] ?? '')
          return (
            <label key={key}>
              <span>
                {label}
                {limit && <em className={value.length > limit ? 'over-limit' : ''}>{value.length}/{limit}</em>}
              </span>
              {multiline ? (
                <textarea value={value} onChange={(event) => updateEmail({ [key]: event.target.value })} />
              ) : (
                <input value={value} onChange={(event) => updateEmail({ [key]: event.target.value })} />
              )}
            </label>
          )
        })}
        <label className="inline-check">
          <input type="checkbox" checked={email.reminder} onChange={(event) => updateEmail({ reminder: event.target.checked })} />
          Send a reminder email 3 days before the offer ends ({formatDate(addDays(campaign.endDate, -3))})
        </label>
        <p className="audience-line">
          Sending to: <strong>{campaign.audience.join(', ') || 'no audience selected'}</strong>{' '}
          <button type="button" className="ghost-link" onClick={() => goToStage('Audience')}>Change audience</button>
        </p>
      </div>

      <div className="email-preview-column">
        <PreviewToggle mode={previewMode} onChange={setPreviewMode} />
        <div className={`email-render ${previewMode}`}>
          <p className="email-render-sender">{email.senderName}</p>
          <p className="email-render-subject">{email.subject}</p>
          <div className="email-render-hero" style={{ backgroundImage: `url(${department.image})` }}>
            <span>{email.headline}</span>
          </div>
          <div className="email-render-body">
            <p>{email.body}</p>
            <p className="email-render-offer">{email.offerDetails}</p>
            <span className="email-render-cta">{email.ctaText}</span>
          </div>
          <footer>
            {activeHotel.name} · {activeHotel.location}
            <br />
            You're receiving this because you opted in to hear from us. <u>Unsubscribe</u>
          </footer>
        </div>

        <div className="quality-checks">
          <h4>Quality checks</h4>
          {checks.map((check) => (
            <span key={check.label} className={check.ok ? 'ok' : 'fail'}>
              {check.ok ? <Check size={14} /> : <TriangleAlert size={14} />}
              {check.label}
              {check.locked && <Lock size={12} className="locked-icon" aria-label="Guaranteed by template" />}
            </span>
          ))}
          <p className="muted small">Mobile compatibility is automatic and cannot be turned off.</p>
        </div>

        <div className="stage-actions">
          <button type="button" className="secondary-button" onClick={sendTest} disabled={!allChecksPass}>
            <Send size={15} /> {email.testSentAt ? 'Send another test' : 'Send test'}
          </button>
          <ApproveControl
            approved={campaign.approvals.Emails}
            label="Email"
            role={currentRole}
            disabledReason={!allChecksPass ? 'Fix the quality checks first' : !email.testSentAt ? 'Send a test email before approving' : undefined}
            onApprove={() => {
              onChange(withApproval(campaign, 'Emails', true))
              onActivity('Email approved', `${campaign.name} email approved for sending.`, 'success')
            }}
            onRevoke={() => onChange(withApproval(campaign, 'Emails', false))}
          />
        </div>
        {email.testSentAt && <p className="muted small">Last test sent {formatDateTime(email.testSentAt)}.</p>}
        {!email.testSentAt && allChecksPass && <p className="muted small">Send a test before approval.</p>}
      </div>
    </div>
  )
}
