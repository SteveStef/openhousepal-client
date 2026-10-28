'use client'

import { usePathname } from 'next/navigation'
import OhpLoader from '@/components/brand/OhpLoader'

// Shown while this page loads - the OpenHousePal house drawing itself. Manager (my-listings) is the
// agent's own listings, so it says so - this loader shows first even there (user, 10/27).
export default function Loading() {
  const path = usePathname() || ''
  return <OhpLoader label={path.startsWith('/open-houses/my-listings') ? 'Opening your listings' : 'Loading your open houses'} />
}
