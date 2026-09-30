import { Activity, Sparkles, Star } from 'lucide-react'
import { useState } from 'react'
import { generateNextRecommendation, type NextRecommendation } from '../../services/aiMarketing'
import type { Department } from '../../types/domain'

export function ResultsPanel({ department }: { department: Department }) {
  const [insight, setInsight] = useState<NextRecommendation | null>(null)
  const [loading, setLoading] = useState(false)

  async function refreshInsight() {
    setLoading(true)
    const result = await generateNextRecommendation(department)
    setInsight(result)
    setLoading(false)
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">What happened</p>
          <h2>Results so far</h2>
        </div>
        <Activity size={22} />
      </div>
      <div className="mini-chart" aria-label="Campaign performance chart">
        {[28, 42, 36, 58, 50, 72, 64, 84].map((height, index) => (
          <span key={index} style={{ height: `${height}%` }}></span>
        ))}
      </div>
      <div className="learning-note">
        <Star size={17} />
        <span>
          {insight
            ? insight.whatWorked
            : department.recommendation.outcome === 'Campaign'
              ? `${department.resultMetric} attributed to email and local audience engagement.`
              : `No campaign results yet for ${department.name}: ${department.resultMetric.toLowerCase()}.`}
        </span>
      </div>
      {insight && (
        <div className="learning-note next-rec">
          <Sparkles size={17} />
          <span>Next: {insight.nextRecommendation}</span>
        </div>
      )}
      <button type="button" className="secondary-button full-width" onClick={refreshInsight} disabled={loading}>
        <Sparkles size={16} />
        {loading ? 'Analyzing results...' : 'Generate next recommendation'}
      </button>
    </section>
  )
}
