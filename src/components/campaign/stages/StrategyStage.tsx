import { ArrowRight, Check, CircleAlert, PenLine } from 'lucide-react'
import { campaignStages } from '../../../data/workflows'
import type { CampaignChannel } from '../../../types/domain'
import type { StageProps } from './shared'

const channelReason: Record<CampaignChannel, (audience: string) => string> = {
  Email: (audience) => `Reaches ${audience.toLowerCase()} directly, using contacts with marketing consent.`,
  Social: () => 'Builds awareness around the offer dates with a short sequence of posts.',
  Website: () => 'Converts guests already browsing your site with a promo block and booking link.',
}

export function StrategyStage({ campaign, department, goToStage, onEditDetails }: StageProps & { onEditDetails: () => void }) {
  const audienceLabel = campaign.audience.join(', ') || 'your selected audience'

  return (
    <div className="strategy-stage">
      <div className="stage-heading">
        <div>
          <h3>Campaign strategy</h3>
          <p className="muted small">{campaign.type} · {campaign.objective}</p>
        </div>
        <button type="button" className="secondary-button" onClick={onEditDetails}>
          <PenLine size={15} /> Edit details
        </button>
      </div>

      <div className="strategy-grid">
        <article>
          <h4>Why now?</h4>
          {department.recommendation.reasons.map((reason) => (
            <span key={reason}><Check size={14} /> {reason}</span>
          ))}
        </article>
        <article>
          <h4>What's the goal?</h4>
          <p>{campaign.goal}</p>
        </article>
        <article>
          <h4>Why these channels?</h4>
          {campaign.channels.map((channel) => (
            <span key={channel}><strong>{channel}:</strong> {channelReason[channel](audienceLabel)}</span>
          ))}
        </article>
        <article>
          <h4>What not to do</h4>
          {department.recommendation.avoid.map((item) => (
            <span key={item}><CircleAlert size={14} /> {item}</span>
          ))}
        </article>
      </div>

      <div className="flow-stepper">
        {campaignStages.filter((stage) => stage !== 'Strategy').map((stage, index, list) => (
          <span key={stage}>
            <button type="button" onClick={() => goToStage(stage)}>{stage === 'Approval' ? 'Approve & send' : stage}</button>
            {index < list.length - 1 && <ArrowRight size={14} />}
          </span>
        ))}
      </div>
    </div>
  )
}
