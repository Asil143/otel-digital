import { AlertTriangle, Eye, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { baseSuppressed } from '../../../data/contacts'
import { eligibleFor, LOW_CONSENT, reachable, segmentStats, statsFor, useContacts } from '../../../lib/audience'
import { formatCount } from '../../../lib/results'
import type { StageProps } from './shared'

export function AudienceStage({ campaign, department, onChange, onActivity }: StageProps) {
  const [contacts] = useContacts()
  const [showPreview, setShowPreview] = useState(false)

  const stats = segmentStats(contacts)
  const selected = campaign.audience.map((name) => statsFor(name, stats)).filter((item) => item !== undefined)
  const eligible = eligibleFor(campaign.audience, stats)
  const excluded = selected.reduce((sum, segment) => sum + (segment.total - segment.consented), 0)
  const awaiting = selected.reduce((sum, segment) => sum + segment.unknown, 0)
  const previewContacts = contacts.filter((contact) => campaign.audience.includes(contact.segment) && reachable(contact)).slice(0, 6)

  function toggleSegment(segment: string) {
    const audience = campaign.audience.includes(segment)
      ? campaign.audience.filter((item) => item !== segment)
      : [...campaign.audience, segment]
    onChange({ ...campaign, audience })
    onActivity('Audience updated', `${segment} ${audience.includes(segment) ? 'added to' : 'removed from'} ${campaign.name}.`)
  }

  return (
    <div className="audience-stage">
      <div className="stage-heading">
        <div>
          <h3>Recommended segments</h3>
          <p className="muted small">From the hotel’s Audience catalogue. Only guests with recorded consent who aren’t suppressed are counted.</p>
        </div>
        <button type="button" className="secondary-button" onClick={() => setShowPreview((current) => !current)}>
          <Eye size={15} /> {showPreview ? 'Hide preview' : 'Preview audience'}
        </button>
      </div>

      <div className="audience-grid">
        {department.audience.map((name) => {
          const segment = statsFor(name, stats)
          const low = segment ? segment.rate < LOW_CONSENT : false
          return (
            <label key={name} className={campaign.audience.includes(name) ? 'selected' : ''}>
              <input type="checkbox" checked={campaign.audience.includes(name)} onChange={() => toggleSegment(name)} />
              <span>
                <strong>{name}</strong>
                {segment ? (
                  <>
                    {formatCount(segment.consented)} reachable of {formatCount(segment.total)} · {Math.round(segment.rate * 100)}% consented
                    {low && (
                      <em className="segment-low">
                        <AlertTriangle size={12} /> Low consent
                      </em>
                    )}
                  </>
                ) : (
                  'Not in the Audience catalogue'
                )}
              </span>
            </label>
          )
        })}
      </div>

      <div className="consent-box">
        <ShieldCheck size={18} />
        <span>
          <strong>{formatCount(eligible)} guests will receive this campaign</strong> after consent and suppression checks.{' '}
          {formatCount(excluded)} in these segments have no recorded consent or have opted out
          {awaiting ? ` (${awaiting} individual record${awaiting === 1 ? '' : 's'} awaiting confirmation on the Audience page)` : ''}, and the hotel’s{' '}
          {formatCount(baseSuppressed)}-address suppression list is never contacted.
        </span>
      </div>

      {showPreview && (
        <div className="audience-preview">
          <p className="eyebrow">Sample of guests who will receive it</p>
          {previewContacts.map((contact) => (
            <div key={contact.id} className="audience-preview-row">
              <strong>{contact.name}</strong>
              <span>{contact.segment}</span>
              <em>{contact.consentBasis ?? 'Consented'}</em>
            </div>
          ))}
          {previewContacts.length === 0 && (
            <p className="muted small">No individual records for these segments on this device yet. The counts above come from the synced guest lists.</p>
          )}
        </div>
      )}
    </div>
  )
}
