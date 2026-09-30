import { BookmarkPlus, Plus, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { buildInsights, computeResults, formatCount, formatMoney, type Insight } from '../../../lib/results'
import { usePersistentState } from '../../../lib/usePersistentState'
import { seedContacts } from '../../../data/contacts'
import { seedOffers } from '../../../data/offers'
import { generateNextRecommendation, type NextRecommendation } from '../../../services/aiMarketing'
import type { Contact, Learning, Offer } from '../../../types/domain'
import { ResultsChart } from '../../operations/ResultsChart'
import type { StageProps } from './shared'

const actionLabel: Record<NonNullable<Insight['action']>, string> = {
  'add-reminder': 'Add reminder email',
  'add-social': 'Add social to campaign',
  'add-website': 'Add website promo',
  'widen-audience': 'Widen audience',
}

export function ResultsStage({ campaign, department, onChange, onActivity, goToStage }: StageProps) {
  const [learnings, setLearnings] = usePersistentState<Learning[]>('otel:learnings', [])
  const [contacts] = usePersistentState<Contact[]>('otel:audience-contacts', seedContacts)
  const [offers] = usePersistentState<Offer[]>('otel:offers', seedOffers)
  const [next, setNext] = useState<(NextRecommendation & { live: boolean }) | null>(null)
  const [loading, setLoading] = useState(false)

  const results = computeResults(campaign, department, contacts, offers)
  const { shown, projected, state, unit } = results
  const insights = buildInsights(results)
  const savedTexts = new Set(learnings.filter((item) => item.departmentKey === department.key).map((item) => item.text))
  const best = [...results.channels].sort((a, b) => b.bookings - a.bookings)[0]

  const progress = state === 'projection' ? 'projected' : state === 'live' ? 'so far' : 'final'
  const tiles = [
    { label: unit.charAt(0).toUpperCase() + unit.slice(1), value: formatCount(shown.bookings), sub: progress },
    { label: /enquir/.test(unit) ? 'Pipeline value' : 'Revenue', value: formatMoney(shown.revenue), sub: progress },
    { label: 'Email open rate', value: campaign.channels.includes('Email') ? `${Math.round(results.openRate * 100)}%` : '—', sub: 'benchmark 30%' },
    { label: 'Clicks', value: formatCount(shown.clicks), sub: progress },
    { label: 'Website visits', value: formatCount(shown.visits), sub: progress },
    { label: 'Consented audience', value: formatCount(results.eligible), sub: 'contacts reached' },
  ]

  function runAction(action: NonNullable<Insight['action']>) {
    if (action === 'add-reminder') {
      onChange({ ...campaign, email: { ...campaign.email, reminder: true } })
      onActivity('Reminder email added', `${campaign.name} will send a reminder 3 days before the offer ends.`, 'success')
      return
    }
    if (action === 'add-social' || action === 'add-website') {
      const channel = action === 'add-social' ? 'Social' : 'Website'
      onChange({ ...campaign, channels: [...campaign.channels, channel] })
      onActivity(`${channel} added`, `${channel} is now part of ${campaign.name}. Review and approve it before sending.`, 'info')
      goToStage(action === 'add-social' ? 'Socials' : 'Website')
      return
    }
    goToStage('Audience')
  }

  function saveLearning(insight: Insight) {
    setLearnings((current) => [
      { id: crypto.randomUUID(), departmentKey: department.key, campaignName: campaign.name, text: insight.text, kind: insight.kind === 'Worked' ? 'Worked' : 'Avoid', createdAt: new Date().toISOString() },
      ...current,
    ])
    onActivity('Learning saved to Hotel Brain', insight.text, 'success')
  }

  async function askForNext() {
    setLoading(true)
    setNext(
      await generateNextRecommendation(department, {
        campaignName: campaign.name,
        status: campaign.status,
        unit,
        bookings: shown.bookings,
        revenue: shown.revenue,
        openRate: campaign.channels.includes('Email') ? results.openRate : null,
        bestChannel: best?.channel ?? null,
        audience: campaign.audience,
      }),
    )
    setLoading(false)
  }

  return (
    <div className="results-stage">
      <p className={`results-note state-${state}`}>
        {state === 'projection' && (
          <>
            <strong>Projection — not live yet.</strong> If {campaign.name} launches as planned, expect about {formatCount(projected.bookings)} {unit} and{' '}
            {formatMoney(projected.revenue)}. Change the audience or channels and this updates.{' '}
            <button type="button" className="ghost-link" onClick={() => goToStage('Approval')}>Approve & send</button>
          </>
        )}
        {state === 'live' && (
          <>
            <strong>Live — day {results.dayCount} of {results.totalDays}.</strong> On track for about {formatCount(projected.bookings)} {unit} ({formatMoney(projected.revenue)}) by the end date.
          </>
        )}
        {state === 'completed' && (
          <>
            <strong>Completed.</strong> Final results over {results.totalDays} days.
          </>
        )}
      </p>

      <div className="results-tiles">
        {tiles.map((tile) => (
          <div key={tile.label}>
            <span>{tile.label}</span>
            <strong>{tile.value}</strong>
            <em>{tile.sub}</em>
          </div>
        ))}
      </div>

      <ResultsChart daily={results.daily} unit={unit} projection={state === 'projection'} />

      {results.channels.length > 0 && (
        <div className="channel-breakdown">
          <h3>By channel</h3>
          {results.channels.map((channel) => (
            <div key={channel.channel} className="channel-breakdown-row">
              <strong>{channel.channel}</strong>
              <span>{formatCount(channel.reach)} {channel.reachLabel}</span>
              <span>{formatCount(channel.clicks)} clicks</span>
              <span className="channel-bar">
                <i style={{ width: `${shown.bookings ? (channel.bookings / shown.bookings) * 100 : 0}%` }} />
              </span>
              <em>{formatCount(channel.bookings)} {unit}</em>
            </div>
          ))}
        </div>
      )}
      <p className="muted small">Demo model based on your audience, consent rate, channels and offer price. Live attribution needs a connected booking source.</p>

      <div className="insights-list">
        <h3>Key insights</h3>
        {insights.map((insight) => (
          <div key={insight.text} className="insight-row">
            <span className={`insight-kind ${insight.kind.toLowerCase()}`}>{insight.kind}</span>
            <p>{insight.text}</p>
            <span className="insight-actions">
              {insight.action && (
                <button type="button" className="ghost-link" onClick={() => runAction(insight.action!)}>
                  <Plus size={14} /> {actionLabel[insight.action]}
                </button>
              )}
              {insight.kind !== 'Try' && (
                <button type="button" className="ghost-link" disabled={savedTexts.has(insight.text)} onClick={() => saveLearning(insight)}>
                  <BookmarkPlus size={14} /> {savedTexts.has(insight.text) ? 'Saved' : 'Save to Hotel Brain'}
                </button>
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="next-recommendation">
        <h3>Next recommendation</h3>
        {next ? (
          <>
            <p><strong>What worked:</strong> {next.whatWorked}</p>
            <p><strong>Next:</strong> {next.nextRecommendation}</p>
            {!next.live && <p className="muted small">Built from these results; the AI server isn't connected in this demo.</p>}
          </>
        ) : (
          <p className="muted small">Turn these results into the next move for {department.name}.</p>
        )}
        <button type="button" className="secondary-button" onClick={askForNext} disabled={loading}>
          <Sparkles size={15} /> {loading ? 'Analysing results...' : 'Generate next recommendation'}
        </button>
      </div>
    </div>
  )
}
