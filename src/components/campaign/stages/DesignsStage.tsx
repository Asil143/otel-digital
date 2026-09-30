import { BookMarked, Check, Eye, Globe2, Image, Lock, Mail, MessageSquareText, PenLine, RefreshCw, Sparkles, ThumbsDown, Unlock } from 'lucide-react'
import { useState } from 'react'
import { usePersistentState } from '../../../lib/usePersistentState'
import { designAssetNames, withApproval } from '../../../services/campaigns'
import { canApprove } from '../../../services/permissions'
import { Modal } from '../../ui/Modal'
import type { StageProps } from './shared'

const styleVariants = ['Classic', 'Bold', 'Minimal'] as const
const feedbackReasons = ['Too busy', 'Too generic', 'Too AI-looking', 'Wrong image', 'Not premium enough', 'Too much text'] as const
const assetIcons = { 'Social square': MessageSquareText, 'Instagram story': Image, 'Email header': Mail, 'Website banner': Globe2 }
const templateLibrary = [
  { id: 'signature', name: 'Signature hero', area: 'All areas' },
  { id: 'offer-card', name: 'Offer card', area: 'Rooms, Spa' },
  { id: 'menu-spotlight', name: 'Menu spotlight', area: 'Restaurant' },
]

type AssetName = (typeof designAssetNames)[number]
type AssetCopy = { headline: string; cta: string; offerText: string }

export function DesignsStage({ campaign, department, currentRole, onChange, onActivity }: StageProps) {
  const [previewAsset, setPreviewAsset] = useState<AssetName | null>(null)
  const [editingAsset, setEditingAsset] = useState<AssetName | null>(null)
  const [feedbackAsset, setFeedbackAsset] = useState<AssetName | null>(null)
  const [assetStyle, setAssetStyle] = useState<Partial<Record<AssetName, (typeof styleVariants)[number]>>>({})
  const [assetCopy, setAssetCopy] = useState<Partial<Record<AssetName, AssetCopy>>>({})
  const [feedbackCounts, setFeedbackCounts] = usePersistentState<Record<string, number>>(`otel:${department.key}:design-feedback`, {})
  const [lockedTemplates, setLockedTemplates] = usePersistentState<string[]>(`otel:${department.key}:locked-templates`, ['signature'])

  const learnedPreference = Object.entries(feedbackCounts).find(([, count]) => count >= 2)?.[0]
  const isApproved = (asset: AssetName) => campaign.approvedDesigns.includes(asset)

  function copyFor(asset: AssetName): AssetCopy {
    return assetCopy[asset] ?? { headline: department.headline, cta: 'Book now', offerText: campaign.offer }
  }

  function setAssetApproval(asset: AssetName, approved: boolean) {
    const approvedDesigns = approved
      ? Array.from(new Set([...campaign.approvedDesigns, asset]))
      : campaign.approvedDesigns.filter((item) => item !== asset)
    const allApproved = designAssetNames.every((name) => approvedDesigns.includes(name))
    onChange(withApproval({ ...campaign, approvedDesigns }, 'Designs', allApproved))
  }

  function markChanged(asset: AssetName, title: string, detail: string) {
    if (isApproved(asset)) setAssetApproval(asset, false)
    onActivity(title, `${detail}${isApproved(asset) ? ' It needs approval again.' : ''}`, 'info')
  }

  function recordFeedback(asset: AssetName, reason: string) {
    setFeedbackCounts((current) => ({ ...current, [reason]: (current[reason] ?? 0) + 1 }))
    onActivity('Feedback saved', `${asset}: "${reason}" saved as a design preference.`, 'warning')
    setFeedbackAsset(null)
  }

  return (
    <>
      {learnedPreference && (
        <div className="learning-banner">
          <Sparkles size={16} />
          Learned preference for {department.name}: avoid "{learnedPreference}" in future proposals.
        </div>
      )}
      <p className="muted small stage-note">
        {campaign.approvedDesigns.length} of {designAssetNames.length} designs approved. Designs use approved hotel templates — editing is limited to copy, CTA and template.
      </p>
      <div className="asset-grid">
        {designAssetNames.map((asset) => {
          const Icon = assetIcons[asset]
          return (
            <article className="asset-card" key={asset}>
              <div className="asset-visual" style={{ backgroundImage: `url(${department.image})` }}>
                <span>{copyFor(asset).offerText}</span>
              </div>
              <div>
                <Icon size={17} />
                <strong>{asset}</strong>
                <em>{isApproved(asset) ? 'Approved' : 'Draft'}</em>
                <em className="style-tag">{assetStyle[asset] ?? styleVariants[0]}</em>
              </div>
              <div className="asset-actions">
                <button type="button" onClick={() => setPreviewAsset(asset)}><Eye size={15} /> Preview</button>
                <button type="button" onClick={() => markChanged(asset, 'Asset regenerated', `${asset} regenerated from the same brief.`)}>
                  <RefreshCw size={15} /> Regenerate
                </button>
                <button type="button" onClick={() => setEditingAsset(asset)}><PenLine size={15} /> Edit</button>
                <button
                  type="button"
                  onClick={() => {
                    const next = styleVariants[(styleVariants.indexOf(assetStyle[asset] ?? styleVariants[0]) + 1) % styleVariants.length]
                    setAssetStyle((current) => ({ ...current, [asset]: next }))
                    markChanged(asset, 'Style changed', `${asset} switched to the ${next} template.`)
                  }}
                >
                  <BookMarked size={15} /> Use different style
                </button>
                <button type="button" onClick={() => setFeedbackAsset(asset)}><ThumbsDown size={15} /> Give feedback</button>
                {canApprove(currentRole) ? (
                  <button
                    type="button"
                    disabled={isApproved(asset)}
                    onClick={() => {
                      setAssetApproval(asset, true)
                      onActivity('Asset approved', `${asset} approved for publishing.`, 'success')
                    }}
                  >
                    <Check size={15} /> {isApproved(asset) ? 'Approved' : 'Approve'}
                  </button>
                ) : (
                  <button type="button" disabled title="Approval by hotel manager"><Lock size={14} /> Manager approves</button>
                )}
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
        <Modal title={`${previewAsset} preview`} onClose={() => setPreviewAsset(null)}>
          <div className="asset-preview-modal">
            <div className="asset-visual large" style={{ backgroundImage: `url(${department.image})` }}>
              <span>{copyFor(previewAsset).offerText}</span>
            </div>
            <div className="modal-list">
              <article>
                <strong>Status</strong>
                <span>{isApproved(previewAsset) ? 'Approved' : 'Draft'}</span>
              </article>
              <article>
                <strong>Template rule</strong>
                <span>Uses the locked hotel template and approved imagery. Only copy, CTA and template can change.</span>
              </article>
            </div>
          </div>
        </Modal>
      )}

      {editingAsset && (
        <Modal title={`Edit ${editingAsset}`} onClose={() => setEditingAsset(null)}>
          <div className="modal-list edit-form">
            {(['headline', 'offerText', 'cta'] as const).map((field) => (
              <label key={field}>
                <span>{field === 'offerText' ? 'Offer text' : field === 'cta' ? 'Call to action' : 'Headline'}</span>
                <input
                  value={copyFor(editingAsset)[field]}
                  onChange={(event) =>
                    setAssetCopy((current) => ({ ...current, [editingAsset]: { ...copyFor(editingAsset), [field]: event.target.value } }))
                  }
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              markChanged(editingAsset, 'Asset edited', `${editingAsset} copy updated.`)
              setEditingAsset(null)
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
