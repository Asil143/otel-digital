import { useMemo } from 'react'
import { departments } from '../data/departments'
import { seedOffers } from '../data/offers'
import { seedCampaigns } from '../services/campaigns'
import type { CampaignRecord, Offer } from '../types/domain'
import { usePersistentState } from './usePersistentState'

export function useCampaigns() {
  const [stored, setStored] = usePersistentState<CampaignRecord[]>('otel:campaigns', [])
  const [deleted, setDeleted] = usePersistentState<string[]>('otel:deleted-campaigns', [])
  const [offers] = usePersistentState<Offer[]>('otel:offers', seedOffers)

  const campaigns = useMemo(() => {
    const ids = new Set(stored.map((campaign) => campaign.id))
    const seeds = seedCampaigns(departments, offers).filter((seed) => !ids.has(seed.id) && !deleted.includes(seed.id))
    return [...stored, ...seeds]
  }, [stored, offers, deleted])

  function upsert(next: CampaignRecord) {
    setStored((current) => [next, ...current.filter((campaign) => campaign.id !== next.id)])
  }

  function remove(id: string) {
    setStored((current) => current.filter((campaign) => campaign.id !== id))
    setDeleted((current) => (current.includes(id) ? current : [...current, id]))
  }

  return { campaigns, upsert, remove }
}
