export type ActivityEvent = {
  id: string
  title: string
  detail: string
  tone: 'success' | 'warning' | 'info'
  at?: string
  area?: string
}
