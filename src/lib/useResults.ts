import { useMemo } from 'react'
import { departments } from '../data/departments'
import { seedOffers } from '../data/offers'
import type { DepartmentKey, Offer } from '../types/domain'
import { useCampaigns } from './campaignStore'
import { computeResults, type CampaignResults } from './results'
import { useContacts } from './audience'
import { usePersistentState } from './usePersistentState'

export function useResults() {
  const { campaigns, upsert, remove } = useCampaigns()
  const [contacts] = useContacts()
  const [offers] = usePersistentState<Offer[]>('otel:offers', seedOffers)

  const results = useMemo(
    () =>
      campaigns.map((campaign) => {
        const department = departments.find((item) => item.key === campaign.departmentKey) ?? departments[0]
        return computeResults(campaign, department, contacts, offers)
      }),
    [campaigns, contacts, offers],
  )

  function forDepartment(key: DepartmentKey): CampaignResults[] {
    return results.filter((result) => result.campaign.departmentKey === key)
  }

  return { campaigns, upsert, remove, results, forDepartment, contacts, offers }
}
