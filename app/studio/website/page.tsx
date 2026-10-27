'use client'

import { useEffect, useState } from 'react'
import { Globe } from 'lucide-react'
import AuthGuard from '@/components/AuthGuard'
import BrokerAuthorizationGuard from '@/components/BrokerAuthorizationGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import LuxeHero, { LuxeTabs } from '@/components/ui/LuxeHero'
import HubReadinessNotice from '@/components/agent-hub/HubReadinessNotice'
import WebsiteEditorShell, { EditorTab, TABS } from '@/components/studio/website/WebsiteEditorShell'

function WebsiteStudioPage() {
  const [actions, setActions] = useState<React.ReactNode>(null)
  const [tab, setTab] = useState<EditorTab>('content')
  const [barEnd, setBarEnd] = useState<React.ReactNode>(null)
  // ?tab=domains (Settings -> IDX Website shortcuts, setup's "connect my domain") opens that tab.
  useEffect(() => {
    const want = new URLSearchParams(window.location.search).get('tab') as EditorTab | null
    if (want && TABS.some(t => t.id === want)) setTab(want)
  }, [])

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-5 sm:py-6">
        <LuxeHero
          compact
          asideClassName="lg:w-[400px] lg:-mt-5"
          kicker="IDX Website"
          icon={Globe}
          title={<>Your site, <em>your brand</em></>}
          subtitle="Edit any part of your site and watch it change in the preview - then publish it live on your OpenHousePal address or your own domain."
          aside={actions}
          tabs={<LuxeTabs items={TABS} active={tab} onChange={setTab} label="Site sections" end={barEnd} />}
        />

        <div className="mt-5">
          <HubReadinessNotice className="mb-4" />
          <WebsiteEditorShell onActionsChange={setActions} onBarEndChange={setBarEnd} tab={tab} onTabChange={setTab} />
        </div>
      </div>
    </div>
  )
}

export default function WebsiteStudioPageGuarded() {
  return (
    <AuthGuard>
      <BrokerAuthorizationGuard>
        <SubscriptionGuard requiredTier="IDX">
          <WebsiteStudioPage />
        </SubscriptionGuard>
      </BrokerAuthorizationGuard>
    </AuthGuard>
  )
}
