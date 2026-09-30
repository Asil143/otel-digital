import type { CampaignRecord, UserRole } from '../types/domain'
import { allRequiredApproved } from './campaigns'

export function canApprove(role: UserRole): boolean {
  return role === 'Hotel manager'
}

export function canPublish(role: UserRole, campaign: CampaignRecord): boolean {
  return role === 'Hotel manager' && allRequiredApproved(campaign)
}

export function canRequestApproval(role: UserRole): boolean {
  return role === 'Hotel manager' || role === 'Department manager'
}

// Hotel-wide settings: property facts, integrations, contact imports and exports.
export function canManageHotel(role: UserRole): boolean {
  return role === 'Hotel manager'
}
