import { Eye, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { seedContacts } from '../../../data/contacts'
import { usePersistentState } from '../../../lib/usePersistentState'
import type { Contact } from '../../../types/domain'
import type { StageProps } from './shared'

const knownSegmentSizes: Record<string, number> = {
  'Past leisure guests': 8240,
  'Lapsed guests': 5120,
  'Local audience within 50 miles': 18400,
  'Family travellers': 6220,
}

function segmentSize(segment: string, index: number): number {
  return knownSegmentSizes[segment] ?? (index + 2) * 1840
}

export function AudienceStage({ campaign, department, onChange, onActivity }: StageProps) {
  const [contacts] = usePersistentState<Contact[]>('otel:audience-contacts', seedContacts)
  const [showPreview, setShowPreview] = useState(false)

  const consentRate = contacts.length > 0 ? contacts.filter((contact) => contact.permission === 'Subscribed').length / contacts.length : 0
  const selectedTotal = department.audience
    .map((segment, index) => (campaign.audience.includes(segment) ? segmentSize(segment, index) : 0))
    .reduce((sum, size) => sum + size, 0)
  const eligible = Math.round(selectedTotal * consentRate)
  const previewContacts = contacts.filter((contact) => contact.permission === 'Subscribed').slice(0, 5)

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
          <p className="muted small">Segment sizes are demo estimates. Consent is applied from your contact records.</p>
        </div>
        <button type="button" className="secondary-button" onClick={() => setShowPreview((current) => !current)}>
          <Eye size={15} /> {showPreview ? 'Hide preview' : 'Preview audience'}
        </button>
      </div>

      <div className="audience-grid">
        {department.audience.map((segment, index) => (
          <label key={segment} className={campaign.audience.includes(segment) ? 'selected' : ''}>
            <input type="checkbox" checked={campaign.audience.includes(segment)} onChange={() => toggleSegment(segment)} />
            <span>
              <strong>{segment}</strong>
              {segmentSize(segment, index).toLocaleString()} contacts (est.)
            </span>
          </label>
        ))}
      </div>

      <div className="consent-box">
        <ShieldCheck size={18} />
        <span>
          <strong>~{eligible.toLocaleString()} contacts eligible</strong> after consent and suppression checks, based on your current consent rate of{' '}
          {Math.round(consentRate * 100)}%. Contacts without explicit consent and the suppression list are always excluded.
        </span>
      </div>

      {showPreview && (
        <div className="audience-preview">
          <p className="eyebrow">Sample of consented contacts</p>
          {previewContacts.map((contact) => (
            <div key={contact.id} className="audience-preview-row">
              <strong>{contact.name}</strong>
              <span>{contact.segment}</span>
              <em>{contact.permission}</em>
            </div>
          ))}
          {previewContacts.length === 0 && <p className="muted small">No consented contacts yet. Import contacts on the Audience page.</p>}
        </div>
      )}
    </div>
  )
}
