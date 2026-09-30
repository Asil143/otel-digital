import { ArrowRight, BookmarkPlus, Download, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { ResultsChart } from '../../components/operations/ResultsChart'
import type { AppRoute } from '../../config/routes'
import { departments } from '../../data/departments'
import { logActivity } from '../../lib/activityLog'
import { useCurrentUser } from '../../lib/currentUser'
import { cappedConfidence, resolveFreshness, ageLabel } from '../../lib/freshness'
import { toCsv } from '../../lib/audience'
import { buildInsights, countUnit, formatMoney, mergeDaily, roundShares, sumTotals, type CampaignResults, type Insight } from '../../lib/results'
import { useSignals } from '../../lib/signalStore'
import { usePersistentState, writeStored } from '../../lib/usePersistentState'
import { useResults } from '../../lib/useResults'
import { formatDate, localDate } from '../../services/campaigns'
import type { CampaignRecord, CampaignStage, DepartmentKey, Learning, Recommendation } from '../../types/domain'

const statusClass = (status: string) => `campaign-status-chip status-${status.toLowerCase().replace(/\s+/g, '-')}`
const percent = (value: number) => `${Math.round(value * 100)}%`

type AreaSummary = {
  key: DepartmentKey
  results: CampaignResults[]
  measured: CampaignResults[]
  bookings: number
  revenue: number
  forecast: number
  bestChannel: string | null
  learnings: number
}

export function ResultsWorkspace({
  onOpenCampaign,
  onNavigate,
}: {
  onOpenCampaign: (campaign: CampaignRecord, stage: CampaignStage) => void
  onNavigate: (route: AppRoute) => void
}) {
  const { results: allResults } = useResults()
  const { canAccess, isHotelManager, allowedAreas } = useCurrentUser()
  const [allLearnings, setLearnings] = usePersistentState<Learning[]>('otel:learnings', [])
  const [signals] = useSignals()
  const [liveRecs] = usePersistentState<Record<string, { recommendation: Recommendation; at: string }>>('otel:live-recommendations', {})
  const [today] = useState(() => localDate())

  const results = allResults.filter((result) => canAccess(result.campaign.departmentKey))
  const learnings = allLearnings.filter((learning) => canAccess(learning.departmentKey))
  const measured = results.filter((result) => result.state !== 'projection')
  const totals = sumTotals(measured.map((result) => result.shown))

  const areas: AreaSummary[] = departments
    .filter((department) => canAccess(department.key))
    .map((department) => {
      const areaResults = results.filter((result) => result.campaign.departmentKey === department.key)
      const areaMeasured = areaResults.filter((result) => result.state !== 'projection')
      const channelBookings = new Map<string, number>()
      for (const item of areaMeasured.flatMap((result) => result.channels)) channelBookings.set(item.channel, (channelBookings.get(item.channel) ?? 0) + item.bookings)
      const best = [...channelBookings.entries()].sort((a, b) => b[1] - a[1])[0]
      return {
        key: department.key,
        results: areaResults,
        measured: areaMeasured,
        bookings: areaMeasured.reduce((sum, result) => sum + result.shown.bookings, 0),
        revenue: areaMeasured.reduce((sum, result) => sum + result.shown.revenue, 0),
        forecast: areaResults.filter((result) => result.state !== 'completed').reduce((sum, result) => sum + result.projected.bookings, 0),
        bestChannel: best && best[1] >= 0.5 ? best[0] : null,
        learnings: learnings.filter((learning) => learning.departmentKey === department.key).length,
      }
    })
    .sort((a, b) => b.revenue - a.revenue || b.forecast - a.forecast)

  const [selectedKey, setSelectedKey] = useState<DepartmentKey>(() => areas.find((area) => area.measured.length)?.key ?? allowedAreas[0])
  const area = areas.find((item) => item.key === selectedKey) ?? areas[0]
  const department = departments.find((item) => item.key === area.key) ?? departments[0]
  const unit = area.results[0]?.unit ?? 'bookings'

  // Insights from everything measured in the area, de-duplicated by text
  const savedTexts = new Set(learnings.filter((learning) => learning.departmentKey === area.key).map((learning) => learning.text))
  const insights = area.measured
    .flatMap((result) => buildInsights(result).map((insight) => ({ insight, result })))
    .filter((entry, index, list) => list.findIndex((other) => other.insight.text === entry.insight.text) === index)
  const unsavedAcrossHotel = measured.flatMap((result) => buildInsights(result).filter((insight) => insight.kind !== 'Try').map((insight) => ({ insight, key: result.campaign.departmentKey })))
    .filter(({ insight, key }) => !learnings.some((learning) => learning.departmentKey === key && learning.text === insight.text)).length

  function save(insight: Insight, result: CampaignResults) {
    setLearnings((current) => [
      { id: crypto.randomUUID(), departmentKey: result.campaign.departmentKey, campaignName: result.campaign.name, text: insight.text, kind: insight.kind === 'Worked' ? 'Worked' : 'Avoid', createdAt: new Date().toISOString() },
      ...current,
    ])
    logActivity('Learning saved to Hotel Brain', insight.text, 'success', department.name)
  }

  // Channel breakdown whose parts add up to the headline number
  const areaTotals = sumTotals(area.measured.map((result) => result.shown))
  const channels = (['Email', 'Social', 'Website'] as const)
    .map((channel) => {
      const items = area.measured.flatMap((result) => result.channels).filter((item) => item.channel === channel)
      return { channel, reach: items.reduce((sum, item) => sum + item.reach, 0), label: items[0]?.reachLabel ?? '', bookings: items.reduce((sum, item) => sum + item.bookings, 0) }
    })
    .filter((item) => item.reach > 0)
  const rounded = roundShares(channels.map((item) => item.bookings), Math.round(areaTotals.bookings))
  const live = area.results.filter((result) => result.state === 'live')
  const pending = area.results.filter((result) => result.state === 'projection')

  const freshness = resolveFreshness(department, signals)
  const recommendation = liveRecs[department.key]?.recommendation ?? department.recommendation
  const confidence = cappedConfidence(recommendation.confidence, freshness.state)

  function openArea() {
    writeStored('otel:active-department', department.key)
    onNavigate('departments')
  }

  function exportCsv() {
    const rows = results.map((result) => [
      result.campaign.name,
      departments.find((item) => item.key === result.campaign.departmentKey)?.name ?? result.campaign.departmentKey,
      result.campaign.status,
      result.campaign.startDate,
      result.campaign.endDate,
      result.state === 'projection' ? 0 : result.dayCount,
      result.totalDays,
      Math.round(result.shown.sends),
      Math.round(result.shown.opens),
      Math.round(result.shown.clicks),
      result.state === 'projection' ? '' : Math.round(result.shown.bookings),
      result.state === 'projection' ? '' : Math.round(result.shown.revenue),
      Math.round(result.projected.bookings),
      Math.round(result.projected.revenue),
      result.unit,
    ])
    const csv = toCsv([['campaign', 'area', 'status', 'start', 'end', 'days_live', 'total_days', 'sends', 'opens', 'clicks', 'results_so_far', 'revenue_so_far', 'projected_results', 'projected_revenue', 'unit'], ...rows])
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `otel-results-${today}.csv`
    link.click()
    URL.revokeObjectURL(url)
    logActivity('Results exported', `${rows.length} campaign${rows.length === 1 ? '' : 's'} downloaded as CSV (simulated results).`, 'info', 'Results')
  }

  return (
    <>
      <section className="results-overview">
        <div>
          <span>Revenue so far</span>
          <strong>{formatMoney(totals.revenue)}</strong>
          <em>live + completed campaigns · simulated</em>
        </div>
        <div>
          <span>Campaigns live</span>
          <strong>{results.filter((result) => result.state === 'live').length}</strong>
          <em>
            {results.filter((result) => result.state === 'completed').length} completed · {results.filter((result) => result.state === 'projection').length} not live yet
          </em>
        </div>
        <div>
          <span>Email open rate</span>
          <strong>{totals.sends ? percent(totals.opens / totals.sends) : '—'}</strong>
          <em>{totals.sends ? `${Math.round(totals.opens).toLocaleString()} opens from ${Math.round(totals.sends).toLocaleString()} sent · 30% benchmark` : 'no emails sent yet'}</em>
        </div>
        <div className={unsavedAcrossHotel ? 'tile-action' : ''}>
          <span>Learnings saved</span>
          <strong>{learnings.length}</strong>
          <em>{unsavedAcrossHotel ? `${unsavedAcrossHotel} new insight${unsavedAcrossHotel === 1 ? '' : 's'} to review` : 'feeding future recommendations'}</em>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Learning loop</p>
            <h2>{isHotelManager ? 'Performance by business area' : `${department.name} performance`}</h2>
          </div>
          <button type="button" className="secondary-button small" onClick={exportCsv} disabled={results.length === 0}>
            <Download size={14} /> Export results
          </button>
        </div>
        <p className="muted small">Simulated results model: figures follow each campaign’s audience, channels, offer price and days live. Connect a booking source for live attribution.</p>
        <div className="area-table" role="table" aria-label="Results by business area">
          <div className="area-row area-head" role="row">
            <span>Business area</span>
            <span>Campaigns</span>
            <span>Results so far</span>
            <span>Revenue</span>
            <span>Forecast</span>
            <span>Best channel</span>
            <span>Data</span>
            <span>Learnings</span>
          </div>
          {areas.map((item) => {
            const itemDepartment = departments.find((entry) => entry.key === item.key) ?? departments[0]
            const itemFreshness = resolveFreshness(itemDepartment, signals)
            const itemUnit = item.results[0]?.unit ?? 'bookings'
            const liveCount = item.results.filter((result) => result.state === 'live').length
            const doneCount = item.results.filter((result) => result.state === 'completed').length
            const notLive = item.results.filter((result) => result.state === 'projection').length
            return (
              <button type="button" role="row" key={item.key} className={`area-row ${item.key === area.key ? 'selected' : ''}`} aria-pressed={item.key === area.key} onClick={() => setSelectedKey(item.key)}>
                <span className="area-name">
                  <img src={itemDepartment.image} alt="" />
                  <strong>{itemDepartment.name}</strong>
                </span>
                <span className="area-campaigns">
                  {item.results.length === 0 ? (
                    <em>No campaign · {itemDepartment.recommendation.outcome}</em>
                  ) : (
                    [liveCount && `${liveCount} live`, doneCount && `${doneCount} completed`, notLive && `${notLive} not live`].filter(Boolean).join(' · ')
                  )}
                </span>
                <span>{item.measured.length ? countUnit(item.bookings, itemUnit) : '—'}</span>
                <span>{item.measured.length ? formatMoney(item.revenue) : '—'}</span>
                <span>{item.forecast ? `~${countUnit(item.forecast, itemUnit)}` : '—'}</span>
                <span>{item.bestChannel ?? '—'}</span>
                <span className={`freshness-chip freshness-${itemFreshness.state.toLowerCase()}`}>{itemFreshness.state}</span>
                <span className={item.learnings ? '' : 'muted-cell'}>{item.learnings ? `${item.learnings} learning${item.learnings === 1 ? '' : 's'} saved` : 'None yet'}</span>
              </button>
            )
          })}
        </div>
      </section>

      <div className="power-grid">
        <section className="panel span-2 area-results">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Results</p>
              <h2>{department.name}</h2>
            </div>
          </div>
          {area.measured.length > 0 ? (
            <>
              <p className="results-lead">
                <strong>{countUnit(areaTotals.bookings, unit)}</strong> and <strong>{formatMoney(areaTotals.revenue)}</strong> so far from {area.measured.length} campaign
                {area.measured.length === 1 ? '' : 's'}.
                {live.map((result) => (
                  <span key={result.campaign.id}>
                    {' '}
                    {result.campaign.name} is on day {result.dayCount} of {result.totalDays}: on current pace ~{countUnit(result.projected.bookings, unit)} and {formatMoney(result.projected.revenue)} by {formatDate(result.campaign.endDate)}.
                  </span>
                ))}
              </p>
              <ResultsChart daily={mergeDaily(area.measured)} unit={unit} />
              <div className="channel-shares">
                {channels.map((item, index) => {
                  const wholeTotal = rounded.reduce((sum, value) => sum + value, 0)
                  const share = wholeTotal ? rounded[index] / wholeTotal : 0
                  return (
                    <div className="channel-share" key={item.channel}>
                      <span className="channel-share-head">
                        <strong>{item.channel}</strong>
                        <span>
                          {Math.round(item.reach).toLocaleString()} {item.label} · {countUnit(rounded[index], unit)}
                        </span>
                      </span>
                      <span className="consent-track">
                        <span style={{ width: `${Math.round(share * 100)}%` }} />
                      </span>
                      <em>{percent(share)}</em>
                    </div>
                  )
                })}
              </div>
            </>
          ) : pending.length ? (
            <div className="results-empty-state">
              <p>
                Nothing live in {department.name} yet. If {pending.map((result) => result.campaign.name).join(' and ')} run{pending.length === 1 ? 's' : ''} as planned: about{' '}
                <strong>{countUnit(pending.reduce((sum, result) => sum + result.projected.bookings, 0), unit)}</strong> and{' '}
                <strong>{formatMoney(pending.reduce((sum, result) => sum + result.projected.revenue, 0))}</strong>.
              </p>
              <button type="button" className="secondary-button small" onClick={() => onOpenCampaign(pending[0].campaign, 'Approval')}>
                Open {pending[0].campaign.name} <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <div className="results-empty-state">
              <p>
                No campaign in {department.name}. The AI recommended <strong>{department.recommendation.outcome.toLowerCase()}</strong> instead: {department.recommendation.title.toLowerCase()}.
              </p>
            </div>
          )}

          {area.results.length > 0 && (
            <div className="detail-section">
              <h3>
                Campaigns <span>{area.results.length}</span>
              </h3>
              <div className="results-campaign-list">
                {area.results.map((result) => (
                  <button type="button" key={result.campaign.id} onClick={() => onOpenCampaign(result.campaign, 'Results')}>
                    <span className={statusClass(result.campaign.status)}>{result.campaign.status}</span>
                    <strong>{result.campaign.name}</strong>
                    <em>
                      {result.state === 'projection'
                        ? `projected ~${countUnit(result.projected.bookings, result.unit)}`
                        : `${countUnit(result.shown.bookings, result.unit)} ${result.state === 'live' ? 'so far' : 'total'}`}{' '}
                      →
                    </em>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="panel learning-panel">
          <p className="eyebrow">What we learned</p>
          <h2>Insights</h2>
          {insights.length === 0 ? (
            <p className="muted small">Insights appear once a campaign in {department.name} is live.</p>
          ) : (
            <ul className="insight-list">
              {insights.map(({ insight, result }) => {
                const saved = savedTexts.has(insight.text)
                return (
                  <li key={insight.text}>
                    <span className={`insight-kind kind-${insight.kind.toLowerCase()}`}>{insight.kind}</span>
                    <p>{insight.text}</p>
                    {insight.kind === 'Try' ? (
                      <button type="button" className="ghost-link" onClick={() => onOpenCampaign(result.campaign, 'Results')}>
                        Apply in {result.campaign.name} <ArrowRight size={13} />
                      </button>
                    ) : (
                      <button type="button" className="ghost-link" disabled={saved} onClick={() => save(insight, result)}>
                        <BookmarkPlus size={13} /> {saved ? 'Saved to Hotel Brain' : 'Save to Hotel Brain'}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <div className="detail-section">
            <h3>
              Saved learnings <span>{area.learnings}</span>
            </h3>
            {area.learnings === 0 ? (
              <p className="muted small">Saved learnings shape the next recommendation for {department.name}.</p>
            ) : (
              <ul className="saved-learnings">
                {learnings
                  .filter((learning) => learning.departmentKey === area.key)
                  .map((learning) => (
                    <li key={learning.id}>
                      <span className={`insight-kind kind-${learning.kind.toLowerCase()}`}>{learning.kind}</span>
                      <span>
                        {learning.text}
                        <small>{learning.campaignName}</small>
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </div>

          <div className="detail-section next-best">
            <h3>
              What next <span>{recommendation.outcome}</span>
            </h3>
            <strong>{recommendation.title}</strong>
            <p className="muted small">{recommendation.summary}</p>
            <p className="source-line">
              <Sparkles size={13} /> {confidence} confidence · data {freshness.state.toLowerCase()}
              {freshness.state !== 'Unavailable' ? `, ${ageLabel(freshness.ageDays)}` : ''}
              {confidence !== recommendation.confidence ? ` (capped from ${recommendation.confidence} until the data is confirmed)` : ''}
            </p>
            <button type="button" className="secondary-button small" onClick={openArea}>
              Open {department.name} <ArrowRight size={14} />
            </button>
          </div>
        </section>
      </div>
    </>
  )
}
