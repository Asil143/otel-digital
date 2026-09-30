import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import { campaignTypes, defaultCampaignInput, type CampaignInput } from '../../services/campaigns'
import type { CampaignChannel, Department, DepartmentKey, Offer } from '../../types/domain'

const channelOptions: { value: CampaignChannel; label: string }[] = [
  { value: 'Email', label: 'Email' },
  { value: 'Social', label: 'Social media' },
  { value: 'Website', label: 'Website' },
]

const CUSTOM_OFFER = '__custom__'

export function CreateCampaignForm({
  departments,
  initialDepartmentKey,
  offers,
  initialInput,
  mode,
  preset,
  onSubmit,
  onCancel,
}: {
  departments: Department[]
  initialDepartmentKey: DepartmentKey
  offers: Offer[]
  initialInput?: CampaignInput
  mode: 'create' | 'edit'
  preset?: { title: string; detail: string }
  onSubmit: (departmentKey: DepartmentKey, input: CampaignInput) => void
  onCancel: () => void
}) {
  const [departmentKey, setDepartmentKey] = useState<DepartmentKey>(initialDepartmentKey)
  const department = departments.find((item) => item.key === departmentKey) ?? departments[0]
  const [input, setInput] = useState<CampaignInput>(() => initialInput ?? defaultCampaignInput(department, offers))
  const [errors, setErrors] = useState<string[]>([])

  const departmentOffers = offers.filter((offer) => offer.departmentKey === departmentKey && offer.status !== 'Archived')
  const selectedOffer = offers.find((offer) => offer.id === input.offerId) ?? null
  const eligible = (channel: CampaignChannel) => !selectedOffer?.channels || selectedOffer.channels.includes(channel)

  function update<K extends keyof CampaignInput>(key: K, value: CampaignInput[K]) {
    setInput((current) => ({ ...current, [key]: value }))
  }

  function changeDepartment(key: DepartmentKey) {
    const next = departments.find((item) => item.key === key)
    if (!next) return
    setDepartmentKey(key)
    setInput(defaultCampaignInput(next, offers))
  }

  function toggleIn<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
  }

  function handleOfferChange(offerId: string) {
    if (offerId === CUSTOM_OFFER) {
      setInput((current) => ({ ...current, offerId: null, offer: '', offerTerms: undefined }))
      return
    }
    const offer = offers.find((item) => item.id === offerId)
    if (!offer) return
    setInput((current) => {
      const allowed = current.channels.filter((channel) => !offer.channels || offer.channels.includes(channel))
      return {
        ...current,
        offerId: offer.id,
        offer: offer.name,
        offerTerms: offer.terms,
        startDate: offer.startDate,
        endDate: offer.endDate,
        channels: allowed.length ? allowed : offer.channels ?? current.channels,
      }
    })
  }

  function handleSubmit() {
    const problems: string[] = []
    if (!input.name.trim()) problems.push('Give the campaign a name.')
    if (!input.offer.trim()) problems.push('Choose an offer or write the campaign message.')
    if (input.audience.length === 0) problems.push('Pick at least one audience.')
    if (input.channels.length === 0) problems.push('Select at least one channel.')
    if (!input.startDate || !input.endDate) problems.push('Set start and end dates.')
    else if (input.endDate < input.startDate) problems.push('End date must be after the start date.')
    setErrors(problems)
    if (problems.length === 0) onSubmit(departmentKey, { ...input, name: input.name.trim(), offer: input.offer.trim() })
  }

  return (
    <div className="campaign-form">
      {mode === 'create' && (
        <div className="ai-suggestion-banner">
          <Sparkles size={16} />
          <div>
            {preset ? (
              <>
                <strong>{preset.title}</strong>
                <span>{preset.detail}</span>
              </>
            ) : (
              <>
                <strong>AI suggestion: {department.recommendation.title}</strong>
                <span>Fields are pre-filled from the recommendation. Change anything before creating.</span>
              </>
            )}
          </div>
          <button type="button" onClick={() => setInput(defaultCampaignInput(department, offers))}>Reset</button>
        </div>
      )}

      <div className="form-grid">
        <label>
          <span>Campaign name</span>
          <input value={input.name} onChange={(event) => update('name', event.target.value)} />
        </label>
        <label>
          <span>Campaign type</span>
          <select value={input.type} onChange={(event) => update('type', event.target.value)}>
            {campaignTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Business area</span>
          <select value={departmentKey} onChange={(event) => changeDepartment(event.target.value as DepartmentKey)} disabled={mode === 'edit'}>
            {departments.map((item) => (
              <option key={item.key} value={item.key}>{item.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Objective</span>
          <input value={input.objective} onChange={(event) => update('objective', event.target.value)} />
        </label>
        <label className={input.offerId === null ? '' : 'span-full'}>
          <span>Offer to promote</span>
          <select value={input.offerId ?? CUSTOM_OFFER} onChange={(event) => handleOfferChange(event.target.value)}>
            {departmentOffers.map((offer) => (
              <option key={offer.id} value={offer.id}>{offer.name} ({offer.status})</option>
            ))}
            <option value={CUSTOM_OFFER}>Custom message</option>
          </select>
        </label>
        {selectedOffer?.terms && (
          <p className="offer-terms-hint span-full">
            <strong>Terms:</strong> {selectedOffer.terms}
            {selectedOffer.channels && ` · Eligible channels: ${selectedOffer.channels.join(', ')}`}
          </p>
        )}
        {input.offerId === null && (
          <label>
            <span>Offer / message</span>
            <input value={input.offer} onChange={(event) => update('offer', event.target.value)} placeholder="What should guests hear about?" />
          </label>
        )}
        <label className="span-full">
          <span>Goal</span>
          <input value={input.goal} onChange={(event) => update('goal', event.target.value)} />
        </label>
        <label>
          <span>Start date</span>
          <input type="date" value={input.startDate} onChange={(event) => update('startDate', event.target.value)} />
        </label>
        <label>
          <span>End date</span>
          <input type="date" value={input.endDate} onChange={(event) => update('endDate', event.target.value)} />
        </label>
      </div>

      <fieldset className="chip-fieldset">
        <legend>Target audience</legend>
        {department.audience.map((segment) => (
          <label key={segment} className={`choice-chip ${input.audience.includes(segment) ? 'selected' : ''}`}>
            <input type="checkbox" checked={input.audience.includes(segment)} onChange={() => update('audience', toggleIn(input.audience, segment))} />
            {segment}
          </label>
        ))}
      </fieldset>

      <fieldset className="chip-fieldset">
        <legend>Channels</legend>
        {channelOptions.map(({ value, label }) => (
          <label
            key={value}
            className={`choice-chip ${input.channels.includes(value) ? 'selected' : ''} ${eligible(value) ? '' : 'disabled'}`}
            title={eligible(value) ? undefined : 'Not eligible for this offer'}
          >
            <input type="checkbox" disabled={!eligible(value)} checked={input.channels.includes(value)} onChange={() => update('channels', toggleIn(input.channels, value))} />
            {label}
          </label>
        ))}
        <label className="choice-chip disabled" title="Paid media is planned for a later phase">
          <input type="checkbox" disabled />
          Paid ads · Coming soon
        </label>
      </fieldset>

      {errors.length > 0 && (
        <ul className="form-errors" role="alert">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      <div className="form-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
        <button type="button" className="primary-button" onClick={handleSubmit}>
          {mode === 'create' ? 'Create campaign' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}
