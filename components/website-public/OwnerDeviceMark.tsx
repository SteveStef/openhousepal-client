'use client'

import { useEffect } from 'react'
import { isOwnerDevice } from '@/lib/ownerDevice'

// Saves the "this is the agent's own browser" mark the moment their site opens from an app link
// (?ohp_owner=1), whatever page they land on - so their later clicks around it aren't counted.
export default function OwnerDeviceMark() {
  useEffect(() => { isOwnerDevice() }, [])
  return null
}
