import { activeHotel } from '../config/hotel'
import type {
  ApprovalChannel,
  CampaignChannel,
  CampaignRecord,
  CampaignStatus,
  CampaignTimelineStep,
  Department,
  EmailContent,
  Offer,
  SocialPost,
  WebsiteContent,
} from '../types/domain'

export const campaignStatuses: CampaignStatus[] = ['Draft', 'Needs approval', 'Approved', 'Scheduled', 'Live', 'Completed']

export const timelineSteps: CampaignTimelineStep[] = ['Content created', 'Sent for approval', 'Approved', 'Scheduled', 'Live', 'Completed']

export const campaignTypes = ['Promote an existing offer', 'Promote a package', 'Fill a quiet period', 'Announce something new']

export const designAssetNames = ['Social square', 'Instagram story', 'Email header', 'Website banner'] as const

export type CampaignInput = {
  name: string
  type: string
  objective: string
  audience: string[]
  offerId: string | null
  offer: string
  offerTerms?: string
  goal: string
  startDate: string
  endDate: string
  channels: CampaignChannel[]
}

const channelApproval: Record<CampaignChannel, ApprovalChannel> = {
  Email: 'Emails',
  Social: 'Socials',
  Website: 'Website',
}

export function localDate(value: Date | string = new Date()): string {
  const date = typeof value === 'string' ? new Date(value.length === 10 ? `${value}T12:00:00` : value) : value
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${localDate(isoDate)}T12:00:00`)
  date.setDate(date.getDate() + days)
  return localDate(date)
}

export function formatDate(isoDate: string): string {
  return new Date(`${localDate(isoDate)}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function hashtag(text: string): string {
  return `#${text.replace(/[^a-zA-Z0-9 ]/g, '').split(' ').filter(Boolean).map((word) => word[0].toUpperCase() + word.slice(1)).join('')}`
}

function campaignNameFor(department: Department): string {
  if (department.recommendation.outcome !== 'Campaign') return `${department.offer} campaign`
  return department.recommendation.title.replace(/^Launch an? /i, '').replace(/ campaign$/i, '')
}

export function toCampaignInput(campaign: CampaignRecord): CampaignInput {
  const { name, type, objective, audience, offerId, offer, offerTerms, goal, startDate, endDate, channels } = campaign
  return { name, type, objective, audience, offerId, offer, offerTerms, goal, startDate, endDate, channels }
}

export function defaultCampaignInput(department: Department, offers: Offer[]): CampaignInput {
  const offer = offers.find((item) => item.departmentKey === department.key && item.status === 'Active')
  const today = localDate()
  return {
    name: campaignNameFor(department),
    type: 'Promote an existing offer',
    objective: department.recommendation.title,
    audience: department.audience.slice(0, 2),
    offerId: offer?.id ?? null,
    offer: offer?.name ?? department.offer,
    offerTerms: offer?.terms,
    goal: `Close the gap: ${department.recommendation.summary.split('. ')[0].replace(/\.$/, '')}.`,
    startDate: offer?.startDate ?? addDays(today, 7),
    endDate: offer?.endDate ?? addDays(today, 28),
    channels: offer?.channels ?? ['Email', 'Social', 'Website'],
  }
}

export function presetForOffer(department: Department, offers: Offer[], offer: Offer): CampaignInput {
  return {
    ...defaultCampaignInput(department, offers),
    name: offer.name,
    type: 'Promote an existing offer',
    objective: `Promote ${offer.name}`,
    offerId: offer.id,
    offer: offer.name,
    offerTerms: offer.terms,
    startDate: offer.startDate,
    endDate: offer.endDate,
    channels: offer.channels ?? ['Email', 'Social', 'Website'],
  }
}

function guestMessage(department: Department, input: CampaignInput): string {
  return `${department.headline} Discover ${input.offer} at ${activeHotel.name}, available ${formatDate(input.startDate)} to ${formatDate(input.endDate)}.`
}

function defaultEmail(department: Department, input: CampaignInput): EmailContent {
  return {
    subject: `${input.name}: ${input.offer}`,
    previewText: department.headline,
    headline: input.name,
    body: guestMessage(department, input),
    offerDetails: `${input.offer}. ${input.offerTerms ? `${input.offerTerms} ` : ''}Available ${formatDate(input.startDate)} to ${formatDate(input.endDate)}, subject to availability.`,
    ctaText: 'Book now',
    senderName: activeHotel.name,
    reminder: false,
    testSentAt: null,
  }
}

function defaultWebsite(department: Department, input: CampaignInput): WebsiteContent {
  const message = guestMessage(department, input)
  return {
    format: 'Promo block',
    title: input.name,
    subtitle: department.headline,
    description: message,
    ctaText: 'Book now',
    link: `/offers/${slug(input.name)}`,
    placements: department.key === 'rooms' ? ['Homepage hero', 'Offers page', 'Booking engine'] : ['Homepage hero', 'Offers page'],
    metaTitle: `${input.name} | ${activeHotel.name}`,
    metaDescription: message.slice(0, 155),
  }
}

export function captionVariants(department: Department, input: { name: string; offer: string }): string[] {
  const tags = `${hashtag(activeHotel.name)} ${hashtag(input.name)}`
  return [
    `${department.headline} ${input.offer} — book via the link in our bio.\n\n${tags}`,
    `Looking for a reason to get away? ${input.offer} is here for a limited time. Tap the link in bio to book.\n\n${tags}`,
    `${input.name}, only at ${activeHotel.name}. ${input.offer} — spaces are limited.\n\n${tags}`,
  ]
}

function defaultPosts(department: Department, input: CampaignInput): SocialPost[] {
  const captions = captionVariants(department, input)
  return [
    { id: 'post-launch', platform: 'Instagram', caption: captions[0], date: input.startDate, status: 'Draft' },
    { id: 'post-facebook', platform: 'Facebook', caption: captions[1], date: addDays(input.startDate, 3), status: 'Draft' },
    { id: 'post-story', platform: 'Instagram Story', caption: captions[2], date: addDays(input.startDate, 7), status: 'Draft' },
  ]
}

export function createCampaign(department: Department, input: CampaignInput, id?: string, createdAt = new Date().toISOString()): CampaignRecord {
  return {
    id: id ?? `HVH-${department.key}-${crypto.randomUUID().slice(0, 8)}`,
    departmentKey: department.key,
    ...input,
    status: 'Draft',
    approvals: { Designs: false, Socials: false, Emails: false, Website: false },
    approvedDesigns: [],
    email: defaultEmail(department, input),
    website: defaultWebsite(department, input),
    socialPosts: defaultPosts(department, input),
    scheduledFor: null,
    timeline: { 'Content created': createdAt },
  }
}

export function requiredApprovals(campaign: CampaignRecord): ApprovalChannel[] {
  return ['Designs', ...campaign.channels.map((channel) => channelApproval[channel])]
}

export function allRequiredApproved(campaign: CampaignRecord): boolean {
  return requiredApprovals(campaign).every((channel) => campaign.approvals[channel])
}

export function withApproval(campaign: CampaignRecord, channel: ApprovalChannel, approved: boolean): CampaignRecord {
  const next = { ...campaign, approvals: { ...campaign.approvals, [channel]: approved } }
  if (allRequiredApproved(next) && (next.status === 'Draft' || next.status === 'Needs approval')) {
    return { ...next, status: 'Approved', timeline: { ...next.timeline, Approved: new Date().toISOString() } }
  }
  if (!allRequiredApproved(next) && next.status === 'Approved') {
    return { ...next, status: 'Needs approval' }
  }
  return next
}

export function sendForApproval(campaign: CampaignRecord): CampaignRecord {
  return { ...campaign, status: 'Needs approval', timeline: { ...campaign.timeline, 'Sent for approval': new Date().toISOString() } }
}

export function scheduleCampaign(campaign: CampaignRecord, when: string): CampaignRecord {
  return { ...campaign, status: 'Scheduled', scheduledFor: when, timeline: { ...campaign.timeline, Scheduled: new Date().toISOString() } }
}

export function publishNow(campaign: CampaignRecord): CampaignRecord {
  return { ...campaign, status: 'Live', timeline: { ...campaign.timeline, Live: new Date().toISOString() } }
}

export function completeCampaign(campaign: CampaignRecord): CampaignRecord {
  return { ...campaign, status: 'Completed', timeline: { ...campaign.timeline, Completed: new Date().toISOString() } }
}

type SeedState = { status: CampaignStatus; approvals: ApprovalChannel[]; steps: CampaignTimelineStep[] }

const seedStates: Partial<Record<Department['key'], SeedState>> = {
  rooms: { status: 'Live', approvals: ['Designs', 'Socials', 'Emails', 'Website'], steps: ['Sent for approval', 'Approved', 'Scheduled', 'Live'] },
  spa: { status: 'Needs approval', approvals: ['Designs', 'Emails'], steps: ['Sent for approval'] },
  restaurant: { status: 'Draft', approvals: [], steps: [] },
  events: { status: 'Draft', approvals: [], steps: [] },
}

const seedStamp: Record<CampaignTimelineStep, string> = {
  'Content created': '2026-09-22T09:10:00',
  'Sent for approval': '2026-09-23T14:30:00',
  Approved: '2026-09-24T10:05:00',
  Scheduled: '2026-09-24T10:20:00',
  Live: '2026-09-26T08:00:00',
  Completed: '2026-10-30T18:00:00',
}

export function seedCampaigns(departments: Department[], offers: Offer[]): CampaignRecord[] {
  return departments.flatMap((department) => {
    const seed = seedStates[department.key]
    if (!seed) return []
    const base = createCampaign(department, defaultCampaignInput(department, offers), `HVH-${department.key}-seed`, seedStamp['Content created'])
    const approvals = { ...base.approvals }
    for (const channel of seed.approvals) approvals[channel] = true
    const timeline = { ...base.timeline }
    for (const step of seed.steps) timeline[step] = seedStamp[step]
    return [{
      ...base,
      status: seed.status,
      approvals,
      approvedDesigns: approvals.Designs ? [...designAssetNames] : [],
      email: { ...base.email, testSentAt: approvals.Emails ? seedStamp['Sent for approval'] : null },
      timeline,
      scheduledFor: seed.steps.includes('Scheduled') ? '2026-09-26T08:00' : null,
      socialPosts: base.socialPosts.map((post) => ({ ...post, status: seed.status === 'Live' ? 'Scheduled' : post.status })),
    }]
  })
}
