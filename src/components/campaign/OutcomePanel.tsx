import { CheckSquare, Plus, Square } from 'lucide-react'
import { usePersistentState } from '../../lib/usePersistentState'
import type { ActivityEvent } from '../../types/activity'
import type { Department, RecommendationOutcome } from '../../types/domain'

const plans: Record<Exclude<RecommendationOutcome, 'Campaign'>, { heading: string; handoff: string; handoffDone: string; steps: string[] }> = {
  'Monitor only': {
    heading: 'No campaign recommended right now',
    handoff: 'Start 30-second check-in',
    handoffDone: 'Check-in opened',
    steps: ['Refresh current demand with a quick check-in', 'Confirm any figures the AI detected', 'Review again when fresh data arrives'],
  },
  'Revenue review': {
    heading: 'This is a pricing question, not a marketing one',
    handoff: 'Share with revenue manager',
    handoffDone: 'Shared with revenue manager',
    steps: ['Review peak-day pricing against demand', 'Agree whether to add a premium tier', 'Revisit marketing once pricing is settled'],
  },
  'OTA/distribution review': {
    heading: 'Review distribution before adding marketing spend',
    handoff: 'Share with distribution lead',
    handoffDone: 'Shared with distribution lead',
    steps: ['Check OTA share trend for the last 8 weeks', 'Confirm rate parity across channels', 'Promote direct-booking benefits on your own site'],
  },
  'Corporate action': {
    heading: 'Route this to the sales team',
    handoff: 'Hand off to sales',
    handoffDone: 'Handed off to sales',
    steps: ['List past corporate bookers for outreach', 'Chase overdue pipeline follow-ups', 'Share a midweek package with key accounts'],
  },
}

export function OutcomePanel({
  department,
  outcome,
  onActivity,
  onCreateAnyway,
  onStartCheckIn,
}: {
  department: Department
  outcome: RecommendationOutcome
  onActivity: (event: ActivityEvent) => void
  onCreateAnyway: () => void
  onStartCheckIn: () => void
}) {
  const [doneSteps, setDoneSteps] = usePersistentState<string[]>(`otel:${department.key}:outcome-steps`, [])

  if (outcome === 'Campaign') {
    return (
      <section className="panel outcome-panel">
        <p className="eyebrow">Universal campaign engine</p>
        <h2>No campaign yet for {department.name}</h2>
        <p className="muted">Create one from the recommendation and the engine will prepare socials, designs, email and website content.</p>
        <button type="button" className="primary-button" onClick={onCreateAnyway}>
          <Plus size={15} /> Create campaign
        </button>
      </section>
    )
  }

  const plan = plans[outcome]

  function handoff() {
    if (outcome === 'Monitor only') {
      onStartCheckIn()
      return
    }
    onActivity({ id: crypto.randomUUID(), title: plan.handoffDone, detail: `${department.name}: ${department.recommendation.title}.`, tone: 'success' })
  }

  return (
    <section className="panel outcome-panel" id="campaign-engine">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">AI outcome · {outcome}</p>
          <h2>{plan.heading}</h2>
        </div>
      </div>
      <p className="muted">
        The AI decided a campaign isn't the right move for {department.name} yet: {department.recommendation.summary}
      </p>
      <div className="outcome-steps">
        {plan.steps.map((step) => {
          const done = doneSteps.includes(step)
          return (
            <button
              type="button"
              key={step}
              className={done ? 'done' : ''}
              onClick={() => setDoneSteps((current) => (done ? current.filter((item) => item !== step) : [...current, step]))}
            >
              {done ? <CheckSquare size={16} /> : <Square size={16} />} {step}
            </button>
          )
        })}
      </div>
      <div className="stage-actions">
        <button type="button" className="primary-button" onClick={handoff}>{plan.handoff}</button>
        <button type="button" className="secondary-button" onClick={onCreateAnyway}>
          <Plus size={15} /> Create a campaign anyway
        </button>
      </div>
    </section>
  )
}
