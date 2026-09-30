import { Check, Clock3, CircleSlash, Eye, Gauge, Mail, MousePointerClick, Radio, Globe2 } from 'lucide-react'
import type { CampaignStage, IntegrationChannel, SourceStateDefinition } from '../types/domain'

export const campaignStages: CampaignStage[] = [
  'Strategy',
  'Socials',
  'Designs',
  'Emails',
  'Website',
  'Audience',
  'Approval',
  'Results',
]

export const sourceStates: SourceStateDefinition[] = [
  { state: 'Confirmed', detail: 'Trusted and current', icon: Check },
  { state: 'Detected', detail: 'Awaiting manager review', icon: Eye },
  { state: 'Approximate', detail: 'Directional but useful', icon: Gauge },
  { state: 'Stale', detail: 'Needs a fresh check-in', icon: Clock3 },
  { state: 'Unavailable', detail: 'No current source connected', icon: CircleSlash },
]

export const integrationChannels: IntegrationChannel[] = [
  { title: 'Email provider', detail: 'Brevo · demo mode, not connected', status: 'Connected', icon: Mail },
  { title: 'Website', detail: 'WordPress · demo mode, not connected', status: 'Connected', icon: Globe2 },
  { title: 'Social media', detail: 'Approval-ready export', status: 'Manual fallback', icon: Radio },
  { title: 'Paid media', detail: 'Future integration', status: 'Future', icon: MousePointerClick },
]

export const productionGuardrails = [
  'AI extracted figures require confirmation',
  'Every recommendation cites sources',
  'Publishing actions keep an audit trail',
  'Brand templates are locked by hotel',
  'Audience sends require consent checks',
]
