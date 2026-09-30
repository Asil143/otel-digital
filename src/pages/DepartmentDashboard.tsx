import { useEffect, useState } from 'react'
import { CampaignEngine } from '../components/campaign/CampaignEngine'
import { CreateCampaignForm } from '../components/campaign/CreateCampaignForm'
import { OutcomePanel } from '../components/campaign/OutcomePanel'
import { DepartmentHero, type HeroFocus } from '../components/dashboard/DepartmentHero'
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
import { seedKeyDates } from '../data/offers'
import { resolveFreshness, signalsFor } from '../lib/freshness'
import { readStored, usePersistentState, writeStored } from '../lib/usePersistentState'
import { createCampaign, formatDateTime, localDate, presetForOffer, requiredApprovals, toCampaignInput, type CampaignInput } from '../services/campaigns'
import { formatCount, formatMoney, resultUnit } from '../lib/results'
import { recordActivity } from '../lib/activityLog'
import { useResults } from '../lib/useResults'
import { ageLabel } from '../lib/freshness'
import type { ActivityEvent } from '../types/activity'
import type { CampaignStage, DepartmentKey, KeyDate, SourceState } from '../types/domain'
import { useCurrentUser } from '../lib/currentUser'
import { hasNewerData, useSignals } from '../lib/signalStore'

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function DepartmentDashboard() {
  const [activeDept, setActiveDept] = usePersistentState<DepartmentKey>('otel:active-department', 'spa')
  const [activeStage, setActiveStage] = usePersistentState<CampaignStage>('otel:active-campaign-stage', 'Strategy')
  const [previewMode, setPreviewMode] = usePersistentState<'desktop' | 'mobile'>('otel:email-preview-mode', 'desktop')
  const { user, role: currentRole, allowedAreas: allowedDepartments, isHotelManager } = useCurrentUser()
  const [signals, setSignals] = useSignals()
  const [liveRecommendations] = usePersistentState<Record<string, { at: string }>>('otel:live-recommendations', {})
  const { campaigns, upsert: upsertCampaign, forDepartment, offers } = useResults()
  const [keyDates] = usePersistentState<KeyDate[]>('otel:key-dates', seedKeyDates)
  const [pendingOfferId] = useState(() => readStored<string | null>('otel:pending-create', null))
  const [modal, setModal] = useState<'notifications' | 'create' | 'edit' | null>(() => (pendingOfferId ? 'create' : null))
  const [createPreset, setCreatePreset] = useState<CampaignInput | undefined>(() => {
    const offer = offers.find((item) => item.id === pendingOfferId)
    const area = offer && departments.find((item) => item.key === offer.departmentKey)
    return offer && area ? presetForOffer(area, offers, offer) : undefined
  })
  const [today] = useState(() => localDate())
  const [hour] = useState(() => new Date().getHours())

  const department = departments.find((item) => item.key === activeDept) ?? departments[0]
  const freshness = resolveFreshness(department, signals)
  const freshnessByArea = Object.fromEntries(
    departments.map((item) => [item.key, resolveFreshness(item, signals).state]),
  ) as Record<DepartmentKey, SourceState>

  const departmentResults = forDepartment(department.key)

  const campaign =
    campaigns
      .filter((item) => item.departmentKey === department.key)
      .sort((a, b) => (b.timeline['Content created'] ?? '').localeCompare(a.timeline['Content created'] ?? ''))[0] ?? null

  const campaignResult = campaign ? departmentResults.find((result) => result.campaign.id === campaign.id) ?? null : null
  const firstName = user.name.split(' ')[0]
  const isOwnArea = user.departmentKey === department.key
  const greeting = isOwnArea
    ? `Good ${hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}, ${firstName} · ${department.name}`
    : `${department.name} · managed by ${department.manager}`

  function openStage(stage: CampaignStage) {
    setActiveStage(stage)
    window.setTimeout(() => scrollToSection('campaign-engine'), 30)
  }

  const focus: HeroFocus = (() => {
    const pendingSignal = freshness.latestSignal?.state === 'Detected'
    if (pendingSignal) {
      return { tone: 'action', title: 'Confirm the update the AI detected', detail: 'New figures are waiting for your check before the AI uses them.', actionLabel: 'Review update', onAction: () => scrollToSection('update-my-ai') }
    }
    if (freshness.state === 'Stale' || freshness.state === 'Unavailable') {
      return { tone: 'action', title: `${department.name} data is ${freshness.state.toLowerCase()}`, detail: `Last ${ageLabel(freshness.ageDays)}. A 30-second check-in keeps recommendations accurate.`, actionLabel: 'Start check-in', onAction: () => scrollToSection('update-my-ai') }
    }
    if (campaign) {
      const required = requiredApprovals(campaign)
      const approved = required.filter((channel) => campaign.approvals[channel]).length
      if (campaign.status === 'Draft') {
        return { tone: 'action', title: `Finish ${campaign.name} and send it for approval`, detail: `${approved} of ${required.length} channels approved so far.`, actionLabel: 'Open campaign', onAction: () => openStage('Strategy') }
      }
      if (campaign.status === 'Needs approval') {
        return isHotelManager
          ? { tone: 'action', title: `${campaign.name} needs your approval`, detail: `${approved} of ${required.length} channels approved.`, actionLabel: 'Review & approve', onAction: () => openStage('Approval') }
          : { tone: 'waiting', title: `${campaign.name} is with the hotel manager`, detail: `${approved} of ${required.length} channels approved. You'll see it here when it's scheduled.`, actionLabel: 'View campaign', onAction: () => openStage('Approval') }
      }
      if (campaign.status === 'Approved') {
        return isHotelManager
          ? { tone: 'action', title: `${campaign.name} is approved — schedule it`, detail: 'Every channel is approved. Choose when it goes out.', actionLabel: 'Schedule', onAction: () => openStage('Approval') }
          : { tone: 'waiting', title: `${campaign.name} is approved`, detail: 'The hotel manager will schedule or publish it.', actionLabel: 'View campaign', onAction: () => openStage('Approval') }
      }
      if (campaign.status === 'Scheduled') {
        return { tone: 'good', title: `${campaign.name} is scheduled`, detail: campaign.scheduledFor ? `Goes out ${formatDateTime(campaign.scheduledFor)}.` : 'Ready to go out.', actionLabel: 'View campaign', onAction: () => openStage('Approval') }
      }
      if (campaign.status === 'Live' && campaignResult) {
        return { tone: 'good', title: `${campaign.name} is live — day ${campaignResult.dayCount} of ${campaignResult.totalDays}`, detail: `${formatCount(campaignResult.shown.bookings)} ${resultUnit(department)} and ${formatMoney(campaignResult.shown.revenue)} so far.`, actionLabel: 'See results', onAction: () => openStage('Results') }
      }
      if (campaign.status === 'Completed') {
        return { tone: 'good', title: `${campaign.name} has finished`, detail: 'Review the results and save what worked to Hotel Brain.', actionLabel: 'See results', onAction: () => openStage('Results') }
      }
    }
    if (hasNewerData(freshness.latestSignal, liveRecommendations[department.key]?.at)) {
      return { tone: 'action', title: 'New data is in — refresh the recommendation', detail: `The recommendation was made before your latest ${department.name} update.`, actionLabel: 'Review recommendation', onAction: () => scrollToSection('recommendation') }
    }
    if (department.recommendation.outcome === 'Campaign') {
      return { tone: 'action', title: department.recommendation.title, detail: department.subline, actionLabel: 'Create campaign', onAction: () => { setCreatePreset(undefined); setModal('create') } }
    }
    return { tone: 'waiting', title: `${department.recommendation.outcome}: ${department.recommendation.title}`, detail: department.subline, actionLabel: 'View plan', onAction: () => scrollToSection('campaign-engine') }
  })()

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
    if (pendingOfferId) writeStored('otel:pending-create', null)
  }, [pendingOfferId])

  useEffect(() => {
    if (!allowedDepartments.includes(activeDept)) {
      setActiveDept(allowedDepartments[0])
    }
  }, [activeDept, allowedDepartments, setActiveDept])

  function addActivity(event: ActivityEvent) {
    recordActivity({ ...event, area: event.area ?? department.name })
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
        onCreateCampaign={() => {
          setCreatePreset(undefined)
          setModal('create')
        }}
        onShowNotifications={() => setModal('notifications')}
        notificationCount={notifications.length}
      />
      <DepartmentSwitcher
        activeDept={activeDept}
        allowedDepartments={allowedDepartments}
        freshnessByArea={freshnessByArea}
        onChange={setActiveDept}
      />
      <DepartmentHero
        department={department}
        greeting={greeting}
        focus={focus}
        onShowRecommendation={() => scrollToSection('recommendation')}
      />
      {!isHotelManager && (
        <div className="scope-notice">
          You can update {department.name} data and prepare campaigns. The hotel manager approves and publishes.
        </div>
      )}
      <MetricGrid department={department} results={departmentResults} keyDates={keyDates} today={today} signals={signalsFor(department.key, signals)} />

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
          onCreateAnyway={() => {
            setCreatePreset(undefined)
            setModal('create')
          }}
          onStartCheckIn={() => scrollToSection('update-my-ai')}
        />
      )}

      <section className="recap-grid">
        <ResultsPanel
          department={department}
          results={departmentResults}
          onOpenResults={() => {
            setActiveStage('Results')
            scrollToSection('campaign-engine')
          }}
        />
        <ActivityFeed area={department.name} />
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
            initialInput={modal === 'edit' && campaign ? toCampaignInput(campaign) : createPreset}
            presetFrom={modal === 'create' ? createPreset?.offer : undefined}
            onSubmit={modal === 'create' ? handleCreate : handleEdit}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </main>
  )
}
