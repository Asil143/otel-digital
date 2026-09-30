import { useEffect, useMemo, useState } from 'react'
import { CampaignEngine } from '../components/campaign/CampaignEngine'
import { CreateCampaignForm } from '../components/campaign/CreateCampaignForm'
import { OutcomePanel } from '../components/campaign/OutcomePanel'
import { DepartmentHero } from '../components/dashboard/DepartmentHero'
import { DepartmentSwitcher } from '../components/dashboard/DepartmentSwitcher'
import { MetricGrid } from '../components/dashboard/MetricGrid'
import { RecommendationPanel } from '../components/dashboard/RecommendationPanel'
import { Topbar } from '../components/dashboard/Topbar'
import { UpdateMyAiPanel } from '../components/dashboard/UpdateMyAiPanel'
import { ActivityFeed } from '../components/operations/ActivityFeed'
import { ResultsPanel } from '../components/operations/ResultsPanel'
import { Modal } from '../components/ui/Modal'
import { StateBlock } from '../components/ui/StateBlock'
import { departments } from '../data/departments'
import { seedKeyDates, seedOffers } from '../data/offers'
import { resolveFreshness } from '../lib/freshness'
import { usePersistentState } from '../lib/usePersistentState'
import { createCampaign, formatDateTime, seedCampaigns, toCampaignInput, type CampaignInput } from '../services/campaigns'
import { ageLabel } from '../lib/freshness'
import type { ActivityEvent } from '../types/activity'
import type { CampaignRecord, CampaignStage, DepartmentKey, KeyDate, Offer, SignalRecord, SourceState, UserRole } from '../types/domain'

const initialEvents: ActivityEvent[] = [
  {
    id: 'initial_signal',
    title: 'Spa diary confirmed',
    detail: 'Midweek availability is trusted current data.',
    tone: 'success',
  },
  {
    id: 'initial_email',
    title: 'Email provider ready (demo)',
    detail: 'Test sends and scheduling are simulated until Brevo is connected.',
    tone: 'info',
  },
]

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function DepartmentDashboard() {
  const [activeDept, setActiveDept] = usePersistentState<DepartmentKey>('otel:active-department', 'spa')
  const [activeStage, setActiveStage] = usePersistentState<CampaignStage>('otel:active-campaign-stage', 'Strategy')
  const [previewMode, setPreviewMode] = usePersistentState<'desktop' | 'mobile'>('otel:email-preview-mode', 'desktop')
  const [events, setEvents] = usePersistentState<ActivityEvent[]>('otel:activity-feed', initialEvents)
  const [currentRole, setCurrentRole] = usePersistentState<UserRole>('otel:current-role', 'Department manager')
  const [departmentScope, setDepartmentScope] = usePersistentState<DepartmentKey>('otel:department-scope', 'spa')
  const [signals, setSignals] = usePersistentState<SignalRecord[]>('otel:signals', [])
  const [storedCampaigns, setStoredCampaigns] = usePersistentState<CampaignRecord[]>('otel:campaigns', [])
  const [offers] = usePersistentState<Offer[]>('otel:offers', seedOffers)
  const [keyDates] = usePersistentState<KeyDate[]>('otel:key-dates', seedKeyDates)
  const [modal, setModal] = useState<'notifications' | 'create' | 'edit' | null>(null)

  const allowedDepartments = useMemo(
    () => (currentRole === 'Department manager' ? [departmentScope] : departments.map((item) => item.key)),
    [currentRole, departmentScope],
  )
  const department = departments.find((item) => item.key === activeDept) ?? departments[0]
  const freshness = resolveFreshness(department, signals)
  const freshnessByArea = Object.fromEntries(
    departments.map((item) => [item.key, resolveFreshness(item, signals).state]),
  ) as Record<DepartmentKey, SourceState>

  const campaigns = useMemo(() => {
    const stored = new Map(storedCampaigns.map((item) => [item.id, item]))
    const seeds = seedCampaigns(departments, offers).filter((seed) => !stored.has(seed.id))
    return [...storedCampaigns, ...seeds]
  }, [storedCampaigns, offers])

  const campaign =
    campaigns
      .filter((item) => item.departmentKey === department.key)
      .sort((a, b) => (b.timeline['Content created'] ?? '').localeCompare(a.timeline['Content created'] ?? ''))[0] ?? null

  const notifications = departments
    .filter((item) => allowedDepartments.includes(item.key))
    .flatMap((item) => {
      const list: { id: string; title: string; detail: string; departmentKey: DepartmentKey }[] = []
      const itemFreshness = resolveFreshness(item, signals)
      if (itemFreshness.latestSignal?.state === 'Detected') {
        list.push({ id: `${item.key}-detected`, title: `${item.name}: update awaiting confirmation`, detail: 'Confirm or edit the figures the AI detected before they are used.', departmentKey: item.key })
      }
      if (itemFreshness.state === 'Stale' || itemFreshness.state === 'Unavailable') {
        list.push({ id: `${item.key}-stale`, title: `${item.name}: data is ${itemFreshness.state.toLowerCase()}`, detail: `Last ${ageLabel(itemFreshness.ageDays)}. A 30-second check-in is due.`, departmentKey: item.key })
      }
      for (const entry of campaigns.filter((record) => record.departmentKey === item.key)) {
        if (entry.status === 'Needs approval') {
          list.push({
            id: `${entry.id}-approval`,
            title: `${entry.name} needs approval`,
            detail: currentRole === 'Hotel manager' ? 'Review each channel and approve or schedule it.' : 'Waiting for the hotel manager to review.',
            departmentKey: item.key,
          })
        }
        if (entry.status === 'Scheduled' && entry.scheduledFor) {
          list.push({ id: `${entry.id}-scheduled`, title: `${entry.name} is scheduled`, detail: `Goes out ${formatDateTime(entry.scheduledFor)}.`, departmentKey: item.key })
        }
      }
      return list
    })

  useEffect(() => {
    if (!allowedDepartments.includes(activeDept)) {
      setActiveDept(allowedDepartments[0])
    }
  }, [activeDept, allowedDepartments, setActiveDept])

  function addActivity(event: ActivityEvent) {
    setEvents((current) => [event, ...current].slice(0, 6))
  }

  function upsertCampaign(next: CampaignRecord) {
    setStoredCampaigns((current) => [next, ...current.filter((item) => item.id !== next.id)])
  }

  function handleCreate(departmentKey: DepartmentKey, input: CampaignInput) {
    const target = departments.find((item) => item.key === departmentKey) ?? department
    const created = createCampaign(target, input)
    upsertCampaign(created)
    setActiveDept(departmentKey)
    setActiveStage('Strategy')
    setModal(null)
    addActivity({ id: crypto.randomUUID(), title: 'Campaign created', detail: `${created.name} is ready to review in the campaign engine.`, tone: 'success' })
    window.setTimeout(() => scrollToSection('campaign-engine'), 50)
  }

  function handleEdit(_departmentKey: DepartmentKey, input: CampaignInput) {
    if (!campaign) return
    upsertCampaign({ ...campaign, ...input })
    setModal(null)
    addActivity({ id: crypto.randomUUID(), title: 'Campaign details updated', detail: `${input.name} details saved.`, tone: 'info' })
  }


  const editableDepartments = departments.filter((item) => allowedDepartments.includes(item.key))

  return (
    <main className="workspace">
      <Topbar
        title={department.name}
        currentRole={currentRole}
        departmentScope={departmentScope}
        onCreateCampaign={() => setModal('create')}
        onShowNotifications={() => setModal('notifications')}
        notificationCount={notifications.length}
        onRoleChange={setCurrentRole}
        onScopeChange={setDepartmentScope}
      />
      <DepartmentSwitcher
        activeDept={activeDept}
        allowedDepartments={allowedDepartments}
        freshnessByArea={freshnessByArea}
        onChange={setActiveDept}
      />
      <DepartmentHero
        department={department}
        onShowRecommendation={() => scrollToSection('recommendation')}
        onShowUpdate={() => scrollToSection('update-my-ai')}
      />
      {currentRole === 'Department manager' && (
        <div className="scope-notice">
          Department manager access is scoped to {department.name}. You can prepare campaigns and send them for approval; the hotel manager approves and publishes.
        </div>
      )}
      <MetricGrid department={department} />

      <div className="main-grid">
        <RecommendationPanel department={department} freshness={freshness} offers={offers} keyDates={keyDates} />
        <UpdateMyAiPanel
          department={department}
          freshness={freshness}
          signals={signals}
          onSignalsChange={setSignals}
          onActivity={addActivity}
        />
      </div>

      {campaign ? (
        <CampaignEngine
          campaign={campaign}
          department={department}
          activeStage={activeStage}
          previewMode={previewMode}
          currentRole={currentRole}
          onChange={upsertCampaign}
          onActivity={addActivity}
          onEditDetails={() => setModal('edit')}
          setActiveStage={setActiveStage}
          setPreviewMode={setPreviewMode}
        />
      ) : (
        <OutcomePanel
          department={department}
          outcome={department.recommendation.outcome}
          onActivity={addActivity}
          onCreateAnyway={() => setModal('create')}
          onStartCheckIn={() => scrollToSection('update-my-ai')}
        />
      )}

      <section className="recap-grid">
        <ResultsPanel department={department} />
        <ActivityFeed events={events} onClear={() => setEvents(initialEvents)} />
      </section>

      {modal === 'notifications' && (
        <Modal title="Notifications" onClose={() => setModal(null)}>
          {notifications.length === 0 && <StateBlock state="empty" message="Nothing needs your attention right now." />}
          <div className="notification-list">
            {notifications.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => {
                  setActiveDept(item.departmentKey)
                  setModal(null)
                }}
              >
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {(modal === 'create' || (modal === 'edit' && campaign)) && (
        <Modal title={modal === 'create' ? 'Create campaign' : 'Edit campaign details'} onClose={() => setModal(null)} wide>
          <CreateCampaignForm
            departments={editableDepartments}
            initialDepartmentKey={department.key}
            offers={offers}
            mode={modal}
            initialInput={modal === 'edit' && campaign ? toCampaignInput(campaign) : undefined}
            onSubmit={modal === 'create' ? handleCreate : handleEdit}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </main>
  )
}
