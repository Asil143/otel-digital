import { useState } from 'react'
import { formatDate } from '../../services/campaigns'
import { formatCount, formatMoney, type DailyPoint } from '../../lib/results'

type Metric = 'bookings' | 'revenue' | 'clicks'

export function ResultsChart({ daily, unit, projection = false }: { daily: DailyPoint[]; unit: string; projection?: boolean }) {
  const [metric, setMetric] = useState<Metric>('bookings')
  const [selected, setSelected] = useState<number | null>(null)

  if (daily.length === 0) return null

  const max = Math.max(...daily.map((point) => point[metric]), 0.0001)
  const format = (value: number) => (metric === 'revenue' ? formatMoney(value) : formatCount(value))
  const label: Record<Metric, string> = { bookings: unit, revenue: 'revenue', clicks: 'clicks' }
  const active = selected !== null ? daily[selected] : null
  const lastRealised = daily.reduce((last, point, index) => (point.realised ? index : last), -1)

  return (
    <div className="results-chart">
      <div className="segmented chart-toggle" role="group" aria-label="Chart metric">
        {(['bookings', 'revenue', 'clicks'] as Metric[]).map((option) => (
          <button type="button" key={option} className={metric === option ? 'selected' : ''} onClick={() => setMetric(option)}>
            {option === 'bookings' ? unit.charAt(0).toUpperCase() + unit.slice(1) : option.charAt(0).toUpperCase() + option.slice(1)}
          </button>
        ))}
      </div>
      <div className="chart-bars" role="list" aria-label={`Daily ${label[metric]}`}>
        {daily.map((point, index) => (
          <button
            type="button"
            role="listitem"
            key={point.date}
            className={`${point.realised && !projection ? 'realised' : 'future'} ${selected === index ? 'selected' : ''}`}
            style={{ height: `${Math.max(4, (point[metric] / max) * 100)}%` }}
            title={`${formatDate(point.date)}: ${format(point[metric])} ${label[metric]}${point.realised && !projection ? '' : ' (projected)'}`}
            aria-label={`${formatDate(point.date)}: ${format(point[metric])} ${label[metric]}`}
            onClick={() => setSelected(selected === index ? null : index)}
          />
        ))}
      </div>
      <div className="chart-axis">
        <span>{formatDate(daily[0].date)}</span>
        {!projection && lastRealised >= 0 && lastRealised < daily.length - 1 && <span className="chart-today">Today</span>}
        <span>{formatDate(daily[daily.length - 1].date)}</span>
      </div>
      <p className="chart-caption">
        {active
          ? `${formatDate(active.date)}: ${format(active[metric])} ${label[metric]}${active.realised && !projection ? '' : ' (projected)'}`
          : projection
            ? 'Projected daily results if the campaign launches as planned. Tap a bar for detail.'
            : 'Solid bars are results so far; faded bars are the projection to the end date. Tap a bar for detail.'}
      </p>
    </div>
  )
}
