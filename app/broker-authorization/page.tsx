'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import AuthGuard from '@/components/AuthGuard'
import Footer from '@/components/Footer'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ShieldAlert, RefreshCw, Building2, CheckCircle2, Clock } from 'lucide-react'

export default function BrokerAuthorizationPage() {
  return (
    <AuthGuard>
      <BrokerAuthorizationContent />
    </AuthGuard>
  )
}

function BrokerAuthorizationContent() {
  const { user, refreshUser, isLoading } = useAuth()
  const router = useRouter()
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (!isLoading && user?.broker_authorized) {
      router.push('/showcases')
    }
  }, [user, isLoading, router])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refreshUser()
    setIsRefreshing(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] dark:bg-[#0B0B0B] flex items-center justify-center p-4 transition-colors duration-300">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#C9A24D]/20 border-t-[#C9A24D] rounded-full animate-spin"></div>
          <p className="text-sm font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-[0.2em] animate-pulse">
            Syncing Credentials
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAF7] dark:bg-[#0B0B0B] transition-colors duration-300">
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] bg-[#C9A24D]/5 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#111827]/5 dark:bg-[#C9A24D]/5 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen" />
        </div>

        <div className="max-w-2xl w-full relative z-10">
          {/* Main Card - Using Subscription Page Dark Theme */}
          <div className="bg-gradient-to-br from-[#111827] via-[#1a1a1e] to-[#111827] rounded-[2.5rem] shadow-2xl border border-white/5 overflow-hidden">
            <div className="p-8 sm:p-12">
              <div className="flex flex-col items-center text-center">
                {/* Animated Icon */}
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-[#C9A24D]/20 rounded-full blur-2xl animate-pulse" />
                  <div className="relative w-24 h-24 bg-[#C9A24D] rounded-[2rem] flex items-center justify-center transform rotate-12 transition-transform hover:rotate-0 duration-500 shadow-xl shadow-[#C9A24D]/20">
                    <ShieldAlert className="w-12 h-12 text-white -rotate-12 group-hover:rotate-0 transition-transform duration-500" />
                  </div>
                </div>

                <h1 className="text-3xl sm:text-4xl font-black text-white mb-4 tracking-tighter uppercase leading-tight">
                  Broker <span className="text-[#C9A24D]">Pending</span>
                </h1>
                
                <p className="text-gray-400 text-lg font-medium mb-10 max-w-md leading-relaxed">
                  Your account is live, but we need one final confirmation from your Broker of Record to activate listing data.
                </p>

                {/* Status Steps */}
                <div className="w-full space-y-4 mb-10 text-left">
                  <div className="flex items-start gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-white uppercase tracking-wider">Step 1: Identity Verified</p>
                      <p className="text-[11px] text-gray-400 font-medium">Your email and MLS credentials have been confirmed.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 bg-[#C9A24D]/10 rounded-2xl border border-[#C9A24D]/30 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-5 text-[#C9A24D]">
                      <Clock className="w-12 h-12" />
                    </div>
                    <div className="w-6 h-6 rounded-full bg-[#C9A24D] flex items-center justify-center flex-shrink-0 mt-0.5 animate-pulse">
                      <Clock className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-[#C9A24D] uppercase tracking-wider">Step 2: Broker Authorization</p>
                      <p className="text-[11px] text-[#C9A24D]/80 font-medium">Waiting for your office to approve the IDX licensing request.</p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="w-full flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="flex-1 flex items-center justify-center gap-3 py-5 bg-white text-[#111827] rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl hover:bg-[#C9A24D] hover:text-white transition-all transform hover:-translate-y-1 active:scale-95 disabled:opacity-70"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    {isRefreshing ? 'Checking Status...' : 'Check Approval Status'}
                  </button>
                </div>
              </div>
            </div>

            {/* Footer of Card */}
            <div className="bg-white/5 px-8 py-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-500" />
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {user?.brokerage || 'Standard Brokerage'} • {user?.state || 'PA'}
                </span>
              </div>
              <p className="text-[10px] font-bold text-gray-500 italic">
                Estimated wait: 24-48 business hours
              </p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
