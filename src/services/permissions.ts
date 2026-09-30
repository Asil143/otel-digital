import type { CampaignRecord, UserRole } from '../types/domain'
import { allRequiredApproved } from './campaigns'

export function canApprove(role: UserRole): boolean {
  return role === 'Hotel manager'
}

export function canPublish(role: UserRole, campaign: CampaignRecord): boolean {
  return role === 'Hotel manager' && allRequiredApproved(campaign)
}

export function canEditCampaign(role: UserRole): boolean {
  return role === 'Hotel manager' || role === 'Department manager'
}

export function canRequestApproval(role: UserRole): boolean {
  return role === 'Hotel manager' || role === 'Department manager'
}

export function roleScopeLabel(role: UserRole): string {
  if (role === 'Hotel manager') return 'Full hotel access'
  if (role === 'Department manager') return 'Department-level access'
  return 'Support access'
}
