import type { DepartmentKey } from '../types/domain'

const extractionByDepartment: Record<DepartmentKey, Record<string, string>> = {
  rooms: {
    period: '12 Oct 2026 - 30 Oct 2026',
    occupancy: '68%',
    revpar: '£78',
    directBookings: '142',
    quietDemand: 'Monday - Thursday',
  },
  spa: {
    period: '14 Oct 2026 - 4 Nov 2026',
    quietDays: 'Tuesday, Wednesday',
    activeOffer: 'Midweek Spa Day £79',
    availability: 'High afternoon availability',
    bookings: '342',
  },
  restaurant: {
    period: '6 Oct 2026 - 27 Oct 2026',
    servicePeriod: 'Weekday dinner',
    quietDay: 'Tuesday',
    covers: '824',
    averageSpend: '£32',
  },
  events: {
    period: 'Spring 2027',
    enquiries: '38',
    confirmedDates: '14',
    openWeekdays: '9',
    avgPackage: '£8,400',
  },
  hair_beauty: {
    period: 'Rolling 4 weeks',
    bookings: '206',
    avgTicket: '£54',
    rebookingRate: '61%',
    peakDay: 'Saturday (full)',
  },
  golf: {
    period: 'Last 18 days',
    roundsPlayed: '312',
    teeTimeFill: '74%',
    societyBookings: '4',
    lastUpdate: '18 days ago',
  },
  meetings: {
    period: 'Current quarter',
    dayDelegates: '58',
    roomHireDays: '11',
    avgPackage: '£62/head',
    pipelineEnquiries: '7',
  },
  beach_club: {
    period: 'Current season',
    dayPassesSold: '164',
    otaShare: '9%',
    directShare: '91%',
    avgSpend: '£46',
  },
}

function wait(ms = 550) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export async function extractBusinessData(department: DepartmentKey) {
  await wait()

  return {
    confidence: department === 'restaurant' ? 'Medium' : 'High',
    fields: extractionByDepartment[department],
    requiresConfirmation: true,
    sourceState: 'Detected',
  }
}

export type PublishStage = {
  label: string
  detail: string
}

export const publishStagesByOutcome: Record<'queued' | 'fallback_required', PublishStage[]> = {
  queued: [
    { label: 'Validating', detail: 'Checking template rules and approval status.' },
    { label: 'Scheduling', detail: 'Reserving a send window with the connected provider.' },
    { label: 'Publishing', detail: 'Handing off to the provider API.' },
    { label: 'Live', detail: 'Confirmed delivered with an audit trail entry.' },
  ],
  fallback_required: [
    { label: 'Validating', detail: 'Checking template rules and approval status.' },
    { label: 'No connection found', detail: 'This channel has no live provider connection yet.' },
    { label: 'Manual fallback', detail: 'Export prepared for a manager to publish by hand.' },
  ],
}

export async function createPublishJob(
  channelTitle: string,
  connected: boolean,
  onStage?: (stage: PublishStage, index: number, total: number) => void,
) {
  const stages = publishStagesByOutcome[connected ? 'queued' : 'fallback_required']

  for (let index = 0; index < stages.length; index += 1) {
    await wait(420)
    onStage?.(stages[index], index, stages.length)
  }

  if (!connected) {
    return {
      status: 'fallback_required' as const,
      message: `${channelTitle} needs manual fallback until the provider integration is live.`,
    }
  }

  return {
    status: 'queued' as const,
    message: `${channelTitle} publish job queued with approval and audit checks.`,
  }
}
