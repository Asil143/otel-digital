import { Activity, ArrowRight, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { formatCount, formatMoney, mergeDaily, resultUnit, sumTotals, type CampaignResults } from '../../lib/results'
import { generateNextRecommendation, type NextRecommendation } from '../../services/aiMarketing'
import type { Department } from '../../types/domain'
import { ResultsChart } from './ResultsChart'

export function ResultsPanel({
  department,
  results,
  onOpenResults,
}: {
  department: Department
  results: CampaignResults[]
  onOpenResults: () => void
}) {
  const [insight, setInsight] = useState<(NextRecommendation & { live: boolean; key: string }) | null>(null)
  const [loading, setLoading] = useState(false)

  const measured = results.filter((result) => result.state !== 'projection')
  const pending = results.filter((result) => result.state === 'projection')
  const unit = resultUnit(department)
  const totals = sumTotals(measured.map((result) => result.shown))
  const projectedEnd = sumTotals(measured.map((result) => result.projected))
  const emailResults = measured.filter((result) => result.campaign.channels.includes('Email'))
  const openRate = emailResults.length ? emailResults.reduce((sum, result) => sum + result.openRate, 0) / emailResults.length : null
  const allChannels = measured.flatMap((result) => result.channels)
  const bestChannel = ['Email', 'Social', 'Website']
    .map((channel) => ({ channel, bookings: allChannels.filter((item) => item.channel === channel).reduce((sum, item) => sum + item.bookings, 0) }))
    .sort((a, b) => b.bookings - a.bookings)[0]
  const anyLive = measured.some((result) => result.state === 'live')
  const shownInsight = insight?.key === department.key ? insight : null

  async function refreshInsight() {
    const lead = measured[0]
    if (!lead) return
    setLoading(true)
    const result = await generateNextRecommendation(department, {
      campaignName: lead.campaign.name,
      status: lead.campaign.status,
      unit,
      bookings: totals.bookings,
      revenue: totals.revenue,
      openRate,
      bestChannel: bestChannel && bestChannel.bookings > 0 ? bestChannel.channel : null,
      audience: lead.campaign.audience,
    })
    setInsight({ ...result, key: department.key })
    setLoading(false)
  }

  return (
    <section className="panel results-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">What happened</p>
          <h2>Results so far</h2>
        </div>
        <Activity size={22} />
      </div>

      {measured.length === 0 ? (
        <div className="results-empty">
          <p>Nothing has gone live in {department.name} yet, so there are no results to show.</p>
          {pending.length > 0 ? (
            <p className="muted small">
              {pending[0].campaign.name} is <strong>{pending[0].campaign.status.toLowerCase()}</strong>. If it launches as planned, the projection is about{' '}
              {formatCount(pending[0].projected.bookings)} {unit} and {formatMoney(pending[0].projected.revenue)}.
            </p>
          ) : (
            <p className="muted small">The AI recommended "{department.recommendation.outcome}" here rather than a campaign.</p>
          )}
          {pending.length > 0 && (
            <button type="button" className="secondary-button" onClick={onOpenResults}>
              See the projection <ArrowRight size={15} />
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="results-summary-tiles">
            <div>
              <span>{unit}</span>
              <strong>{formatCount(totals.bookings)}</strong>
              <em>{anyLive ? `on track for ${formatCount(projectedEnd.bookings)}` : 'final'}</em>
            </div>
            <div>
              <span>Revenue</span>
              <strong>{formatMoney(totals.revenue)}</strong>
              <em>{anyLive ? 'so far' : 'final'}</em>
            </div>
            <div>
              <span>Open rate</span>
              <strong>{openRate !== null ? `${Math.round(openRate * 100)}%` : '—'}</strong>
              <em>email</em>
            </div>
          </div>

          <ResultsChart daily={mergeDaily(measured)} unit={unit} />

          <ul className="results-campaign-list">
            {measured.map((result) => (
              <li key={result.campaign.id}>
                <span className={`campaign-status-chip status-${result.campaign.status.toLowerCase()}`}>{result.campaign.status}</span>
                <strong>{result.campaign.name}</strong>
                <em>
                  {result.state === 'live' ? `Day ${result.dayCount} of ${result.totalDays}` : `${result.totalDays} days`} · {formatCount(result.shown.bookings)} {unit}
                </em>
              </li>
            ))}
          </ul>

          {shownInsight && (
            <div className="learning-note next-rec">
              <Sparkles size={17} />
              <span>
                <strong>{shownInsight.whatWorked}</strong> Next: {shownInsight.nextRecommendation}
              </span>
            </div>
          )}

          <div className="results-panel-actions">
            <button type="button" className="secondary-button" onClick={refreshInsight} disabled={loading}>
              <Sparkles size={16} /> {loading ? 'Analysing...' : 'Next recommendation'}
            </button>
            <button type="button" className="ghost-link" onClick={onOpenResults}>
              Full results <ArrowRight size={14} />
            </button>
          </div>
        </>
      )}
    </section>
  )
}
