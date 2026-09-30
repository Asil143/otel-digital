import type { DepartmentKey } from '../types/domain'

/** Sample reports used when a real file can't be read in this demo (PDF, spreadsheet, screenshot without the AI server). */
export const sampleReports: Record<DepartmentKey, { file: string; type: string; fields: Record<string, string>; confidence: 'High' | 'Medium' | 'Low' }> = {
  rooms: { file: 'rooms-pickup-report-october.xlsx', type: 'Excel report', confidence: 'High', fields: { period: '12 Oct 2026 - 30 Oct 2026', occupancy: '68%', revpar: '£78', directBookings: '142', quietDemand: 'Monday - Thursday' } },
  spa: { file: 'spa-diary-screenshot.png', type: 'Diary screenshot', confidence: 'High', fields: { period: '14 Oct 2026 - 4 Nov 2026', quietDays: 'Tuesday, Wednesday', activeOffer: 'Midweek Spa Day £79', availability: 'High afternoon availability', bookings: '342' } },
  restaurant: { file: 'restaurant-trading-update.pdf', type: 'PDF report', confidence: 'Medium', fields: { period: '6 Oct 2026 - 27 Oct 2026', servicePeriod: 'Weekday dinner', quietDay: 'Tuesday', covers: '824', averageSpend: '£32' } },
  events: { file: 'wedding-enquiry-log.csv', type: 'CSV export', confidence: 'Medium', fields: { period: 'Spring 2027', enquiries: '38', confirmedDates: '14', openWeekdays: '9', avgPackage: '£8,400' } },
  hair_beauty: { file: 'salon-booking-export.xlsx', type: 'Excel report', confidence: 'High', fields: { period: 'Rolling 4 weeks', bookings: '206', avgTicket: '£54', rebookingRate: '61%', peakDay: 'Saturday (full)' } },
  golf: { file: 'tee-sheet-export.pdf', type: 'PDF report', confidence: 'Low', fields: { period: 'Last 18 days', roundsPlayed: '312', teeTimeFill: '74%', societyBookings: '4', lastUpdate: '18 days ago' } },
  meetings: { file: 'mice-pipeline-notes.pdf', type: 'PDF report', confidence: 'Medium', fields: { period: 'Current quarter', dayDelegates: '58', roomHireDays: '11', avgPackage: '£62/head', pipelineEnquiries: '7' } },
  beach_club: { file: 'beach-club-sales-export.csv', type: 'CSV export', confidence: 'Medium', fields: { period: 'Current season', dayPassesSold: '164', otaShare: '9%', directShare: '91%', avgSpend: '£46' } },
}
