import { AlertTriangle, BadgeCheck, CalendarClock, Check, CircleDot, Play, ShieldCheck } from 'lucide-react'
import { useState } from 'react'

const readiness = [
  ['SaaS shell', 'Ready', 'Navigation, responsive app frame, tenant-style workspace'],
  ['Department workspaces', 'Ready', 'All 8 business areas seeded, with non-campaign outcomes for Golf, Hair & Beauty, Meetings and Beach Club'],
  ['Update My AI', 'Ready', 'Structured signal and confirmation demo works'],
  ['Campaign engine', 'Ready', 'Create, strategy, socials, designs, email, website, audience, approve & send, results'],
  ['Execution integrations', 'Demo mode', 'Provider actions are simulated until backend is connected'],
  ['Backend persistence', 'Next', 'Saved in this browser only; database and login still pending'],
]

const script = [
  'Departments → Spa: read the recommendation, its sources and confidence.',
  'Update My AI: structure an update, edit a figure, confirm it and watch confidence change.',
  'Switch to Golf: stale data shows a check-in prompt and a "Monitor only" outcome instead of a campaign.',
  'Create campaign from the top bar: the form is pre-filled from the AI recommendation.',
  'Walk the stages: Socials, Designs, Emails (send a test), Website, Audience.',
  'Switch role to Department manager: approvals lock; switch back to Hotel manager and Approve & send.',
  'Results: save an insight, then show it in Hotel Brain.',
  'Offers, Calendar and Audience: add an offer, a key date, import a CSV of contacts.',
]

export function DemoControlPage() {
  const [activeStep, setActiveStep] = useState(0)
  const [banner, setBanner] = useState('Demo flow is ready. Start the walkthrough when you begin presenting.')

  return (
    <main className="workspace">
      <header className="topbar">
        <div>
          <p className="eyebrow">October 4 demo</p>
          <h1>Demo control center</h1>
        </div>
        <div className="topbar-actions">
          <button type="button" className="secondary-button" onClick={() => setBanner('Sprint view opened: focus on demo-critical flows, then freeze on October 3.')}>
            <CalendarClock size={17} /> 5-day sprint
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setActiveStep(0)
              setBanner('Walkthrough started: begin with Departments and Spa & Wellness.')
            }}
          >
            <Play size={17} /> Start walkthrough
          </button>
        </div>
      </header>

      <section className="workspace-hero">
        <div>
          <p>
            This view keeps the demo honest: what is ready, what is simulated, and what must be positioned as next-stage backend work.
          </p>
          <div className="hero-actions">
            <button type="button" className="primary-button" onClick={() => setBanner('Demo-ready flow checked: Update My AI, campaign engine, approvals, and results are interactive.')}>
              <BadgeCheck size={17} /> Demo-ready flow
            </button>
            <button type="button" className="secondary-button" onClick={() => setBanner('Guardrails visible: source confidence, role scope, approvals, consent, and publish gates are in the UI.')}>
              <ShieldCheck size={17} /> Guardrails visible
            </button>
          </div>
        </div>
        <div className="status-stack">
          <span><Check size={16} /><strong>Frontend</strong> Interactive SaaS demo</span>
          <span><CircleDot size={16} /><strong>Data</strong> Seeded and persistent locally</span>
          <span><AlertTriangle size={16} /><strong>Integrations</strong> Simulated until backend</span>
        </div>
      </section>

      <div className="action-banner">
        <strong>Current demo note</strong>
        <span>{banner}</span>
      </div>

      <div className="power-grid">
        <section className="panel span-2">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Readiness</p>
              <h2>Build status</h2>
            </div>
          </div>
          <div className="readiness-list">
            {readiness.map(([area, status, detail]) => (
              <article key={area}>
                <strong>{area}</strong>
                <em>{status}</em>
                <span>{detail}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Talk track</p>
              <h2>Demo path</h2>
            </div>
          </div>
          <div className="timeline-list">
            {script.map((item, index) => (
              <button
                type="button"
                className={index <= activeStep ? 'done' : ''}
                key={item}
                onClick={() => {
                  setActiveStep(index)
                  setBanner(item)
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
