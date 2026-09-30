import type { HotelRule, MediaAsset } from '../types/domain'

const seededAt = '2026-09-01T09:00:00'

export const seedAssets: MediaAsset[] = [
  { id: 'asset-logo', name: 'Logo pack (SVG, PNG)', kind: 'Brand', departmentKey: null, status: 'Approved', locked: true, addedAt: seededAt },
  { id: 'asset-images', name: 'Brand image library', kind: 'Image', departmentKey: null, status: 'Approved', locked: true, addedAt: seededAt },
  { id: 'asset-email-pack', name: 'Email template pack', kind: 'Template', departmentKey: null, status: 'Approved', locked: true, addedAt: seededAt },
  { id: 'asset-hero-template', name: 'Signature hero template', kind: 'Template', departmentKey: null, status: 'Approved', locked: true, addedAt: seededAt },
  { id: 'asset-spa-diary', name: 'Spa diary screenshot', kind: 'Report', departmentKey: 'spa', status: 'Approved', locked: false, addedAt: seededAt },
  { id: 'asset-rooms-pickup', name: 'Rooms pickup report', kind: 'Report', departmentKey: 'rooms', status: 'Approved', locked: false, addedAt: seededAt },
  { id: 'asset-menu', name: 'Restaurant menu PDF', kind: 'Menu', departmentKey: 'restaurant', status: 'Approved', locked: false, addedAt: seededAt },
  { id: 'asset-wedding-brochure', name: 'Wedding brochure', kind: 'Brochure', departmentKey: 'events', status: 'Pending approval', locked: false, addedAt: seededAt },
]

export const seedRules: HotelRule[] = [
  { id: 'rule-discount', text: 'Never discount premium treatments or the main restaurant menu', createdAt: seededAt },
  { id: 'rule-cta', text: 'Every campaign needs one clear booking call to action', createdAt: seededAt },
  { id: 'rule-weekends', text: 'Do not promote weekends that are already over 90% booked', createdAt: seededAt },
  { id: 'rule-offers', text: 'Run one offer per business area at a time', createdAt: seededAt },
]
