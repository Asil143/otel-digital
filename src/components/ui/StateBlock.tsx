import { AlertTriangle, Inbox, Loader2 } from 'lucide-react'

export function StateBlock({
  message,
  state,
}: {
  message: string
  state: 'loading' | 'empty' | 'error'
}) {
  const Icon = state === 'loading' ? Loader2 : state === 'empty' ? Inbox : AlertTriangle

  return (
    <div className={`state-block ${state}`}>
      <Icon size={20} />
      <span>{message}</span>
    </div>
  )
}
