import { addDays, localDate } from '../services/campaigns'
import type { CampaignChannel, CampaignRecord, Contact, Department, Offer } from '../types/domain'

const segmentSizes: Record<string, number> = {
  'Past leisure guests': 8240,
  'Lapsed guests': 5120,
  'Local audience within 50 miles': 18400,
  'Family travellers': 6220,
  'Past spa guests': 3180,
  'Local audience within 15 miles': 9600,
  'Health club members': 740,
  'Afternoon tea buyers': 1260,
  'Past restaurant guests': 4420,
  'Local diners within 15 miles': 7300,
  'Hotel guests dining interest': 2150,
  'Loyalty members': 6200,
  'Past enquiry contacts': 610,
  'Wedding planners': 85,
  'Local venue search traffic': 2400,
  'Past salon guests': 1340,
  'Hotel guests with spa interest': 2900,
  'Golf members': 420,
  'Past society bookers': 160,
  'Local golf audience': 3100,
  'Past corporate bookers': 980,
  'Local business contacts': 2600,
  'Local day-trippers': 5400,
  'Hotel guests': 7800,
  'Past beach club visitors': 2200,
}

export function segmentSize(segment: string): number {
  return segmentSizes[segment] ?? 1000
}

export function consentRate(contacts: Contact[]): number {
  if (contacts.length === 0) return 0.75
  return contacts.filter((contact) => contact.permission === 'Subscribed').length / contacts.length
}

export function eligibleAudience(campaign: Pick<CampaignRecord, 'audience'>, contacts: Contact[]): number {
  const total = campaign.audience.reduce((sum, segment) => sum + segmentSize(segment), 0)
  return Math.round(total * consentRate(contacts))
}

function parsePrice(text: string): number | null {
  const match = text.replace(/,/g, '').match(/£\s*(\d+(?:\.\d+)?)/)
  return match ? Number(match[1]) : null
}

export function offerPrice(campaign: CampaignRecord, offers: Offer[]): number {
  const offer = offers.find((item) => item.id === campaign.offerId)
  return (offer && parsePrice(offer.price)) ?? parsePrice(campaign.offer) ?? 50
}

export function resultUnit(department: Department): string {
  const match = department.resultMetric.match(/^\d[\d,]*\s+(.+)$/)
  return match ? match[1] : 'bookings'
}

function seededRandom(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

const DAY = 86_400_000

function dayIndex(from: string, to: string): number {
  const start = new Date(`${localDate(from)}T12:00:00`).getTime()
  const end = new Date(`${localDate(to)}T12:00:00`).getTime()
  return Math.round((end - start) / DAY)
}

export type Totals = {
  sends: number
  opens: number
  clicks: number
  reach: number
  visits: number
  bookings: number
  revenue: number
}

export type DailyPoint = { date: string; clicks: number; bookings: number; revenue: number; realised: boolean }

export type ChannelResult = { channel: CampaignChannel; reach: number; reachLabel: string; clicks: number; bookings: number }

export type ResultState = 'projection' | 'live' | 'completed'

export type CampaignResults = {
  campaign: CampaignRecord
  state: ResultState
  dayCount: number
  totalDays: number
  eligible: number
  unit: string
  price: number
  shown: Totals
  projected: Totals
  daily: DailyPoint[]
  channels: ChannelResult[]
  openRate: number
  clickRate: number
}

const zero: Totals = { sends: 0, opens: 0, clicks: 0, reach: 0, visits: 0, bookings: 0, revenue: 0 }

function scale(totals: Totals, factor: number): Totals {
  return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, value * factor])) as Totals
}

export function computeResults(
  campaign: CampaignRecord,
  department: Department,
  contacts: Contact[],
  offers: Offer[],
  now = new Date(),
): CampaignResults {
  const random = seededRandom(campaign.id)
  const eligible = eligibleAudience(campaign, contacts)
  const unit = resultUnit(department)
  const isEnquiry = /enquir/.test(unit)
  const listPrice = offerPrice(campaign, offers)
  const price = isEnquiry ? listPrice * 0.3 : listPrice
  const conversionScale = isEnquiry ? 2 : listPrice > 1000 ? 0.12 : listPrice > 200 ? 0.55 : 1
  const has = (channel: CampaignChannel) => campaign.channels.includes(channel)

  const openRate = 0.3 + random() * 0.16
  const clickRate = 0.12 + random() * 0.08
  const sends = has('Email') ? eligible : 0
  const opens = sends * openRate
  const emailClicks = opens * clickRate
  const socialReach = has('Social') ? eligible * (1.4 + random() * 0.8) : 0
  const socialClicks = socialReach * 0.012
  const siteBoost = has('Website') ? 1.3 : 1
  const visits = (emailClicks + socialClicks) * siteBoost + (has('Website') ? eligible * 0.03 : 0)
  const websiteOnlyVisits = Math.max(0, visits - emailClicks - socialClicks)
  const emailBookings = emailClicks * 0.09 * conversionScale
  const socialBookings = socialClicks * 0.04 * conversionScale
  const websiteBookings = websiteOnlyVisits * 0.015 * conversionScale
  const bookings = emailBookings + socialBookings + websiteBookings

  const projected: Totals = {
    sends,
    opens,
    clicks: emailClicks + socialClicks,
    reach: socialReach,
    visits,
    bookings,
    revenue: bookings * price,
  }

  const totalDays = Math.min(90, Math.max(1, dayIndex(campaign.startDate, campaign.endDate) + 1))
  const liveAt = campaign.timeline.Live ?? campaign.startDate
  const weights = Array.from({ length: totalDays }, (_, day) => {
    const base = day === 0 ? 3 : day === 1 ? 2 : day === 2 ? 1.5 : 1
    return base * (0.7 + random() * 0.6)
  })
  if (campaign.email.reminder && has('Email') && totalDays > 4) weights[totalDays - 3] += 2
  for (const post of has('Social') ? campaign.socialPosts : []) {
    const offset = dayIndex(campaign.startDate, post.date)
    if (offset >= 0 && offset < totalDays) weights[offset] += 0.8
  }
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0)

  const state: ResultState = campaign.status === 'Completed' ? 'completed' : campaign.status === 'Live' ? 'live' : 'projection'
  const dayCount =
    state === 'completed' ? totalDays : state === 'live' ? Math.min(totalDays, Math.max(1, dayIndex(liveAt, localDate(now)) + 1)) : 0
  const realisedShare = weights.slice(0, dayCount).reduce((sum, weight) => sum + weight, 0) / weightSum

  const daily: DailyPoint[] = weights.map((weight, day) => {
    const share = weight / weightSum
    return {
      date: addDays(liveAt, day),
      clicks: projected.clicks * share,
      bookings: projected.bookings * share,
      revenue: projected.revenue * share,
      realised: day < dayCount,
    }
  })

  const shown = state === 'projection' ? projected : scale(projected, realisedShare)
  const factor = state === 'projection' ? 1 : realisedShare
  const channels: ChannelResult[] = [
    has('Email') && { channel: 'Email' as const, reach: opens * factor, reachLabel: 'opens', clicks: emailClicks * factor, bookings: emailBookings * factor },
    has('Social') && { channel: 'Social' as const, reach: socialReach * factor, reachLabel: 'reach', clicks: socialClicks * factor, bookings: socialBookings * factor },
    has('Website') && { channel: 'Website' as const, reach: visits * factor, reachLabel: 'visits', clicks: websiteOnlyVisits * factor, bookings: websiteBookings * factor },
  ].filter(Boolean) as ChannelResult[]

  return { campaign, state, dayCount, totalDays, eligible, unit, price, shown, projected, daily, channels, openRate, clickRate }
}

export type Insight = {
  text: string
  kind: 'Worked' | 'Avoid' | 'Try'
  action?: 'add-reminder' | 'add-social' | 'add-website' | 'widen-audience'
}

export function buildInsights(results: CampaignResults): Insight[] {
  const { campaign, channels, shown, eligible, openRate, unit } = results
  const insights: Insight[] = []
  const best = [...channels].sort((a, b) => b.bookings - a.bookings)[0]
  const total = shown.bookings

  if (best && total >= 1) {
    const share = Math.round((best.bookings / total) * 100)
    insights.push({ text: `${best.channel} drives most results: ${share}% of ${unit} so far.`, kind: 'Worked' })
  }
  if (campaign.channels.includes('Email')) {
    const rate = Math.round(openRate * 100)
    insights.push(
      rate >= 36
        ? { text: `Email open rate of ${rate}% is well above the 30% hotel benchmark — keep this subject-line style.`, kind: 'Worked' }
        : { text: `Email open rate of ${rate}% is close to the 30% benchmark — test a shorter subject line next time.`, kind: 'Avoid' },
    )
    const emailChannel = channels.find((item) => item.channel === 'Email')
    const clickedNotBooked = emailChannel ? Math.round(emailChannel.clicks - emailChannel.bookings) : 0
    if (!campaign.email.reminder && clickedNotBooked > 0) {
      insights.push({ text: `${clickedNotBooked.toLocaleString()} people clicked but didn't book. A reminder before the offer ends usually recovers some of them.`, kind: 'Try', action: 'add-reminder' })
    }
  }
  if (!campaign.channels.includes('Social')) {
    insights.push({ text: `Social isn't part of this campaign. Adding it could reach roughly ${Math.round(eligible * 1.6).toLocaleString()} more people.`, kind: 'Try', action: 'add-social' })
  }
  if (!campaign.channels.includes('Website')) {
    insights.push({ text: 'There is no website promo, so clicks land on a generic page. Adding one usually lifts conversion.', kind: 'Try', action: 'add-website' })
  }
  if (eligible < 500) {
    insights.push({ text: `Only ${eligible.toLocaleString()} consented contacts are selected. Widen the audience to reach more guests.`, kind: 'Avoid', action: 'widen-audience' })
  }
  return insights
}

export function sumTotals(list: Totals[]): Totals {
  return list.reduce(
    (sum, item) => ({
      sends: sum.sends + item.sends,
      opens: sum.opens + item.opens,
      clicks: sum.clicks + item.clicks,
      reach: sum.reach + item.reach,
      visits: sum.visits + item.visits,
      bookings: sum.bookings + item.bookings,
      revenue: sum.revenue + item.revenue,
    }),
    zero,
  )
}

export function mergeDaily(list: CampaignResults[]): DailyPoint[] {
  const byDate = new Map<string, DailyPoint>()
  for (const result of list) {
    for (const point of result.daily) {
      const existing = byDate.get(point.date)
      byDate.set(
        point.date,
        existing
          ? {
              date: point.date,
              clicks: existing.clicks + point.clicks,
              bookings: existing.bookings + point.bookings,
              revenue: existing.revenue + point.revenue,
              realised: existing.realised || point.realised,
            }
          : { ...point },
      )
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function formatMoney(value: number): string {
  return `£${Math.round(value).toLocaleString()}`
}

export function formatCount(value: number): string {
  return Math.round(value).toLocaleString()
}
