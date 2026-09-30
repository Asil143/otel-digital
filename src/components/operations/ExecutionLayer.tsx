import { PlugZap } from 'lucide-react'
import { useState } from 'react'
import { integrationChannels } from '../../data/workflows'
import type { ActivityEvent } from '../../types/activity'
import { StateBlock } from '../ui/StateBlock'

type Check = { status: 'idle' | 'running' | 'done'; step: string; result: string }

const steps: Record<'Demo mode' | 'Manual export', { label: string; result: string }[]> = {
  'Demo mode': [
    { label: 'Checking credentials', result: '' },
    { label: 'No API key configured', result: '' },
    { label: 'Staying in demo mode', result: 'Not connected — approved content is kept ready and sends are simulated.' },
  ],
  'Manual export': [
    { label: 'Checking approved posts', result: '' },
    { label: 'Preparing export', result: 'Export ready — approved posts are published by hand, with an audit entry.' },
  ],
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

/** Integrations are honest about their state: nothing is sent to a real provider in this build. */
export function ExecutionLayer({ onActivity, readOnly = false }: { onActivity: (event: ActivityEvent) => void; readOnly?: boolean }) {
  const [checks, setChecks] = useState<Record<string, Check>>({})

  async function test(title: string, status: 'Demo mode' | 'Manual export') {
    for (const step of steps[status]) {
      setChecks((current) => ({ ...current, [title]: { status: 'running', step: step.label, result: '' } }))
      await wait(380)
    }
    const result = steps[status][steps[status].length - 1].result
    setChecks((current) => ({ ...current, [title]: { status: 'done', step: '', result } }))
    onActivity({ id: crypto.randomUUID(), title: `${title} connection tested`, detail: result, tone: status === 'Demo mode' ? 'warning' : 'info', area: 'Hotel-wide' })
  }

  return (
    <section className="panel integrations-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Execution layer</p>
          <h2>Connected channels</h2>
        </div>
        <PlugZap size={22} />
      </div>
      <p className="muted small">No provider is connected in this build: approved content is prepared and publishing is simulated.</p>
      {integrationChannels.map(({ title, provider, detail, status, icon: Icon }) => {
        const check = checks[title]
        return (
          <div className="channel-row" key={title}>
            <Icon size={18} />
            <div>
              <strong>
                {title} <span className={`integration-status status-${status.toLowerCase().replace(/\s+/g, '-')}`}>{status}</span>
              </strong>
              <span>
                {provider} · {detail}
              </span>
            </div>
            {status === 'Future' ? (
              <button type="button" disabled title="Planned for a later phase">
                Coming soon
              </button>
            ) : readOnly ? (
              <button type="button" disabled title="Integrations are managed by the hotel manager">
                Hotel manager
              </button>
            ) : (
              <button type="button" onClick={() => test(title, status)} disabled={check?.status === 'running'}>
                Test connection
              </button>
            )}
            {check?.status === 'running' && <StateBlock state="loading" message={`${check.step}…`} />}
            {check?.status === 'done' && <StateBlock state={status === 'Demo mode' ? 'error' : 'empty'} message={check.result} />}
          </div>
        )
      })}
    </section>
  )
}
