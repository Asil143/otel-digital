import { PlugZap } from 'lucide-react'
import { useState } from 'react'
import { integrationChannels } from '../../data/workflows'
import { createPublishJob, type PublishStage } from '../../services/mockApi'
import type { ActivityEvent } from '../../types/activity'
import { StateBlock } from '../ui/StateBlock'

type ChannelState = {
  status: 'idle' | 'running' | 'success' | 'error'
  stage: PublishStage | null
  progress: string
}

const idleState: ChannelState = { status: 'idle', stage: null, progress: '' }

export function ExecutionLayer({ onActivity }: { onActivity: (event: ActivityEvent) => void }) {
  const [channelState, setChannelState] = useState<Record<string, ChannelState>>({})

  async function runChannelAction(title: string, connected: boolean) {
    setChannelState((current) => ({ ...current, [title]: { status: 'running', stage: null, progress: '' } }))

    const result = await createPublishJob(title, connected, (stage, index, total) => {
      setChannelState((current) => ({
        ...current,
        [title]: { status: 'running', stage, progress: `${index + 1}/${total}` },
      }))
    })

    const nextStatus = result.status === 'queued' ? 'success' : 'error'
    setChannelState((current) => ({ ...current, [title]: { status: nextStatus, stage: null, progress: '' } }))

    onActivity({
      id: crypto.randomUUID(),
      title: connected ? `${title} job queued` : `${title} fallback planned`,
      detail: result.message,
      tone: connected ? 'success' : 'warning',
    })
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Execution layer</p>
          <h2>Connected channels</h2>
        </div>
        <PlugZap size={22} />
      </div>
      {integrationChannels.map(({ title, detail, status, icon: Icon }) => {
        const state = channelState[title] ?? idleState
        return (
          <div className="channel-row" key={title}>
            <Icon size={18} />
            <div>
              <strong>{title}</strong>
              <span>{detail}</span>
            </div>
            {status === 'Future' ? (
              <button type="button" disabled title="Planned for a later phase">Coming soon</button>
            ) : (
              <button
                type="button"
                onClick={() => runChannelAction(title, status === 'Connected')}
                disabled={state.status === 'running'}
              >
                {status === 'Connected' ? 'Queue' : 'Plan'}
              </button>
            )}
            {state.status === 'running' && (
              <StateBlock
                state="loading"
                message={state.stage ? `${state.progress} · ${state.stage.label} — ${state.stage.detail}` : 'Starting...'}
              />
            )}
            {state.status === 'success' && <StateBlock state="empty" message="Queued with audit checks." />}
            {state.status === 'error' && <StateBlock state="error" message="Manual fallback required." />}
          </div>
        )
      })}
    </section>
  )
}
