import { Bell, CalendarDays, WandSparkles } from 'lucide-react'
import { activeHotel } from '../../config/hotel'
import { usePersistentState } from '../../lib/usePersistentState'
import type { HotelAccount } from '../../types/domain'

const snapshotLabel = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export function Topbar({
  title,
  onCreateCampaign,
  onShowNotifications,
  notificationCount,
}: {
  title: string
  onCreateCampaign: () => void
  onShowNotifications: () => void
  notificationCount: number
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
        <button type="button" className="primary-button" onClick={onCreateCampaign}>
          <WandSparkles size={17} /> Create campaign
        </button>
      </div>
    </header>
  )
}
