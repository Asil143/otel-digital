import { useMemo } from 'react'
import { seedContacts } from '../data/contacts'
import { departments } from '../data/departments'
import { seedOffers } from '../data/offers'
import type { Contact, DepartmentKey, Offer } from '../types/domain'
import { useCampaigns } from './campaignStore'
import { computeResults, type CampaignResults } from './results'
import { usePersistentState } from './usePersistentState'

export function useResults() {
  const { campaigns, upsert } = useCampaigns()
  const [contacts] = usePersistentState<Contact[]>('otel:audience-contacts', seedContacts)
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

  return { campaigns, upsert, results, forDepartment, contacts, offers }
}
