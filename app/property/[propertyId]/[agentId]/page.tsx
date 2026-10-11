'use client'

import { useParams, useSearchParams } from 'next/navigation'
import PropertyDetailView from '@/components/PropertyDetailView'

// Public listing page - a Similar Homes QR, the Agent Hub's listing cards, the email signature...
export default function PropertyPage() {
  const { propertyId, agentId } = useParams()
  const searchParams = useSearchParams()
  return (
    <PropertyDetailView
      propertyId={propertyId as string}
      agentId={agentId as string}
      initialAction={searchParams.get('action')}
    />
  )
}
