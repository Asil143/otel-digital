import { areaImages } from '../data/areaImages'
import { emailStyles } from './emailHtml'
import type { CampaignChannel, CampaignRecord, DepartmentKey, DesignStyle } from '../types/domain'

/** Real output sizes for each design format. */
export type DesignFormat = 'Social square' | 'Instagram story' | 'Email header' | 'Website banner'

export const designFormats: DesignFormat[] = ['Social square', 'Instagram story', 'Email header', 'Website banner']

export const formatSpecs: Record<
  DesignFormat,
  { ratio: string; size: string; width: number; height: number; use: string; layout: 'stack' | 'split'; channel: CampaignChannel; headlineMax: number }
> = {
  'Social square': { ratio: '1 / 1', size: '1080 × 1080', width: 1080, height: 1080, use: 'Instagram & Facebook feed', layout: 'stack', channel: 'Social', headlineMax: 40 },
  'Instagram story': { ratio: '9 / 16', size: '1080 × 1920', width: 1080, height: 1920, use: 'Stories & Reels cover', layout: 'stack', channel: 'Social', headlineMax: 40 },
  'Email header': { ratio: '3 / 1', size: '1200 × 400', width: 1200, height: 400, use: 'Top of the campaign email', layout: 'split', channel: 'Email', headlineMax: 45 },
  'Website banner': { ratio: '16 / 5', size: '1920 × 600', width: 1920, height: 600, use: 'Homepage & offer page', layout: 'split', channel: 'Website', headlineMax: 45 },
}

export const designStyles: DesignStyle[] = ['Classic', 'Bold', 'Minimal']

export const styleNotes: Record<DesignStyle, string> = {
  Classic: 'Light panel in the area palette, solid button',
  Bold: 'Dark panel, white headline, gold button',
  Minimal: 'White panel, no brand line, text-link call to action',
}

/** Only the formats the campaign's channels actually use (no social designs for an email-only campaign). */
export function formatsFor(campaign: Pick<CampaignRecord, 'channels'>): DesignFormat[] {
  return designFormats.filter((format) => campaign.channels.includes(formatSpecs[format].channel))
}

/**
 * Each format starts with a different photo and style so a campaign's set doesn't repeat itself.
 */
export const formatDefaults: Record<DesignFormat, { style: DesignStyle; variant: number; image: number }> = {
  'Social square': { style: 'Bold', variant: 0, image: 0 }, // stands out in a busy feed
  'Instagram story': { style: 'Minimal', variant: 0, image: 1 }, // full-screen, photo-led, little text
  'Email header': { style: 'Classic', variant: 0, image: 2 }, // matches the email template palette
  'Website banner': { style: 'Bold', variant: 1, image: 3 }, // copy panel on the left, unlike the email header
}

/** The photo a design uses: the saved choice, or the format's default from the area's set. */
export function designImage(campaign: Pick<CampaignRecord, 'designs'>, area: DepartmentKey, format: DesignFormat): string {
  const pool = areaImages[area]
  return campaign.designs?.[format]?.image ?? pool[formatDefaults[format].image % pool.length]
}

/**
 * Artwork needs short headlines: keep the first clause of a long title ("Weekday wedding package
 * with added-value extras" → "Weekday wedding package"); the offer line carries the rest.
 */
export function designHeadline(title: string, max = 40): string {
  const clean = title.trim()
  if (clean.length <= max) return clean
  const clause = clean.split(/\s+(?:with|for|including|plus)\s+|\s+[-–—:·|]\s+|\s*\(/i)[0].trim()
  if (clause.length >= 8 && clause.length <= max) return clause
  const words = clean.slice(0, max + 1).split(/\s+/)
  words.pop()
  return words.join(' ').replace(/[,;:–-]$/, '')
}

export type DesignColours = { panel: string; heading: string; text: string; accent: string; ctaBg: string; ctaText: string }

/** One source of truth for design colours — used on screen and in the downloaded files. */
export function designColours(area: DepartmentKey, style: DesignStyle): DesignColours {
  const palette = emailStyles[area]
  if (style === 'Bold') return { panel: palette.button, heading: '#FFFFFF', text: 'rgba(255,255,255,0.86)', accent: palette.accent, ctaBg: palette.accent, ctaText: '#1B1B1B' }
  if (style === 'Minimal') return { panel: '#FFFFFF', heading: '#1C1C1C', text: '#4A4A46', accent: palette.accent, ctaBg: 'transparent', ctaText: '#1C1C1C' }
  return { panel: palette.page, heading: palette.heading, text: palette.text, accent: palette.accent, ctaBg: palette.button, ctaText: palette.buttonText }
}

export const crops = ['50% 50%', '50% 28%', '50% 72%', '28% 50%', '72% 50%']
