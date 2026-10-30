import type { OpenHouse } from '@/types'

// Similar Homes counts as on only with homes picked. Kits made before the switch existed (10/15)
// that left Similar Homes out were saved "on" with no homes - they show as off, and Include opens
// the picker (user, 10/30).
export const similarHomesOn = (oh: Pick<OpenHouse, 'similarHomes' | 'similarPropertiesSnapshot'> | null | undefined) =>
  !!oh && oh.similarHomes !== false && !!(oh.similarPropertiesSnapshot || []).length
