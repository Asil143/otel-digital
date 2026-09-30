import { Check, Clock3, Info } from 'lucide-react'
import type { ActivityEvent } from '../../types/activity'

const toneIcon = {
  success: Check,
  warning: Clock3,
  info: Info,
}

export function ActivityFeed({ events, onClear }: { events: ActivityEvent[]; onClear: () => void }) {
  return (
    <section className="panel activity-feed">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">What happened</p>
          <h2>Recent activity</h2>
        </div>
        <button type="button" className="small-action" onClick={onClear}>Clear</button>
      </div>
      {events.map((event) => {
        const Icon = toneIcon[event.tone]

        return (
          <article className={event.tone} key={event.id}>
            <Icon size={17} />
            <div>
              <strong>{event.title}</strong>
              <span>{event.detail}</span>
            </div>
          </article>
        )
      })}
    </section>
  )
}
