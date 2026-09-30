import type { HotelRule, MediaAsset } from '../types/domain'

const seededAt = '2026-09-01T09:00:00'

const photo = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=480&q=70`

export const seedAssets: MediaAsset[] = [
  { id: 'asset-logo', name: 'Logo pack (SVG, PNG)', kind: 'Brand', departmentKey: null, status: 'Approved', locked: true, addedAt: seededAt, addedBy: 'Hannah Smith', size: 2_400_000 },
  { id: 'asset-images', name: 'Brand image library', kind: 'Image', departmentKey: null, status: 'Approved', locked: true, addedAt: seededAt, addedBy: 'Hannah Smith', size: 184_000_000, preview: photo('photo-1566073771259-6a8506099945') },
  { id: 'asset-email-pack', name: 'Email template pack', kind: 'Template', departmentKey: null, status: 'Approved', locked: true, addedAt: seededAt, addedBy: 'Hannah Smith', size: 860_000 },
  { id: 'asset-hero-template', name: 'Signature hero template', kind: 'Template', departmentKey: null, status: 'Approved', locked: true, addedAt: seededAt, addedBy: 'Hannah Smith', size: 1_200_000 },
  { id: 'asset-spa-photos', name: 'Thermal suite photography', kind: 'Image', departmentKey: 'spa', status: 'Approved', locked: false, addedAt: '2026-09-10T11:20:00', addedBy: 'Sarah Mitchell', size: 38_000_000, preview: photo('photo-1544161515-4ab6ce6db874') },
  { id: 'asset-spa-prices', name: 'Spa treatment price list', kind: 'Price list', departmentKey: 'spa', status: 'Approved', locked: false, addedAt: '2026-09-12T09:05:00', addedBy: 'Sarah Mitchell', size: 310_000 },
  { id: 'asset-spa-diary', name: 'Spa diary screenshot', kind: 'Report', departmentKey: 'spa', status: 'Approved', locked: false, addedAt: seededAt, addedBy: 'Sarah Mitchell', size: 420_000 },
  { id: 'asset-rooms-pickup', name: 'Rooms pickup report', kind: 'Report', departmentKey: 'rooms', status: 'Approved', locked: false, addedAt: seededAt, addedBy: 'James Carter', size: 96_000 },
  { id: 'asset-menu', name: 'Restaurant menu PDF', kind: 'Menu', departmentKey: 'restaurant', status: 'Approved', locked: false, addedAt: seededAt, addedBy: 'Maya Wilson', size: 1_900_000 },
  { id: 'asset-restaurant-photos', name: '1961 dining room photography', kind: 'Image', departmentKey: 'restaurant', status: 'Approved', locked: false, addedAt: '2026-09-18T15:40:00', addedBy: 'Maya Wilson', size: 24_000_000, preview: photo('photo-1414235077428-338989a2e8c0') },
  { id: 'asset-wedding-brochure', name: 'Wedding brochure', kind: 'Brochure', departmentKey: 'events', status: 'Pending approval', locked: false, addedAt: '2026-09-25T10:15:00', addedBy: 'Priya Anand', size: 6_800_000 },
  { id: 'asset-beach-video', name: 'Beach Club summer reel', kind: 'Video', departmentKey: 'beach_club', status: 'Pending approval', locked: false, addedAt: '2026-09-27T16:30:00', addedBy: 'Noah Fischer', size: 142_000_000 },
]

export const seedRules: HotelRule[] = [
  { id: 'rule-discount', text: 'Never discount premium treatments or the main restaurant menu', createdAt: seededAt },
  { id: 'rule-cta', text: 'Every campaign needs one clear booking call to action', createdAt: seededAt },
  { id: 'rule-weekends', text: 'Do not promote weekends that are already over 90% booked', createdAt: seededAt },
  { id: 'rule-offers', text: 'Run one offer per business area at a time', createdAt: seededAt },
]
