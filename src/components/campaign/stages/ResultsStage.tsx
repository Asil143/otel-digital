import { ArrowDownRight, ArrowUpRight, BookmarkPlus, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { departments } from '../../../data/departments'
import { usePersistentState } from '../../../lib/usePersistentState'
import { generateNextRecommendation, type NextRecommendation } from '../../../services/aiMarketing'
import type { Learning } from '../../../types/domain'
import type { StageProps } from './shared'

function resultTiles(departmentIndex: number, resultMetric: string) {
  const scale = 1 + departmentIndex * 0.07
  return [
    { label: 'Email open rate', value: `${Math.round(42 * scale)}%`, previous: `${Math.round(35 * scale)}%`, up: true },
    { label: 'Click rate', value: `${(6.8 * scale).toFixed(1)}%`, previous: `${(4.9 * scale).toFixed(1)}%`, up: true },
    { label: 'Website visits', value: Math.round(1856 * scale).toLocaleString(), previous: Math.round(1410 * scale).toLocaleString(), up: true },
    { label: 'Bookings', value: resultMetric, previous: 'vs 31 last period', up: true },
    { label: 'Estimated revenue', value: `£${Math.round(4560 * scale).toLocaleString()}`, previous: `£${Math.round(3200 * scale).toLocaleString()}`, up: true },
    { label: 'Unsubscribes', value: '0.3%', previous: '0.2%', up: false },
  ]
}

export function ResultsStage({ campaign, department, onActivity }: StageProps) {
  const [learnings, setLearnings] = usePersistentState<Learning[]>('otel:learnings', [])
  const [next, setNext] = useState<NextRecommendation | null>(null)
  const [loading, setLoading] = useState(false)

  const isMeasured = campaign.status === 'Live' || campaign.status === 'Completed'
  const tiles = resultTiles(departments.findIndex((item) => item.key === department.key), department.resultMetric)
  const topAudience = campaign.audience[0] ?? department.audience[0]
  const insights: { text: string; kind: Learning['kind'] }[] = [
    { text: `The launch email performed 32% above your average open rate with ${topAudience.toLowerCase()}.`, kind: 'Worked' },
    { text: `${campaign.offer} converted best when shown with a clear booking button above the fold.`, kind: 'Worked' },
    { text: 'Follow up people who clicked but did not book with a reminder before the offer ends.', kind: 'Worked' },
    { text: 'Avoid Friday afternoon sends — they had the lowest open rate in this campaign.', kind: 'Avoid' },
  ]
  const savedTexts = new Set(learnings.filter((item) => item.departmentKey === department.key).map((item) => item.text))

  function saveLearning(text: string, kind: Learning['kind']) {
    setLearnings((current) => [
      { id: crypto.randomUUID(), departmentKey: department.key, campaignName: campaign.name, text, kind, createdAt: new Date().toISOString() },
      ...current,
    ])
    onActivity('Learning saved to Hotel Brain', text, 'success')
  }

  async function askForNext() {
    setLoading(true)
    setNext(await generateNextRecommendation(department))
    setLoading(false)
  }

  return (
    <div className="results-stage">
      {!isMeasured && (
        <p className="results-note">
          {campaign.name} isn't live yet. Showing results from a comparable past {department.name} campaign so you know what to expect.
        </p>
      )}
      <div className="results-tiles">
        {tiles.map((tile) => (
          <div key={tile.label}>
            <span>{tile.label}</span>
            <strong>{tile.value}</strong>
            <em className={tile.up ? 'up' : 'down'}>
              {tile.up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />} {tile.previous.startsWith('vs') ? tile.previous : `vs ${tile.previous} last period`}
            </em>
          </div>
        ))}
      </div>
      <p className="muted small">Demo results. Live attribution needs a connected booking and analytics source.</p>

      <div className="insights-list">
        <h3>Key insights</h3>
        {insights.map((insight) => (
          <div key={insight.text} className="insight-row">
            <span className={`insight-kind ${insight.kind.toLowerCase()}`}>{insight.kind === 'Worked' ? 'Worked' : 'Avoid'}</span>
            <p>{insight.text}</p>
            <button type="button" className="ghost-link" disabled={savedTexts.has(insight.text)} onClick={() => saveLearning(insight.text, insight.kind)}>
              <BookmarkPlus size={14} /> {savedTexts.has(insight.text) ? 'Saved' : 'Save to Hotel Brain'}
            </button>
          </div>
        ))}
      </div>

      <div className="next-recommendation">
        <h3>Next recommendation</h3>
        {next ? (
          <>
            <p><strong>What worked:</strong> {next.whatWorked}</p>
            <p><strong>Next:</strong> {next.nextRecommendation}</p>
          </>
        ) : (
          <p className="muted small">Ask the AI to turn these results into the next move for {department.name}.</p>
        )}
        <button type="button" className="secondary-button" onClick={askForNext} disabled={loading}>
          <Sparkles size={15} /> {loading ? 'Analysing results...' : 'Generate next recommendation'}
        </button>
      </div>
    </div>
  )
}
