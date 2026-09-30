import { Check, ChevronsUpDown } from 'lucide-react'
import { useState } from 'react'
import { demoUsers, initials, useCurrentUser } from '../../lib/currentUser'
import { logActivity } from '../../lib/activityLog'
import { Modal } from './Modal'

export function UserSwitcher() {
  const { user, setUserId } = useCurrentUser()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" className="user-switcher" onClick={() => setOpen(true)} aria-label={`Signed in as ${user.name}, ${user.title}. Switch user`}>
        <span className="user-avatar">{initials(user.name)}</span>
        <span className="user-text">
          <strong>{user.name}</strong>
          <span>{user.title}</span>
        </span>
        <ChevronsUpDown size={15} className="user-chevron" />
      </button>

      {open && (
        <Modal title="Switch user" onClose={() => setOpen(false)}>
          <p className="muted small user-picker-note">
            Demo only — there is no login yet. The hotel manager has full access; each department manager sees and edits only their own area.
          </p>
          <div className="user-picker">
            {demoUsers.map((item, index) => (
              <button
                type="button"
                key={item.id}
                className={`${item.id === user.id ? 'current' : ''} ${index === 0 ? 'hotel' : ''}`}
                onClick={() => {
                  if (item.id !== user.id) {
                    setUserId(item.id)
                    logActivity('Switched user', `Now viewing as ${item.name}, ${item.title}.`, 'info')
                  }
                  setOpen(false)
                }}
              >
                <span className="user-avatar">{initials(item.name)}</span>
                <span className="user-text">
                  <strong>{item.name}</strong>
                  <span>{item.title}</span>
                </span>
                {item.id === user.id && <Check size={16} />}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </>
  )
}
