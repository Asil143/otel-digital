import type { Contact } from '../types/domain'

export const segments = [
  'Past leisure guests',
  'Corporate contacts',
  'Past spa guests',
  'Wedding enquiries',
  'Local diners',
  'Loyalty members',
  'Suppression list',
]

export const seedContacts: Contact[] = [
  { id: 'c1', name: 'Sarah Mitchell', email: 'sarah.m@example.com', segment: 'Past leisure guests', lastActivity: '12 Aug 2026', permission: 'Subscribed', guestValue: 640 },
  { id: 'c2', name: 'James Carter', email: 'james.c@example.com', segment: 'Corporate contacts', lastActivity: '15 May 2026', permission: 'Subscribed', guestValue: 2180 },
  { id: 'c3', name: 'Emily Roberts', email: 'emily.r@example.com', segment: 'Past spa guests', lastActivity: '3 Apr 2026', permission: 'Subscribed', guestValue: 510 },
  { id: 'c4', name: 'Michael Khan', email: 'michael.k@example.com', segment: 'Corporate contacts', lastActivity: '22 Mar 2026', permission: 'Unknown', guestValue: 1920 },
  { id: 'c5', name: 'Laura Bennett', email: 'laura.b@example.com', segment: 'Wedding enquiries', lastActivity: '2 Jun 2026', permission: 'Subscribed', guestValue: 3400 },
  { id: 'c6', name: 'Priya Anand', email: 'priya.a@example.com', segment: 'Loyalty members', lastActivity: '30 Jul 2026', permission: 'Subscribed', guestValue: 1260 },
  { id: 'c7', name: 'Tom Wallace', email: 'tom.w@example.com', segment: 'Local diners', lastActivity: '9 Sep 2026', permission: 'Subscribed', guestValue: 210 },
  { id: 'c8', name: 'Noah Fischer', email: 'noah.f@example.com', segment: 'Past leisure guests', lastActivity: '18 Jan 2026', permission: 'Unsubscribed', guestValue: 480 },
  { id: 'c9', name: 'Callum Reid', email: 'callum.r@example.com', segment: 'Loyalty members', lastActivity: '5 Aug 2026', permission: 'Subscribed', guestValue: 890 },
  { id: 'c10', name: 'Diane Foster', email: 'diane.f@example.com', segment: 'Corporate contacts', lastActivity: '11 Feb 2026', permission: 'Unknown', guestValue: 1540 },
  { id: 'c11', name: 'Lauren Ng', email: 'lauren.n@example.com', segment: 'Past spa guests', lastActivity: '27 Jun 2026', permission: 'Subscribed', guestValue: 730 },
  { id: 'c12', name: 'Reserved contact', email: 'suppressed@example.com', segment: 'Suppression list', lastActivity: '—', permission: 'Unsubscribed', guestValue: 0 },
]
