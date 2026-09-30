import { Calendar, Check, Link2, Radio, Send, Tag, Users } from 'lucide-react'
import { campaignStages } from '../../data/workflows'
import { formatDate, formatDateTime, requiredApprovals, sendForApproval, timelineSteps } from '../../services/campaigns'
import { canRequestApproval } from '../../services/permissions'
import type { ActivityEvent } from '../../types/activity'
import type { ApprovalChannel, CampaignRecord, CampaignStage, Department, UserRole } from '../../types/domain'
import { ApprovalStage } from './stages/ApprovalStage'
import { AudienceStage } from './stages/AudienceStage'
import { DesignsStage } from './stages/DesignsStage'
import { EmailStage } from './stages/EmailStage'
import { ResultsStage } from './stages/ResultsStage'
import type { StageProps } from './stages/shared'
import { SocialsStage } from './stages/SocialsStage'
import { StrategyStage } from './stages/StrategyStage'
import { WebsiteStage } from './stages/WebsiteStage'

const allApprovalChannels: ApprovalChannel[] = ['Designs', 'Socials', 'Emails', 'Website']

export function CampaignEngine({
  campaign,
  department,
  activeStage,
  previewMode,
  currentRole,
  onChange,
  onActivity,
  onEditDetails,
  setActiveStage,
  setPreviewMode,
}: {
  campaign: CampaignRecord
  department: Department
  activeStage: CampaignStage
  previewMode: 'desktop' | 'mobile'
  currentRole: UserRole
  onChange: (next: CampaignRecord) => void
  onActivity: (event: ActivityEvent) => void
  onEditDetails: () => void
  setActiveStage: (stage: CampaignStage) => void
  setPreviewMode: (mode: 'desktop' | 'mobile') => void
}) {
  const required = requiredApprovals(campaign)
  const approvedCount = required.filter((channel) => campaign.approvals[channel]).length
  const lastDoneIndex = timelineSteps.reduce((last, step, index) => (campaign.timeline[step] ? index : last), -1)

  function addActivity(title: string, detail: string, tone: ActivityEvent['tone'] = 'info') {
    onActivity({ id: crypto.randomUUID(), title, detail, tone })
  }

  const stageProps: StageProps = {
    campaign,
    department,
    currentRole,
    onChange,
    onActivity: addActivity,
    goToStage: setActiveStage,
  }

  function renderStage() {
    switch (activeStage) {
      case 'Strategy':
        return <StrategyStage {...stageProps} onEditDetails={onEditDetails} />
      case 'Socials':
        return <SocialsStage {...stageProps} />
      case 'Designs':
        return <DesignsStage {...stageProps} />
      case 'Emails':
        return <EmailStage {...stageProps} previewMode={previewMode} setPreviewMode={setPreviewMode} />
      case 'Website':
        return <WebsiteStage {...stageProps} previewMode={previewMode} setPreviewMode={setPreviewMode} />
      case 'Audience':
        return <AudienceStage {...stageProps} />
      case 'Approval':
        return <ApprovalStage {...stageProps} />
      case 'Results':
        return <ResultsStage {...stageProps} />
    }
  }

  return (
    <section className="panel campaign-panel" id="campaign-engine">
      <div className="campaign-header">
        <div>
          <p className="eyebrow">Universal campaign engine</p>
          <h2>{campaign.name}</h2>
          <p className="campaign-subtitle">
            {approvedCount} of {required.length} channels approved · <span className="campaign-id-text">ID {campaign.id}</span>
          </p>
        </div>
        <div className="campaign-header-actions">
          <span className={`campaign-status-chip status-${campaign.status.toLowerCase().replace(/\s+/g, '-')}`}>{campaign.status}</span>
          {campaign.status === 'Draft' && canRequestApproval(currentRole) && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                onChange(sendForApproval(campaign))
                addActivity('Sent for approval', `${campaign.name} is with the hotel manager for review.`, 'success')
              }}
            >
              <Send size={15} /> Send for approval
            </button>
          )}
          <button type="button" className="primary-button" onClick={() => setActiveStage('Approval')}>
            Approve & send
          </button>
        </div>
      </div>

      <div className="campaign-info-bar">
        <div>
          <Tag size={16} />
          <div>
            <span>Offer</span>
            <strong title={campaign.offer}>{campaign.offer}</strong>
          </div>
        </div>
        <div>
          <Users size={16} />
          <div>
            <span>Audience</span>
            <strong title={campaign.audience.join(', ')}>{campaign.audience.join(', ') || 'Not selected'}</strong>
          </div>
        </div>
        <div>
          <Calendar size={16} />
          <div>
            <span>Campaign dates</span>
            <strong>{formatDate(campaign.startDate)} – {formatDate(campaign.endDate)}</strong>
          </div>
        </div>
        <div>
          <Radio size={16} />
          <div>
            <span>Channels</span>
            <strong>{campaign.channels.join(', ')}</strong>
          </div>
        </div>
      </div>

      <div className="campaign-layout">
        <div className="campaign-main">
          <div className="stage-tabs" role="tablist" aria-label="Campaign stages">
            {campaignStages.map((stage) => (
              <button
                type="button"
                role="tab"
                aria-selected={stage === activeStage}
                key={stage}
                className={stage === activeStage ? 'active' : ''}
                onClick={() => setActiveStage(stage)}
              >
                {stage === 'Approval' ? 'Approve & send' : stage}
              </button>
            ))}
          </div>

          <div className="campaign-content" key={campaign.id}>
            {renderStage()}
          </div>
        </div>

        <aside className="campaign-rail">
          <div className="rail-card">
            <h3>Campaign in progress</h3>
            <ol className="workflow-stepper">
              {timelineSteps.map((step, index) => {
                const stamp = campaign.timeline[step]
                const state = stamp ? 'done' : index < lastDoneIndex ? 'skipped' : index === lastDoneIndex + 1 ? 'current' : ''
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
          </div>

          <div className="rail-card">
            <h3>Channel approval status</h3>
            <ul className="channel-approval-list">
              {allApprovalChannels.map((channel) => {
                const inCampaign = required.includes(channel)
                const approved = campaign.approvals[channel]
                return (
                  <li key={channel} className={inCampaign ? '' : 'muted-row'}>
                    <span className={`status-radio ${approved && inCampaign ? 'approved' : ''}`}></span>
                    {channel}
                    <em>{!inCampaign ? 'Not in campaign' : approved ? 'Approved' : 'To review'}</em>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="rail-card publishing-note">
            <Link2 size={16} />
            <h3>Publishing not connected</h3>
            <p>This demo saves content and approvals on this device. Connect your email, website and social tools to send for real.</p>
          </div>
        </aside>
      </div>
    </section>
  )
}
