'use client'

import OhpLoader from '@/components/brand/OhpLoader'

import { Suspense } from 'react'
import BillingPanel from '@/components/settings/BillingPanel'

export default function SubscriptionManagementPage() {
  return (
    <Suspense fallback={
      <OhpLoader />
    }>
      <BillingPanel />
    </Suspense>
  )
}
