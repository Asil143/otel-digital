import { CalendarClock, Check, Circle, Rocket, Send } from 'lucide-react'
import { useState } from 'react'
import {
  allRequiredApproved,
  completeCampaign,
  formatDateTime,
  publishNow,
  requiredApprovals,
  scheduleCampaign,
  sendForApproval,
} from '../../../services/campaigns'
import { canApprove, canPublish, canRequestApproval } from '../../../services/permissions'
import type { ApprovalChannel, CampaignStage, SendMode } from '../../../types/domain'
import type { StageProps } from './shared'

const stageFor: Record<ApprovalChannel, CampaignStage> = {
  Designs: 'Designs',
  Socials: 'Socials',
  Emails: 'Emails',
  Website: 'Website',
}

export function ApprovalStage({ campaign, currentRole, onChange, onActivity, goToStage }: StageProps) {
  const [mode, setMode] = useState<SendMode>(() => (campaign.status === 'Draft' || !canApprove(currentRole) ? 'approval' : 'schedule'))
  const [scheduleAt, setScheduleAt] = useState(`${campaign.startDate}T09:00`)

  const required = requiredApprovals(campaign)
  const approvedAll = allRequiredApproved(campaign)
  const consentOk = !campaign.channels.includes('Email') || campaign.audience.length > 0
  const isManager = canApprove(currentRole)

  const availability: Record<SendMode, string | null> = {
    approval: !canRequestApproval(currentRole)
      ? 'Your role cannot request approval.'
      : campaign.status !== 'Draft'
        ? 'Already sent to the hotel manager.'
        : null,
    schedule: !isManager
      ? 'Only the hotel manager can schedule.'
      : !approvedAll
        ? 'Every channel must be approved first.'
        : !consentOk
          ? 'Select a consented audience first.'
          : null,
    publish: !canPublish(currentRole, campaign)
      ? isManager ? 'Every channel must be approved first.' : 'Only the hotel manager can publish.'
      : !consentOk
        ? 'Select a consented audience first.'
        : null,
  }

  function run() {
    if (availability[mode]) return
    if (mode === 'approval') {
      onChange(sendForApproval(campaign))
      onActivity('Sent for approval', `${campaign.name} is with the hotel manager for review.`, 'success')
      return
    }
    if (mode === 'schedule') {
      onChange(scheduleCampaign(campaign, scheduleAt))
      onActivity('Campaign scheduled', `${campaign.name} will go out ${formatDateTime(scheduleAt)}.`, 'success')
      return
    }
    onChange(publishNow(campaign))
    onActivity('Campaign live', `${campaign.name} marked live (demo: providers are not connected, content is ready to export).`, 'success')
  }

  const options: { value: SendMode; title: string; detail: string; icon: typeof Send }[] = [
    { value: 'approval', title: 'Send for approval', detail: 'Default. The hotel manager reviews before anything goes live.', icon: Send },
    { value: 'schedule', title: 'Schedule', detail: 'Choose the date and time the campaign goes out.', icon: CalendarClock },
    { value: 'publish', title: 'Publish now', detail: 'Only available with publishing permission.', icon: Rocket },
  ]

  return (
    <div className="approval-stage">
      <div className="approval-checklist">
        <h3>Approvals</h3>
        <p className="muted small">
          {required.filter((channel) => campaign.approvals[channel]).length} of {required.length} channels approved.
          {!isManager && ' Approvals are made by the hotel manager.'}
        </p>
        {required.map((channel) => (
          <div className="approval-row" key={channel}>
            {campaign.approvals[channel] ? <Check size={16} className="ok" /> : <Circle size={16} />}
            <strong>{channel}</strong>
            <em>{campaign.approvals[channel] ? 'Approved' : 'To review'}</em>
            <button type="button" className="ghost-link" onClick={() => goToStage(stageFor[channel])}>Review</button>
          </div>
        ))}
      </div>

      {(campaign.status === 'Draft' || campaign.status === 'Needs approval' || campaign.status === 'Approved') && (
        <div className="send-options">
          <h3>How should this go out?</h3>
          {options.map(({ value, title, detail, icon: Icon }) => (
            <label key={value} className={`send-option ${mode === value ? 'selected' : ''} ${availability[value] ? 'unavailable' : ''}`}>
              <input type="radio" name="send-mode" checked={mode === value} onChange={() => setMode(value)} />
              <Icon size={17} />
              <span>
                <strong>{title}</strong>
                {availability[value] ?? detail}
              </span>
            </label>
          ))}
          {mode === 'schedule' && (
            <label className="schedule-input">
              <span>Send date and time</span>
              <input type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} />
            </label>
          )}
          <button type="button" className="primary-button" onClick={run} disabled={Boolean(availability[mode])}>
            {mode === 'approval' ? 'Send for approval' : mode === 'schedule' ? 'Schedule campaign' : 'Publish now'}
          </button>
        </div>
      )}

      {campaign.status === 'Scheduled' && (
        <div className="send-options">
          <h3>Scheduled</h3>
          <p>{campaign.name} goes out {campaign.scheduledFor ? formatDateTime(campaign.scheduledFor) : 'soon'}.</p>
          <div className="stage-actions">
            <button type="button" className="secondary-button" onClick={() => onChange({ ...campaign, status: 'Approved', scheduledFor: null })}>
              Unschedule
            </button>
            {isManager && (
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  onChange(publishNow(campaign))
                  onActivity('Campaign live', `${campaign.name} is live.`, 'success')
                }}
              >
                Go live now
              </button>
            )}
          </div>
        </div>
      )}

      {campaign.status === 'Live' && (
        <div className="send-options">
          <h3>Live</h3>
          <p>Live since {campaign.timeline.Live ? formatDateTime(campaign.timeline.Live) : 'today'}. Results update as bookings come in.</p>
          <div className="stage-actions">
            <button type="button" className="secondary-button" onClick={() => goToStage('Results')}>View results</button>
            {isManager && (
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  onChange(completeCampaign(campaign))
                  onActivity('Campaign completed', `${campaign.name} finished. Review results and save learnings.`, 'success')
                  goToStage('Results')
                }}
              >
                Mark completed
              </button>
            )}
          </div>
        </div>
      )}

      {campaign.status === 'Completed' && (
        <div className="send-options">
          <h3>Completed</h3>
          <p>This campaign has finished.</p>
          <button type="button" className="primary-button" onClick={() => goToStage('Results')}>See results & next steps</button>
        </div>
      )}
    </div>
  )
}
