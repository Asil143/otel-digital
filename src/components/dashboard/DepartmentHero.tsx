import { ArrowRight, Upload } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { Department } from '../../types/domain'

export function DepartmentHero({
  department,
  onShowRecommendation,
  onShowUpdate,
}: {
  department: Department
  onShowRecommendation: () => void
  onShowUpdate: () => void
}) {
  return (
    <section className="hero-band" style={{ '--dept-accent': department.accent } as CSSProperties}>
      <div className="hero-copy">
        <p className="eyebrow">{department.name} · managed by {department.manager}</p>
        <h2>{department.headline}</h2>
        <p>{department.subline}</p>
        <div className="hero-actions">
          <button type="button" className="primary-button" onClick={onShowRecommendation}>
            View recommendation <ArrowRight size={17} />
          </button>
          <button type="button" className="secondary-button" onClick={onShowUpdate}>
            <Upload size={17} /> Update my AI
          </button>
        </div>
      </div>
      <div className="hero-image-wrap">
        <span className="priority-pill">Today's focus</span>
        <img src={department.image} alt={`${department.name} campaign context`} />
      </div>
    </section>
  )
}
