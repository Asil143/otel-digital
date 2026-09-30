import { Hotel } from 'lucide-react'
import type { ReactNode } from 'react'
import { UserSwitcher } from '../components/ui/UserSwitcher'
import { type AppRoute, hiddenFromNav, routes } from '../config/routes'

export function AppLayout({
  activeRoute,
  children,
  onRouteChange,
}: {
  activeRoute: AppRoute
  children: ReactNode
  onRouteChange: (route: AppRoute) => void
}) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Hotel size={22} />
          </div>
          <div>
            <strong>Otel Digital</strong>
            <span>AI marketing OS</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Primary navigation">
          {routes.filter(({ id }) => !hiddenFromNav.includes(id)).map(({ id, label, path, icon: Icon }) => (
            <button
              className={id === activeRoute ? 'active' : ''}
              type="button"
              key={id}
              aria-current={id === activeRoute ? 'page' : undefined}
              data-path={path}
              onClick={() => onRouteChange(id)}
            >
              <Icon size={17} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <UserSwitcher />
        </div>
      </aside>

      <div className="app-main">
        {children}
        <footer className="app-footer">
          <span>Hotel marketing workspace. Otel Digital.</span>
          <span className="demo-chip">Demo data · changes saved on this device</span>
        </footer>
      </div>
    </div>
  )
}
