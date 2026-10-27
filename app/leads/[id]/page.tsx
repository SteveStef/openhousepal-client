'use client'

import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import LeadDetailPanel from '@/components/leads/LeadDetailPanel'
import { smartBack } from '@/lib/navHistory'

export default function LeadDetailPage() {
  const params = useParams()
  const router = useRouter()
  const leadId = params?.id as string

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]">
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-5 sm:py-14">
        {/* smartBack, not a push to /leads - this page is linked from the Dash, notifications
            and the Leads list alike, so "back" returns wherever the agent actually came from, and
            to Leads when opened fresh (an email link). The panel's own back link is for bigger
            screens; phones get this one. */}
        <button onClick={() => smartBack(router, '/leads')} className="mb-3 inline-flex items-center gap-1.5 text-sm font-black text-gray-500 sm:hidden">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <LeadDetailPanel leadId={leadId} onBack={() => smartBack(router, '/leads')} backLabel="Back" />
      </div>
    </div>
  )
}
