import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { departments } from '../../data/departments'
import { seedOffers } from '../../data/offers'
import { usePersistentState } from '../../lib/usePersistentState'
import { formatDate } from '../../services/campaigns'
import type { DepartmentKey, Offer } from '../../types/domain'

const statuses: Offer['status'][] = ['Active', 'Draft', 'Archived']

function emptyOffer(departmentKey: DepartmentKey): Offer {
  const today = new Date().toISOString().slice(0, 10)
  return { id: '', departmentKey, name: '', price: '', startDate: today, endDate: today, status: 'Draft' }
}

export function OffersWorkspace() {
  const [offers, setOffers] = usePersistentState<Offer[]>('otel:offers', seedOffers)
  const [departmentFilter, setDepartmentFilter] = useState<DepartmentKey | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<Offer['status'] | 'All'>('All')
  const [draft, setDraft] = useState<Offer>(() => emptyOffer('rooms'))
  const [errors, setErrors] = useState<string[]>([])

  const visible = offers
    .filter((offer) => departmentFilter === 'all' || offer.departmentKey === departmentFilter)
    .filter((offer) => statusFilter === 'All' || offer.status === statusFilter)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))

  function save() {
    const problems: string[] = []
    if (!draft.name.trim()) problems.push('Name the offer.')
    if (!draft.price.trim()) problems.push('Add a price or value.')
    if (draft.endDate < draft.startDate) problems.push('End date must be after the start date.')
    setErrors(problems)
    if (problems.length > 0) return
    if (draft.id) {
      setOffers((current) => current.map((offer) => (offer.id === draft.id ? draft : offer)))
    } else {
      setOffers((current) => [...current, { ...draft, id: crypto.randomUUID(), name: draft.name.trim() }])
    }
    setDraft(emptyOffer(draft.departmentKey))
  }

  return (
    <div className="power-grid">
      <section className="panel span-2">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Offers catalogue</p>
            <h2>Offers by business area</h2>
          </div>
        </div>
        <p className="muted small">Active offers feed the AI recommendations and appear in Create campaign.</p>

        <div className="audience-filter-row">
          <select className="filter-select" aria-label="Filter by business area" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value as DepartmentKey | 'all')}>
            <option value="all">All business areas</option>
            {departments.map((department) => (
              <option key={department.key} value={department.key}>{department.name}</option>
            ))}
          </select>
          {(['All', ...statuses] as const).map((status) => (
            <button type="button" key={status} className={statusFilter === status ? 'selected' : ''} onClick={() => setStatusFilter(status)}>
              {status}
            </button>
          ))}
        </div>

        <div className="data-table offers-table">
          <div className="data-table-head">
            <span>Offer</span>
            <span>Business area</span>
            <span>Price</span>
            <span>Dates</span>
            <span>Status</span>
            <span></span>
          </div>
          {visible.map((offer) => (
            <div className="data-table-row" key={offer.id}>
              <strong>{offer.name}</strong>
              <span>{departments.find((department) => department.key === offer.departmentKey)?.name}</span>
              <span>{offer.price}</span>
              <span>{formatDate(offer.startDate)} – {formatDate(offer.endDate)}</span>
              <select
                className={`status-select status-${offer.status.toLowerCase()}`}
                value={offer.status}
                onChange={(event) => setOffers((current) => current.map((item) => (item.id === offer.id ? { ...item, status: event.target.value as Offer['status'] } : item)))}
                aria-label={`Status for ${offer.name}`}
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <span className="row-actions">
                <button type="button" aria-label={`Edit ${offer.name}`} onClick={() => setDraft(offer)}><Pencil size={14} /></button>
                <button type="button" aria-label={`Delete ${offer.name}`} onClick={() => setOffers((current) => current.filter((item) => item.id !== offer.id))}>
                  <Trash2 size={14} />
                </button>
              </span>
            </div>
          ))}
          {visible.length === 0 && <div className="contact-table-empty">No offers match these filters.</div>}
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">{draft.id ? 'Edit offer' : 'New offer'}</p>
        <h2>{draft.id ? draft.name || 'Edit offer' : 'Add an offer'}</h2>
        <div className="stacked-form">
          <label>
            <span>Offer name</span>
            <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Midweek Spa Day" />
          </label>
          <label>
            <span>Business area</span>
            <select value={draft.departmentKey} onChange={(event) => setDraft({ ...draft, departmentKey: event.target.value as DepartmentKey })}>
              {departments.map((department) => (
                <option key={department.key} value={department.key}>{department.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Price or value</span>
            <input value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} placeholder="£79" />
          </label>
          <div className="two-up">
            <label>
              <span>Start</span>
              <input type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} />
            </label>
            <label>
              <span>End</span>
              <input type="date" value={draft.endDate} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} />
            </label>
          </div>
          <label>
            <span>Status</span>
            <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Offer['status'] })}>
              {statuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
          {errors.length > 0 && (
            <ul className="form-errors" role="alert">
              {errors.map((error) => <li key={error}>{error}</li>)}
            </ul>
          )}
          <div className="form-actions">
            {draft.id && <button type="button" className="secondary-button" onClick={() => setDraft(emptyOffer(draft.departmentKey))}>Cancel</button>}
            <button type="button" className="primary-button" onClick={save}>
              <Plus size={15} /> {draft.id ? 'Save offer' : 'Add offer'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
