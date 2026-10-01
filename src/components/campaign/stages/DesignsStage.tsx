import { BookMarked, Check, Download, Eye, Globe2, Image, Lock, Mail, MessageSquareText, PenLine, RefreshCw, ShieldCheck, Sparkles, ThumbsDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { activeHotel } from '../../../config/hotel'
import { areaImages } from '../../../data/areaImages'
import { seedOffers } from '../../../data/offers'
import { useAssets } from '../../../lib/assets'
import { renderDesignPng } from '../../../lib/designExport'
import { designColours, designFormats, designHeadline, designImage, designStyles, formatDefaults, formatSpecs, formatsFor, styleNotes, type DesignFormat } from '../../../lib/designFormats'
import { genericPhrases } from '../../../lib/emailHtml'
import { usePersistentState } from '../../../lib/usePersistentState'
import { guestTitle, withApproval } from '../../../services/campaigns'
import { canApprove } from '../../../services/permissions'
import type { CampaignRecord, DesignState, DesignStyle, HotelAccount, Offer } from '../../../types/domain'
import { Modal } from '../../ui/Modal'
import { DesignCanvas } from '../DesignCanvas'
import type { StageProps } from './shared'

const feedbackReasons = ['Too busy', 'Too generic', 'Too AI-looking', 'Wrong image', 'Not premium enough', 'Too much text'] as const
type FeedbackReason = (typeof feedbackReasons)[number]
const feedbackEffect: Record<FeedbackReason, string> = {
  'Too busy': 'Switches to the calmer Minimal style',
  'Too generic': 'Opens the editor so you can make the headline specific',
  'Too AI-looking': 'Tries a different photo in the Classic style',
  'Wrong image': 'Swaps to the next approved photo',
  'Not premium enough': 'Switches to Minimal for more white space',
  'Too much text': 'Removes the offer line',
}
// Feedback that means "pare it back" also changes how future designs in this area start.
const simplerReasons = new Set(['Too busy', 'Too much text', 'Too AI-looking', 'Not premium enough'])
const formatIcons: Record<DesignFormat, typeof Image> = { 'Social square': MessageSquareText, 'Instagram story': Image, 'Email header': Mail, 'Website banner': Globe2 }
const LOCKED_STATUSES = ['Scheduled', 'Live', 'Completed']
const OFFER_MAX = 80
const CTA_MAX = 22

type Draft = { headline: string; offerText: string; cta: string; image: string }
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function DesignsStage({ campaign, department, currentRole, onChange, onActivity, goToStage }: StageProps) {
  const [previewAsset, setPreviewAsset] = useState<DesignFormat | null>(null)
  const [showSafeZones, setShowSafeZones] = useState(true)
  const [editing, setEditing] = useState<{ asset: DesignFormat; draft: Draft; tip?: string } | null>(null)
  const [feedbackAsset, setFeedbackAsset] = useState<DesignFormat | null>(null)
  const [downloading, setDownloading] = useState<DesignFormat | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [feedbackCounts, setFeedbackCounts] = usePersistentState<Record<string, number>>(`otel:${department.key}:design-feedback`, {})
  const [allowedStyles, setAllowedStyles] = usePersistentState<DesignStyle[]>(`otel:${department.key}:design-styles`, designStyles)
  const [hotel] = usePersistentState<HotelAccount>('otel:hotel-account', activeHotel)
  const [offers] = usePersistentState<Offer[]>('otel:offers', seedOffers)
  const [assets] = useAssets()

  const isManager = canApprove(currentRole)
  const locked = LOCKED_STATUSES.includes(campaign.status)
  const formats = formatsFor(campaign)
  const missing = designFormats.filter((format) => !formats.includes(format))
  const offer = offers.find((item) => item.id === campaign.offerId)
  const brand = hotel.name || activeHotel.name

  // Curated area photography plus any approved photos the hotel has added in Files & Media.
  const library = assets
    .filter((asset) => asset.kind === 'Image' && asset.status === 'Approved' && asset.preview && (asset.departmentKey === department.key || asset.departmentKey === null))
    .map((asset) => asset.preview as string)
  const photos = Array.from(new Set([...areaImages[department.key], ...library]))

  const learnedPreference = Object.entries(feedbackCounts).find(([, count]) => count >= 2)?.[0]
  const prefersSimpler = Boolean(learnedPreference && simplerReasons.has(learnedPreference))
  const allowed = allowedStyles.length ? allowedStyles : designStyles
  const isApproved = (asset: DesignFormat) => campaign.approvedDesigns.includes(asset)
  const approvedCount = formats.filter(isApproved).length

  function styleFor(asset: DesignFormat): DesignStyle {
    const saved = campaign.designs?.[asset]?.style
    // Published designs never change: area style settings and learned preferences apply to new work only.
    if (locked) return saved ?? formatDefaults[asset].style
    if (saved && allowed.includes(saved)) return saved
    const fallback = prefersSimpler && formatDefaults[asset].style === 'Bold' ? 'Minimal' : formatDefaults[asset].style
    return allowed.includes(fallback) ? fallback : allowed[0]
  }

  function stateFor(asset: DesignFormat): Draft & { style: DesignStyle; variant: number } {
    const saved = campaign.designs?.[asset] ?? {}
    return {
      style: styleFor(asset),
      variant: saved.variant ?? formatDefaults[asset].variant,
      image: designImage(campaign, department.key, asset),
      headline: saved.headline ?? designHeadline(guestTitle(campaign), formatSpecs[asset].headlineMax),
      offerText: saved.offerText ?? campaign.offer,
      cta: saved.cta ?? (campaign.email.ctaText || 'Book now'),
    }
  }

  /** Designs approval covers only the formats this campaign uses. */
  function setApproved(next: CampaignRecord, approvedDesigns: string[]) {
    const allApproved = formats.every((format) => approvedDesigns.includes(format))
    onChange(withApproval({ ...next, approvedDesigns }, 'Designs', allApproved))
  }

  function approve(asset: DesignFormat) {
    setApproved(campaign, Array.from(new Set([...campaign.approvedDesigns, asset])))
    onActivity('Design approved', `${asset} approved for publishing.`, 'success')
  }

  function approveAll() {
    const pending = formats.filter((format) => !isApproved(format))
    setApproved(campaign, Array.from(new Set([...campaign.approvedDesigns, ...pending])))
    onActivity('Designs approved', `${pending.join(', ')} approved for publishing.`, 'success')
  }

  /** Saves a change to one design; a changed design needs approval again. */
  function updateDesign(asset: DesignFormat, patch: DesignState, title: string, detail: string) {
    const wasApproved = isApproved(asset)
    const next: CampaignRecord = { ...campaign, designs: { ...campaign.designs, [asset]: { ...campaign.designs?.[asset], ...patch } } }
    if (wasApproved) setApproved(next, next.approvedDesigns.filter((item) => item !== asset))
    else onChange(next)
    onActivity(title, `${detail}${wasApproved ? ' It needs approval again.' : ''}`, 'info')
  }

  function nextPhoto(current: string) {
    return photos[(Math.max(0, photos.indexOf(current)) + 1) % photos.length]
  }

  function cycleStyle(asset: DesignFormat) {
    const current = styleFor(asset)
    const next = allowed[(allowed.indexOf(current) + 1) % allowed.length]
    updateDesign(asset, { style: next }, 'Style changed', `${asset} switched to the ${next} style.`)
  }

  function regenerate(asset: DesignFormat) {
    const state = stateFor(asset)
    updateDesign(asset, { variant: state.variant + 1, image: nextPhoto(state.image) }, 'Design regenerated', `${asset} regenerated with a different approved photo and layout.`)
  }

  function giveFeedback(asset: DesignFormat, reason: FeedbackReason) {
    setFeedbackCounts((current) => ({ ...current, [reason]: (current[reason] ?? 0) + 1 }))
    setFeedbackAsset(null)
    if (locked) {
      onActivity('Feedback saved', `${asset}: "${reason}" saved for future ${department.name} designs (this campaign is ${campaign.status.toLowerCase()}, so its designs are locked).`, 'warning')
      return
    }
    const state = stateFor(asset)
    const minimal: DesignStyle = allowed.includes('Minimal') ? 'Minimal' : state.style
    const classic: DesignStyle = allowed.includes('Classic') ? 'Classic' : state.style
    if (reason === 'Too generic') {
      onActivity('Feedback saved', `${asset}: "${reason}" — make the headline specific.`, 'warning')
      setEditing({
        asset,
        draft: { headline: state.headline, offerText: state.offerText, cta: state.cta, image: state.image },
        tip: 'Make it specific: say what it is, when, or the price — for example “Midweek spa day, £79”.',
      })
      return
    }
    const patch: DesignState =
      reason === 'Wrong image'
        ? { image: nextPhoto(state.image) }
        : reason === 'Too AI-looking'
          ? { image: nextPhoto(state.image), style: classic }
          : reason === 'Too much text'
            ? { offerText: '' }
            : { style: minimal }
    updateDesign(asset, patch, 'Feedback applied', `${asset}: "${reason}" — ${feedbackEffect[reason].toLowerCase()}.`)
  }

  async function download(asset: DesignFormat) {
    const state = stateFor(asset)
    const spec = formatSpecs[asset]
    setDownloading(asset)
    setDownloadError(null)
    try {
      const blob = await renderDesignPng({ format: asset, area: department.key, image: state.image, brand, headline: state.headline, offerText: state.offerText, cta: state.cta, style: state.style, variant: state.variant })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      // Unapproved downloads are marked so a draft can't be mistaken for final artwork.
      link.download = `${slug(campaign.name)}-${slug(asset)}-${spec.width}x${spec.height}${isApproved(asset) ? '' : '-draft'}.png`
      link.click()
      URL.revokeObjectURL(url)
      onActivity('Design downloaded', `${asset} (${spec.size}px${isApproved(asset) ? '' : ', draft'}).`, 'info')
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Download failed')
    } finally {
      setDownloading(null)
    }
  }

  function toggleStyle(style: DesignStyle) {
    const isOn = allowed.includes(style)
    if (isOn && allowed.length === 1) return
    const next = isOn ? allowed.filter((item) => item !== style) : designStyles.filter((item) => allowed.includes(item) || item === style)
    setAllowedStyles(next)
    onActivity(isOn ? 'Design style turned off' : 'Design style allowed', `${style} ${isOn ? 'is no longer used' : 'can now be used'} for ${department.name} designs.`, 'info')
  }

  function canvas(asset: DesignFormat, override?: Partial<Draft>, safeZones = false): ReactNode {
    const state = { ...stateFor(asset), ...override }
    return (
      <DesignCanvas
        format={asset}
        area={department.key}
        image={state.image}
        brand={brand}
        headline={state.headline}
        offerText={state.offerText}
        cta={state.cta}
        style={state.style}
        variant={state.variant}
        safeZones={safeZones}
      />
    )
  }

  const missingReason =
    offer?.channels && missing.some((format) => !offer.channels?.includes(formatSpecs[format].channel))
      ? `the offer “${offer.name}” is limited to ${offer.channels.join(' and ')}.`
      : `this campaign doesn’t use ${[...new Set(missing.map((format) => (formatSpecs[format].channel === 'Social' ? 'social media' : formatSpecs[format].channel.toLowerCase())))].join(' or ')}.`

  return (
    <>
      {learnedPreference && (
        <div className="learning-banner">
          <Sparkles size={16} />
          Learned preference for {department.name}: avoid "{learnedPreference}"{prefersSimpler ? ' — bold designs now start in the calmer Minimal style.' : '.'}
        </div>
      )}
      {locked && (
        <div className="design-locked-banner">
          <Lock size={15} />
          <span>
            This campaign is <strong>{campaign.status.toLowerCase()}</strong>, so its approved designs are locked. You can preview and download them; to change them, duplicate the campaign from the
            Campaigns page.
          </span>
        </div>
      )}

      <div className="design-toolbar">
        <p className="muted small stage-note">
          {approvedCount} of {formats.length} design{formats.length === 1 ? '' : 's'} approved. Real sizes, the {department.name} palette, approved photography only, and copy kept off the photo.
        </p>
        {isManager && !locked && approvedCount < formats.length && (
          <button type="button" className="primary-button small" onClick={approveAll}>
            <Check size={14} /> Approve all {formats.length - approvedCount}
          </button>
        )}
      </div>
      {downloadError && (
        <p className="form-errors" role="alert">
          {downloadError}
        </p>
      )}

      {missing.length > 0 && (
        <div className="design-missing">
          <span>
            <strong>{missing.join(' and ')}</strong> {missing.length === 1 ? 'isn’t' : 'aren’t'} needed — {missingReason}
          </span>
          {!offer?.channels && !locked && (
            <button type="button" className="ghost-link" onClick={() => goToStage('Strategy')}>
              Change channels on Strategy
            </button>
          )}
        </div>
      )}

      <div className="design-board">
        {formats.map((asset) => {
          const Icon = formatIcons[asset]
          const state = stateFor(asset)
          const spec = formatSpecs[asset]
          const styleLocked = allowed.length === 1
          return (
            <article className={`asset-card design-card format-${slug(asset)}`} key={asset}>
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
                  {locked ? (
                    <button type="button" onClick={() => download(asset)} disabled={downloading === asset}>
                      <Download size={14} /> {downloading === asset ? 'Preparing…' : 'Download'}
                    </button>
                  ) : (
                    <button type="button" onClick={() => setEditing({ asset, draft: { headline: state.headline, offerText: state.offerText, cta: state.cta, image: state.image } })}>
                      <PenLine size={14} /> Edit
                    </button>
                  )}
                  {isManager ? (
                    <button type="button" className="design-approve" disabled={isApproved(asset) || locked} onClick={() => approve(asset)}>
                      <Check size={14} /> {isApproved(asset) ? 'Approved' : 'Approve'}
                    </button>
                  ) : (
                    <button type="button" disabled title="Approval by hotel manager">
                      <Lock size={13} /> Manager approves
                    </button>
                  )}
                </span>
                {!locked && (
                  <span className="design-secondary">
                    <button type="button" onClick={() => cycleStyle(asset)} disabled={styleLocked} title={styleLocked ? `Locked to ${allowed[0]} by the hotel manager` : 'Next allowed style'}>
                      <BookMarked size={13} /> Use different style
                    </button>
                    <button type="button" onClick={() => regenerate(asset)} title="Next approved photo and layout">
                      <RefreshCw size={13} /> Regenerate
                    </button>
                    <button type="button" onClick={() => setFeedbackAsset(asset)}>
                      <ThumbsDown size={13} /> Give feedback
                    </button>
                    <button type="button" onClick={() => download(asset)} disabled={downloading === asset}>
                      <Download size={13} /> {downloading === asset ? 'Preparing…' : 'Download PNG'}
                    </button>
                  </span>
                )}
              </div>
            </article>
          )
        })}
      </div>

      <section className="brand-templates">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Brand templates</p>
            <h3>Design styles for {department.name}</h3>
          </div>
          <span className="muted small">{isManager ? 'Turn styles off to keep designs on-brand. At least one stays on.' : 'Set by the hotel manager.'}</span>
        </div>
        <div className="style-template-list">
          {designStyles.map((style) => {
            const on = allowed.includes(style)
            const colours = designColours(department.key, style)
            const inUse = formats.filter((format) => styleFor(format) === style).length
            return (
              <div className={`style-template ${on ? '' : 'off'}`} key={style} data-style={style}>
                <span className="style-swatch" style={{ background: colours.panel }}>
                  <i style={{ background: colours.heading }} />
                  <i style={{ background: colours.ctaBg === 'transparent' ? colours.accent : colours.ctaBg }} />
                </span>
                <span className="style-template-text">
                  <strong>{style}</strong>
                  <small>{styleNotes[style]}</small>
                  <small>{on ? `${inUse} design${inUse === 1 ? '' : 's'} using it` : 'Not used for this area'}</small>
                </span>
                {isManager ? (
                  <button
                    type="button"
                    className={on ? 'secondary-button small' : 'primary-button small'}
                    onClick={() => toggleStyle(style)}
                    disabled={on && allowed.length === 1}
                    title={on && allowed.length === 1 ? 'At least one style must stay on' : undefined}
                  >
                    {on ? 'Turn off' : 'Allow'}
                  </button>
                ) : (
                  <span className="muted small">{on ? 'Allowed' : 'Off'}</span>
                )}
              </div>
            )
          })}
        </div>
        <p className="brand-rules">
          <ShieldCheck size={14} /> Always applied: approved photography only · copy never over the photo · {department.name} palette · real output sizes.
        </p>
      </section>

      {previewAsset && (
        <Modal title={`${previewAsset} preview`} onClose={() => setPreviewAsset(null)} wide>
          <div className="asset-preview-modal">
            <div className={`design-preview-frame format-${slug(previewAsset)}`}>{canvas(previewAsset, undefined, previewAsset === 'Instagram story' && showSafeZones)}</div>
            {previewAsset === 'Instagram story' && (
              <label className="inline-check">
                <input type="checkbox" checked={showSafeZones} onChange={(event) => setShowSafeZones(event.target.checked)} /> Show where Instagram’s own buttons cover the story
              </label>
            )}
            <div className="modal-list">
              <article>
                <strong>Format</strong>
                <span>
                  {formatSpecs[previewAsset].size} px · {formatSpecs[previewAsset].use}
                </span>
              </article>
              <article>
                <strong>Status</strong>
                <span>
                  {isApproved(previewAsset) ? 'Approved' : 'Draft'} · {styleFor(previewAsset)} style
                </span>
              </article>
            </div>
            <div className="form-actions">
              <button type="button" className="primary-button" onClick={() => download(previewAsset)} disabled={downloading === previewAsset}>
                <Download size={14} /> {downloading === previewAsset ? 'Preparing…' : `Download PNG (${formatSpecs[previewAsset].size})`}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {editing && (
        <EditDesign
          editing={editing}
          photos={photos}
          canvas={canvas}
          onCancel={() => setEditing(null)}
          onChange={(draft) => setEditing({ ...editing, draft })}
          onSave={(draft) => {
            updateDesign(editing.asset, draft, 'Design edited', `${editing.asset} updated.`)
            setEditing(null)
          }}
        />
      )}

      {feedbackAsset && (
        <Modal title={`Feedback on ${feedbackAsset}`} onClose={() => setFeedbackAsset(null)}>
          <p className="muted small">{locked ? 'This campaign’s designs are locked; feedback is saved for future designs in this area.' : 'Each choice fixes this design now and teaches future designs in this area.'}</p>
          <div className="feedback-chip-list">
            {feedbackReasons.map((reason) => (
              <button type="button" key={reason} onClick={() => giveFeedback(feedbackAsset, reason)}>
                {reason}
                {!locked && <small>{feedbackEffect[reason]}</small>}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </>
  )
}

function EditDesign({
  editing,
  photos,
  canvas,
  onCancel,
  onSave,
  onChange,
}: {
  editing: { asset: DesignFormat; draft: Draft; tip?: string }
  photos: string[]
  canvas: (asset: DesignFormat, override?: Partial<Draft>) => ReactNode
  onCancel: () => void
  onSave: (draft: Draft) => void
  onChange: (draft: Draft) => void
}) {
  const { asset, draft } = editing
  const max = formatSpecs[asset].headlineMax
  const copy = `${draft.headline} ${draft.offerText} ${draft.cta}`.toLowerCase()
  const generic = genericPhrases.filter((phrase) => copy.includes(phrase))
  const problems = [
    !draft.headline.trim() && 'Add a headline.',
    draft.headline.length > max && `Shorten the headline to ${max} characters for this format.`,
    draft.offerText.length > OFFER_MAX && `Keep the offer line under ${OFFER_MAX} characters.`,
    !draft.cta.trim() && 'Add a call to action.',
    draft.cta.length > CTA_MAX && `Keep the call to action under ${CTA_MAX} characters.`,
    generic.length > 0 && `Replace generic wording: “${generic.join('”, “')}”.`,
  ].filter(Boolean) as string[]
  const field = (key: 'headline' | 'offerText' | 'cta', label: string, limit: number, hint?: string) => (
    <label key={key}>
      <span>
        {label}
        <em className={draft[key].length > limit ? 'over-limit' : ''}>
          {draft[key].length}/{limit}
        </em>
      </span>
      <input value={draft[key]} onChange={(event) => onChange({ ...draft, [key]: event.target.value })} />
      {hint && <small>{hint}</small>}
    </label>
  )

  return (
    <Modal title={`Edit ${asset}`} onClose={onCancel} wide>
      {editing.tip && <p className="edit-tip">{editing.tip}</p>}
      <div className="design-editor">
        <div className="modal-list edit-form">
          <div className="photo-picker" role="radiogroup" aria-label="Photo">
            <span>Photo</span>
            <div>
              {photos.map((url, index) => (
                <button
                  type="button"
                  key={url}
                  role="radio"
                  aria-checked={draft.image === url}
                  aria-label={`Photo ${index + 1}`}
                  className={draft.image === url ? 'selected' : ''}
                  onClick={() => onChange({ ...draft, image: url })}
                >
                  <img src={url.startsWith('data:') ? url : url.replace('w=1200', 'w=240')} alt="" />
                </button>
              ))}
            </div>
          </div>
          {field('headline', 'Headline', max, 'Short and specific — the offer line carries the detail.')}
          {field('offerText', 'Offer text', OFFER_MAX, 'Leave empty to show the headline only.')}
          {field('cta', 'Call to action', CTA_MAX)}
          {problems.length > 0 && (
            <ul className="form-errors" role="alert">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
        </div>
        <div className={`design-editor-preview format-${slug(asset)}`}>
          <span className="muted small">Live preview</span>
          {canvas(asset, draft)}
        </div>
      </div>
      <div className="form-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={() => onSave({ ...draft, headline: draft.headline.trim(), offerText: draft.offerText.trim(), cta: draft.cta.trim() })}
          disabled={problems.length > 0}
        >
          Save edits
        </button>
      </div>
    </Modal>
  )
}
