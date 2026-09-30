import { ArrowRight, Check, Globe2, Mail, MessageSquareText } from 'lucide-react'
import { useState } from 'react'
import { departments } from '../../data/departments'
import { formatCount, resultUnit } from '../../lib/results'
import { useResults } from '../../lib/useResults'
import { useCurrentUser } from '../../lib/currentUser'
import { campaignStatuses, formatDate, formatDateTime, timelineSteps } from '../../services/campaigns'
import type { CampaignChannel, CampaignRecord, CampaignStatus } from '../../types/domain'

const channelIcon: Record<CampaignChannel, typeof Mail> = { Email: Mail, Social: MessageSquareText, Website: Globe2 }

export function CampaignsWorkspace({ onOpenCampaign }: { onOpenCampaign: (campaign: CampaignRecord) => void }) {
  const { campaigns: allCampaigns, results } = useResults()
  const { canAccess } = useCurrentUser()
  const campaigns = allCampaigns.filter((campaign) => canAccess(campaign.departmentKey))
  const [filter, setFilter] = useState<CampaignStatus | 'All'>('All')
  const [selectedId, setSelectedId] = useState<string | null>(null)


  const visible = campaigns.filter((campaign) => filter === 'All' || campaign.status === filter)
  const selected = campaigns.find((campaign) => campaign.id === selectedId) ?? visible[0] ?? null

  return (
    <div className="power-grid">
      <section className="panel span-2">
        <div className="audience-filter-row">
          {(['All', ...campaignStatuses] as const).map((status) => {
            const count = status === 'All' ? campaigns.length : campaigns.filter((campaign) => campaign.status === status).length
            return (
              <button type="button" key={status} className={filter === status ? 'selected' : ''} onClick={() => setFilter(status)}>
                {status} · {count}
              </button>
            )
          })}
        </div>
        <div className="campaign-card-grid">
          {visible.map((campaign) => {
            const department = departments.find((item) => item.key === campaign.departmentKey)
            return (
              <button
                type="button"
                key={campaign.id}
                className={`campaign-card ${selected?.id === campaign.id ? 'selected' : ''}`}
                onClick={() => setSelectedId(campaign.id)}
              >
                <span className="campaign-card-image" style={{ backgroundImage: `url(${department?.image})` }}>
                  <em className={`campaign-status-chip status-${campaign.status.toLowerCase().replace(/\s+/g, '-')}`}>{campaign.status}</em>
                </span>
                <span className="campaign-card-body">
                  <small>{department?.name}</small>
                  <strong>{campaign.name}</strong>
                  <span>{campaign.objective}</span>
                  {(() => {
                    const result = results.find((item) => item.campaign.id === campaign.id)
                    if (!result || !department) return null
                    const unit = resultUnit(department)
                    return (
                      <span className={`campaign-card-result ${result.state}`}>
                        {result.state === 'projection'
                          ? `Projected ${formatCount(result.projected.bookings)} ${unit}`
                          : `${formatCount(result.shown.bookings)} ${unit} ${result.state === 'live' ? 'so far' : 'total'}`}
                      </span>
                    )
                  })()}
                  <span className="campaign-card-footer">
                    {formatDate(campaign.startDate)} – {formatDate(campaign.endDate)}
                    <span className="channel-icons">
                      {campaign.channels.map((channel) => {
                        const Icon = channelIcon[channel]
                        return <Icon key={channel} size={14} aria-label={channel} />
                      })}
                    </span>
                  </span>
                </span>
              </button>
            )
          })}
          {visible.length === 0 && <p className="muted">No {filter.toLowerCase()} campaigns.</p>}
        </div>
      </section>

      <section className="panel">
        {selected ? (
          <>
            <p className="eyebrow">{departments.find((item) => item.key === selected.departmentKey)?.name}</p>
            <h2>{selected.name}</h2>
            <p className="muted small">{selected.offer}</p>
            <ol className="workflow-stepper campaign-list-timeline">
              {timelineSteps.map((step, index) => {
                const stamp = selected.timeline[step]
                const lastDone = timelineSteps.reduce((last, item, i) => (selected.timeline[item] ? i : last), -1)
                const state = stamp ? 'done' : index < lastDone ? 'skipped' : ''
                return (
                  <li key={step} className={state}>
                    <span className="step-marker">{stamp ? <Check size={13} /> : index + 1}</span>
                    <span className="step-text">
                      {step}
                      {stamp && <small>{formatDateTime(stamp)}</small>}
                      {state === 'skipped' && <small>Skipped</small>}
                    </span>
                  </li>
                )
              })}
            </ol>
            <button type="button" className="primary-button full-width" onClick={() => onOpenCampaign(selected)}>
              Open in campaign engine <ArrowRight size={15} />
            </button>
          </>
        ) : (
          <p className="muted">Select a campaign to see its progress.</p>
        )}
      </section>
    </div>
  )
}
