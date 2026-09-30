import { formatDate } from '../../services/campaigns'
import { formatCount, sumTotals, type CampaignResults } from '../../lib/results'
import { ageLabel, daysSince } from '../../lib/freshness'
import type { Department, KeyDate, Metric, SignalRecord } from '../../types/domain'

type LiveMetric = Metric & { note?: string; source?: string }

const normalise = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')
const fieldAliases: Record<string, string> = { averagespend: 'avgspend', averagespendperhead: 'avgspend' }

function fieldMatches(label: string, field: string): boolean {
  const target = normalise(label)
  const key = fieldAliases[normalise(field)] ?? normalise(field)
  return target === key || (key.length >= 5 && target.endsWith(key))
}

function fromConfirmedData(metric: Metric, signals: SignalRecord[]): LiveMetric | null {
  const hits = signals
    .filter((signal) => signal.state === 'Confirmed')
    .flatMap((signal) => {
      const entry = Object.entries(signal.fields).find(([field]) => fieldMatches(metric.label, field))
      return entry ? [{ signal, value: entry[1] }] : []
    })
  if (hits.length === 0) return null
  const [latest, previous] = hits
  const summary = latest.signal.summary.length > 42 ? `${latest.signal.summary.slice(0, 42)}…` : latest.signal.summary
  return {
    ...metric,
    value: latest.value,
    delta: previous && previous.value !== latest.value ? `was ${previous.value}` : metric.delta,
    source: `${summary} · ${ageLabel(daysSince(latest.signal.createdAt))}`,
  }
}

function withLiveData(department: Department, metric: Metric, results: CampaignResults[], keyDates: KeyDate[], today: string, signals: SignalRecord[]): LiveMetric {
  const label = metric.label.toLowerCase()
  const areaDates = keyDates
    .filter((date) => (date.departmentKey === department.key || date.departmentKey === 'all') && (date.endDate ?? date.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date))

  if (label === 'campaigns live') {
    const live = results.filter((result) => result.campaign.status === 'Live').length
    const upcoming = results.filter((result) => ['Needs approval', 'Approved', 'Scheduled'].includes(result.campaign.status)).length
    return { ...metric, value: String(live), delta: `${upcoming} upcoming` }
  }

  if (label === 'next key date') {
    const next = areaDates.find((date) => date.kind === 'Event')
    return next
      ? { ...metric, value: next.name, delta: formatDate(next.date) }
      : { ...metric, value: 'None planned', delta: 'Add one in Calendar' }
  }

  if (label.includes('quiet') || label.includes('low demand')) {
    const quiet = areaDates.find((date) => date.kind === 'Quiet period')
    return quiet
      ? { ...metric, delta: `${quiet.name} · ${formatDate(quiet.date)}` }
      : { ...metric, value: 'None flagged', delta: 'Add one in Calendar' }
  }

  const confirmed = fromConfirmedData(metric, signals) ?? metric
  if (/booking|covers|enquir/.test(label)) {
    const attributed = sumTotals(results.filter((result) => result.state !== 'projection').map((result) => result.shown)).bookings
    if (attributed >= 1) return { ...confirmed, note: `incl. ${formatCount(attributed)} from campaigns` }
  }

  return confirmed
}

export function MetricGrid({
  department,
  results,
  keyDates,
  today,
  signals,
}: {
  department: Department
  results: CampaignResults[]
  keyDates: KeyDate[]
  today: string
  signals: SignalRecord[]
}) {
  return (
    <section className="metric-grid" aria-label="Department metrics">
      {department.metrics.map((metric) => {
        const item = withLiveData(department, metric, results, keyDates, today, signals)
        return (
          <article className="metric-card" key={metric.label}>
            <span>{item.label}</span>
            <strong title={item.value}>{item.value}</strong>
            <em>{item.delta}</em>
            {item.note && <small className="metric-note">{item.note}</small>}
            {item.source && <small className="metric-source" title={item.source}>From {item.source}</small>}
          </article>
        )
      })}
    </section>
  )
}
