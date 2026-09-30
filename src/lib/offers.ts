import type { CampaignRecord, Offer } from '../types/domain'

const DAY = 86_400_000

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / DAY)
}

export type OfferTiming = { phase: 'running' | 'upcoming' | 'ended'; label: string; daysLeft: number }

export function offerTiming(offer: Offer, today: string): OfferTiming {
  if (offer.endDate < today) {
    const ago = daysBetween(offer.endDate, today)
    return { phase: 'ended', label: `Ended ${ago === 1 ? 'yesterday' : `${ago} days ago`}`, daysLeft: -ago }
  }
  if (offer.startDate > today) {
    const inDays = daysBetween(today, offer.startDate)
    return { phase: 'upcoming', label: `Starts in ${inDays} day${inDays === 1 ? '' : 's'}`, daysLeft: daysBetween(today, offer.endDate) }
  }
  const left = daysBetween(today, offer.endDate)
  return { phase: 'running', label: left === 0 ? 'Running · ends today' : `Running · ${left} day${left === 1 ? '' : 's'} left`, daysLeft: left }
}

// Active offers in the same business area whose dates overlap this one.
export function overlappingOffers(offer: Offer, offers: Offer[]): Offer[] {
  if (offer.status !== 'Active') return []
  return offers.filter(
    (other) =>
      other.id !== offer.id &&
      other.status === 'Active' &&
      other.departmentKey === offer.departmentKey &&
      other.startDate <= offer.endDate &&
      offer.startDate <= other.endDate,
  )
}

export function campaignsForOffer(offer: Offer, campaigns: CampaignRecord[]): CampaignRecord[] {
  return campaigns.filter((campaign) => campaign.offerId === offer.id)
}

export function inProgress(campaign: CampaignRecord): boolean {
  return campaign.status !== 'Completed'
}
