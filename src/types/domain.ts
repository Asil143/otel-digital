import type { LucideIcon } from 'lucide-react'

export type DepartmentKey = 'rooms' | 'spa' | 'restaurant' | 'events' | 'hair_beauty' | 'golf' | 'meetings' | 'beach_club'

export type SourceState = 'Confirmed' | 'Detected' | 'Approximate' | 'Stale' | 'Unavailable'

export type CampaignStage =
  | 'Strategy'
  | 'Socials'
  | 'Designs'
  | 'Emails'
  | 'Website'
  | 'Audience'
  | 'Approval'
  | 'Results'

export type Confidence = 'High' | 'Medium' | 'Low'

export type CampaignStatus = 'Draft' | 'Needs approval' | 'Approved' | 'Scheduled' | 'Live' | 'Completed'

export type ApprovalState = 'Not requested' | 'Pending' | 'Approved' | 'Changes requested'

export type UserRole = 'Hotel manager' | 'Department manager'

export type Metric = {
  label: string
  value: string
  delta: string
}

export type RecommendationOutcome = 'Campaign' | 'Corporate action' | 'OTA/distribution review' | 'Monitor only' | 'Revenue review'

export type Priority = 'High' | 'Medium' | 'Low'

export type Recommendation = {
  title: string
  summary: string
  confidence: Confidence
  reasons: string[]
  avoid: string[]
  outcome: RecommendationOutcome
  priority: Priority
  alternatives: string[]
}

export type Department = {
  key: DepartmentKey
  name: string
  manager: string
  /** Staff-facing motivation line for the dashboard. Never shown to guests. */
  headline: string
  /** Guest-facing one-liner used for email preview text and openers. Specific, no clichés, no invented inclusions. */
  guestLine: string
  subline: string
  image: string
  accent: string
  metrics: Metric[]
  recommendation: Recommendation
  signal: string
  signalState: SourceState
  signalAgeDays: number
  offer: string
  audience: string[]
  resultMetric: string
}

export type SourceStateDefinition = {
  state: SourceState
  detail: string
  icon: LucideIcon
}

export type HotelAccount = {
  id: string
  name: string
  location: string
  timezone: string
  currency: string
  brandPromise: string
  brandTone: string
  roomCount: number
  /** Public website, used to turn relative booking links into absolute ones in emails. */
  website?: string
}

export type CampaignAsset = {
  id: string
  channel: 'Social' | 'Design' | 'Email' | 'Website' | 'Paid media'
  title: string
  status: ApprovalState
}

export type IntegrationChannel = {
  title: string
  provider: string
  /** What the channel does for campaigns. */
  detail: string
  status: 'Demo mode' | 'Manual export' | 'Future'
  icon: LucideIcon
}

export type SignalSourceType = 'quick_update' | 'file_upload' | 'forwarded_email' | 'adaptive_check_in'

export type SignalRecord = {
  id: string
  departmentKey: DepartmentKey
  sourceType: SignalSourceType
  summary: string
  fields: Record<string, string>
  confidence: Confidence
  state: 'Detected' | 'Confirmed'
  createdAt: string
}

export type Offer = {
  id: string
  departmentKey: DepartmentKey
  name: string
  price: string
  startDate: string
  endDate: string
  status: 'Active' | 'Draft' | 'Archived'
  terms?: string
  channels?: CampaignChannel[]
}

export type KeyDate = {
  id: string
  departmentKey: DepartmentKey | 'all'
  name: string
  date: string
  /** Inclusive last day for multi-day events and quiet periods. */
  endDate?: string
  kind: 'Event' | 'Quiet period' | 'Deadline'
}

export type CampaignChannel = 'Email' | 'Social' | 'Website'

export type SocialPost = {
  id: string
  platform: 'Instagram' | 'Facebook' | 'Instagram Story'
  caption: string
  date: string
  status: 'Draft' | 'Approved' | 'Scheduled'
}

export type EmailContent = {
  subject: string
  previewText: string
  headline: string
  body: string
  offerDetails: string
  ctaText: string
  senderName: string
  reminder: boolean
  testSentAt: string | null
}

export type WebsiteFormat = 'Promo block' | 'Landing page' | 'Banner' | 'SEO & meta'

export type WebsiteContent = {
  format: WebsiteFormat
  title: string
  subtitle: string
  description: string
  ctaText: string
  link: string
  placements: string[]
  metaTitle: string
  metaDescription: string
}

export type ApprovalChannel = 'Designs' | 'Socials' | 'Emails' | 'Website'

export type SendMode = 'approval' | 'schedule' | 'publish'

export type CampaignTimelineStep = 'Content created' | 'Sent for approval' | 'Approved' | 'Scheduled' | 'Live' | 'Completed'

export type DesignStyle = 'Classic' | 'Bold' | 'Minimal'

export type DesignState = {
  style?: DesignStyle
  variant?: number
  headline?: string
  offerText?: string
  cta?: string
}

export type CampaignRecord = {
  id: string
  departmentKey: DepartmentKey
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
  status: CampaignStatus
  approvals: Record<ApprovalChannel, boolean>
  approvedDesigns: string[]
  /** Per-format design choices (style, variation, copy overrides), saved with the campaign. */
  designs?: Partial<Record<string, DesignState>>
  email: EmailContent
  website: WebsiteContent
  socialPosts: SocialPost[]
  scheduledFor: string | null
  timeline: Partial<Record<CampaignTimelineStep, string>>
}

export type AssetKind = 'Brand' | 'Image' | 'Video' | 'Template' | 'Brochure' | 'Menu' | 'Price list' | 'Report'

export type MediaAsset = {
  id: string
  name: string
  kind: AssetKind
  departmentKey: DepartmentKey | null
  status: 'Approved' | 'Pending approval'
  locked: boolean
  addedAt: string
  /** Bytes, when uploaded on this device. */
  size?: number
  addedBy?: string
  /** Small image preview (URL or data URL). The original file isn't stored in this demo. */
  preview?: string
  /** The confirmed signal this report fed, for reports added by extraction. */
  signalId?: string
}

export type HotelRule = {
  id: string
  text: string
  createdAt: string
}

export type Learning = {
  id: string
  departmentKey: DepartmentKey
  campaignName: string
  text: string
  kind: 'Worked' | 'Avoid'
  createdAt: string
}

export type ConsentPermission = 'Subscribed' | 'Unsubscribed' | 'Unknown'

export type Contact = {
  id: string
  name: string
  email: string
  /** A segment name from the hotel's catalogue, or 'Unassigned' for imports that didn't match one. */
  segment: string
  /** ISO date of the last stay, visit or enquiry. */
  lastActivity: string | null
  permission: ConsentPermission
  /** How consent was given (the PDF's consent_basis). Required for anyone who is sent marketing. */
  consentBasis?: string | null
  guestValue: number
  /** Never contacted on any channel (the PDF's suppression_status). */
  suppressed?: boolean
  suppressionReason?: string | null
  /** Set for records imported on this device. */
  addedAt?: string
}
