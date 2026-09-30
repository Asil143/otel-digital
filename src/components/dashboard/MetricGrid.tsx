import type { Department } from '../../types/domain'

export function MetricGrid({ department }: { department: Department }) {
  return (
    <section className="metric-grid" aria-label="Department metrics">
      {department.metrics.map((metric) => (
        <article className="metric-card" key={metric.label}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
          <em>{metric.delta}</em>
        </article>
      ))}
    </section>
  )
}
