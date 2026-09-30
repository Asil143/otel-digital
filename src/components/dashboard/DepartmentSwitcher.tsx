import { BedDouble, Flag, Flower2, Heart, Lock, Presentation, Scissors, UtensilsCrossed, Waves, type LucideIcon } from 'lucide-react'
import { departments } from '../../data/departments'
import type { DepartmentKey, SourceState } from '../../types/domain'

const areaIcon: Record<DepartmentKey, LucideIcon> = {
  rooms: BedDouble,
  spa: Flower2,
  restaurant: UtensilsCrossed,
  events: Heart,
  hair_beauty: Scissors,
  golf: Flag,
  meetings: Presentation,
  beach_club: Waves,
}

const shortName: Record<DepartmentKey, string> = {
  rooms: 'Rooms',
  spa: 'Spa',
  restaurant: 'Restaurant',
  events: 'Weddings',
  hair_beauty: 'Hair & Beauty',
  golf: 'Golf',
  meetings: 'Meetings',
  beach_club: 'Beach Club',
}

const dotTone: Record<SourceState, string> = {
  Confirmed: 'fresh',
  Approximate: 'partial',
  Detected: 'partial',
  Stale: 'stale',
  Unavailable: 'stale',
}

export function DepartmentSwitcher({
  activeDept,
  allowedDepartments,
  freshnessByArea,
  onChange,
}: {
  activeDept: DepartmentKey
  allowedDepartments: DepartmentKey[]
  freshnessByArea: Record<DepartmentKey, SourceState>
  onChange: (key: DepartmentKey) => void
}) {
  return (
    <nav className="area-switcher" aria-label="Business areas">
      {departments.map((department) => {
        const Icon = areaIcon[department.key]
        const allowed = allowedDepartments.includes(department.key)
        const state = freshnessByArea[department.key]
        return (
          <button
            type="button"
            key={department.key}
            className={department.key === activeDept ? 'active' : ''}
            disabled={!allowed}
            aria-current={department.key === activeDept ? 'page' : undefined}
            title={allowed ? `${department.name} — data ${state.toLowerCase()}` : `${department.name} is outside your access`}
            onClick={() => onChange(department.key)}
          >
            <Icon size={16} />
            <span>{shortName[department.key]}</span>
            {allowed ? <i className={`area-dot ${dotTone[state]}`} aria-hidden="true" /> : <Lock size={12} />}
          </button>
        )
      })}
    </nav>
  )
}
