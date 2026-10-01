import type { DepartmentKey } from '../types/domain'

const photo = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`

/**
 * A small curated photo set per business area (sample photography — replace with the hotel's
 * own approved imagery). The first photo is the area's main image. Each design format starts
 * on a different photo so a campaign's set doesn't repeat one picture.
 */
export const areaImages: Record<DepartmentKey, string[]> = {
  rooms: ['photo-1566073771259-6a8506099945', 'photo-1611892440504-42a792e24d32', 'photo-1590490360182-c33d57733427', 'photo-1582719478250-c89cae4dc85b'].map(photo),
  spa: ['photo-1544161515-4ab6ce6db874', 'photo-1600334089648-b0d9d3028eb2', 'photo-1507652313519-d4e9174996dd', 'photo-1540555700478-4be289fbecef'].map(photo),
  restaurant: ['photo-1414235077428-338989a2e8c0', 'photo-1504674900247-0877df9cc836', 'photo-1517248135467-4c7edcad34c4', 'photo-1550966871-3ed3cdb5ed0c'].map(photo),
  events: ['photo-1519741497674-611481863552', 'photo-1519225421980-715cb0215aed', 'photo-1465495976277-4387d4b0b4c6', 'photo-1469371670807-013ccf25f16a'].map(photo),
  hair_beauty: ['photo-1487412947147-5cebf100ffc2', 'photo-1562322140-8baeececf3df', 'photo-1522337360788-8b13dee7a37e', 'photo-1560066984-138dadb4c035'].map(photo),
  golf: ['photo-1587174486073-ae5e5cff23aa', 'photo-1535131749006-b7f58c99034b', 'photo-1593111774240-d529f12cf4bb', 'photo-1500932334442-8761ee4810a7'].map(photo),
  meetings: ['photo-1497366216548-37526070297c', 'photo-1517502884422-41eaead166d4', 'photo-1431540015161-0bf868a2d407', 'photo-1556761175-5973dc0f32e7'].map(photo),
  beach_club: ['photo-1507525428034-b723cf961d3e', 'photo-1473116763249-2faaef81ccda', 'photo-1519046904884-53103b34b206', 'photo-1520454974749-611b7248ffdb'].map(photo),
}
