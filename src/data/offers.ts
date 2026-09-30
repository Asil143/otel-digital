import type { KeyDate, Offer } from '../types/domain'

export const seedOffers: Offer[] = [
  { id: 'offer-rooms-midweek', departmentKey: 'rooms', name: '2-night stay with dinner', price: '£289', startDate: '2026-10-05', endDate: '2026-11-27', status: 'Active', terms: 'Sunday–Thursday arrivals. Dinner on one night, breakfast daily. Subject to availability.' },
  { id: 'offer-rooms-autumn', departmentKey: 'rooms', name: 'Autumn by the sea B&B', price: '£149', startDate: '2026-09-01', endDate: '2026-10-31', status: 'Active', terms: 'Bed and breakfast for two. Minimum two nights at weekends.' },
  { id: 'offer-spa-midweek', departmentKey: 'spa', name: 'Midweek Spa Day £79', price: '£79', startDate: '2026-10-06', endDate: '2026-11-04', status: 'Active', terms: 'Tuesday–Thursday. 50-minute treatment, lunch and full use of the thermal suite.' },
  { id: 'offer-spa-twilight', departmentKey: 'spa', name: 'Twilight Spa & Supper', price: '£65', startDate: '2026-11-01', endDate: '2026-12-20', status: 'Draft', terms: 'From 5pm. Two treatments and a two-course supper.' },
  { id: 'offer-restaurant-1961', departmentKey: 'restaurant', name: '1961 Menu - 2 courses £20.95', price: '£20.95', startDate: '2026-10-06', endDate: '2026-11-24', status: 'Active', terms: 'Tuesday–Thursday dinner. Excludes Christmas and New Year.' },
  { id: 'offer-restaurant-sunday', departmentKey: 'restaurant', name: 'Sunday lunch, three courses', price: '£35', startDate: '2026-10-04', endDate: '2026-10-25', status: 'Active', terms: 'Sunday lunch, 12–4pm. Children’s menu available.' },
  { id: 'offer-events-weekday', departmentKey: 'events', name: 'Weekday wedding package with added-value extras', price: 'From £6,900', startDate: '2027-03-01', endDate: '2027-05-31', status: 'Active', terms: 'Monday–Thursday weddings, March–May 2027. Includes room hire, drinks package and bridal suite.', channels: ['Email', 'Website'] },
  { id: 'offer-hair-signature', departmentKey: 'hair_beauty', name: 'Signature blow-dry and treatment package', price: '£68', startDate: '2026-09-01', endDate: '2026-12-31', status: 'Active' },
  { id: 'offer-golf-twilight', departmentKey: 'golf', name: 'Twilight rounds for two', price: '£48', startDate: '2026-09-15', endDate: '2026-10-31', status: 'Active' },
  { id: 'offer-meetings-daydelegate', departmentKey: 'meetings', name: 'Midweek day-delegate package', price: '£62 per head', startDate: '2026-10-01', endDate: '2026-12-18', status: 'Active', terms: 'Minimum 10 delegates. Room hire, lunch and refreshments.', channels: ['Email', 'Website'] },
  { id: 'offer-beach-daypass', departmentKey: 'beach_club', name: 'Beach Club day pass', price: '£35', startDate: '2026-05-01', endDate: '2026-10-31', status: 'Active' },
]

export const seedKeyDates: KeyDate[] = [
  { id: 'date-halfterm', departmentKey: 'all', name: 'October half term', date: '2026-10-24', endDate: '2026-11-01', kind: 'Event' },
  { id: 'date-halloween', departmentKey: 'spa', name: 'Halloween', date: '2026-10-31', kind: 'Event' },
  { id: 'date-rooms-quiet', departmentKey: 'rooms', name: 'Midweek quiet period', date: '2026-10-12', endDate: '2026-10-15', kind: 'Quiet period' },
  { id: 'date-showcase', departmentKey: 'events', name: 'Wedding showcase', date: '2026-10-18', kind: 'Event' },
  { id: 'date-restaurant-quiet', departmentKey: 'restaurant', name: 'Tuesday dinner quiet period', date: '2026-10-13', kind: 'Quiet period' },
  { id: 'date-approval', departmentKey: 'all', name: 'Autumn campaign approval deadline', date: '2026-10-02', kind: 'Deadline' },
  { id: 'date-festive', departmentKey: 'all', name: 'Festive bookings open', date: '2026-11-02', kind: 'Event' },
]
