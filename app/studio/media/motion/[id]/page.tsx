'use client'

// AI Media - Cinematic Video editor page. The editor itself is a component so the same editor also
// runs inside the AI chat: components/studio/media/cinematic/CinematicEditor.tsx.
import { useParams } from 'next/navigation'
import AuthGuard from '@/components/AuthGuard'
import BrokerAuthorizationGuard from '@/components/BrokerAuthorizationGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import CinematicEditor from '@/components/studio/media/cinematic/CinematicEditor'

export default function CinematicEditorPage() {
  const params = useParams<{ id: string }>()
  return (
    <AuthGuard>
      <BrokerAuthorizationGuard>
        <SubscriptionGuard requireStudioMediaAccess>
          <CinematicEditor id={params?.id as string} />
        </SubscriptionGuard>
      </BrokerAuthorizationGuard>
    </AuthGuard>
  )
}
