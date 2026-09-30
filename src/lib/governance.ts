import { baseSuppressed } from '../data/contacts'
import { cappedConfidence, resolveFreshness } from './freshness'
import { overlappingCampaigns } from './campaignFlow'
import { overlappingOffers } from './offers'
import { requiredApprovals } from '../services/campaigns'
import type { ActivityEvent } from '../types/activity'
import type { CampaignRecord, Contact, Department, DepartmentKey, HotelRule, MediaAsset, Offer, SignalRecord } from '../types/domain'

export type CheckStatus = 'pass' | 'enforced' | 'attention' | 'off'
export type CheckAction = { label: string; route?: 'offers' | 'campaigns' | 'audience' | 'files' | 'brain'; area?: DepartmentKey }
export type GuardrailCheck = { id: string; title: string; how: string; status: CheckStatus; evidence: string; action?: CheckAction }

type Context = {
  areas: Department[]
  signals: SignalRecord[]
  campaigns: CampaignRecord[]
  assets: MediaAsset[]
  offers: Offer[]
  contacts: Contact[]
  rules: HotelRule[]
  audit: ActivityEvent[]
  isHotelManager: boolean
}

const list = (names: string[]) => (names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`)

/** Live checks behind each production guardrail from the handoff spec. */
export function guardrailChecks(ctx: Context): GuardrailCheck[] {
  const { areas, signals, campaigns, assets, offers, contacts, rules, audit, isHotelManager } = ctx
  const freshness = areas.map((area) => ({ area, freshness: resolveFreshness(area, signals) }))

  // 1. Extracted data waits for a person
  const detected = freshness.filter((item) => item.freshness.latestSignal?.state === 'Detected')
  // 2. Confidence caps
  const capped = freshness.filter((item) => cappedConfidence(item.area.recommendation.confidence, item.freshness.state) !== item.area.recommendation.confidence)
  const held = freshness.filter((item) => item.freshness.state !== 'Confirmed')
  // 3. Freshness
  const stale = freshness.filter((item) => item.freshness.state === 'Stale' || item.freshness.state === 'Unavailable')
  // 4. Approval before publishing
  const committed = campaigns.filter((campaign) => ['Approved', 'Scheduled', 'Live', 'Completed'].includes(campaign.status))
  const unapprovedCommitted = committed.filter((campaign) => requiredApprovals(campaign).some((channel) => !campaign.approvals[channel]))
  const waiting = campaigns.filter((campaign) => campaign.status === 'Needs approval')
  // 5. Audit trail: live/scheduled campaigns carry approval + publish stamps
  const running = campaigns.filter((campaign) => campaign.status === 'Scheduled' || campaign.status === 'Live')
  const unstamped = running.filter((campaign) => !campaign.timeline.Approved || !(campaign.timeline.Scheduled || campaign.timeline.Live))
  // 6. Brand files locked
  const brand = assets.filter((asset) => asset.kind === 'Brand' || asset.kind === 'Template')
  const unlocked = brand.filter((asset) => !asset.locked)
  const pendingAssets = assets.filter((asset) => asset.status === 'Pending approval')
  // 7. Consent
  const unknown = contacts.filter((contact) => contact.permission === 'Unknown' && !contact.suppressed).length
  const suppressed = baseSuppressed + contacts.filter((contact) => contact.suppressed).length
  // 8. One offer per area (hotel rule)
  const oneOffer = rules.find((rule) => /one offer/i.test(rule.text))
  const offerClashes = [...new Set(offers.filter((offer) => overlappingOffers(offer, offers).length > 0).map((offer) => offer.departmentKey))]
  const campaignClashes = [...new Set(campaigns.filter((campaign) => overlappingCampaigns(campaign, campaigns).length > 0).map((campaign) => campaign.departmentKey))]
  const clashAreas = [...new Set([...offerClashes, ...campaignClashes])]
  const areaName = (key: DepartmentKey) => areas.find((area) => area.key === key)?.name ?? key

  return [
    {
      id: 'confirm-data',
      title: 'AI-extracted figures are confirmed by a person',
      how: 'Detected updates stay out of recommendations until the area manager confirms or edits them.',
      status: detected.length ? 'attention' : 'pass',
      evidence: detected.length
        ? `${detected.length} update${detected.length === 1 ? '' : 's'} awaiting confirmation: ${list(detected.map((item) => item.area.name))}.`
        : 'No detected updates waiting.',
      action: detected.length ? { label: `Review ${detected[0].area.name}`, area: detected[0].area.key } : undefined,
    },
    {
      id: 'capped-confidence',
      title: 'Unconfirmed or old data can’t drive high-confidence recommendations',
      how: 'Confidence is capped automatically: detected or approximate data → Medium, stale or unavailable → Low.',
      status: 'enforced',
      evidence: held.length
        ? `${list(held.map((item) => `${item.area.name} held to ${cappedConfidence('High', item.freshness.state)} (${item.freshness.state.toLowerCase()})`))}${capped.length ? ` · ${capped.length} recommendation${capped.length === 1 ? '' : 's'} lowered right now` : ''}.`
        : 'Every area’s data is confirmed and current, so no limits apply.',
    },
    {
      id: 'fresh-data',
      title: 'Business data is kept current',
      how: 'Data older than 14 days is marked stale and a 30-second check-in is requested.',
      status: stale.length ? 'attention' : 'pass',
      evidence: stale.length ? `${list(stale.map((item) => `${item.area.name} (${item.freshness.state.toLowerCase()})`))} need${stale.length === 1 ? 's' : ''} a check-in.` : `All ${areas.length} area${areas.length === 1 ? '' : 's'} current.`,
      action: stale.length ? { label: `Open ${stale[0].area.name}`, area: stale[0].area.key } : undefined,
    },
    {
      id: 'approval',
      title: 'Nothing is published without approval',
      how: 'Designs, socials, emails and website must each be approved by the hotel manager before a campaign can be scheduled.',
      status: unapprovedCommitted.length ? 'attention' : 'pass',
      evidence: unapprovedCommitted.length
        ? `${list(unapprovedCommitted.map((campaign) => campaign.name))} went ahead with channels unapproved.`
        : `${committed.length} approved, scheduled or live campaign${committed.length === 1 ? '' : 's'} — every channel approved.${waiting.length ? ` ${waiting.length} waiting for approval.` : ''}`,
      action: waiting.length && isHotelManager ? { label: 'Review approvals', route: 'campaigns' } : undefined,
    },
    {
      id: 'audit',
      title: 'Approvals, sends and data changes are recorded',
      how: 'Every action is written to the audit log with who and when. Clearing a dashboard feed doesn’t remove it.',
      status: unstamped.length ? 'attention' : 'pass',
      evidence: unstamped.length
        ? `${list(unstamped.map((campaign) => campaign.name))} ${unstamped.length === 1 ? 'is' : 'are'} missing approval or publish timestamps.`
        : `${audit.length} event${audit.length === 1 ? '' : 's'} recorded. ${running.length} scheduled or live campaign${running.length === 1 ? '' : 's'} with full timestamps.`,
    },
    {
      id: 'brand',
      title: 'Brand files and templates are locked by the hotel',
      how: 'Locked assets can’t be changed per campaign, and only approved assets can be used.',
      status: unlocked.length ? 'attention' : 'pass',
      evidence: `${brand.length - unlocked.length} of ${brand.length} brand files and templates locked${unlocked.length ? ` — unlocked: ${list(unlocked.map((asset) => asset.name))}` : ''}.${pendingAssets.length ? ` ${pendingAssets.length} asset${pendingAssets.length === 1 ? '' : 's'} awaiting approval can’t be used yet.` : ''}`,
      action: unlocked.length && isHotelManager ? { label: 'Open Files & Media', route: 'files' } : undefined,
    },
    {
      id: 'consent',
      title: 'Sends only reach consented, unsuppressed guests',
      how: 'Anyone without recorded consent, and every suppressed address, is left out of every campaign audience.',
      status: 'enforced',
      evidence: `${unknown} record${unknown === 1 ? '' : 's'} without consent excluded · ${suppressed.toLocaleString()} suppressed addresses never contacted.`,
      action: unknown && isHotelManager ? { label: 'Review consent', route: 'audience' } : undefined,
    },
    {
      id: 'one-offer',
      title: oneOffer ? `Hotel rule: ${oneOffer.text}` : 'One offer per business area',
      how: oneOffer ? 'Overlapping offers and campaigns in the same area are flagged on Offers, Campaigns and here.' : 'This rule isn’t set in Hotel Brain, so overlaps aren’t checked.',
      status: !oneOffer ? 'off' : clashAreas.length ? 'attention' : 'pass',
      evidence: !oneOffer
        ? 'Add it in Hotel Brain to turn the check on.'
        : clashAreas.length
          ? `${list(clashAreas.map(areaName))} run${clashAreas.length === 1 ? 's' : ''} more than one offer or campaign at once.`
          : 'No overlapping offers or campaigns.',
      action: !oneOffer ? (isHotelManager ? { label: 'Open Hotel Brain', route: 'brain' } : undefined) : clashAreas.length ? { label: offerClashes.length ? 'Open Offers' : 'Open Campaigns', route: offerClashes.length ? 'offers' : 'campaigns' } : undefined,
    },
  ]
}
