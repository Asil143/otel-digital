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
  { title: 'Email provider', provider: 'Brevo', detail: 'Sends approved emails to consented guests.', status: 'Demo mode', icon: Mail },
  { title: 'Website', provider: 'WordPress', detail: 'Publishes approved promo blocks and landing pages.', status: 'Demo mode', icon: Globe2 },
  { title: 'Social media', provider: 'Instagram & Facebook', detail: 'Approved posts are exported to post by hand.', status: 'Manual export', icon: Radio },
  { title: 'Paid media', provider: 'Meta & Google Ads', detail: 'Planned for a later phase.', status: 'Future', icon: MousePointerClick },
]

export const productionGuardrails = [
  'AI extracted figures require confirmation',
  'Every recommendation cites sources',
  'Publishing actions keep an audit trail',
  'Brand templates are locked by hotel',
  'Audience sends require consent checks',
]
