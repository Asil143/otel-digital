import { useEffect, useState } from 'react'
import { type AppRoute, pathForRoute, routeFromPath } from './config/routes'
import { AppLayout } from './layout/AppLayout'
import { usePersistentState } from './lib/usePersistentState'
import { DemoControlPage } from './pages/DemoControlPage'
import { DepartmentDashboard } from './pages/DepartmentDashboard'
import { WorkspacePage } from './pages/WorkspacePage'
import './App.css'

function App() {
  const [lastRoute, setLastRoute] = usePersistentState<AppRoute>('otel:last-route', 'departments')
  const [activeRoute, setActiveRoute] = useState<AppRoute>(() => routeFromPath(window.location.pathname) || lastRoute)

  useEffect(() => {
    function handlePopState() {
      const route = routeFromPath(window.location.pathname)
      setActiveRoute(route)
      setLastRoute(route)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [setLastRoute])

  function handleRouteChange(route: AppRoute) {
    const nextPath = pathForRoute(route)
    setActiveRoute(route)
    setLastRoute(route)

    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, '', nextPath)
    }
  }

  return (
    <AppLayout activeRoute={activeRoute} onRouteChange={handleRouteChange}>
      {activeRoute === 'demo' && <DemoControlPage />}
      {activeRoute === 'departments' && <DepartmentDashboard />}
      {activeRoute !== 'demo' && activeRoute !== 'departments' && <WorkspacePage route={activeRoute} onNavigate={handleRouteChange} />}
    </AppLayout>
  )
}

export default App
