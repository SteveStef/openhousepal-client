'use client'

import { useParams } from 'next/navigation'
import AuthGuard from '@/components/AuthGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import DesignEditor from '@/components/studio/design/editor/DesignEditor'

// The design editor - one editor, opened straight from "Edit". See components/studio/design/editor.
export default function DesignEditorPage() {
  const params = useParams<{ id: string }>()
  return (
    <AuthGuard>
      <SubscriptionGuard requireStudioDesignAccess>
        <DesignEditor designId={params.id} />
      </SubscriptionGuard>
    </AuthGuard>
  )
}
