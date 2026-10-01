/** Real output sizes for each design format. */
export type DesignFormat = 'Social square' | 'Instagram story' | 'Email header' | 'Website banner'

export const formatSpecs: Record<DesignFormat, { ratio: string; size: string; use: string; layout: 'stack' | 'split' }> = {
  'Social square': { ratio: '1 / 1', size: '1080 × 1080', use: 'Instagram & Facebook feed', layout: 'stack' },
  'Instagram story': { ratio: '9 / 16', size: '1080 × 1920', use: 'Stories & Reels cover', layout: 'stack' },
  'Email header': { ratio: '3 / 1', size: '1200 × 400', use: 'Top of the campaign email', layout: 'split' },
  'Website banner': { ratio: '16 / 5', size: '1920 × 600', use: 'Homepage & offer page', layout: 'split' },
}
