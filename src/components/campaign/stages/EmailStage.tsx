import { Check, Copy, Download, Lock, Send, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { activeHotel } from '../../../config/hotel'
import { designImage } from '../../../lib/designFormats'
import { buildEmailHtml, emailChecks, emailStyles } from '../../../lib/emailHtml'
import { usePersistentState } from '../../../lib/usePersistentState'
import { addDays, formatDate, formatDateTime, withApproval } from '../../../services/campaigns'
import type { EmailContent, HotelAccount } from '../../../types/domain'
import { EmailPreview } from '../EmailPreview'
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
  const [hotel] = usePersistentState<HotelAccount>('otel:hotel-account', activeHotel)
  const [copied, setCopied] = useState(false)

  if (!campaign.channels.includes('Email')) {
    return <ChannelMissing campaign={campaign} channel="Email" label="Email" onChange={onChange} />
  }

  const email = campaign.email
  const style = emailStyles[department.key]
  // The email hero is the photo chosen for the Email header design, so the two always match.
  const html = buildEmailHtml(campaign, department, { ...activeHotel, ...hotel }, designImage(campaign, department.key, 'Email header'))
  const checks = emailChecks(campaign, html)
  const allChecksPass = checks.every((check) => check.status !== 'fail')
  const warnings = checks.filter((check) => check.status === 'warn').length
  const fileName = `${campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-email.html`

  async function copyHtml() {
    try {
      await navigator.clipboard.writeText(html)
    } catch {
      const area = document.createElement('textarea')
      area.value = html
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      area.remove()
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
    onActivity('Email HTML copied', `${campaign.name}: email-safe HTML copied for your email provider.`, 'info')
  }

  function downloadHtml() {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)
    onActivity('Email HTML downloaded', `${campaign.name}: ${fileName}.`, 'info')
  }

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
        <p className="muted small">You edit the words. The email-safe HTML on the right is built from the {department.name} template and is exactly what you copy or download.</p>
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
        <div className="email-template-line">
          <span>
            <strong>{style.family} template</strong> · {style.width}px · {style.why}
          </span>
          <PreviewToggle mode={previewMode} onChange={setPreviewMode} />
        </div>
        <p className="email-inbox-line">
          <strong>{email.senderName}</strong> · {email.subject || 'No subject'} <span>— {email.previewText}</span>
        </p>
        <EmailPreview html={html} width={style.width} mode={previewMode} title={`Email preview: ${email.subject}`} />
        <div className="email-export">
          <button type="button" className="secondary-button small" onClick={copyHtml}>
            <Copy size={14} /> {copied ? 'Copied' : 'Copy HTML'}
          </button>
          <button type="button" className="secondary-button small" onClick={downloadHtml}>
            <Download size={14} /> Download .html
          </button>
          <span className="muted small">Paste into Brevo or Mailchimp; {'{{ unsubscribe }}'} becomes each guest’s unsubscribe link.</span>
        </div>

        <div className="quality-checks">
          <h4>
            Quality checks
            <span>{allChecksPass ? (warnings ? `${warnings} suggestion${warnings === 1 ? '' : 's'}` : 'all clear') : 'fix before sending'}</span>
          </h4>
          {checks.map((check) => (
            <span key={check.id} className={check.status === 'pass' ? 'ok' : check.status === 'warn' ? 'warn' : 'fail'} data-check={check.id}>
              {check.status === 'pass' ? <Check size={14} /> : <TriangleAlert size={14} />}
              <span className="check-text">
                {check.label}
                {check.detail && <small>{check.detail}</small>}
              </span>
              {check.verified && <Lock size={12} className="locked-icon" aria-label="Verified in the generated HTML" />}
            </span>
          ))}
          <p className="muted small">Checks with a lock are verified against the generated HTML, not assumed.</p>
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
