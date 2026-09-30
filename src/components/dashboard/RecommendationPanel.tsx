import { Check, ChevronDown, CircleAlert, DatabaseZap, Lightbulb, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { ageLabel, cappedConfidence, type Freshness } from '../../lib/freshness'
import { generateRecommendation } from '../../services/aiMarketing'
import type { Department, KeyDate, Offer, Recommendation } from '../../types/domain'

export function RecommendationPanel({
  department,
  freshness,
  offers,
  keyDates,
}: {
  department: Department
  freshness: Freshness
  offers: Offer[]
  keyDates: KeyDate[]
}) {
  const [live, setLive] = useState<Record<string, Recommendation>>({})
  const [refreshNote, setRefreshNote] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [showIdeas, setShowIdeas] = useState(false)

  const recommendation = live[department.key] ?? department.recommendation
  const confidence = cappedConfidence(recommendation.confidence, freshness.state)
  const capped = confidence !== recommendation.confidence
  const latest = freshness.latestSignal
  const basedOn = latest && latest.state === 'Confirmed' ? `Manager update ${ageLabel(freshness.ageDays).replace('updated ', '')} + ${department.signal}` : department.signal

  async function refreshWithAi() {
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const { recommendation: result, live: reachedAi } = await generateRecommendation(department, {
      sourceState: freshness.state,
      latestUpdate: latest ? latest.summary : null,
      activeOffers: offers.filter((offer) => offer.departmentKey === department.key && offer.status === 'Active').map((offer) => `${offer.name} (${offer.price})`),
      upcomingDates: keyDates
        .filter((date) => (date.departmentKey === department.key || date.departmentKey === 'all') && date.date >= today)
        .map((date) => `${date.name} on ${date.date}`),
    })
    if (reachedAi) setLive((current) => ({ ...current, [department.key]: result }))
    setRefreshNote((current) => ({
      ...current,
      [department.key]: reachedAi
        ? 'Refreshed live with current offers, key dates and data freshness.'
        : 'The AI server isn\'t connected in this demo, so this is the built-in recommendation.',
    }))
    setLoading(false)
  }

  return (
    <section className="panel ai-panel" id="recommendation">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Recommended for you</p>
          <h2>{recommendation.title}</h2>
        </div>
        <span className={`priority-chip priority-${recommendation.priority.toLowerCase()}`}>{recommendation.priority} priority</span>
      </div>
      <span className={`outcome-badge outcome-${recommendation.outcome.split('/')[0].toLowerCase().replace(/\s+/g, '-')}`}>
        {recommendation.outcome}
      </span>
      <p>{recommendation.summary}</p>
      <p className="recommended-action">
        <strong>Recommended action:</strong> {recommendation.title}.
      </p>
      <div className="reason-grid">
        <div>
          <h3>Why now</h3>
          {recommendation.reasons.map((reason) => (
            <span key={reason}>
              <Check size={15} /> {reason}
            </span>
          ))}
        </div>
        <div>
          <h3>What not to do</h3>
          {recommendation.avoid.map((reason) => (
            <span key={reason}>
              <CircleAlert size={15} /> {reason}
            </span>
          ))}
        </div>
      </div>
      <div className="source-strip">
        <DatabaseZap size={18} />
        <span>
          <strong>Based on:</strong> {basedOn}. <strong>Confidence:</strong> {confidence}.
          <span className={`freshness-chip freshness-${freshness.state.toLowerCase()}`}>
            {freshness.state} · {ageLabel(freshness.ageDays)}
          </span>
        </span>
      </div>
      {capped && (
        <p className="confidence-note">
          Confidence limited from {recommendation.confidence} because the latest {department.name} data is {freshness.state.toLowerCase()}. Confirm or refresh it in Update My AI.
        </p>
      )}

      <button type="button" className="ideas-toggle" onClick={() => setShowIdeas((current) => !current)} aria-expanded={showIdeas}>
        <Lightbulb size={15} /> See other ideas <ChevronDown size={15} className={showIdeas ? 'rotated' : ''} />
      </button>
      {showIdeas && (
        <ul className="ideas-list">
          {recommendation.alternatives.map((idea) => (
            <li key={idea}>{idea}</li>
          ))}
        </ul>
      )}

      <button type="button" className="secondary-button full-width" onClick={refreshWithAi} disabled={loading}>
        <Sparkles size={16} />
        {loading ? 'Asking the AI decision layer...' : 'Refresh with live AI'}
      </button>
      {refreshNote[department.key] && <p className="ai-source-note">{refreshNote[department.key]}</p>}
    </section>
  )
}
