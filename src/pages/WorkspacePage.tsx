import { activeHotel } from '../config/hotel'
import type { AppRoute } from '../config/routes'
import { readStored, usePersistentState, writeStored } from '../lib/usePersistentState'
import type { CampaignRecord, CampaignStage, DepartmentKey, HotelAccount } from '../types/domain'
import { AudienceWorkspace } from './workspaces/AudienceWorkspace'
import { CalendarWorkspace } from './workspaces/CalendarWorkspace'
import { CampaignsWorkspace } from './workspaces/CampaignsWorkspace'
import { FilesWorkspace } from './workspaces/FilesWorkspace'
import { GovernanceWorkspace } from './workspaces/GovernanceWorkspace'
import { OffersWorkspace } from './workspaces/OffersWorkspace'
import { ResultsWorkspace } from './workspaces/ResultsWorkspace'
import { BrainWorkspace } from './workspaces/BrainWorkspace'

type WorkspaceRoute = Exclude<AppRoute, 'demo' | 'departments'>

const routeMeta: Record<WorkspaceRoute, { title: string; eyebrow: string; summary: string }> = {
  brain: {
    title: 'Hotel Brain',
    eyebrow: activeHotel.name,
    summary: 'Everything the AI knows about your hotel: property facts, the rules it must follow, approved assets, audiences, and what it has learned.',
  },
  offers: {
    title: 'Offers',
    eyebrow: 'Offers and packages',
    summary: 'Keep offers current for every business area. Active offers feed recommendations and campaign creation.',
  },
  campaigns: {
    title: 'Campaigns',
    eyebrow: 'Universal engine',
    summary: 'Every department uses the same campaign lifecycle from recommendation to approval, publishing, results, and learning.',
  },
  audience: {
    title: 'Audience',
    eyebrow: 'Consent-safe segments',
    summary: 'Import, review, and activate compliant guest audiences with suppression and unsubscribe controls.',
  },
  calendar: {
    title: 'Calendar',
    eyebrow: 'Demand planning',
    summary: 'See key dates, quiet periods, approval deadlines, scheduled sends, and publishing windows.',
  },
  files: {
    title: 'Files & Media',
    eyebrow: 'Approved assets and reports',
    summary: 'Store imagery, videos, menus, brochures, price lists, brand files, and uploaded reports for AI extraction.',
  },
  results: {
    title: 'Results',
    eyebrow: 'Learning loop',
    summary: 'Track commercial impact, engagement, source confidence, and next best recommendations.',
  },
  governance: {
    title: 'Governance',
    eyebrow: 'Production controls',
    summary: 'Permissions, approvals, audit events, confidence thresholds, consent gates, and publishing rules.',
  },
}

export function WorkspacePage({ route, onNavigate }: { route: WorkspaceRoute; onNavigate: (route: AppRoute) => void }) {
  const [hotel] = usePersistentState<HotelAccount>('otel:hotel-account', activeHotel)
  const meta = routeMeta[route]
  const eyebrow = route === 'brain' ? hotel.name : meta.eyebrow

  function startCreate(departmentKey: DepartmentKey, from: { offerId?: string; campaignId?: string; keyDateId?: string } = {}) {
    writeStored('otel:active-department', departmentKey)
    writeStored('otel:pending-create', { departmentKey, offerId: from.offerId ?? null, fromCampaignId: from.campaignId ?? null, keyDateId: from.keyDateId ?? null })
    onNavigate('departments')
  }

  function openCampaign(campaign: CampaignRecord, stage: CampaignStage = 'Strategy') {
    writeStored('otel:active-campaign', { ...readStored<Record<string, string>>('otel:active-campaign', {}), [campaign.departmentKey]: campaign.id })
    writeStored('otel:active-department', campaign.departmentKey)
    writeStored('otel:active-campaign-stage', stage)
    onNavigate('departments')
  }

  return (
    <main className="workspace">
      <header className="page-header">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{meta.title}</h1>
        <p className="page-summary">{meta.summary}</p>
      </header>

      {route === 'brain' && <BrainWorkspace onNavigate={onNavigate} />}
      {route === 'offers' && (
        <OffersWorkspace
          onOpenCampaign={openCampaign}
          onCreateCampaign={(offer) => {
            startCreate(offer.departmentKey, { offerId: offer.id })
          }}
        />
      )}
      {route === 'campaigns' && (
        <CampaignsWorkspace
          onOpenCampaign={openCampaign}
          onCreateCampaign={(departmentKey, fromCampaignId) => startCreate(departmentKey, { campaignId: fromCampaignId })}
        />
      )}
      {route === 'audience' && <AudienceWorkspace onOpenCampaign={openCampaign} />}
      {route === 'calendar' && (
        <CalendarWorkspace
          onOpenCampaign={openCampaign}
          onCreateCampaign={(departmentKey, keyDateId) => startCreate(departmentKey, { keyDateId })}
          onNavigate={onNavigate}
        />
      )}
      {route === 'files' && <FilesWorkspace onNavigate={onNavigate} />}
      {route === 'results' && <ResultsWorkspace onOpenCampaign={openCampaign} onNavigate={onNavigate} />}
      {route === 'governance' && <GovernanceWorkspace onNavigate={onNavigate} />}
    </main>
  )
}
