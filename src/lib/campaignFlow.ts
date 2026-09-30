import { addDays, formatDate, formatDateTime, requiredApprovals, type CampaignInput } from '../services/campaigns'
import type { ApprovalChannel, CampaignRecord, CampaignStage, Department, Learning, Offer } from '../types/domain'
import { formatCount, type CampaignResults } from './results'

const stageForChannel: Record<ApprovalChannel, CampaignStage> = {
  Designs: 'Designs',
  Socials: 'Socials',
  Emails: 'Emails',
  Website: 'Website',
}

export function pendingApprovals(campaign: CampaignRecord): ApprovalChannel[] {
  return requiredApprovals(campaign).filter((channel) => !campaign.approvals[channel])
}

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000)
}

/** Days since a live campaign's end date; 0 or less while it is still inside its window. */
export function daysPastEnd(campaign: CampaignRecord, today: string): number {
  return campaign.status === 'Live' ? daysBetween(campaign.endDate, today) : 0
}

export function daysUntilStart(campaign: CampaignRecord, today: string): number {
  return daysBetween(today, campaign.startDate)
}

export function hasSavedLearning(campaign: CampaignRecord, learnings: Learning[]): boolean {
  return learnings.some((item) => item.departmentKey === campaign.departmentKey && item.campaignName === campaign.name)
}

/** Campaigns in the same business area whose windows overlap — breaks the "one offer per area" rule. */
export function overlappingCampaigns(campaign: CampaignRecord, all: CampaignRecord[]): CampaignRecord[] {
  if (campaign.status === 'Completed') return []
  return all.filter(
    (other) =>
      other.id !== campaign.id &&
      other.departmentKey === campaign.departmentKey &&
      other.status !== 'Completed' &&
      other.startDate <= campaign.endDate &&
      campaign.startDate <= other.endDate,
  )
}

export type StepOwner = 'you' | 'hotel-manager' | 'department' | 'none'

export type NextStep = {
  owner: StepOwner
  title: string
  detail: string
  label: string
  stage: CampaignStage
  action?: 'complete' | 'rerun'
  /** Lower is more urgent. Only meaningful when owner is "you". */
  priority: number
}

export function nextStep(
  campaign: CampaignRecord,
  context: { isHotelManager: boolean; today: string; result: CampaignResults | null; department: Department | undefined; learnings: Learning[] },
): NextStep {
  const { isHotelManager, today, result, department, learnings } = context
  const pending = pendingApprovals(campaign)
  const firstPendingStage = pending[0] ? stageForChannel[pending[0]] : 'Approval'
  const manager = department?.manager ?? 'the department'
  const unit = result?.unit ?? 'bookings'

  switch (campaign.status) {
    case 'Draft': {
      const startsIn = daysUntilStart(campaign, today)
      const soon = startsIn <= 7
      const timing = startsIn < 0 ? `Start date passed ${Math.abs(startsIn)} days ago` : startsIn === 0 ? 'Starts today' : `Starts in ${startsIn} days`
      if (isHotelManager) {
        return { owner: 'department', title: `Being prepared by ${manager}`, detail: `${timing}. You'll be asked to approve once it's sent.`, label: 'Open draft', stage: 'Strategy', priority: 9 }
      }
      return {
        owner: 'you',
        title: 'Finish it and send for approval',
        detail: soon ? `${timing} — send it to the hotel manager soon so there's time to approve.` : `${timing}. Check each channel, then send it to the hotel manager.`,
        label: 'Continue draft',
        stage: 'Strategy',
        priority: soon ? 3 : 5,
      }
    }
    case 'Needs approval':
      return isHotelManager
        ? { owner: 'you', title: 'Review and approve', detail: `Waiting on your approval: ${pending.join(', ') || 'final sign-off'}.`, label: 'Review & approve', stage: firstPendingStage, priority: 1 }
        : { owner: 'hotel-manager', title: 'With the hotel manager', detail: `Still to approve: ${pending.join(', ') || 'final sign-off'}.`, label: 'View campaign', stage: 'Approval', priority: 9 }
    case 'Approved':
      return isHotelManager
        ? { owner: 'you', title: 'Schedule or publish it', detail: 'Every channel is approved. Choose when it goes out.', label: 'Schedule', stage: 'Approval', priority: 2 }
        : { owner: 'hotel-manager', title: 'Approved — waiting to be scheduled', detail: 'The hotel manager chooses when it goes out.', label: 'View campaign', stage: 'Approval', priority: 9 }
    case 'Scheduled':
      return { owner: 'none', title: campaign.scheduledFor ? `Goes out ${formatDateTime(campaign.scheduledFor)}` : 'Scheduled', detail: 'Nothing to do until it goes live.', label: 'View schedule', stage: 'Approval', priority: 9 }
    case 'Live': {
      const overdue = daysPastEnd(campaign, today)
      if (overdue > 0) {
        const ended = `Ended ${formatDate(campaign.endDate)} (${overdue} day${overdue === 1 ? '' : 's'} ago)`
        return isHotelManager
          ? { owner: 'you', title: 'Mark it completed', detail: `${ended}. Completing it finalises the results and prompts the learning loop.`, label: 'Mark completed', stage: 'Results', action: 'complete', priority: 2 }
          : { owner: 'hotel-manager', title: 'Ended — waiting to be closed', detail: `${ended}. The hotel manager marks it completed.`, label: 'See results', stage: 'Results', priority: 9 }
      }
      const soFar = result ? `${formatCount(result.shown.bookings)} ${unit} so far` : 'Results update as bookings come in'
      return { owner: 'none', title: result ? `Live — day ${result.dayCount} of ${result.totalDays}` : 'Live', detail: `${soFar}.`, label: 'See results', stage: 'Results', priority: 9 }
    }
    case 'Completed':
      if (!hasSavedLearning(campaign, learnings)) {
        return { owner: 'you', title: 'Review results and save what worked', detail: 'Saved learnings shape the next recommendation for this area.', label: 'Review results', stage: 'Results', priority: 6 }
      }
      return { owner: 'none', title: 'Completed — learnings saved', detail: result ? `${formatCount(result.shown.bookings)} ${unit} in total.` : 'Results are final.', label: 'Run again', stage: 'Results', action: 'rerun', priority: 9 }
  }
}

function monthLabel(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

/** A new draft input based on an earlier campaign: same audience, channels and offer, dates moved forward. */
export function rerunInput(campaign: CampaignRecord, offers: Offer[], today: string): { input: CampaignInput; offerNote: string | null } {
  const length = Math.max(7, daysBetween(campaign.startDate, campaign.endDate))
  const startDate = addDays(today, 14)
  let endDate = addDays(startDate, length)
  const offer = offers.find((item) => item.id === campaign.offerId)
  let offerNote: string | null = null
  if (offer && (offer.status === 'Archived' || offer.endDate < startDate)) {
    offerNote = `The offer “${offer.name}” ${offer.status === 'Archived' ? 'is archived' : `ended ${formatDate(offer.endDate)}`} — choose a current offer before creating.`
  } else if (offer && offer.endDate < endDate) {
    endDate = offer.endDate
  }
  const baseName = campaign.name.replace(/ · [A-Z][a-z]{2} \d{4}$/, '')
  return {
    input: {
      name: `${baseName} · ${monthLabel(startDate)}`,
      type: campaign.type,
      objective: campaign.objective,
      audience: campaign.audience,
      offerId: campaign.offerId,
      offer: campaign.offer,
      offerTerms: campaign.offerTerms,
      goal: campaign.goal,
      startDate,
      endDate,
      channels: campaign.channels,
    },
    offerNote,
  }
}
