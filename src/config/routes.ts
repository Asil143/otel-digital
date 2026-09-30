import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  Files,
  Layers3,
  Megaphone,
  ShieldCheck,
  Sparkles,
  Tag,
  Users,
} from 'lucide-react'

export const routes = [
  { id: 'demo', path: '/demo', label: 'Demo Control', icon: ClipboardCheck },
  { id: 'brain', path: '/', label: 'Hotel Brain', icon: Sparkles },
  { id: 'departments', path: '/departments', label: 'Departments', icon: Layers3 },
  { id: 'offers', path: '/offers', label: 'Offers', icon: Tag },
  { id: 'campaigns', path: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { id: 'audience', path: '/audience', label: 'Audience', icon: Users },
  { id: 'calendar', path: '/calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'files', path: '/files', label: 'Files & Media', icon: Files },
  { id: 'results', path: '/results', label: 'Results', icon: BarChart3 },
  { id: 'governance', path: '/governance', label: 'Governance', icon: ShieldCheck },
] as const

export type AppRoute = (typeof routes)[number]['id']

// Presenter-only page: reachable at /demo, not shown in the sidebar.
export const hiddenFromNav: AppRoute[] = ['demo']

export function routeFromPath(pathname: string): AppRoute {
  return routes.find((route) => route.path === pathname)?.id ?? 'brain'
}

export function pathForRoute(routeId: AppRoute): string {
  return routes.find((route) => route.id === routeId)?.path ?? '/'
}
