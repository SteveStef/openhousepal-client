'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/lib/api-service'
import { User } from '@/types'
import AuthGuard from '@/components/AuthGuard'
import Toast from '@/components/Toast'
import ConfirmationModal from '@/components/ConfirmationModal'
import { 
  Users, 
  Search, 
  Filter, 
  ShieldCheck, 
  ShieldAlert, 
  UserCheck, 
  UserX,
  Mail,
  MapPin,
  Calendar,
  Hash,
  ArrowUpDown,
  ExternalLink
} from 'lucide-react'

export default function AdminDashboard() {
  return (
    <AuthGuard>
      <AdminDashboardContent />
    </AuthGuard>
  )
}

function AdminDashboardContent() {
  const { user, isAuthenticated, isLoading: isAuthenticating } = useAuth()
  const router = useRouter()
  
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'AUTHORIZED' | 'PENDING'>('ALL')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '', type: 'success', isVisible: false
  })

  // Plan Update States
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false)
  const [targetUser, setTargetUser] = useState<User | null>(null)
  const [targetPlan, setTargetPlan] = useState<string | null>(null)
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false)

  useEffect(() => {
    if (!isAuthenticating) {
      if (!user?.is_admin) {
        router.push('/')
      } else {
        fetchUsers()
      }
    }
  }, [user, isAuthenticating, router])

  const fetchUsers = async () => {
    setIsLoading(true)
    const { success, data, error } = await api.admin.getUsers()
    
    if (success && data) {
      setUsers(data)
    } else {
      showToast(error || 'Failed to load users', 'error')
    }
    setIsLoading(false)
  }

  const toggleAuthorization = async (userId: string, currentStatus: boolean) => {
    const { success, error } = await api.admin.toggleAuthorization(userId, currentStatus)
    
    if (success) {
      setUsers(users.map(u => u.id === userId ? { ...u, broker_authorized: !currentStatus } : u))
      showToast(`Agent ${!currentStatus ? 'authorized' : 'deauthorized'} successfully`, 'success')
    } else {
      showToast(error || 'Failed to update authorization', 'error')
    }
  }

  const handlePlanClick = (u: User, tier: string) => {
    if ((u.plan_tier || 'FREE') === tier) return // Already on this plan
    setTargetUser(u)
    setTargetPlan(tier)
    setIsPlanModalOpen(true)
  }

  const confirmUpdatePlan = async () => {
    if (!targetUser || !targetPlan) return

    setIsUpdatingPlan(true)
    const { success, error } = await api.admin.updatePlanTier(targetUser.id, targetPlan)

    if (success) {
      setUsers(users.map(u => u.id === targetUser.id ? { ...u, plan_tier: targetPlan === 'FREE' ? undefined : targetPlan } : u))
      showToast(`User plan updated to ${targetPlan}`, 'success')
    } else {
      showToast(error || 'Failed to update plan', 'error')
    }
    
    setIsUpdatingPlan(false)
    setIsPlanModalOpen(false)
    setTargetUser(null)
    setTargetPlan(null)
  }

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type, isVisible: true })
  }

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (u.first_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.last_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.brokerage?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.mls_id?.toLowerCase().includes(searchTerm.toLowerCase()))
    
    if (filterStatus === 'AUTHORIZED') return matchesSearch && u.broker_authorized
    if (filterStatus === 'PENDING') return matchesSearch && !u.broker_authorized
    return matchesSearch
  })

  if (isAuthenticating || isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] dark:bg-[#0B0B0B] flex items-center justify-center p-4 transition-colors duration-300">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#C9A24D]/20 border-t-[#C9A24D] rounded-full animate-spin"></div>
          <p className="text-sm font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-[0.2em] animate-pulse">
            Loading System Data
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7] dark:bg-[#0B0B0B] transition-colors duration-300 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        
        {/* Header Section */}
        <div className="relative mb-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-2">
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-[#C9A24D] rounded-lg">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] font-black text-[#C9A24D] uppercase tracking-[0.3em]">
                  System Administration
                </span>
              </div>
              <h1 className="text-5xl font-black text-[#111827] dark:text-white tracking-tighter uppercase leading-none">
                Agent <span className="text-[#C9A24D]">Control</span>
              </h1>
              <p className="text-[#6B7280] dark:text-gray-400 font-medium max-w-xl text-sm">
                Real-time management of platform access, broker authorizations, and agent lifecycle monitoring.
              </p>
            </div>

            {/* Stats Overview */}
            <div className="flex gap-4">
              <div className="bg-white dark:bg-[#151517] px-6 py-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col">
                <span className="text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-widest mb-1">Total Agents</span>
                <span className="text-2xl font-black text-[#111827] dark:text-white leading-tight">{users.length}</span>
              </div>
              <div className="bg-white dark:bg-[#151517] px-6 py-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col border-l-4 border-l-[#C9A24D]">
                <span className="text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-widest mb-1">Pending Approval</span>
                <span className="text-2xl font-black text-[#C9A24D] leading-tight">{users.filter(u => !u.broker_authorized).length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="bg-white dark:bg-[#151517] p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 mb-8 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full group">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#C9A24D] transition-colors" />
            <input
              type="text"
              placeholder="Search by name, email, brokerage, or MLS ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-transparent focus:border-[#C9A24D]/30 focus:bg-white dark:focus:bg-[#151517] rounded-xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/5 transition-all"
            />
          </div>
          
          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative group min-w-[180px]">
              <Filter className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select
                value={filterStatus}
                onChange={(e: any) => setFilterStatus(e.target.value)}
                className="w-full pl-11 pr-10 py-3 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-transparent focus:border-[#C9A24D]/30 focus:bg-white dark:focus:bg-[#151517] rounded-xl text-[10px] font-black uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/5 transition-all appearance-none cursor-pointer"
              >
                <option value="ALL">Status: All</option>
                <option value="AUTHORIZED">Status: Authorized</option>
                <option value="PENDING">Status: Pending</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                <ArrowUpDown className="w-3 h-3" />
              </div>
            </div>

            <button 
              onClick={fetchUsers}
              className="p-3 bg-[#FAFAF7] dark:bg-[#0B0B0B] hover:bg-white dark:hover:bg-[#151517] rounded-xl border border-transparent hover:border-[#C9A24D]/30 transition-all text-gray-500 hover:text-[#C9A24D]"
              title="Refresh Data"
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Users Grid/Table */}
        <div className="bg-white dark:bg-[#151517] rounded-[2rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 dark:border-gray-800 relative overflow-hidden transition-colors">
          {/* Decorative top border - Matching Subscription page */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#151517] via-[#C9A24D] to-[#151517]"></div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-800">
                  <th className="px-8 py-6 text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-[0.2em]">Identity & Contact</th>
                  <th className="px-8 py-6 text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-[0.2em]">Professional Profile</th>
                  <th className="px-8 py-6 text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-[0.2em]">Subscription</th>
                  <th className="px-8 py-6 text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-[0.2em] text-right">Access Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                {filteredUsers.length > 0 ? filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-[#FAFAF7] dark:hover:bg-gray-900/30 transition-all group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#C9A24D]/10 flex items-center justify-center text-[#C9A24D] font-black text-sm uppercase">
                          {u.first_name?.[0]}{u.last_name?.[0]}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-black text-[#111827] dark:text-white leading-tight">
                            {u.first_name} {u.last_name}
                          </span>
                          <div className="flex items-center gap-1.5 text-xs text-[#6B7280] dark:text-gray-500 font-medium">
                            <Mail className="w-3 h-3" />
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="space-y-1.5">
                        <div className="text-sm font-bold text-[#111827] dark:text-gray-300">{u.brokerage}</div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 text-[10px] font-black text-[#C9A24D] uppercase tracking-wider bg-[#C9A24D]/5 px-2 py-0.5 rounded">
                            <MapPin className="w-2.5 h-2.5" /> {u.state}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] font-black text-[#C9A24D] uppercase tracking-wider bg-[#C9A24D]/10 px-2 py-0.5 rounded">
                            <Hash className="w-2.5 h-2.5" /> {u.mls_id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-1 p-1 bg-gray-50 dark:bg-gray-900/50 rounded-xl w-fit border border-gray-100 dark:border-gray-800">
                          {['FREE', 'BASIC', 'PREMIUM'].map((tier) => {
                            const isActive = (u.plan_tier || 'FREE') === tier;
                            return (
                              <button
                                key={tier}
                                onClick={() => handlePlanClick(u, tier)}
                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                                  isActive
                                    ? tier === 'PREMIUM'
                                      ? 'bg-[#C9A24D] text-white shadow-lg shadow-[#C9A24D]/20'
                                      : tier === 'BASIC'
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                        : 'bg-gray-500 text-white shadow-lg'
                                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-white dark:hover:bg-gray-800'
                                }`}
                              >
                                {tier}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-[#6B7280] dark:text-gray-500 font-bold uppercase tracking-wider ml-1">
                          <Calendar className="w-3 h-3" />
                          Joined {new Date(u.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex flex-col items-end gap-2">
                        <button
                          onClick={() => toggleAuthorization(u.id, !!u.broker_authorized)}
                          className={`group/btn relative inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-500 border overflow-hidden ${
                            u.broker_authorized
                              ? 'bg-green-500/5 text-green-600 dark:text-green-400 border-green-500/20 hover:bg-red-500 hover:text-white hover:border-red-500'
                              : 'bg-[#111827] dark:bg-white text-white dark:text-[#111827] border-transparent hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] hover:text-white'
                          }`}
                        >
                          <div className="relative z-10 flex items-center gap-2">
                            {u.broker_authorized ? (
                              <>
                                <span className="group-hover/btn:hidden flex items-center gap-2">
                                  <ShieldCheck className="w-3.5 h-3.5" /> Authorized
                                </span>
                                <span className="hidden group-hover/btn:flex items-center gap-2">
                                  <ShieldAlert className="w-3.5 h-3.5" /> Revoke Access
                                </span>
                              </>
                            ) : (
                              <>
                                <ShieldAlert className="w-3.5 h-3.5" /> Authorize Agent
                              </>
                            )}
                          </div>
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-8 py-32 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900/50 rounded-2xl flex items-center justify-center">
                          <Users className="w-8 h-8 text-gray-300" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-black text-[#111827] dark:text-white uppercase tracking-widest">No Database Matches</p>
                          <p className="text-xs text-[#6B7280] dark:text-gray-500 font-medium">Try adjusting your search filters or refresh the list.</p>
                        </div>
                        <button 
                          onClick={() => { setSearchTerm(''); setFilterStatus('ALL'); }}
                          className="mt-2 text-[10px] font-black text-[#C9A24D] uppercase tracking-[0.2em] border-b-2 border-[#C9A24D]/20 hover:border-[#C9A24D] transition-all pb-0.5"
                        >
                          Clear All Filters
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 flex items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
              <span className="text-[10px] font-black text-[#6B7280] uppercase tracking-widest">System Online</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-[#6B7280] uppercase tracking-widest">Total Revenue Layer: Active</span>
            </div>
          </div>
          <p className="text-[10px] font-black text-[#6B7280] uppercase tracking-widest opacity-40">
            OpenHousePal Security Control
          </p>
        </div>
      </div>

      <ConfirmationModal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        onConfirm={confirmUpdatePlan}
        title="Update User Plan?"
        message={`Are you sure you want to change ${targetUser?.first_name}'s plan to ${targetPlan}? 
        
        WARNING: This ONLY updates our database. It DOES NOT cancel or modify their actual PayPal subscription. Only use this for manual overrides or if the user is not paying for their own subscription. If they have a live subscription, you must manage it in the PayPal dashboard.`}
        confirmText="Yes, Update Plan"
        isLoading={isUpdatingPlan}
      />

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
    </div>
  )
}
