import { Check, Lock } from 'lucide-react'
import { canApprove } from '../../../services/permissions'
import type { ActivityEvent } from '../../../types/activity'
import type { CampaignChannel, CampaignRecord, CampaignStage, Department, UserRole } from '../../../types/domain'

export type StageProps = {
  campaign: CampaignRecord
  department: Department
  currentRole: UserRole
  onChange: (next: CampaignRecord) => void
  onActivity: (title: string, detail: string, tone?: ActivityEvent['tone']) => void
  goToStage: (stage: CampaignStage) => void
}

export function ChannelMissing({
  campaign,
  channel,
  label,
  onChange,
}: {
  campaign: CampaignRecord
  channel: CampaignChannel
  label: string
  onChange: (next: CampaignRecord) => void
}) {
  return (
    <div className="channel-missing">
      <p>{label} isn't part of this campaign.</p>
      <button type="button" className="secondary-button" onClick={() => onChange({ ...campaign, channels: [...campaign.channels, channel] })}>
        Add {label.toLowerCase()} to this campaign
      </button>
    </div>
  )
}

export function ApproveControl({
  approved,
  label,
  role,
  disabledReason,
  onApprove,
  onRevoke,
}: {
  approved: boolean
  label: string
  role: UserRole
  disabledReason?: string
  onApprove: () => void
  onRevoke: () => void
}) {
  if (approved) {
    return (
      <div className="approve-control approved">
        <span><Check size={15} /> {label} approved</span>
        {canApprove(role) && (
          <button type="button" className="ghost-link" onClick={onRevoke}>Revoke</button>
        )}
      </div>
    )
  }
  if (!canApprove(role)) {
    return (
      <div className="approve-control locked">
        <span><Lock size={14} /> Approval by hotel manager</span>
      </div>
    )
  }
  return (
    <button type="button" className="primary-button" onClick={onApprove} disabled={Boolean(disabledReason)} title={disabledReason}>
      <Check size={15} /> Approve {label.toLowerCase()}
    </button>
  )
}

export function PreviewToggle({ mode, onChange }: { mode: 'desktop' | 'mobile'; onChange: (mode: 'desktop' | 'mobile') => void }) {
  return (
    <div className="segmented preview-toggle">
      <button type="button" className={mode === 'desktop' ? 'selected' : ''} onClick={() => onChange('desktop')}>Desktop</button>
      <button type="button" className={mode === 'mobile' ? 'selected' : ''} onClick={() => onChange('mobile')}>Mobile</button>
    </div>
  )
}
