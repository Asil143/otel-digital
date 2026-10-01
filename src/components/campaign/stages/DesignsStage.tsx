import { BookMarked, Check, Eye, Globe2, Image, Lock, Mail, MessageSquareText, PenLine, RefreshCw, Sparkles, ThumbsDown, Unlock } from 'lucide-react'
import { useState } from 'react'
import { activeHotel } from '../../../config/hotel'
import { usePersistentState } from '../../../lib/usePersistentState'
import { designAssetNames, guestTitle, withApproval } from '../../../services/campaigns'
import { canApprove } from '../../../services/permissions'
import type { CampaignRecord, DesignState, DesignStyle } from '../../../types/domain'
import { Modal } from '../../ui/Modal'
import { areaImages } from '../../../data/areaImages'
import { useAssets } from '../../../lib/assets'
import { designImage, formatDefaults, formatSpecs, type DesignFormat } from '../../../lib/designFormats'
import { DesignCanvas } from '../DesignCanvas'
import type { StageProps } from './shared'

const styleVariants: DesignStyle[] = ['Classic', 'Bold', 'Minimal']
const feedbackReasons = ['Too busy', 'Too generic', 'Too AI-looking', 'Wrong image', 'Not premium enough', 'Too much text'] as const
// Feedback that means "pare it back" starts new designs in the Minimal style.
const simplerReasons = new Set(['Too busy', 'Too much text', 'Too AI-looking', 'Not premium enough'])
const assetIcons = { 'Social square': MessageSquareText, 'Instagram story': Image, 'Email header': Mail, 'Website banner': Globe2 }
const templateLibrary = [
  { id: 'signature', name: 'Signature hero', area: 'All areas' },
  { id: 'offer-card', name: 'Offer card', area: 'Rooms, Spa' },
  { id: 'menu-spotlight', name: 'Menu spotlight', area: 'Restaurant' },
]

type AssetName = (typeof designAssetNames)[number]
type Copy = { headline: string; offerText: string; cta: string; image: string }

export function DesignsStage({ campaign, department, currentRole, onChange, onActivity }: StageProps) {
  const [previewAsset, setPreviewAsset] = useState<AssetName | null>(null)
  const [editing, setEditing] = useState<{ asset: AssetName; copy: Copy } | null>(null)
  const [feedbackAsset, setFeedbackAsset] = useState<AssetName | null>(null)
  const [feedbackCounts, setFeedbackCounts] = usePersistentState<Record<string, number>>(`otel:${department.key}:design-feedback`, {})
  const [lockedTemplates, setLockedTemplates] = usePersistentState<string[]>(`otel:${department.key}:locked-templates`, ['signature'])

  const [assets] = useAssets()
  // Curated area photography plus any approved photos the hotel has added in Files & Media.
  const library = assets
    .filter((asset) => asset.kind === 'Image' && asset.status === 'Approved' && asset.preview && (asset.departmentKey === department.key || asset.departmentKey === null))
    .map((asset) => asset.preview as string)
  const photos = Array.from(new Set([...areaImages[department.key], ...library]))
  const learnedPreference = Object.entries(feedbackCounts).find(([, count]) => count >= 2)?.[0]
  const prefersSimpler = Boolean(learnedPreference && simplerReasons.has(learnedPreference))
  const defaultStyleFor = (asset: AssetName): DesignStyle => {
    const style = formatDefaults[asset as DesignFormat]?.style ?? 'Classic'
    return prefersSimpler && style === 'Bold' ? 'Minimal' : style
  }
  const isApproved = (asset: AssetName) => campaign.approvedDesigns.includes(asset)

  function stateFor(asset: AssetName): Required<Pick<DesignState, 'style' | 'variant'>> & Copy {
    const saved = campaign.designs?.[asset] ?? {}
    return {
      style: saved.style ?? defaultStyleFor(asset),
      variant: saved.variant ?? formatDefaults[asset as DesignFormat]?.variant ?? 0,
      image: designImage(campaign, department.key, asset as DesignFormat),
      headline: saved.headline ?? guestTitle(campaign),
      offerText: saved.offerText ?? campaign.offer,
      cta: saved.cta ?? (campaign.email.ctaText || 'Book now'),
    }
  }

  function setAssetApproval(asset: AssetName, approved: boolean) {
    const approvedDesigns = approved ? Array.from(new Set([...campaign.approvedDesigns, asset])) : campaign.approvedDesigns.filter((item) => item !== asset)
    const allApproved = designAssetNames.every((name) => approvedDesigns.includes(name))
    onChange(withApproval({ ...campaign, approvedDesigns }, 'Designs', allApproved))
  }

  /** Saves a change to one design; a changed design needs approval again. */
  function updateDesign(asset: AssetName, patch: DesignState, title: string, detail: string) {
    const wasApproved = isApproved(asset)
    let next: CampaignRecord = { ...campaign, designs: { ...campaign.designs, [asset]: { ...campaign.designs?.[asset], ...patch } } }
    if (wasApproved) next = withApproval({ ...next, approvedDesigns: next.approvedDesigns.filter((item) => item !== asset) }, 'Designs', false)
    onChange(next)
    onActivity(title, `${detail}${wasApproved ? ' It needs approval again.' : ''}`, 'info')
  }

  function recordFeedback(asset: AssetName, reason: string) {
    setFeedbackCounts((current) => ({ ...current, [reason]: (current[reason] ?? 0) + 1 }))
    onActivity('Feedback saved', `${asset}: "${reason}" saved as a design preference.`, 'warning')
    setFeedbackAsset(null)
  }

  function canvas(asset: AssetName) {
    const state = stateFor(asset)
    return (
      <DesignCanvas
        format={asset as DesignFormat}
        area={department.key}
        image={state.image}
        brand={activeHotel.name}
        headline={state.headline}
        offerText={state.offerText}
        cta={state.cta}
        style={state.style}
        variant={state.variant}
      />
    )
  }

  return (
    <>
      {learnedPreference && (
        <div className="learning-banner">
          <Sparkles size={16} />
          Learned preference for {department.name}: avoid "{learnedPreference}" in future proposals
          {simplerReasons.has(learnedPreference) ? ' — bold designs now start in the calmer Minimal style.' : '.'}
        </div>
      )}
      <p className="muted small stage-note">
        {campaign.approvedDesigns.length} of {designAssetNames.length} designs approved. Each format uses its real size and the {department.name} palette; photography and copy stay
        separate. Each format starts with a different approved photo; editing covers photo, copy, call to action and style.
      </p>
      <div className="design-board">
        {designAssetNames.map((asset) => {
          const Icon = assetIcons[asset]
          const state = stateFor(asset)
          const spec = formatSpecs[asset as DesignFormat]
          return (
            <article className={`asset-card design-card format-${asset.toLowerCase().replace(/\s+/g, '-')}`} key={asset}>
              <div className="design-stage-area">{canvas(asset)}</div>
              <div className="design-card-head">
                <Icon size={16} />
                <span>
                  <strong>{asset}</strong>
                  <small>
                    {spec.size} · {spec.use}
                  </small>
                </span>
                <em className={isApproved(asset) ? 'design-status approved' : 'design-status'}>{isApproved(asset) ? 'Approved' : 'Draft'}</em>
                <em className="style-tag">{state.style}</em>
              </div>
              <div className="asset-actions">
                <span className="design-primary">
                  <button type="button" onClick={() => setPreviewAsset(asset)}>
                    <Eye size={14} /> Preview
                  </button>
                  <button type="button" onClick={() => setEditing({ asset, copy: { headline: state.headline, offerText: state.offerText, cta: state.cta, image: state.image } })}>
                    <PenLine size={14} /> Edit
                  </button>
                  {canApprove(currentRole) ? (
                    <button
                      type="button"
                      className="design-approve"
                      disabled={isApproved(asset)}
                      onClick={() => {
                        setAssetApproval(asset, true)
                        onActivity('Asset approved', `${asset} approved for publishing.`, 'success')
                      }}
                    >
                      <Check size={14} /> {isApproved(asset) ? 'Approved' : 'Approve'}
                    </button>
                  ) : (
                    <button type="button" disabled title="Approval by hotel manager">
                      <Lock size={13} /> Manager approves
                    </button>
                  )}
                </span>
                <span className="design-secondary">
                  <button
                    type="button"
                    onClick={() => {
                      const next = styleVariants[(styleVariants.indexOf(state.style) + 1) % styleVariants.length]
                      updateDesign(asset, { style: next }, 'Style changed', `${asset} switched to the ${next} style.`)
                    }}
                  >
                    <BookMarked size={13} /> Use different style
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = photos[(Math.max(0, photos.indexOf(state.image)) + 1) % photos.length]
                      updateDesign(asset, { variant: state.variant + 1, image: next }, 'Asset regenerated', `${asset} regenerated from the same brief with a different photo and layout.`)
                    }}
                  >
                    <RefreshCw size={13} /> Regenerate
                  </button>
                  <button type="button" onClick={() => setFeedbackAsset(asset)}>
                    <ThumbsDown size={13} /> Give feedback
                  </button>
                </span>
              </div>
            </article>
          )
        })}
      </div>

      <div className="template-library">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Template library</p>
            <h3>Locked brand templates</h3>
          </div>
        </div>
        <div className="template-list">
          {templateLibrary.map((template) => {
            const locked = lockedTemplates.includes(template.id)
            return (
              <div className="template-row" key={template.id}>
                {locked ? <Lock size={16} /> : <Unlock size={16} />}
                <div>
                  <strong>{template.name}</strong>
                  <span>{template.area}</span>
                </div>
                <button
                  type="button"
                  disabled={!canApprove(currentRole)}
                  title={canApprove(currentRole) ? undefined : 'Only the hotel manager can lock templates'}
                  onClick={() => {
                    setLockedTemplates((current) => (locked ? current.filter((id) => id !== template.id) : [...current, template.id]))
                    onActivity(locked ? 'Template unlocked' : 'Template locked', `${template.name} ${locked ? 'is now editable per campaign' : 'is locked for on-brand consistency'}.`)
                  }}
                >
                  {locked ? 'Unlock' : 'Lock'}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {previewAsset && (
        <Modal title={`${previewAsset} preview`} onClose={() => setPreviewAsset(null)} wide>
          <div className="asset-preview-modal">
            <div className={`design-preview-frame format-${previewAsset.toLowerCase().replace(/\s+/g, '-')}`}>{canvas(previewAsset)}</div>
            <div className="modal-list">
              <article>
                <strong>Format</strong>
                <span>
                  {formatSpecs[previewAsset as DesignFormat].size} px · {formatSpecs[previewAsset as DesignFormat].use}
                </span>
              </article>
              <article>
                <strong>Status</strong>
                <span>
                  {isApproved(previewAsset) ? 'Approved' : 'Draft'} · {stateFor(previewAsset).style} style
                </span>
              </article>
              <article>
                <strong>Template rule</strong>
                <span>Approved {department.name} imagery and palette. Copy sits on its own panel, never over the photo. Only the photo (from approved photography), copy, call to action and style can change.</span>
              </article>
            </div>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal title={`Edit ${editing.asset}`} onClose={() => setEditing(null)}>
          <div className="modal-list edit-form">
            <div className="photo-picker" role="radiogroup" aria-label="Photo">
              <span>Photo</span>
              <div>
                {photos.map((url, index) => (
                  <button
                    type="button"
                    key={url}
                    role="radio"
                    aria-checked={editing.copy.image === url}
                    aria-label={`Photo ${index + 1}`}
                    className={editing.copy.image === url ? 'selected' : ''}
                    onClick={() => setEditing({ ...editing, copy: { ...editing.copy, image: url } })}
                  >
                    <img src={url.startsWith('data:') ? url : url.replace('w=1200', 'w=240')} alt="" />
                  </button>
                ))}
              </div>
            </div>
            {(['headline', 'offerText', 'cta'] as const).map((field) => (
              <label key={field}>
                <span>{field === 'offerText' ? 'Offer text' : field === 'cta' ? 'Call to action' : 'Headline'}</span>
                <input value={editing.copy[field]} onChange={(event) => setEditing({ ...editing, copy: { ...editing.copy, [field]: event.target.value } })} />
              </label>
            ))}
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              updateDesign(editing.asset, editing.copy, 'Asset edited', `${editing.asset} copy updated.`)
              setEditing(null)
            }}
          >
            Save edits
          </button>
        </Modal>
      )}

      {feedbackAsset && (
        <Modal title={`Feedback on ${feedbackAsset}`} onClose={() => setFeedbackAsset(null)}>
          <div className="feedback-chip-list">
            {feedbackReasons.map((reason) => (
              <button type="button" key={reason} onClick={() => recordFeedback(feedbackAsset, reason)}>
                {reason}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </>
  )
}
