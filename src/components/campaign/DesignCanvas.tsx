import type { CSSProperties } from 'react'
import { crops, designColours, formatSpecs, type DesignFormat } from '../../lib/designFormats'
import type { DepartmentKey, DesignStyle } from '../../types/domain'

/**
 * One on-brand composition per format. Photography and copy are kept apart (no text over the
 * image), type scales with the canvas so thumbnails and previews match, and colours come from
 * the business area's palette — the same one its emails use.
 */
export function DesignCanvas({
  format,
  area,
  image,
  brand,
  headline,
  offerText,
  cta,
  style,
  variant,
  safeZones = false,
}: {
  format: DesignFormat
  area: DepartmentKey
  image: string
  brand: string
  headline: string
  offerText: string
  cta: string
  style: DesignStyle
  variant: number
  /** Show where Instagram's own interface covers a story (preview only). */
  safeZones?: boolean
}) {
  const spec = formatSpecs[format]
  const colours = designColours(area, style)
  const flipped = spec.layout === 'split' && variant % 2 === 1

  return (
    <div
      className={`design-canvas format-${format.toLowerCase().replace(/\s+/g, '-')} layout-${spec.layout} style-${style.toLowerCase()} ${flipped ? 'flipped' : ''}`}
      style={{ aspectRatio: spec.ratio, '--panel': colours.panel, '--heading': colours.heading, '--text': colours.text, '--accent': colours.accent, '--cta-bg': colours.ctaBg, '--cta-text': colours.ctaText } as CSSProperties}
      role="img"
      aria-label={`${format} design: ${headline}. ${offerText}. ${cta}.`}
    >
      <div className="design-photo">
        <img src={image} alt="" style={{ objectPosition: crops[variant % crops.length] }} />
      </div>
      <div className="design-panel">
        {style !== 'Minimal' && <span className="design-brand">{brand}</span>}
        <strong className="design-headline">{headline}</strong>
        <span className="design-rule" />
        {offerText && offerText.trim().toLowerCase() !== headline.trim().toLowerCase() && <span className="design-offer">{offerText}</span>}
        <span className="design-cta">{cta}</span>
      </div>
      {safeZones && format === 'Instagram story' && (
        <>
          <span className="safe-zone top">Instagram profile bar</span>
          <span className="safe-zone bottom">Reply bar</span>
        </>
      )}
    </div>
  )
}
