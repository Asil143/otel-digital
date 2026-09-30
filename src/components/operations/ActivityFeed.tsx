import { Check, Clock3, Info } from 'lucide-react'
import { useState } from 'react'
import { timeAgo, useActivityLog } from '../../lib/activityLog'
import { useCurrentUser } from '../../lib/currentUser'

const toneIcon = {
  success: Check,
  warning: Clock3,
  info: Info,
}

const PAGE = 6

export function ActivityFeed({ area }: { area?: string }) {
  const { events: allEvents, clear } = useActivityLog()
  const { isHotelManager, areaName } = useCurrentUser()
  const [showAll, setShowAll] = useState(false)
  const [scope, setScope] = useState<'area' | 'all'>(area ? 'area' : 'all')

  const events = isHotelManager ? allEvents : allEvents.filter((event) => event.area === areaName)
  const scoped = isHotelManager && scope === 'area' && area ? events.filter((event) => !event.area || event.area === area) : events
  const visible = showAll ? scoped : scoped.slice(0, PAGE)

  return (
    <section className="panel activity-feed">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">What happened</p>
          <h2>Recent activity</h2>
        </div>
        {isHotelManager && events.length > 0 && (
          <button type="button" className="small-action" onClick={clear}>Clear</button>
        )}
      </div>

      {area && isHotelManager && (
        <div className="segmented activity-scope" role="group" aria-label="Activity scope">
          <button type="button" className={scope === 'area' ? 'selected' : ''} onClick={() => setScope('area')}>{area}</button>
          <button type="button" className={scope === 'all' ? 'selected' : ''} onClick={() => setScope('all')}>Whole hotel</button>
        </div>
      )}

      {visible.length === 0 && (
        <p className="muted small activity-empty">
          Nothing yet. Updates, approvals, offers, dates and imports you make anywhere in the app appear here.
        </p>
      )}

      {visible.map((event) => {
        const Icon = toneIcon[event.tone]
        return (
          <article className={event.tone} key={event.id}>
            <Icon size={17} />
            <div>
              <strong>{event.title}</strong>
              <span>{event.detail}</span>
              <small>
                {[event.area, timeAgo(event.at)].filter(Boolean).join(' · ')}
              </small>
            </div>
          </article>
        )
      })}

      {scoped.length > PAGE && (
        <button type="button" className="ghost-link" onClick={() => setShowAll((current) => !current)}>
          {showAll ? 'Show less' : `Show all ${scoped.length}`}
        </button>
      )}
    </section>
  )
}
