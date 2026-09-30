import { useMemo } from 'react'
import { departments } from '../data/departments'
import { seedOffers } from '../data/offers'
import { seedCampaigns } from '../services/campaigns'
import type { CampaignRecord, Offer } from '../types/domain'
import { usePersistentState } from './usePersistentState'

export function useCampaigns() {
  const [stored, setStored] = usePersistentState<CampaignRecord[]>('otel:campaigns', [])
  const [offers] = usePersistentState<Offer[]>('otel:offers', seedOffers)

  const campaigns = useMemo(() => {
    const ids = new Set(stored.map((campaign) => campaign.id))
    return [...stored, ...seedCampaigns(departments, offers).filter((seed) => !ids.has(seed.id))]
  }, [stored, offers])

  function upsert(next: CampaignRecord) {
    setStored((current) => [next, ...current.filter((campaign) => campaign.id !== next.id)])
  }

  return { campaigns, upsert }
}
