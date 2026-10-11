'use client'

import OhpLoader from '@/components/brand/OhpLoader'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Activity, Building2, Cpu, FileSearch, HardDrive, HelpCircle, LayoutDashboard, LifeBuoy, ShieldCheck, Ticket, Users, Wallet, Workflow,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/lib/api-service'
import { BillingGroup, User } from '@/types'
import AuthGuard from '@/components/AuthGuard'
import Toast from '@/components/Toast'
import LuxeHero, { LuxeStats } from '@/components/ui/LuxeHero'
import AIUsagePanel from '@/components/admin/AIUsagePanel'
import ProviderBalancesPanel from '@/components/admin/ProviderBalancesPanel'
import AgentStorageUsagePanel from '@/components/admin/AgentStorageUsagePanel'
import SupportInboxPanel from '@/components/admin/SupportInboxPanel'
import PublicQuestionsPanel from '@/components/admin/PublicQuestionsPanel'
import CmaLookupPanel from '@/components/admin/CmaLookupPanel'
import FeatureFlowsPanel from '@/components/admin/FeatureFlowsPanel'
import AgentActivityPanel from '@/components/admin/AgentActivityPanel'
import AgentControlPanel from '@/components/admin/AgentControlPanel'
import BrokerageGroupsPanel from '@/components/admin/BrokerageGroupsPanel'
import AdminOverviewPanel from '@/components/admin/AdminOverviewPanel'
import PromoCodesPanel from '@/components/admin/PromoCodesPanel'

type Tab = 'overview' | 'agents' | 'groups' | 'codes' | 'activity' | 'support' | 'questions' | 'ai' | 'providers' | 'storage' | 'cma' | 'flows'

// The admin's sections, grouped the way they're used.
const NAV: { group: string; items: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }>; blurb: string }[] }[] = [
  { group: '', items: [{ key: 'overview', label: 'Overview', icon: LayoutDashboard, blurb: 'Everything that needs you, at a glance.' }] },
  { group: 'People', items: [
    { key: 'agents', label: 'Agents', icon: Users, blurb: 'Approve agents, change plans and see how each one pays.' },
    { key: 'groups', label: 'Brokerage groups', icon: Building2, blurb: 'Custom deals where a brokerage pays for its agents.' },
    { key: 'codes', label: 'Codes', icon: Ticket, blurb: 'Sign-up codes for teams and deals - a special PayPal plan, or billed by you.' },
    { key: 'activity', label: 'Activity', icon: Activity, blurb: 'What every agent uses, how often, and whether it works for them.' },
  ] },
  { group: 'Inbox', items: [
    { key: 'support', label: 'Support', icon: LifeBuoy, blurb: 'Messages from agents.' },
    { key: 'questions', label: 'Questions', icon: HelpCircle, blurb: 'Questions from the public site.' },
  ] },
  { group: 'Costs', items: [
    { key: 'ai', label: 'AI usage & cost', icon: Cpu, blurb: 'AI spend by agent and feature, and the spending limits.' },
    { key: 'providers', label: 'Provider billing', icon: Wallet, blurb: 'Balances with the services we pay for.' },
    { key: 'storage', label: 'Storage', icon: HardDrive, blurb: 'How much each agent is storing.' },
  ] },
  { group: 'Tools', items: [
    { key: 'cma', label: 'CMA lookup', icon: FileSearch, blurb: 'Find any CMA by its code.' },
    { key: 'flows', label: 'Feature flows', icon: Workflow, blurb: 'How each feature works, step by step.' },
  ] },
]
const ALL_TABS = NAV.flatMap(g => g.items)

export default function AdminDashboard() {
  return (
    <AuthGuard>
      <Suspense fallback={<OhpLoader label="Loading admin" />}>
        <AdminDashboardContent />
      </Suspense>
    </AuthGuard>
  )
}

function AdminDashboardContent() {
  const { user, isLoading: isAuthenticating } = useAuth()
  const router = useRouter()
  const params = useSearchParams()
  const fromUrl = params.get('tab') as Tab | null
  const [tab, setTabState] = useState<Tab>(fromUrl && ALL_TABS.some(t => t.key === fromUrl) ? fromUrl : 'overview')
  const [users, setUsers] = useState<User[]>([])
  const [groups, setGroups] = useState<BillingGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [supportUnread, setSupportUnread] = useState(0)
  const [questionsUnread, setQuestionsUnread] = useState(0)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({ message: '', type: 'success', isVisible: false })
  const showToast = useCallback((message: string, type: 'success' | 'error') => setToast({ message, type, isVisible: true }), [])

  // The open section lives in the address (?tab=) so refresh / back / a shared link land on it.
  const setTab = (t: Tab) => {
    setTabState(t)
    router.replace(t === 'overview' ? '/admin' : `/admin?tab=${t}`, { scroll: false })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const refreshUnreadCounts = useCallback(() => {
    api.admin.getSupportUnreadCount().then(({ success, data }) => { if (success && data) setSupportUnread(data.unread_count) })
    api.admin.getPublicQuestionsUnreadCount().then(({ success, data }) => { if (success && data) setQuestionsUnread(data.unread_count) })
  }, [])
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
    refreshUnreadCounts()
  }, [user, isAuthenticating, router, fetchUsers, fetchGroups, refreshUnreadCounts])

  // Badges keep up with tickets read here or in another tab.
  useEffect(() => {
    if (!user?.is_admin) return
    const interval = setInterval(refreshUnreadCounts, 8000)
    return () => clearInterval(interval)
  }, [user, refreshUnreadCounts])

  const approve = async (u: User) => {
    const r = await api.admin.toggleAuthorization(u.id, false)
    if (r.success) { setUsers(prev => prev.map(x => x.id === u.id ? { ...x, broker_authorized: true } : x)); showToast(`${u.first_name || u.email} is approved`, 'success') }
    else showToast(r.error || "Couldn't approve", 'error')
  }

  if (isAuthenticating || isLoading) return <OhpLoader label="Loading admin" />

  const agents = users.filter(u => !u.is_admin)
  const pending = agents.filter(u => !u.broker_authorized).length
  const badge = (k: Tab) => k === 'support' ? supportUnread : k === 'questions' ? questionsUnread : k === 'agents' ? pending : 0
  const current = ALL_TABS.find(t => t.key === tab)!

  return (
    <div className="min-h-screen bg-[#faf9f7] pb-20 transition-colors duration-300 dark:bg-[#0B0B0B]">
      <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6 sm:py-6">
        <LuxeHero
          compact
          kicker="Admin"
          icon={ShieldCheck}
          title={<>Run <em>OpenHousePal.</em></>}
          subtitle="Agents, brokerage deals, activity, support and costs - all in one place."
          asideClassName="w-full lg:w-[420px] lg:-mt-5"
          aside={<LuxeStats stats={[
            { label: 'Agents', value: agents.length, icon: Users, onClick: () => setTab('agents') },
            { label: 'To approve', value: pending, icon: ShieldCheck, urgent: pending > 0, onClick: () => setTab('agents') },
            { label: 'Unread', value: supportUnread + questionsUnread, icon: LifeBuoy, urgent: supportUnread + questionsUnread > 0, onClick: () => setTab(supportUnread ? 'support' : 'questions') },
          ]} />}
        />

        {/* Phones: the sections as one sideways row. */}
        <nav className="mt-4 -mx-4 overflow-x-auto px-4 [scrollbar-width:none] lg:hidden" aria-label="Admin sections">
          <div className="flex min-w-max gap-1.5">
            {ALL_TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} aria-current={tab === t.key ? 'page' : undefined}
                className={`relative inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black transition ${tab === t.key ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'bg-white text-gray-500 ring-1 ring-gray-200 dark:bg-[#151517] dark:text-gray-400 dark:ring-white/10'}`}>
                <t.icon className="h-3.5 w-3.5" /> {t.label}
                {badge(t.key) > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[9px] font-black text-white">{badge(t.key)}</span>}
              </button>
            ))}
          </div>
        </nav>

        <div className="mt-5 grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
          {/* Desktop: a sticky side menu, grouped. */}
          <aside className="hidden lg:block">
            <nav className="sticky top-6 space-y-5 rounded-3xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-[#151517]" aria-label="Admin sections">
              {NAV.map(g => (
                <div key={g.group || 'top'}>
                  {g.group && <p className="mb-1.5 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">{g.group}</p>}
                  <div className="space-y-0.5">
                    {g.items.map(t => {
                      const on = tab === t.key
                      return (
                        <button key={t.key} onClick={() => setTab(t.key)} aria-current={on ? 'page' : undefined}
                          className={`relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold transition ${on ? 'text-white dark:text-[#111827]' : 'text-gray-600 hover:bg-[#C9A24D]/10 hover:text-[#111827] dark:text-gray-300 dark:hover:bg-white/[0.06] dark:hover:text-white'}`}>
                          {on && <motion.span layoutId="admin-nav" className="absolute inset-0 rounded-xl bg-[#111827] shadow-md dark:bg-white" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                          <t.icon className={`relative h-4 w-4 ${on ? '' : 'text-[#C9A24D]'}`} />
                          <span className="relative flex-1">{t.label}</span>
                          {badge(t.key) > 0 && <span className={`relative rounded-full px-1.5 py-0.5 text-[10px] font-black ${on ? 'bg-[#C9A24D] text-white' : 'bg-red-500 text-white'}`}>{badge(t.key)}</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              <div className="border-t border-gray-100 px-3 pt-3 dark:border-gray-800">
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" /> System online</p>
              </div>
            </nav>
          </aside>

          <main className="min-w-0">
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              {tab !== 'activity' && tab !== 'groups' && tab !== 'codes' && (
                <div className="mb-4 flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#e8c97a]"><current.icon className="h-4.5 w-4.5" /></span>
                  <div>
                    <h2 className="text-lg font-black leading-tight text-[#111827] dark:text-white">{current.label}</h2>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{current.blurb}</p>
                  </div>
                </div>
              )}
              {tab === 'overview' && <AdminOverviewPanel users={users} groups={groups} supportUnread={supportUnread} questionsUnread={questionsUnread} onGo={t => setTab(t as Tab)} onApprove={approve} />}
              {tab === 'agents' && <AgentControlPanel users={users} setUsers={setUsers} groups={groups} onToast={showToast} onRefresh={fetchUsers} onGroupsChanged={fetchGroups} />}
              {tab === 'groups' && <BrokerageGroupsPanel users={users} groups={groups} onToast={showToast} onChanged={async () => { await Promise.all([fetchGroups(), fetchUsers()]) }} />}
              {tab === 'codes' && <PromoCodesPanel groups={groups} onToast={showToast} onAgentsChanged={fetchUsers} />}
              {tab === 'activity' && <AgentActivityPanel groups={groups} />}
              {tab === 'support' && <SupportInboxPanel onRead={refreshUnreadCounts} />}
              {tab === 'questions' && <PublicQuestionsPanel onRead={refreshUnreadCounts} />}
              {tab === 'ai' && <AIUsagePanel />}
              {tab === 'providers' && <ProviderBalancesPanel />}
              {tab === 'storage' && <AgentStorageUsagePanel />}
              {tab === 'cma' && <CmaLookupPanel />}
              {tab === 'flows' && <FeatureFlowsPanel />}
            </motion.div>
          </main>
        </div>
      </div>

      <Toast message={toast.message} type={toast.type} isVisible={toast.isVisible} onClose={() => setToast(t => ({ ...t, isVisible: false }))} />
    </div>
  )
}


