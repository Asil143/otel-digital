import type { CSSProperties } from 'react'
import { formatSpecs, type DesignFormat } from '../../lib/designFormats'
import { emailStyles } from '../../lib/emailHtml'
import type { DepartmentKey, DesignStyle } from '../../types/domain'

const crops = ['50% 50%', '50% 28%', '50% 72%', '28% 50%', '72% 50%']

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
}) {
  const spec = formatSpecs[format]
  const palette = emailStyles[area]
  const colours =
    style === 'Bold'
      ? { panel: palette.button, heading: '#FFFFFF', text: 'rgba(255,255,255,0.86)', accent: palette.accent, ctaBg: palette.accent, ctaText: '#1B1B1B' }
      : style === 'Minimal'
        ? { panel: '#FFFFFF', heading: '#1C1C1C', text: '#4A4A46', accent: palette.accent, ctaBg: 'transparent', ctaText: '#1C1C1C' }
        : { panel: palette.page, heading: palette.heading, text: palette.text, accent: palette.accent, ctaBg: palette.button, ctaText: palette.buttonText }
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
    </div>
  )
}
