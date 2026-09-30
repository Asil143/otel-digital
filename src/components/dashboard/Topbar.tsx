import { Bell, CalendarDays, WandSparkles } from 'lucide-react'
import { activeHotel } from '../../config/hotel'
import { usePersistentState } from '../../lib/usePersistentState'
import { departments } from '../../data/departments'
import type { DepartmentKey, HotelAccount, UserRole } from '../../types/domain'

const roles: UserRole[] = ['Department manager', 'Hotel manager', 'Admin']
const snapshotLabel = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export function Topbar({
  title,
  currentRole,
  departmentScope,
  onCreateCampaign,
  onShowNotifications,
  notificationCount,
  onRoleChange,
  onScopeChange,
}: {
  title: string
  currentRole: UserRole
  departmentScope: DepartmentKey
  onCreateCampaign: () => void
  onShowNotifications: () => void
  notificationCount: number
  onRoleChange: (role: UserRole) => void
  onScopeChange: (department: DepartmentKey) => void
}) {
  const [hotel] = usePersistentState<HotelAccount>('otel:hotel-account', activeHotel)

  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">{hotel.name} <span className="demo-chip">Demo workspace · no live feed</span></p>
        <h1>{title}</h1>
      </div>
      <div className="topbar-actions">
        <button type="button" className="icon-button notification-button" aria-label={`Notifications (${notificationCount})`} onClick={onShowNotifications}>
          <Bell size={18} />
          {notificationCount > 0 && <span className="notification-count">{notificationCount}</span>}
        </button>
        <span className="snapshot-chip">
          <CalendarDays size={15} /> Snapshot: {snapshotLabel}
        </span>
        <label className="role-switcher">
          <span>Role</span>
          <select value={currentRole} onChange={(event) => onRoleChange(event.target.value as UserRole)}>
            {roles.map((role) => (
              <option value={role} key={role}>{role}</option>
            ))}
          </select>
        </label>
        {currentRole === 'Department manager' && (
          <label className="role-switcher">
            <span>Scope</span>
            <select value={departmentScope} onChange={(event) => onScopeChange(event.target.value as DepartmentKey)}>
              {departments.map((department) => (
                <option value={department.key} key={department.key}>{department.name}</option>
              ))}
            </select>
          </label>
        )}
        <button type="button" className="primary-button" onClick={onCreateCampaign}>
          <WandSparkles size={17} /> Create campaign
        </button>
      </div>
    </header>
  )
}
