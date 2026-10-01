import { Globe2 } from 'lucide-react'
import { activeHotel } from '../../../config/hotel'
import { withApproval } from '../../../services/campaigns'
import { canApprove } from '../../../services/permissions'
import type { WebsiteContent, WebsiteFormat } from '../../../types/domain'
import { ApproveControl, ChannelMissing, PreviewToggle, type StageProps } from './shared'

const formats: WebsiteFormat[] = ['Promo block', 'Landing page', 'Banner', 'SEO & meta']

export function WebsiteStage({
  campaign,
  department,
  currentRole,
  onChange,
  onActivity,
  previewMode,
  setPreviewMode,
}: StageProps & { previewMode: 'desktop' | 'mobile'; setPreviewMode: (mode: 'desktop' | 'mobile') => void }) {
  if (!campaign.channels.includes('Website')) {
    return <ChannelMissing campaign={campaign} channel="Website" label="Website" onChange={onChange} />
  }

  const website = campaign.website
  const placementOptions = department.key === 'rooms'
    ? ['Homepage hero', 'Offers page', 'Booking engine', 'Popup (optional)']
    : ['Homepage hero', 'Offers page', 'Popup (optional)']

  function updateWebsite(changes: Partial<WebsiteContent>) {
    onChange(withApproval({ ...campaign, website: { ...website, ...changes } }, 'Website', false))
  }

  function togglePlacement(placement: string) {
    const placements = website.placements.includes(placement)
      ? website.placements.filter((item) => item !== placement)
      : [...website.placements, placement]
    updateWebsite({ placements })
  }

  function publishToWordPress() {
    onActivity(
      'Queued for WordPress',
      `${website.format} for ${campaign.name} packaged for ${website.placements.join(', ')} (demo: WordPress is not connected, nothing went live).`,
      'success',
    )
  }

  const textFields: { key: keyof WebsiteContent; label: string; limit?: number; multiline?: boolean }[] =
    website.format === 'SEO & meta'
      ? [
          { key: 'metaTitle', label: 'Meta title', limit: 60 },
          { key: 'metaDescription', label: 'Meta description', limit: 155, multiline: true },
        ]
      : [
          { key: 'title', label: 'Title' },
          { key: 'subtitle', label: 'Subtitle' },
          { key: 'description', label: 'Description', multiline: true },
          { key: 'ctaText', label: 'Button text', limit: 24 },
          { key: 'link', label: 'Link' },
        ]

  return (
    <div className="website-stage">
      <div className="website-form">
        <div className="segmented format-tabs">
          {formats.map((format) => (
            <button type="button" key={format} className={website.format === format ? 'selected' : ''} onClick={() => updateWebsite({ format })}>
              {format}
            </button>
          ))}
        </div>
        {textFields.map(({ key, label, limit, multiline }) => {
          const value = String(website[key] ?? '')
          return (
            <label key={key}>
              <span>
                {label}
                {limit && <em className={value.length > limit ? 'over-limit' : ''}>{value.length}/{limit}</em>}
              </span>
              {multiline ? (
                <textarea value={value} onChange={(event) => updateWebsite({ [key]: event.target.value })} />
              ) : (
                <input value={value} onChange={(event) => updateWebsite({ [key]: event.target.value })} />
              )}
            </label>
          )
        })}
        <fieldset className="chip-fieldset">
          <legend>Placement</legend>
          {placementOptions.map((placement) => (
            <label key={placement} className={`choice-chip ${website.placements.includes(placement) ? 'selected' : ''}`}>
              <input type="checkbox" checked={website.placements.includes(placement)} onChange={() => togglePlacement(placement)} />
              {placement}
            </label>
          ))}
        </fieldset>
      </div>

      <div className="website-preview-column">
        <PreviewToggle mode={previewMode} onChange={setPreviewMode} />
        {website.format === 'SEO & meta' ? (
          <div className="serp-preview">
            <span className="serp-url">{(activeHotel.website ?? '').replace(/^https?:\/\//, '')}{website.link}</span>
            <strong>{website.metaTitle}</strong>
            <p>{website.metaDescription}</p>
          </div>
        ) : (
          <div className={`website-render ${previewMode} format-${website.format.split(' ')[0].toLowerCase()}`}>
            <div className="website-render-nav">
              <Globe2 size={13} /> {activeHotel.name}
            </div>
            <div className="website-render-hero" style={{ backgroundImage: `url(${department.image})` }}>
              <div>
                <strong>{website.title}</strong>
                <span>{website.subtitle}</span>
              </div>
            </div>
            {website.format !== 'Banner' && <p>{website.description}</p>}
            <span className="website-render-cta">{website.ctaText}</span>
          </div>
        )}
        <p className="muted small">Controlled publishing: only these fields change on your site. Placements: {website.placements.join(', ') || 'none selected'}.</p>

        <div className="stage-actions">
          <button type="button" className="secondary-button" onClick={() => onActivity('Website draft saved', `${website.format} draft saved for ${campaign.name}.`)}>
            Save draft
          </button>
          <ApproveControl
            approved={campaign.approvals.Website}
            label="Website change"
            role={currentRole}
            disabledReason={website.placements.length === 0 ? 'Choose at least one placement' : undefined}
            onApprove={() => {
              onChange(withApproval(campaign, 'Website', true))
              onActivity('Website change approved', `${website.format} approved for ${website.placements.join(', ')}.`, 'success')
            }}
            onRevoke={() => onChange(withApproval(campaign, 'Website', false))}
          />
          {canApprove(currentRole) && (
            <button
              type="button"
              className="secondary-button"
              onClick={publishToWordPress}
              disabled={!campaign.approvals.Website}
              title={campaign.approvals.Website ? undefined : 'Approve the website change first'}
            >
              Publish to WordPress
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
