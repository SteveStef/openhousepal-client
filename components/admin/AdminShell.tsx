'use client'

import OhpLoader from '@/components/brand/OhpLoader'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { LifeBuoy, ShieldCheck, Users } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/lib/api-service'
import { BillingGroup, User } from '@/types'
import Toast from '@/components/Toast'
import LuxeHero, { LuxeStats, LuxeTabs } from '@/components/ui/LuxeHero'
import { ADMIN_UNREAD_EVENT, useAdminUnread } from '@/hooks/useAdminUnread'
import { adminHref, adminLocation } from '@/lib/adminNav'
import AIUsagePanel from '@/components/admin/AIUsagePanel'
import RecentFailuresPanel from '@/components/admin/RecentFailuresPanel'
import ProviderBalancesPanel from '@/components/admin/ProviderBalancesPanel'
import AgentStorageUsagePanel from '@/components/admin/AgentStorageUsagePanel'
import SupportInboxPanel from '@/components/admin/SupportInboxPanel'
import PublicQuestionsPanel from '@/components/admin/PublicQuestionsPanel'
import CmaLookupPanel from '@/components/admin/CmaLookupPanel'
import CmaBacktestPanel from '@/components/admin/CmaBacktestPanel'
import FeatureFlowsPanel from '@/components/admin/FeatureFlowsPanel'
import AgentActivityPanel from '@/components/admin/AgentActivityPanel'
import AgentControlPanel from '@/components/admin/AgentControlPanel'
import BrokerageGroupsPanel from '@/components/admin/BrokerageGroupsPanel'
import AdminOverviewPanel from '@/components/admin/AdminOverviewPanel'
import PromoCodesPanel from '@/components/admin/PromoCodesPanel'
import NeighborhoodsPanel from '@/components/admin/NeighborhoodsPanel'
import InsightsPanel from '@/components/admin/insights/InsightsPanel'
import EmailHealthPanel from '@/components/admin/insights/EmailHealthPanel'
import AdminMobileStyles from '@/components/admin/AdminMobileStyles'

// One admin page: its section's header + tabs, and the open tab's panel. The sections are the
// admin's own items in the top bar (lib/adminNav.ts); /admin/<section>/<tab> picks the tab.
export default function AdminShell({ sectionKey, tabKey }: { sectionKey: string; tabKey?: string | null }) {
  const { user, isLoading: isAuthenticating } = useAuth()
  const router = useRouter()
  const { section, tab } = adminLocation(sectionKey, tabKey)
  const [users, setUsers] = useState<User[]>([])
  const [groups, setGroups] = useState<BillingGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { support: supportUnread, questions: questionsUnread } = useAdminUnread(8000)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({ message: '', type: 'success', isVisible: false })
  const showToast = useCallback((message: string, type: 'success' | 'error') => setToast({ message, type, isVisible: true }), [])

  const go = useCallback((t: string) => {
    router.push(adminHref(t), { scroll: false })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [router])
  const unreadChanged = useCallback(() => window.dispatchEvent(new Event(ADMIN_UNREAD_EVENT)), [])

  const fetchUsers = useCallback(async () => {
    const { success, data, error } = await api.admin.getUsers()
    if (success && data) setUsers(data)
    else showToast(error || 'Failed to load agents', 'error')
  }, [showToast])
  const fetchGroups = useCallback(async () => {
    const r = await api.admin.getGroups()
    if (r.success && r.data) setGroups(r.data)
  }, [])

  useEffect(() => {
    if (isAuthenticating) return
    if (!user?.is_admin) { router.push('/'); return }
    Promise.all([fetchUsers(), fetchGroups()]).finally(() => setIsLoading(false))
  }, [user, isAuthenticating, router, fetchUsers, fetchGroups])

  const approve = async (u: User) => {
    const r = await api.admin.toggleAuthorization(u.id, false)
    if (r.success) { setUsers(prev => prev.map(x => x.id === u.id ? { ...x, broker_authorized: true } : x)); showToast(`${u.first_name || u.email} is approved`, 'success') }
    else showToast(r.error || "Couldn't approve", 'error')
  }

  if (isAuthenticating || isLoading) return <OhpLoader label="Loading admin" />

  const agents = users.filter(u => !u.is_admin)
  const pending = agents.filter(u => !u.broker_authorized).length
  const count = (k: string) => k === 'support' ? supportUnread : k === 'questions' ? questionsUnread : k === 'agents' ? pending : 0
  const k = tab.key
  // Panels with their own big heading skip the small one.
  const ownHeading = ['overview', 'activity', 'groups', 'codes', 'neighborhoods'].includes(k) || section.key === 'insights'

  return (
    <div className="ohp-admin min-h-screen bg-[#faf9f7] pb-20 transition-colors duration-300 dark:bg-[#0B0B0B]">
      <AdminMobileStyles />
      <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6 sm:py-6">
        <LuxeHero
          compact
          kicker={section.key === 'overview' ? 'Admin' : `Admin · ${section.label}`}
          icon={section.key === 'overview' ? ShieldCheck : section.icon}
          title={<em>{section.title}</em>}
          subtitle={section.subtitle}
          subtitleClassName="max-sm:hidden"
          // Phones: a back arrow on every admin page but the Overview (the admin's home) - back to
          // the admin page you came from, or the Overview on a fresh tab. Computers unchanged.
          backHref={section.key === 'overview' ? undefined : '/admin'}
          backLabel="Admin overview"
          backPhoneOnly
          asideClassName="w-full lg:w-[420px] lg:-mt-5"
          aside={<LuxeStats stats={[
            { label: 'Agents', value: agents.length, icon: Users, onClick: () => go('agents') },
            { label: 'To approve', value: pending, icon: ShieldCheck, urgent: pending > 0, onClick: () => go('agents') },
            { label: 'Unread', value: supportUnread + questionsUnread, icon: LifeBuoy, urgent: supportUnread + questionsUnread > 0, onClick: () => go(supportUnread ? 'support' : 'questions') },
          ]} />}
          tabs={section.tabs.length > 1 ? (
            <LuxeTabs
              label={`${section.label} tabs`}
              items={section.tabs.map(t => ({ id: t.key, label: count(t.key) ? `${t.label} (${count(t.key)})` : t.label, icon: t.icon }))}
              active={k}
              onChange={go}
              wrapOnPhone
            />
          ) : undefined}
        />

        <main className="mt-5 min-w-0">
          <motion.div key={k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            {!ownHeading && (
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#e8c97a]"><tab.icon className="h-4.5 w-4.5" /></span>
                <div>
                  <h2 className="text-lg font-black leading-tight text-[#111827] dark:text-white">{tab.label}</h2>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{tab.blurb}</p>
                </div>
              </div>
            )}
            {k === 'overview' && <AdminOverviewPanel users={users} groups={groups} supportUnread={supportUnread} questionsUnread={questionsUnread} onGo={go} onApprove={approve} />}
            {k === 'agents' && <AgentControlPanel users={users} setUsers={setUsers} groups={groups} onToast={showToast} onRefresh={fetchUsers} onGroupsChanged={fetchGroups} />}
            {k === 'groups' && <BrokerageGroupsPanel users={users} groups={groups} onToast={showToast} onChanged={async () => { await Promise.all([fetchGroups(), fetchUsers()]) }} />}
            {k === 'codes' && <PromoCodesPanel groups={groups} onToast={showToast} onAgentsChanged={fetchUsers} />}
            {k === 'activity' && <AgentActivityPanel groups={groups} />}
            {section.key === 'insights' && k !== 'emailhealth' && <InsightsPanel page={k} blurb={tab.blurb} title={tab.label} onGo={go} />}
            {k === 'emailhealth' && <EmailHealthPanel title={tab.label} blurb={tab.blurb} />}
            {k === 'support' && <SupportInboxPanel onRead={unreadChanged} />}
            {k === 'questions' && <PublicQuestionsPanel onRead={unreadChanged} />}
            {k === 'failures' && <RecentFailuresPanel />}
            {k === 'ai' && <AIUsagePanel />}
            {k === 'providers' && <ProviderBalancesPanel />}
            {k === 'storage' && <AgentStorageUsagePanel />}
            {k === 'cma' && <CmaLookupPanel />}
            {k === 'cmatest' && <CmaBacktestPanel />}
            {k === 'neighborhoods' && <NeighborhoodsPanel onToast={showToast} />}
            {k === 'flows' && <FeatureFlowsPanel />}
          </motion.div>
        </main>
      </div>

      <Toast message={toast.message} type={toast.type} isVisible={toast.isVisible} onClose={() => setToast(t => ({ ...t, isVisible: false }))} />
    </div>
  )
}
