import { areaImages } from '../data/areaImages'
import type { CampaignRecord, DepartmentKey, DesignStyle } from '../types/domain'

/** Real output sizes for each design format. */
export type DesignFormat = 'Social square' | 'Instagram story' | 'Email header' | 'Website banner'

export const formatSpecs: Record<DesignFormat, { ratio: string; size: string; use: string; layout: 'stack' | 'split' }> = {
  'Social square': { ratio: '1 / 1', size: '1080 × 1080', use: 'Instagram & Facebook feed', layout: 'stack' },
  'Instagram story': { ratio: '9 / 16', size: '1080 × 1920', use: 'Stories & Reels cover', layout: 'stack' },
  'Email header': { ratio: '3 / 1', size: '1200 × 400', use: 'Top of the campaign email', layout: 'split' },
  'Website banner': { ratio: '16 / 5', size: '1920 × 600', use: 'Homepage & offer page', layout: 'split' },
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
