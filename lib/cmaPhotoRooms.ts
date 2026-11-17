// Kitchen / Baths in the photo viewer (owner, 11/16: "since we sort through all the pictures and label them,
// shouldn't there be a clickable button where it says kitchen and baths? ... so people can flip through the
// bathrooms easily ... click next property and it shows the subject's kitchen or bathroom, and the next property").
//
// The AI run saves which room each photo shows (`photo_rooms`, one entry per photo, same order as `photos`).
// This file turns that into "the photos to flip through" for the Subject vs Comp viewer in the Analysis step.
// It only chooses which photos show - nothing here is saved and nothing reaches the client's report.

export type CmaRoomFilter = 'all' | 'kitchen' | 'bath' | 'outside'

export const CMA_ROOM_FILTERS: { key: CmaRoomFilter; label: string; rooms: string[]; noun: string }[] = [
  { key: 'all', label: 'All', rooms: [], noun: '' },
  { key: 'kitchen', label: 'Kitchen', rooms: ['kitchen'], noun: 'kitchen' },
  { key: 'bath', label: 'Baths', rooms: ['bathroom'], noun: 'bathroom' },
  { key: 'outside', label: 'Outside', rooms: ['exterior_front', 'exterior_back_or_yard'], noun: 'outside' },
]

type RoomHome = { photos?: (string | null | undefined)[] | null; photo_rooms?: (string | null)[] | null }

/** True when this home's photos have been sorted by room (and the labels still line up with its photo list). */
export function cmaHomeHasRooms(home?: RoomHome | null): boolean {
  const photos = home?.photos || []
  const rooms = home?.photo_rooms
  return Array.isArray(rooms) && photos.length > 0 && rooms.length === photos.length && rooms.some(Boolean)
}

export interface CmaRoomView {
  /** The photos to flip through. */
  photos: string[]
  /** 'all' = no filter; 'room' = just that room's photos; 'none' = sorted, but no photo of that room;
   *  'unsorted' = this home's photos were never sorted by room, so all of them show. */
  state: 'all' | 'room' | 'none' | 'unsorted'
}

/** A home's photos for the chip that is on. */
export function cmaRoomPhotos(home: RoomHome | null | undefined, filter: CmaRoomFilter): CmaRoomView {
  const all = (home?.photos || []).filter((p): p is string => !!p)
  const want = CMA_ROOM_FILTERS.find(f => f.key === filter)?.rooms || []
  if (filter === 'all' || want.length === 0) return { photos: all, state: 'all' }
  if (!cmaHomeHasRooms(home)) return { photos: all, state: 'unsorted' }
  const rooms = home!.photo_rooms as (string | null)[]
  const picked = (home!.photos || []).filter((p, i): p is string => !!p && want.includes(rooms[i] || ''))
  return picked.length ? { photos: picked, state: 'room' } : { photos: [], state: 'none' }
}

/** "No kitchen photo in this listing" */
export function cmaNoRoomPhotoText(filter: CmaRoomFilter): string {
  const noun = CMA_ROOM_FILTERS.find(f => f.key === filter)?.noun || 'matching'
  return `No ${noun} photo in this listing`
}
