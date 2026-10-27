'use client'

import OhpLoader from '@/components/brand/OhpLoader'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import AuthGuard from '@/components/AuthGuard'
import Footer from '@/components/Footer'
import { useEffect, useState } from 'react'
import { RefreshCw, CheckCircle2, Clock, ExternalLink, ChevronRight, Copy, Check, Sparkles } from 'lucide-react'
import { copyText } from '@/lib/copyText'

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
    copyText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // One task for the agent, shown as one: the old page listed "Step 1-4" + "Final Step", and people
  // thought those were four jobs still to do after signing up (owner, 10/26). Now: what's done,
  // the one thing to do (with its directions inside), and what happens after.
  const SENT_KEY = `ohp_bright_request_sent:${user?.id || ''}`
  const [sent, setSent] = useState(false)
  const [showHow, setShowHow] = useState(true)
  useEffect(() => {
    try { if (localStorage.getItem(SENT_KEY)) { setSent(true); setShowHow(false) } } catch { /* fine */ }
  }, [SENT_KEY])
  const markSent = (v: boolean) => {
    setSent(v); setShowHow(!v)
    try { if (v) localStorage.setItem(SENT_KEY, new Date().toISOString()); else localStorage.removeItem(SENT_KEY) } catch { /* fine */ }
  }

  if (isLoading) {
    return (
      <OhpLoader />
    )
  }

  const progress: { label: string; note: string; state: 'done' | 'now' | 'next' }[] = [
    { label: 'Account created', note: 'Your OpenHousePal account is ready.', state: 'done' },
    { label: 'Email confirmed', note: 'Thanks for confirming your email.', state: 'done' },
    { label: 'Let OpenHousePal show your Bright MLS listings', note: sent ? 'Request sent - nothing more to do here.' : 'Your one step - about 2 minutes in Bright MLS.', state: sent ? 'done' : 'now' },
    { label: 'Bright MLS approves it', note: 'Usually 24-48 hours. We email you the moment it does.', state: sent ? 'now' : 'next' },
    { label: 'Pick your plan', note: 'Then your account switches on.', state: 'next' },
  ]
  const how = [
    { text: 'Sign in to Bright MLS.', link: { label: 'Open Bright MLS', href: 'https://www.brightmls.com/login' } },
    { text: "Click your name (top right) and choose 'Account & Settings'." },
    { text: "Open 'My Subscription' in the side menu." },
    { text: "Scroll to 'IDX and VOW Licensing Request' and add OpenHousePal with the details below." },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAF7] dark:bg-[#0B0B0B] transition-colors duration-300">
      <div className="flex-1 flex flex-col items-center px-4 py-8 sm:px-6 sm:py-12 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-5%] left-[-10%] w-[800px] h-[800px] bg-[#C9A24D]/5 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen" />
        </div>

        <div className="max-w-4xl w-full relative z-10">
          <div className="text-center mb-8 sm:mb-10">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#8b7355] dark:text-[#d7b974]">Almost there{user?.first_name ? `, ${user.first_name}` : ''}</p>
            <h1 className="mt-2 font-serif text-[2rem] sm:text-5xl font-black text-[#111827] dark:text-white tracking-tight leading-tight">
              {sent ? <>Waiting on <em className="text-[#C9A24D]">Bright MLS</em></> : <>One step <em className="text-[#C9A24D]">left</em></>}
            </h1>
            <p className="mt-3 text-gray-500 dark:text-gray-400 text-base sm:text-lg font-medium max-w-2xl mx-auto leading-relaxed">
              {sent
                ? "You've done your part. Bright MLS usually approves within 24-48 hours - we'll email you, then you pick your plan."
                : 'Bright MLS needs your OK before OpenHousePal can show your listings. It takes about 2 minutes.'}
            </p>
          </div>

          <div className="grid lg:grid-cols-5 gap-6 lg:gap-8">
            <div className="lg:col-span-3 space-y-5">
              {/* Where they are - done steps clearly done */}
              <ol className="rounded-3xl border border-gray-100 bg-white p-4 sm:p-6 shadow-sm dark:border-gray-800 dark:bg-[#151517]">
                {progress.map((p, i) => (
                  <li key={p.label} className="relative flex gap-4 pb-5 last:pb-0">
                    {i < progress.length - 1 && <span className={`absolute left-[17px] top-9 bottom-0 w-0.5 ${p.state === 'done' ? 'bg-emerald-400/60' : 'bg-gray-200 dark:bg-gray-700'}`} />}
                    <span className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                      p.state === 'done' ? 'bg-emerald-500 text-white'
                        : p.state === 'now' ? 'bg-[#C9A24D] text-[#111827] ring-4 ring-[#C9A24D]/25'
                          : 'border-2 border-gray-200 bg-white text-gray-400 dark:border-gray-700 dark:bg-[#151517]'}`}>
                      {p.state === 'done' ? <Check className="h-5 w-5" /> : i + 1}
                    </span>
                    <span className="min-w-0 pt-1">
                      <span className={`flex flex-wrap items-center gap-2 text-[15px] font-black ${p.state === 'done' ? 'text-gray-400 dark:text-gray-500' : 'text-[#111827] dark:text-white'}`}>
                        {p.label}
                        {p.state === 'done' && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">Done</span>}
                        {p.state === 'now' && <span className="rounded-full bg-[#C9A24D] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#111827]">{sent ? 'In progress' : 'Your step'}</span>}
                      </span>
                      <span className="mt-0.5 block text-sm font-medium text-gray-500 dark:text-gray-400">{p.note}</span>
                    </span>
                  </li>
                ))}
              </ol>

              {/* The one thing to do */}
              <div className="rounded-3xl border border-[#C9A24D]/40 bg-white shadow-sm dark:bg-[#151517]">
                <button type="button" onClick={() => setShowHow(v => !v)} className="flex w-full items-center justify-between gap-3 p-5 text-left sm:p-6">
                  <span>
                    <span className="block text-[11px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#d7b974]">{sent ? 'Done - here if you need it' : 'How to do it'}</span>
                    <span className="mt-1 block text-lg font-black text-[#111827] dark:text-white">Add OpenHousePal as a vendor in Bright MLS</span>
                  </span>
                  <ChevronRight className={`h-5 w-5 shrink-0 text-[#C9A24D] transition-transform ${showHow ? 'rotate-90' : ''}`} />
                </button>
                {showHow && (
                  <div className="border-t border-[#C9A24D]/15 px-5 pb-6 pt-4 sm:px-6">
                    <ol className="space-y-3">
                      {how.map((h, i) => (
                        <li key={i} className="flex gap-3 text-[15px] font-medium text-gray-700 dark:text-gray-300">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#C9A24D]/15 text-xs font-black text-[#8b7355] dark:text-[#e8c97a]">{String.fromCharCode(97 + i)}</span>
                          <span>
                            {h.text}
                            {h.link && (
                              <a href={h.link.href} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest text-[#C9A24D] hover:underline">
                                {h.link.label} <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </span>
                        </li>
                      ))}
                    </ol>
                    <div className="mt-5 space-y-3 rounded-2xl bg-gradient-to-br from-[#111827] to-[#1a1a1e] p-4 sm:p-5">
                      {[['Vendor name', 'OpenHousePal - R-OPENHOUSEPAL', 'vendor'], ['Website', 'https://openhousepal.com', 'url']].map(([label, value, key]) => (
                        <div key={key}>
                          <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{label}</span>
                          <button type="button" onClick={() => copyToClipboard(value, key)}
                            className="mt-1 flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left transition hover:border-[#C9A24D]/50">
                            <code className="break-all text-[15px] font-bold text-[#C9A24D]">{value}</code>
                            <span className="flex shrink-0 items-center gap-1 text-xs font-black text-gray-300">{copiedField === key ? <><Check className="h-4 w-4 text-green-400" /> Copied</> : <><Copy className="h-4 w-4" /> Copy</>}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                    {!sent ? (
                      <button type="button" onClick={() => markSent(true)}
                        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#111827] py-4 text-sm font-black text-white transition hover:bg-[#C9A24D] dark:bg-white dark:text-[#111827]">
                        <CheckCircle2 className="h-5 w-5" /> I&apos;ve sent the request
                      </button>
                    ) : (
                      <button type="button" onClick={() => markSent(false)} className="mt-4 text-xs font-bold text-gray-400 underline-offset-2 hover:underline">
                        I haven&apos;t sent it yet
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Status */}
            <div className="lg:col-span-2">
              <div className="lg:sticky lg:top-8 rounded-3xl border border-gray-100 bg-white p-6 sm:p-8 shadow-xl dark:border-gray-800 dark:bg-[#151517]">
                <div className="flex flex-col items-center text-center">
                  <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#C9A24D]/10">
                    <Clock className="h-8 w-8 animate-pulse text-[#C9A24D]" />
                  </div>
                  <h3 className="text-lg font-black text-[#111827] dark:text-white">{sent ? 'Waiting for Bright MLS' : 'Waiting for your Bright MLS request'}</h3>
                  <p className="mb-6 mt-1 text-sm font-medium text-gray-500 dark:text-gray-400">
                    {sent ? 'Usually 24-48 hours. You can close this page - we email you when it’s approved.' : 'Once you send it, Bright MLS usually approves within 24-48 hours.'}
                  </p>
                  <div className="mb-6 w-full space-y-2">
                    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-[#0B0B0B]">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">MLS ID</span>
                      <span className="text-xs font-bold text-[#111827] dark:text-white">{user?.mls_id || 'Not set'}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-[#0B0B0B]">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Office</span>
                      <span className="max-w-[150px] truncate text-xs font-bold text-[#111827] dark:text-white">{user?.brokerage || 'Not set'}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl border border-gray-200 py-4 text-sm font-black text-[#111827] transition hover:border-[#C9A24D] disabled:opacity-70 dark:border-gray-700 dark:text-white"
                  >
                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    {isRefreshing ? 'Checking...' : 'Check if I’m approved'}
                  </button>

                  {/* While they wait: the setup flow's shared steps (about you, contact, photo...) -
                      all ready the moment they're approved. */}
                  <Link href="/setup" className="group mt-5 flex w-full items-center gap-3 rounded-2xl border border-[#C9A24D]/40 bg-gradient-to-br from-[#fffaf0] to-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#C9A24D] dark:from-[#1b1813] dark:to-[#151517]">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a]"><Sparkles className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black text-[#111827] dark:text-white">Optional: get a head start</span>
                      <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400">Add your photo, contact info and bio now - it&apos;s all ready when you&apos;re approved.</span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-[#C9A24D] transition group-hover:translate-x-0.5" />
                  </Link>
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
