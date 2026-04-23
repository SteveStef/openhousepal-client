'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import AuthGuard from '@/components/AuthGuard'
import Footer from '@/components/Footer'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ShieldAlert, RefreshCw, Building2, CheckCircle2, Clock, ExternalLink, ChevronRight, Search, PlusCircle, Copy, Check } from 'lucide-react'

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
  const [copiedField, setCopiedField] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && user?.broker_authorized) {
      router.push('/open-houses')
    }
  }, [user, isLoading, router])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refreshUser()
    setIsRefreshing(false)
  }

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
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

  const steps = [
    {
      title: "Login to Bright MLS",
      description: "Sign in to your professional Bright MLS account dashboard.",
      icon: <ExternalLink className="w-5 h-5" />,
      action: {
        label: "Open Bright MLS",
        href: "https://www.brightmls.com/login"
      }
    },
    {
      title: "Account & Settings",
      description: "Click on your name in the top right and select 'Account & Settings'.",
      icon: <Search className="w-5 h-5" />
    },
    {
      title: "My Subscription",
      description: "Navigate to the 'My Subscription' section in the side menu.",
      icon: <Building2 className="w-5 h-5" />
    },
    {
      title: "IDX & VOW Licensing",
      description: "Scroll down to find 'IDX and VOW Licensing Request'.",
      icon: <PlusCircle className="w-5 h-5" />
    }
  ]

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAF7] dark:bg-[#0B0B0B] transition-colors duration-300">
      <div className="flex-1 flex flex-col items-center py-12 px-6 relative overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-5%] left-[-10%] w-[800px] h-[800px] bg-[#C9A24D]/5 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen" />
          <div className="absolute bottom-[-5%] right-[-10%] w-[600px] h-[600px] bg-[#111827]/5 dark:bg-[#C9A24D]/5 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen" />
        </div>

        <div className="max-w-4xl w-full relative z-10">
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-black text-[#111827] dark:text-white mb-4 tracking-tighter uppercase leading-tight">
              Activate <span className="text-[#C9A24D]">IDX Data</span>
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-lg font-medium max-w-2xl mx-auto leading-relaxed">
              To show listing data in your showcases, Bright MLS requires a one-time authorization of OpenHousePal as your vendor.
            </p>
          </div>

          <div className="grid lg:grid-cols-5 gap-8">
            {/* Left Side: Tutorial Steps */}
            <div className="lg:col-span-3 space-y-4">
              {steps.map((step, index) => (
                <div key={index} className="bg-white dark:bg-[#151517] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm flex gap-5 group hover:border-[#C9A24D]/30 transition-all">
                  <div className="w-12 h-12 rounded-xl bg-[#C9A24D]/10 text-[#C9A24D] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    {step.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black text-[#C9A24D] uppercase tracking-widest">Step {index + 1}</span>
                      <ChevronRight className="w-3 h-3 text-gray-300" />
                    </div>
                    <h3 className="text-lg font-black text-[#111827] dark:text-white uppercase tracking-tight">{step.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed">{step.description}</p>
                    {step.action && (
                      <a 
                        href={step.action.href} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 mt-3 text-xs font-black text-[#C9A24D] uppercase tracking-widest hover:underline"
                      >
                        {step.action.label} <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}

              {/* Final Critical Step */}
              <div className="bg-gradient-to-br from-[#111827] to-[#1a1a1e] rounded-3xl p-8 border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 text-[#C9A24D]">
                  <PlusCircle className="w-24 h-24" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-3 py-1 bg-[#C9A24D] text-[#111827] text-[10px] font-black uppercase tracking-widest rounded-full">Final Step</span>
                  </div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight mb-6">Add Vendor Details</h3>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">Vendor Name</label>
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 group hover:border-[#C9A24D]/50 transition-all">
                        <code className="text-[#C9A24D] font-bold text-lg">OpenHousePal - R-OPENHOUSEPAL</code>
                        <button onClick={() => copyToClipboard('OpenHousePal - R-OPENHOUSEPAL', 'vendor')} className="text-gray-500 hover:text-white">
                          {copiedField === 'vendor' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">Website URL</label>
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 group hover:border-[#C9A24D]/50 transition-all">
                        <code className="text-[#C9A24D] font-bold text-lg">https://openhousepal.com</code>
                        <button onClick={() => copyToClipboard('https://openhousepal.com', 'url')} className="text-gray-500 hover:text-white">
                          {copiedField === 'url' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side: Status Card */}
            <div className="lg:col-span-2">
              <div className="sticky top-8 bg-white dark:bg-[#151517] rounded-3xl p-8 border border-gray-100 dark:border-gray-800 shadow-xl">
                <div className="flex flex-col items-center text-center">
                  <div className="w-20 h-20 rounded-2xl bg-[#C9A24D]/10 flex items-center justify-center mb-6">
                    <Clock className="w-10 h-10 text-[#C9A24D] animate-pulse" />
                  </div>
                  <h3 className="text-xl font-black text-[#111827] dark:text-white uppercase tracking-tight mb-2">Status: Pending</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-8">
                    Once you submit the request in Bright MLS, it typically takes 24-48 hours for them to approve the feed.
                  </p>

                  <div className="w-full space-y-3 mb-8">
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#0B0B0B] rounded-xl border border-gray-100 dark:border-gray-800">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">MLS ID</span>
                      <span className="text-xs font-bold text-[#111827] dark:text-white">{user?.mls_id || 'Not Set'}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#0B0B0B] rounded-xl border border-gray-100 dark:border-gray-800">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Office</span>
                      <span className="text-xs font-bold text-[#111827] dark:text-white truncate max-w-[150px]">{user?.brokerage || 'Standard'}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="w-full flex items-center justify-center gap-3 py-5 bg-[#111827] dark:bg-white text-white dark:text-[#111827] rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] hover:text-white transition-all transform hover:-translate-y-1 active:scale-95 disabled:opacity-70"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    {isRefreshing ? 'Checking...' : 'Check Approval Status'}
                  </button>
                  
                  <p className="mt-6 text-[10px] font-bold text-gray-400 italic">
                    OpenHousePal will automatically activate your showcases once Bright MLS approves.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}

