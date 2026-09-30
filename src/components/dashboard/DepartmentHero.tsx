import { ArrowRight, CircleAlert, CircleCheck, Clock3 } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { Department } from '../../types/domain'

export type HeroFocus = {
  tone: 'action' | 'waiting' | 'good'
  title: string
  detail: string
  actionLabel?: string
  onAction?: () => void
}

const toneIcon = { action: CircleAlert, waiting: Clock3, good: CircleCheck }

export function DepartmentHero({
  department,
  greeting,
  focus,
  onShowRecommendation,
}: {
  department: Department
  greeting: string
  focus: HeroFocus
  onShowRecommendation: () => void
}) {
  const Icon = toneIcon[focus.tone]

  return (
    <section className="hero-band" style={{ '--dept-accent': department.accent } as CSSProperties}>
      <div className="hero-copy">
        <p className="eyebrow">{greeting}</p>
        <h2>{department.headline}</h2>
        <div className={`hero-focus tone-${focus.tone}`}>
          <span className="hero-focus-label">
            <Icon size={15} /> Today's focus
          </span>
          <strong>{focus.title}</strong>
          <p>{focus.detail}</p>
        </div>
        <div className="hero-actions">
          {focus.actionLabel && focus.onAction && (
            <button type="button" className="primary-button" onClick={focus.onAction}>
              {focus.actionLabel} <ArrowRight size={17} />
            </button>
          )}
          <button type="button" className="secondary-button" onClick={onShowRecommendation}>
            View recommendation
          </button>
        </div>
      </div>
      <div className="hero-image-wrap">
        <img src={department.image} alt={`${department.name} campaign context`} />
      </div>
    </section>
  )
}
