import type { Contact } from '../types/domain'

/**
 * Hotel-wide guest segments. Every campaign audience is drawn from this catalogue.
 * `total` and `consented` are the synced list sizes (demo figures) — they already
 * include the individual seed records below. Consented excludes suppressed guests.
 */
export type SegmentDef = {
  name: string
  rule: string
  source: string
  consentBasis: string
  total: number
  consented: number
}

export const segmentCatalogue: SegmentDef[] = [
  { name: 'Past leisure guests', rule: 'Stayed in the last 24 months', source: 'PMS guest history', consentBasis: 'Opted in at booking', total: 8240, consented: 5930 },
  { name: 'Lapsed guests', rule: 'Last stay 24–48 months ago', source: 'PMS guest history', consentBasis: 'Opted in at booking', total: 5120, consented: 2870 },
  { name: 'Local audience within 50 miles', rule: 'Postcode within 50 miles, no stay yet', source: 'Newsletter and competition sign-ups', consentBasis: 'Newsletter sign-up', total: 18400, consented: 11960 },
  { name: 'Family travellers', rule: 'Booked with a child in the last 3 years', source: 'PMS guest history', consentBasis: 'Opted in at booking', total: 6220, consented: 4230 },
  { name: 'Past spa guests', rule: 'Spa visit in the last 18 months', source: 'Spa booking system', consentBasis: 'Opted in at booking', total: 3180, consented: 2410 },
  { name: 'Local audience within 15 miles', rule: 'Postcode within 15 miles', source: 'Newsletter sign-ups', consentBasis: 'Newsletter sign-up', total: 9600, consented: 6140 },
  { name: 'Health club members', rule: 'Active health club membership', source: 'Membership system', consentBasis: 'Membership terms', total: 740, consented: 690 },
  { name: 'Afternoon tea buyers', rule: 'Bought afternoon tea or a voucher', source: 'Online shop', consentBasis: 'Opted in at purchase', total: 1260, consented: 880 },
  { name: 'Past restaurant guests', rule: 'Dined in the last 12 months', source: 'Table booking system', consentBasis: 'Opted in at booking', total: 4420, consented: 2920 },
  { name: 'Local diners within 15 miles', rule: 'Local and interested in dining', source: 'Newsletter sign-ups', consentBasis: 'Newsletter sign-up', total: 7300, consented: 4530 },
  { name: 'Hotel guests dining interest', rule: 'Stayed and dined in the last 12 months', source: 'PMS guest history', consentBasis: 'Opted in at booking', total: 2150, consented: 1590 },
  { name: 'Loyalty members', rule: 'Active loyalty member', source: 'Loyalty programme', consentBasis: 'Loyalty terms', total: 6200, consented: 5700 },
  { name: 'Past enquiry contacts', rule: 'Wedding or event enquiry in the last 3 years', source: 'Events enquiry form', consentBasis: 'Enquiry form', total: 610, consented: 350 },
  { name: 'Wedding planners', rule: 'Wedding planners and agents', source: 'Trade contacts list', consentBasis: 'Legitimate interest (B2B)', total: 85, consented: 40 },
  { name: 'Local venue search traffic', rule: 'Viewed wedding pages and left details', source: 'Website forms', consentBasis: 'Website form', total: 2400, consented: 1150 },
  { name: 'Past salon guests', rule: 'Salon visit in the last 12 months', source: 'Salon booking system', consentBasis: 'Opted in at booking', total: 1340, consented: 980 },
  { name: 'Hotel guests with spa interest', rule: 'Stayed and booked a treatment', source: 'PMS guest history', consentBasis: 'Opted in at booking', total: 2900, consented: 2030 },
  { name: 'Golf members', rule: 'Active golf membership', source: 'Membership system', consentBasis: 'Membership terms', total: 420, consented: 400 },
  { name: 'Past society bookers', rule: 'Organised a society day', source: 'Tee-sheet system', consentBasis: 'Legitimate interest (B2B)', total: 160, consented: 61 },
  { name: 'Local golf audience', rule: 'Golf interest, within 30 miles', source: 'Newsletter sign-ups', consentBasis: 'Newsletter sign-up', total: 3100, consented: 1860 },
  { name: 'Past corporate bookers', rule: 'Booked a meeting or corporate stay', source: 'Sales CRM', consentBasis: 'Legitimate interest (B2B)', total: 980, consented: 610 },
  { name: 'Local business contacts', rule: 'Local businesses, no booking yet', source: 'Sales CRM', consentBasis: 'Legitimate interest (B2B)', total: 2600, consented: 1170 },
  { name: 'Local day-trippers', rule: 'Day visitor in the last 12 months', source: 'Beach Club tills and Wi-Fi sign-ups', consentBasis: 'Wi-Fi sign-up', total: 5400, consented: 3350 },
  { name: 'Hotel guests', rule: 'In house or stayed in the last 12 months', source: 'PMS guest history', consentBasis: 'Opted in at booking', total: 7800, consented: 5620 },
  { name: 'Past beach club visitors', rule: 'Day pass in the last two seasons', source: 'Beach Club booking system', consentBasis: 'Opted in at booking', total: 2200, consented: 1540 },
]

/** Unsubscribed, bounced or asked not to be contacted — synced from the email provider. Never contacted on any channel. */
export const baseSuppressed = 312

export const consentBases = [
  'Opted in at booking',
  'Opted in at purchase',
  'Newsletter sign-up',
  'Enquiry form',
  'Website form',
  'Wi-Fi sign-up',
  'Membership terms',
  'Loyalty terms',
  'Legitimate interest (B2B)',
]

export const suppressionReasons = ['Asked not to be contacted', 'Hard bounce', 'Spam complaint', 'Erasure request']

export const seedContacts: Contact[] = [
  { id: 'c1', name: 'Olivia Hart', email: 'olivia.h@example.com', segment: 'Past leisure guests', lastActivity: '2026-08-12', permission: 'Subscribed', consentBasis: 'Opted in at booking', guestValue: 640 },
  { id: 'c2', name: 'Daniel Price', email: 'daniel.p@example.com', segment: 'Past corporate bookers', lastActivity: '2026-05-15', permission: 'Subscribed', consentBasis: 'Legitimate interest (B2B)', guestValue: 2180 },
  { id: 'c3', name: 'Emily Roberts', email: 'emily.r@example.com', segment: 'Past spa guests', lastActivity: '2026-04-03', permission: 'Subscribed', consentBasis: 'Opted in at booking', guestValue: 510 },
  { id: 'c4', name: 'Michael Khan', email: 'michael.k@example.com', segment: 'Past corporate bookers', lastActivity: '2026-03-22', permission: 'Unknown', consentBasis: null, guestValue: 1920 },
  { id: 'c5', name: 'Laura Bennett', email: 'laura.b@example.com', segment: 'Past enquiry contacts', lastActivity: '2026-06-02', permission: 'Subscribed', consentBasis: 'Enquiry form', guestValue: 3400 },
  { id: 'c6', name: 'Grace Turner', email: 'grace.t@example.com', segment: 'Loyalty members', lastActivity: '2026-07-30', permission: 'Subscribed', consentBasis: 'Loyalty terms', guestValue: 1260 },
  { id: 'c7', name: 'Tom Wallace', email: 'tom.w@example.com', segment: 'Local diners within 15 miles', lastActivity: '2026-09-09', permission: 'Subscribed', consentBasis: 'Newsletter sign-up', guestValue: 210 },
  { id: 'c8', name: 'Ben Saunders', email: 'ben.s@example.com', segment: 'Past leisure guests', lastActivity: '2026-01-18', permission: 'Unsubscribed', consentBasis: null, guestValue: 480 },
  { id: 'c9', name: 'Harriet Cole', email: 'harriet.c@example.com', segment: 'Loyalty members', lastActivity: '2026-08-05', permission: 'Subscribed', consentBasis: 'Loyalty terms', guestValue: 890 },
  { id: 'c10', name: 'Owen Doyle', email: 'owen.d@example.com', segment: 'Local business contacts', lastActivity: '2026-02-11', permission: 'Unknown', consentBasis: null, guestValue: 1540 },
  { id: 'c11', name: 'Chloe Adams', email: 'chloe.a@example.com', segment: 'Past spa guests', lastActivity: '2026-06-27', permission: 'Subscribed', consentBasis: 'Opted in at booking', guestValue: 730 },
  { id: 'c12', name: 'Marcus Webb', email: 'marcus.w@example.com', segment: 'Hotel guests', lastActivity: '2025-11-04', permission: 'Unsubscribed', consentBasis: null, guestValue: 0, suppressed: true, suppressionReason: 'Asked not to be contacted' },
  { id: 'c13', name: 'Isla Morgan', email: 'isla.m@example.com', segment: 'Golf members', lastActivity: '2026-09-21', permission: 'Subscribed', consentBasis: 'Membership terms', guestValue: 1150 },
  { id: 'c14', name: 'Ravi Patel', email: 'ravi.p@example.com', segment: 'Past society bookers', lastActivity: '2026-07-14', permission: 'Unknown', consentBasis: null, guestValue: 860 },
  { id: 'c15', name: 'Sophie Lane', email: 'sophie.l@example.com', segment: 'Local day-trippers', lastActivity: '2026-08-28', permission: 'Subscribed', consentBasis: 'Wi-Fi sign-up', guestValue: 95 },
  { id: 'c16', name: 'Hugo Bell', email: 'hugo.b@example.com', segment: 'Past salon guests', lastActivity: '2026-09-02', permission: 'Subscribed', consentBasis: 'Opted in at booking', guestValue: 320 },
  { id: 'c17', name: 'Ella Fraser', email: 'ella.f@example.com', segment: 'Afternoon tea buyers', lastActivity: '2026-08-19', permission: 'Unknown', consentBasis: null, guestValue: 140 },
]
