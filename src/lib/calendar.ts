import { addDays, formatDate } from '../services/campaigns'
import type { CampaignRecord, CampaignStage, KeyDate } from '../types/domain'

export const lastDay = (date: KeyDate) => date.endDate ?? date.date

export function daysBetween(from: string, to: string): number {
  return Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000)
}

export function relativeDay(date: string, today: string): string {
  const days = daysBetween(today, date)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  return days > 0 ? `In ${days} days` : `${Math.abs(days)} days ago`
}

export function dateRange(date: KeyDate): string {
  return date.endDate && date.endDate !== date.date ? `${formatDate(date.date)} – ${formatDate(date.endDate)}` : formatDate(date.date)
}

export const covers = (start: string, end: string, day: string) => start <= day && day <= end

// ---------- Sends ----------

export type SendChannel = 'Email' | 'Reminder' | 'Social' | 'Website'
export type SendState = 'planned' | 'scheduled' | 'sent'
export type Send = { id: string; campaign: CampaignRecord; date: string; channel: SendChannel; label: string; state: SendState; stage: CampaignStage }

/** Everything a campaign puts out, on the day it goes out. Drafts are "planned" until approved and scheduled. */
export function campaignSends(campaign: CampaignRecord, today: string): Send[] {
  const committed = ['Scheduled', 'Live', 'Completed'].includes(campaign.status)
  const state = (date: string, scheduled = committed): SendState => (committed && date <= today && campaign.status !== 'Scheduled' ? 'sent' : scheduled ? 'scheduled' : 'planned')
  const sends: Send[] = []
  const launch = campaign.scheduledFor?.slice(0, 10) ?? campaign.startDate
  if (campaign.channels.includes('Email')) {
    sends.push({ id: `${campaign.id}-email`, campaign, date: launch, channel: 'Email', label: 'Launch email', state: state(launch), stage: 'Emails' })
    if (campaign.email.reminder) {
      const reminder = addDays(campaign.endDate, -3)
      sends.push({ id: `${campaign.id}-reminder`, campaign, date: reminder, channel: 'Reminder', label: 'Reminder email', state: state(reminder), stage: 'Emails' })
    }
  }
  if (campaign.channels.includes('Social')) {
    for (const post of campaign.socialPosts) {
      sends.push({ id: `${campaign.id}-${post.id}`, campaign, date: post.date, channel: 'Social', label: `${post.platform} post`, state: state(post.date, committed && post.status !== 'Draft'), stage: 'Socials' })
    }
  }
  if (campaign.channels.includes('Website')) {
    sends.push({ id: `${campaign.id}-web`, campaign, date: launch, channel: 'Website', label: 'Website offer goes live', state: state(launch), stage: 'Website' })
  }
  return sends
}

// ---------- Coverage + deadlines ----------

/** Unfinished campaigns in the same area (or any area, for hotel-wide dates) whose window overlaps the key date. */
export function coveringCampaigns(date: KeyDate, campaigns: CampaignRecord[]): CampaignRecord[] {
  return campaigns.filter(
    (campaign) =>
      campaign.status !== 'Completed' &&
      (date.departmentKey === 'all' || campaign.departmentKey === date.departmentKey) &&
      campaign.startDate <= lastDay(date) &&
      date.date <= campaign.endDate,
  )
}

/** Upcoming events and quiet periods with nothing planned against them. */
export function planningGaps(dates: KeyDate[], campaigns: CampaignRecord[], today: string, horizonDays = 60): KeyDate[] {
  const horizon = addDays(today, horizonDays)
  return dates
    .filter((date) => date.kind !== 'Deadline' && lastDay(date) >= today && date.date <= horizon)
    .filter((date) => coveringCampaigns(date, campaigns).length === 0)
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Campaigns that should be approved by a deadline: not yet approved, starting within ~6 weeks of it. */
export function unapprovedFor(deadline: KeyDate, campaigns: CampaignRecord[]): CampaignRecord[] {
  return campaigns.filter(
    (campaign) =>
      (campaign.status === 'Draft' || campaign.status === 'Needs approval') &&
      (deadline.departmentKey === 'all' || campaign.departmentKey === deadline.departmentKey) &&
      campaign.startDate <= addDays(deadline.date, 45),
  )
}
