import { MessageCircle, Send, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { routes, type AppRoute } from '../../config/routes'
import { timeAgo } from '../../lib/activityLog'
import { readStored, writeStored } from '../../lib/usePersistentState'

type ChatMessage = { id: string; name: string; text: string; page: string | null; at: string }

const NAME_KEY = 'otel:chat-name'
const SEEN_KEY = 'otel:chat-seen'
const MAX_TEXT = 1000

/**
 * Shared feedback chat for reviewers of this link: everyone who opens it sees the same messages.
 * Hidden entirely when the chat server isn't connected (e.g. no storage yet).
 */
export function FeedbackChat({ activeRoute }: { activeRoute: AppRoute }) {
  const [available, setAvailable] = useState<boolean | null>(null)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [name, setName] = useState(() => readStored<string>(NAME_KEY, ''))
  const [nameDraft, setNameDraft] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [seen, setSeen] = useState(() => readStored<string>(SEEN_KEY, ''))
  const listRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const response = await fetch('/api/chat', { cache: 'no-store' })
        if (!response.ok) throw new Error(String(response.status))
        const data = (await response.json()) as { messages?: ChatMessage[] }
        if (cancelled) return
        setMessages(Array.isArray(data.messages) ? data.messages : [])
        setAvailable(true)
      } catch {
        if (!cancelled) setAvailable((current) => (current === true ? true : false))
      }
    }
    void load()
    const timer = window.setInterval(load, open ? 3000 : 20000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [open])

  const latest = messages[messages.length - 1]?.at ?? ''
  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [open, latest])

  function markSeen() {
    if (!latest) return
    setSeen(latest)
    writeStored(SEEN_KEY, latest)
  }

  if (!available) return null

  // Everything counts as read while the chat is open.
  const unread = open ? 0 : messages.filter((message) => message.at > seen && message.name !== name).length
  const pageLabel = (page: string | null) => routes.find((route) => route.id === page)?.label

  async function send(event?: FormEvent) {
    event?.preventDefault()
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    setError(null)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, text, page: activeRoute }),
      })
      const data = (await response.json().catch(() => ({}))) as { message?: ChatMessage; error?: string }
      if (!response.ok || !data.message) throw new Error(data.error || 'Message not sent — try again')
      setMessages((current) => [...current, data.message as ChatMessage])
      setDraft('')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Message not sent — try again')
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void send()
    }
  }

  function saveName(event: FormEvent) {
    event.preventDefault()
    const value = nameDraft.trim().replace(/\s+/g, ' ').slice(0, 40)
    if (!value) return
    setName(value)
    writeStored(NAME_KEY, value)
  }

  return (
    <>
      {!open && (
        <button type="button" className="chat-launcher" onClick={() => {
            markSeen()
            setOpen(true)
          }} aria-label={unread ? `Feedback chat, ${unread} new` : 'Feedback chat'}>
          <MessageCircle size={18} /> Feedback
          {unread > 0 && <span className="chat-unread">{unread}</span>}
        </button>
      )}
      {open && (
        <section className="chat-panel" aria-label="Feedback chat">
          <header className="chat-head">
            <span>
              <strong>Feedback chat</strong>
              <small>Everyone with this link sees these messages.</small>
            </span>
            <button
              type="button"
              className="icon-button"
              onClick={() => {
                markSeen()
                setOpen(false)
              }}
              aria-label="Close chat"
            >
              <X size={16} />
            </button>
          </header>

          <ol className="chat-list" ref={listRef} aria-live="polite">
            {messages.length === 0 && <li className="chat-empty">No messages yet. Share what you think of this version.</li>}
            {messages.map((message) => (
              <li key={message.id} className={message.name === name ? 'mine' : ''}>
                <span className="chat-meta">
                  <strong>{message.name === name ? 'You' : message.name}</strong>
                  {pageLabel(message.page) && <em>{pageLabel(message.page)}</em>}
                  <small title={new Date(message.at).toLocaleString('en-GB')}>{timeAgo(message.at)}</small>
                </span>
                <p>{message.text}</p>
              </li>
            ))}
          </ol>

          {name ? (
            <form className="chat-compose" onSubmit={send}>
              <textarea
                value={draft}
                maxLength={MAX_TEXT}
                placeholder={`Message as ${name} — Enter to send`}
                aria-label="Message"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onKeyDown}
              />
              <div className="chat-compose-foot">
                <button type="button" className="ghost-link" onClick={() => setName('')}>
                  Not {name}?
                </button>
                <span className="muted small">{draft.length}/{MAX_TEXT}</span>
                <button type="submit" className="primary-button small" disabled={!draft.trim() || sending}>
                  <Send size={13} /> {sending ? 'Sending…' : 'Send'}
                </button>
              </div>
              {error && (
                <p className="chat-error" role="alert">
                  {error}
                </p>
              )}
            </form>
          ) : (
            <form className="chat-name" onSubmit={saveName}>
              <label>
                <span>Your name, so people know who’s talking</span>
                <input value={nameDraft} maxLength={40} onChange={(event) => setNameDraft(event.target.value)} placeholder="e.g. Sarah from Sales" autoFocus />
              </label>
              <button type="submit" className="primary-button small" disabled={!nameDraft.trim()}>
                Start chatting
              </button>
            </form>
          )}
        </section>
      )}
    </>
  )
}
