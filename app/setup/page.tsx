'use client'

// The one-time setup flow. One question group per screen, in plain words, with what it powers and
// what skipping costs. Everything saves as it's typed, and the step they were on is remembered.
// Steps come from the backend for the agent's plan (setup_flow_service.py); answers are written
// where each feature already reads them, so the flow and the features never disagree.
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, ChevronDown, CircleAlert, Clock3, ExternalLink, Info, Loader2, Sparkles, X } from 'lucide-react'
import api, { type SetupData, type SetupInfoPatch, type SetupStepId } from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import { stepCopy } from '@/lib/setupFlow'
import { OhpWordmark } from '@/components/brand/OhpBrand'
import OhpLoader from '@/components/brand/OhpLoader'
import type { Gate, Mini, StepCtx } from '@/components/setup/SetupUi'
import { AboutStep, ContactStep, LicenseStep, PhotoStep, SocialsStep, StoryStep } from '@/components/setup/InfoSteps'
import { BrandStep, FormsStep, HubStep, ReviewsStep, SalesStep, SignatureStep } from '@/components/setup/FeatureSteps'
import { AlertsStep, AreasStep, CalendarStep, CrmStep, HomesStep, MailboxStep, WebsiteStep } from '@/components/setup/ConnectSteps'
import { DomainStep } from '@/components/setup/DomainStep'
import { OpenHouseStep } from '@/components/setup/OpenHouseStep'

const STEP_VIEWS: Record<SetupStepId, (p: { ctx: StepCtx }) => React.ReactElement> = {
  about: AboutStep, contact: ContactStep, license: LicenseStep, photo: PhotoStep, story: StoryStep, socials: SocialsStep,
  sales: SalesStep, reviews: ReviewsStep, brand: BrandStep, hub: HubStep, forms: FormsStep, signature: SignatureStep,
  openhouse: OpenHouseStep, alerts: AlertsStep, calendar: CalendarStep, mailbox: MailboxStep, crm: CrmStep, areas: AreasStep, homes: HomesStep, website: WebsiteStep, domain: DomainStep,
}
const GROUPS: { title: string; ids: SetupStepId[] }[] = [
  { title: 'About you', ids: ['about', 'contact', 'license', 'photo', 'story', 'socials'] },
  { title: 'Your pages', ids: ['sales', 'reviews', 'brand', 'hub', 'forms', 'signature'] },
  { title: 'Your open houses', ids: ['openhouse'] },
  { title: 'Staying in touch', ids: ['alerts', 'calendar', 'mailbox', 'crm'] },
  { title: 'Your website', ids: ['areas', 'homes', 'website', 'domain'] },
]
// The website steps get the whole width: choices on the left, a tall live preview on the right.
const WIDE_STEPS: SetupStepId[] = ['homes', 'website']

function mergePatch(a: SetupInfoPatch, b: SetupInfoPatch): SetupInfoPatch {
  return {
    ...a, ...b,
    profile: a.profile || b.profile ? { ...a.profile, ...b.profile } : undefined,
    contact: a.contact || b.contact ? { ...a.contact, ...b.contact } : undefined,
    card: a.card || b.card ? { ...a.card, ...b.card } : undefined,
    look: a.look || b.look ? { ...a.look, ...b.look } : undefined,
  }
}

export default function SetupPage() {
  return <Suspense fallback={<OhpLoader />}><SetupFlow /></Suspense>
}

function SetupFlow() {
  const router = useRouter()
  const params = useSearchParams()
  const { user, isAuthenticated, isLoading } = useAuth()
  const [data, setData] = useState<SetupData | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [current, setCurrent] = useState<SetupStepId | 'done' | null>(null)
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [gateMsg, setGateMsg] = useState('')
  const [shake, setShake] = useState(0)
  const [advancing, setAdvancing] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  // A sign-in result shows on its own step only (the email one on "Your email", not every step after).
  const [notice, setNotice] = useState<{ text: string; step: SetupStepId } | null>(null)
  const [newIds, setNewIds] = useState<string[]>([])
  const gate = useRef<Gate>({ ok: true })
  // A step split into pages (Agent Hub, Brand, Signature...): where it is, for the bottom bar.
  const [mini, setMiniState] = useState<Mini | null>(null)
  // Only a Back press opens a step on its last page; any other way in starts at page 1.
  const enteredFromEnd = useRef<SetupStepId | null>(null)
  const pending = useRef<SetupInfoPatch | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const inflight = useRef<Promise<unknown> | null>(null)
  const savedTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login?redirect=/setup')
  }, [isLoading, isAuthenticated, router])

  // first load: pick the step (URL > where they left off > first unfinished)
  useEffect(() => {
    if (!isAuthenticated) return
    api.setup.get().then(r => {
      if (!r.success || !r.data) { setLoadError(true); return }
      const d = r.data
      setData(d)
      const ids = d.steps.map(s => s.id)
      const fresh = d.seen.length ? d.steps.filter(s => s.status === 'todo' && !d.seen.includes(s.id)).map(s => s.id) : []
      setNewIds(fresh)
      api.setup.setState({ seen: ids })
      const want = params.get('step') as SetupStepId | null
      const start = (want && ids.includes(want) ? want : null)
        || (fresh[0] as SetupStepId | undefined)
        || (d.last_step && d.steps.find(s => s.id === d.last_step && s.status !== 'done') ? d.last_step : null)
        || d.steps.find(s => s.status === 'todo')?.id
        || d.steps.find(s => s.status === 'skipped')?.id
        || 'done'
      setCurrent(start)
      if (start !== 'done' && params.get('step') !== start) router.replace(`/setup?step=${start}`, { scroll: false })
      const cal = params.get('calendar')
      if (cal === 'connected') setNotice({ text: 'Your calendar is connected.', step: 'calendar' })
      if (cal === 'error') setNotice({ text: 'That calendar didn’t connect - please try again.', step: 'calendar' })
      const mb = params.get('mailbox')
      if (mb === 'connected') setNotice({ text: 'Your email is connected - guest emails will now come from you.', step: 'mailbox' })
      if (mb === 'error') setNotice({ text: 'Your email didn’t connect - please try again, and allow the "send email" permission.', step: 'mailbox' })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  const flashSaved = () => {
    setSaving('saved')
    window.clearTimeout(savedTimer.current)
    savedTimer.current = window.setTimeout(() => setSaving('idle'), 2200)
  }
  const flush = useCallback(async () => {
    window.clearTimeout(timer.current)
    if (inflight.current) await inflight.current.catch(() => {})
    const patch = pending.current
    if (!patch) return
    pending.current = null
    setSaving('saving')
    const p = api.setup.patchInfo(patch).then(r => {
      if (r.success && r.data) { setData(r.data); flashSaved() } else setSaving('error')
    })
    inflight.current = p
    await p
    inflight.current = null
  }, [])
  const saveInfo = useCallback((patch: SetupInfoPatch) => {
    pending.current = mergePatch(pending.current || {}, patch)
    setSaving('saving')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, 650)
  }, [flush])
  const markSaving = useCallback((p: Promise<unknown>) => {
    setSaving('saving')
    p.then(flashSaved, () => setSaving('error'))
  }, [])
  // never lose typing when they close the tab
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (pending.current) { flush(); e.preventDefault() } }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [flush])

  const refresh = useCallback(async () => {
    const r = await api.setup.get()
    if (r.success && r.data) setData(r.data)
    return r.data
  }, [])

  const ids = useMemo(() => (data?.steps || []).map(s => s.id), [data])
  const goTo = useCallback((id: SetupStepId | 'done') => {
    setGateMsg('')
    gate.current = { ok: true }
    enteredFromEnd.current = null
    setMiniState(null)
    setCurrent(id)
    setSheetOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    const qs = id === 'done' ? '' : `?step=${id}`
    router.replace(`/setup${qs}`, { scroll: false })
    if (id !== 'done') api.setup.setState({ last_step: id })
  }, [router])

  const nextOf = (id: SetupStepId): SetupStepId | 'done' => {
    const i = ids.indexOf(id)
    return (ids[i + 1] as SetupStepId) || 'done'
  }
  const onContinue = async () => {
    if (!current || current === 'done' || advancing) return
    // the step's own pages first - each one saves as it's changed, so nothing to wait for
    if (mini && mini.part < mini.count - 1) { setGateMsg(''); mini.go(mini.part + 1); return }
    setAdvancing(true)
    try {
      await flush()
      const g = gate.current
      if (!g.ok) { setGateMsg(g.message || 'Please finish this step first.'); setShake(s => s + 1); return }
      if (g.onContinue) {
        const res = await g.onContinue()
        if (res === false) { setGateMsg(g.message || 'Something didn’t save - please check and try again.'); setShake(s => s + 1); return }
      }
      await api.setup.setState({ unskip: current })
      await refresh()
      goTo(nextOf(current))
    } finally {
      setAdvancing(false)
    }
  }
  const onSkip = async () => {
    if (!current || current === 'done') return
    await flush()
    const r = await api.setup.setState({ skip: current })
    if (r.success && r.data) setData(r.data)
    goTo(nextOf(current))
  }
  const onBack = () => {
    if (!current) return
    if (mini && mini.part > 0) { setGateMsg(''); mini.go(mini.part - 1); return }
    const i = current === 'done' ? ids.length : ids.indexOf(current)
    if (i > 0) { goTo(ids[i - 1] as SetupStepId); enteredFromEnd.current = ids[i - 1] }
  }

  const ctx: StepCtx | null = data ? {
    data, setData, saveInfo, markSaving, plan: data.plan,
    setGate: (g: Gate) => { gate.current = g; if (g.ok) setGateMsg('') },
    setMini: setMiniState,
    enteredFromEnd: enteredFromEnd.current === current,
  } : null

  if (isLoading || (!data && !loadError) || !current) return <OhpLoader />
  if (loadError || !data || !ctx) {
    return <div className="flex min-h-screen items-center justify-center p-6 text-center"><div><p className="text-lg font-black">We couldn&apos;t load your setup.</p><button onClick={() => window.location.reload()} className="mt-4 rounded-2xl bg-[#111827] px-6 py-3 font-black text-white">Try again</button></div></div>
  }

  const doneCount = data.steps.filter(s => s.status === 'done').length
  const total = data.steps.length
  const pct = Math.round((doneCount / Math.max(1, total)) * 100)
  const stepIndex = current === 'done' ? total : ids.indexOf(current)
  const step = current !== 'done' ? data.steps.find(s => s.id === current)! : null
  const copy = step ? stepCopy(step.id, data.plan, data.has_mls) : null
  const View = step ? STEP_VIEWS[step.id] : null
  const firstName = (data.info.name || user?.first_name || '').split(' ')[0]
  const wide = !!step && WIDE_STEPS.includes(step.id)
  const headFolded = !!mini && mini.part > 0
  const frame = `mx-auto transition-[max-width] duration-500 ${wide ? 'max-w-[1760px]' : 'max-w-[1220px]'}`

  const stepList = (
    <nav aria-label="Setup steps" className="space-y-6">
      {GROUPS.map(g => {
        const items = data.steps.filter(s => g.ids.includes(s.id))
        if (!items.length) return null
        return (
          <div key={g.title}>
            <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.26em] text-[#8b7355] dark:text-[#d7b974]">{g.title === 'Your website' && data.plan !== 'IDX' ? 'Your towns' : g.title}</p>
            <ul className="space-y-1">
              {items.map(s => {
                const c = stepCopy(s.id, data.plan, data.has_mls)
                const on = s.id === current
                return (
                  <li key={s.id}>
                    <button type="button" onClick={() => goTo(s.id)} aria-current={on ? 'step' : undefined} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${on ? 'bg-[#111827] text-white shadow-[0_14px_30px_-18px_rgba(17,24,39,.9)] dark:bg-white dark:text-[#111827]' : 'text-[#111827] hover:bg-white/80 dark:text-white dark:hover:bg-white/5'}`}>
                      <StatusDot status={s.status} on={on} />
                      <span className="min-w-0 flex-1 truncate text-[14.5px] font-bold">{c.label}</span>
                      {newIds.includes(s.id) && <span className="rounded-full bg-[#C9A24D] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">New</span>}
                      {s.status === 'skipped' && !on && <span className="text-[11px] font-bold text-gray-400">Skipped</span>}
                      {s.required && s.status !== 'done' && !on && <span className="text-[11px] font-black text-[#a8803a]">Needed</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </nav>
  )

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#f6f2ea] text-[#111827] dark:bg-[#09090a] dark:text-white">
      <SetupBackdrop />
      {/* top bar */}
      <header className="sticky top-0 z-40 border-b border-[#C9A24D]/15 bg-[#fbf8f2] dark:border-white/[0.06] dark:bg-[#0c0c0d]">
        <div className={`${frame} flex h-16 items-center gap-3 px-4 sm:px-6`}>
          <Link href={data.approved && data.plan ? '/dash' : '#'} aria-label="OpenHousePal" className="shrink-0"><OhpWordmark className="text-[22px]" /></Link>
          <span className="hidden h-6 w-px bg-[#C9A24D]/30 sm:block" />
          <span className="hidden text-[12px] font-black uppercase tracking-[0.24em] text-[#8b7355] dark:text-[#d7b974] sm:block">Account setup</span>
          <div className="ml-auto flex items-center gap-2">
            <SavePill state={saving} />
            {data.approved && data.plan
              ? <Link href="/dash" onClick={() => flush()} className="rounded-full border border-[#C9A24D]/40 bg-white/80 px-4 py-2 text-[13px] font-black text-[#111827] transition hover:border-[#C9A24D] dark:border-white/15 dark:bg-white/5 dark:text-white">Finish later</Link>
              : <Link href={data.approved ? '/checkout' : '/broker-authorization'} onClick={() => flush()} className="rounded-full border border-[#C9A24D]/40 bg-white/80 px-4 py-2 text-[13px] font-black text-[#111827] dark:border-white/15 dark:bg-white/5 dark:text-white">Finish later</Link>}
          </div>
        </div>
        <div className="h-[3px] bg-[#C9A24D]/12">
          <motion.div className="h-full bg-gradient-to-r from-[#a8803a] via-[#C9A24D] to-[#e8c97a]" initial={false} animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 120, damping: 24 }} />
        </div>
      </header>

      <div className={`relative isolate z-0 ${frame} px-4 pb-32 pt-6 sm:px-6 lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:pt-10 ${wide ? 'lg:gap-8' : 'lg:gap-10'}`}>
        {/* step list - desktop */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-[28px] border border-[#C9A24D]/20 bg-white/60 p-4 shadow-[0_30px_60px_-46px_rgba(139,106,43,.8)] dark:border-white/[0.07] dark:bg-white/[0.03]">
            <div className="mb-5 flex items-center gap-4 px-2 pt-1">
              <ProgressRing pct={pct} />
              <div>
                <p className="font-serif text-[22px] font-black leading-none">{doneCount} of {total}</p>
                <p className="mt-1 text-[12.5px] font-bold text-gray-500 dark:text-gray-400">steps finished</p>
              </div>
            </div>
            {stepList}
          </div>
        </aside>

        <main className="min-w-0">
          {!data.approved && (
            <div className="mb-5 flex items-start gap-3 rounded-[22px] border border-[#C9A24D]/30 bg-white/80 p-4 dark:bg-white/[0.04]">
              <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-[#C9A24D]" />
              <p className="text-[14.5px] font-semibold leading-snug">While we wait for your broker&apos;s approval, get a head start. Everything you add here is ready the moment you&apos;re approved.</p>
            </div>
          )}
          {notice && notice.step === current && (
            <div className="mb-5 flex items-center gap-3 rounded-[22px] border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              <Check className="h-5 w-5 shrink-0" /><p className="flex-1 text-[14.5px] font-bold">{notice.text}</p>
              <button onClick={() => setNotice(null)} aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
          )}

          {/* phone: where am I + all steps */}
          <button type="button" onClick={() => setSheetOpen(true)} className="mb-4 flex w-full items-center gap-3 rounded-[20px] border border-[#C9A24D]/25 bg-white/80 px-4 py-3 text-left shadow-sm lg:hidden dark:border-white/10 dark:bg-white/[0.04]">
            <ProgressRing pct={pct} small />
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#d7b974]">{current === 'done' ? 'All steps' : `Step ${stepIndex + 1} of ${total}`}</span>
              <span className="block truncate text-[15px] font-black">{copy ? copy.label : 'Finished'} · {doneCount} done</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[13px] font-black text-[#8b6a2b] dark:text-[#e8c97a]">All steps <ChevronDown className="h-4 w-4" /></span>
          </button>

          <AnimatePresence mode="wait">
            {current === 'done' ? (
              <motion.div key="done" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.4 }}>
                <Finale data={data} firstName={firstName} onGo={goTo} />
              </motion.div>
            ) : step && copy && View ? (
              <motion.section key={step.id} initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -28 }} transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                className="overflow-clip rounded-[32px] border border-[#C9A24D]/25 bg-white shadow-[0_50px_90px_-60px_rgba(139,106,43,.85)] dark:border-white/[0.08] dark:bg-[#121214]">
                {/* step header */}
                <div className="relative overflow-hidden border-b border-[#C9A24D]/15 bg-gradient-to-br from-[#fffaf0] via-white to-[#f8f1e2] px-6 pb-7 pt-7 dark:border-white/[0.06] dark:from-[#1a1712] dark:via-[#141416] dark:to-[#121214] sm:px-10 sm:pt-9">
                  <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#e8c97a]/30 blur-3xl dark:bg-[#C9A24D]/15" />
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#C9A24D]/70 to-transparent" />
                  {/* Phones: the icon sits small on the "Step x of y" line and the title gets the full
                      width (it used to push all the words right, leaving a gap under it - owner 10/22). */}
                  <div className="relative flex items-start gap-5">
                    <span className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a] shadow-[0_18px_34px_-16px_rgba(17,24,39,.9)] ring-1 ring-[#C9A24D]/40 sm:flex">
                      <copy.icon className="h-7 w-7" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.26em] text-[#8b7355] dark:text-[#d7b974]">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a] ring-1 ring-[#C9A24D]/40 sm:hidden"><copy.icon className="h-[18px] w-[18px]" /></span>
                        Step {stepIndex + 1} of {total}
                        {step.required ? <span className="rounded-full bg-[#111827] px-2 py-0.5 text-[9px] tracking-wider text-[#e8c97a] dark:bg-[#C9A24D] dark:text-[#111827]">Needed</span> : <span className="rounded-full border border-[#C9A24D]/40 px-2 py-0.5 text-[9px] tracking-wider">Can skip</span>}
                        {newIds.includes(step.id) && <span className="rounded-full bg-[#C9A24D] px-2 py-0.5 text-[9px] tracking-wider text-white">New for your plan</span>}
                        {step.status === 'done' && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] tracking-wider text-white"><Check className="h-3 w-3" /> Done</span>}
                      </p>
                      {/* The gold italic word is painted through its own box (bg-clip-text), so a slanted
                          last letter (the "s" of "sales") was cut off - the box gets a little room on
                          the right and below for the overhang (owner, 10/22). */}
                      <h1 className="mt-2 font-serif text-[29px] font-black leading-[1.12] tracking-tight [overflow-wrap:anywhere] sm:text-[40px] sm:leading-[1.08]">
                        {copy.title[0]}<em className="-mr-[0.14em] bg-gradient-to-r from-[#a8803a] via-[#C9A24D] to-[#d9b867] bg-clip-text pb-[0.12em] pr-[0.14em] font-black italic text-transparent [box-decoration-break:clone]">{copy.title[1]}</em>
                      </h1>
                      {/* Past a step's first page the intro folds away, so each page's questions sit
                          right under the title (owner, 10/22). */}
                      <AnimatePresence initial={false}>
                        {!headFolded && (
                          <motion.p key="intro" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                            className="max-w-2xl overflow-hidden text-[16.5px] font-medium leading-relaxed text-gray-600 dark:text-gray-300"><span className="block pt-3">{copy.intro}</span></motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  <AnimatePresence initial={false}>
                    {copy.powers.length > 0 && !headFolded && (
                      <motion.div key="powers" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="relative overflow-hidden">
                        <div className="flex flex-wrap items-center gap-2 pt-6">
                          <span className="mr-1 text-[12px] font-black text-gray-500 dark:text-gray-400">Shows up on:</span>
                          {copy.powers.map(p => <span key={p} className="inline-flex items-center gap-1.5 rounded-full border border-[#C9A24D]/35 bg-white/90 px-3 py-1.5 text-[12.5px] font-bold text-[#111827] dark:border-white/10 dark:bg-white/[0.05] dark:text-white"><Check className="h-3.5 w-3.5 text-[#C9A24D]" />{p}</span>)}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* step body */}
                <div className={wide ? 'px-5 py-7 sm:px-8 sm:py-8' : 'px-6 py-8 sm:px-10 sm:py-10'}>
                  <View ctx={ctx} />
                  {copy.skip && !step.required && (
                    <p className="mt-8 flex items-start gap-2.5 rounded-2xl bg-[#f7f3ea] px-4 py-3 text-[14px] font-semibold text-gray-600 dark:bg-white/[0.04] dark:text-gray-300">
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#a8803a]" /><span><b className="text-[#111827] dark:text-white">If you skip this:</b> {copy.skip}</span>
                    </p>
                  )}
                </div>
              </motion.section>
            ) : null}
          </AnimatePresence>
        </main>
      </div>

      {/* bottom bar */}
      {current !== 'done' && step && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#C9A24D]/20 bg-[#fbf8f2] pb-[env(safe-area-inset-bottom)] dark:border-white/[0.07] dark:bg-[#0c0c0d]">
          <AnimatePresence>
            {gateMsg && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`${frame} px-3 pt-2 sm:px-6 sm:pt-3 ${wide ? 'lg:pl-[318px]' : 'lg:pl-[326px]'}`}>
                <motion.p key={shake} animate={{ x: [0, -8, 8, -5, 5, 0] }} transition={{ duration: 0.4 }} className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3.5 py-1.5 text-[13.5px] font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"><CircleAlert className="h-4 w-4" /> {gateMsg}</motion.p>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Slim on phones (owner, 10/22): 44px buttons - still easy to tap - in a 60px bar. */}
          <div className={`${frame} flex items-center gap-2 px-3 py-2 sm:gap-3 sm:px-6 sm:py-2.5 ${wide ? 'lg:pl-[318px]' : 'lg:pl-[326px]'}`}>
            <button type="button" onClick={onBack} disabled={stepIndex === 0 && !(mini && mini.part > 0)} aria-label="Back" className="inline-flex h-11 min-w-[44px] items-center justify-center gap-2 rounded-xl px-2.5 text-[15px] font-black text-gray-600 transition hover:bg-black/5 disabled:opacity-30 dark:text-gray-300 dark:hover:bg-white/5 sm:h-12 sm:rounded-2xl sm:px-5">
              <ArrowLeft className="h-5 w-5" /> <span className="max-sm:sr-only">Back</span>
            </button>
            <div className="flex-1" />
            {!step.required && step.status !== 'done' && (
              <button type="button" onClick={onSkip} className="h-11 rounded-xl px-3 text-[14px] font-black text-gray-500 underline-offset-4 transition hover:text-[#111827] hover:underline dark:text-gray-400 dark:hover:text-white sm:h-12 sm:rounded-2xl sm:px-5 sm:text-[15px]">Skip for now</button>
            )}
            <button type="button" onClick={onContinue} disabled={advancing} className="group inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-[#111827] to-[#2a2218] px-5 text-[15px] font-black text-white shadow-[0_14px_28px_-16px_rgba(17,24,39,.9)] ring-1 ring-[#C9A24D]/40 transition hover:-translate-y-0.5 disabled:opacity-70 dark:from-[#C9A24D] dark:to-[#e8c97a] dark:text-[#111827] sm:h-12 sm:rounded-2xl sm:px-8 sm:text-[16px]">
              {advancing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mini && mini.part < mini.count - 1
                ? <span>Next<span className="max-sm:hidden">: {mini.labels[mini.part + 1]}</span></span>
                : stepIndex === total - 1 ? 'Finish' : 'Continue'}
              {!advancing && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 sm:h-5 sm:w-5" />}
            </button>
          </div>
        </div>
      )}

      {/* phone: all steps sheet */}
      <AnimatePresence>
        {sheetOpen && (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/40 " onClick={() => setSheetOpen(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 34 }} className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[30px] bg-[#fbf8f2] p-5 pb-10 dark:bg-[#121214]">
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-300 dark:bg-white/20" />
              <div className="mb-4 flex items-center justify-between px-2">
                <p className="font-serif text-[22px] font-black">{doneCount} of {total} finished</p>
                <button onClick={() => setSheetOpen(false)} aria-label="Close" className="rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/5"><X className="h-5 w-5" /></button>
              </div>
              {stepList}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StatusDot({ status, on }: { status: string; on: boolean }) {
  if (status === 'done') return <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#a8803a] to-[#e8c97a] text-white shadow-sm"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
  if (status === 'skipped') return <span className={`h-6 w-6 shrink-0 rounded-full border-2 border-dashed ${on ? 'border-white/60 dark:border-[#111827]/50' : 'border-gray-300 dark:border-white/25'}`} />
  return <span className={`h-6 w-6 shrink-0 rounded-full border-2 ${on ? 'border-[#e8c97a] dark:border-[#a8803a]' : 'border-[#d9cdb3] dark:border-white/25'}`} />
}

function ProgressRing({ pct, small = false }: { pct: number; small?: boolean }) {
  const size = small ? 40 : 58
  const r = small ? 16 : 24
  const c = 2 * Math.PI * r
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(201,162,77,.18)" strokeWidth={small ? 4 : 5} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#setupRing)" strokeWidth={small ? 4 : 5} strokeLinecap="round" strokeDasharray={c} initial={false} animate={{ strokeDashoffset: c * (1 - pct / 100) }} transition={{ type: 'spring', stiffness: 90, damping: 20 }} />
        <defs><linearGradient id="setupRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#8b6a2b" /><stop offset="60%" stopColor="#C9A24D" /><stop offset="100%" stopColor="#e8c97a" /></linearGradient></defs>
      </svg>
      <span className={`absolute font-black ${small ? 'text-[10px]' : 'text-[13px]'}`}>{pct}%</span>
    </span>
  )
}

function SavePill({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (state === 'idle') return <span className="hidden text-[12px] font-bold text-gray-400 sm:inline">Saves as you go</span>
  if (state === 'saving') return <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-gray-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> <span className="max-sm:hidden">Saving</span></span>
  if (state === 'error') return <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-rose-600"><CircleAlert className="h-3.5 w-3.5" /> Not saved - check your connection</span>
  return <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-emerald-600 dark:text-emerald-400"><Check className="h-3.5 w-3.5" /> Saved</span>
}

function SetupBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute -left-40 top-24 h-[520px] w-[520px] rounded-full bg-[#e8c97a]/25 blur-[120px] dark:bg-[#C9A24D]/10" />
      <div className="absolute -right-32 top-[40%] h-[460px] w-[460px] rounded-full bg-[#1b6f58]/[0.07] blur-[110px] dark:bg-[#1b6f58]/15" />
      <div className="absolute bottom-[-160px] left-1/3 h-[420px] w-[620px] rounded-full bg-[#C9A24D]/15 blur-[120px] dark:bg-[#2c4a96]/[0.12]" />
      <div className="absolute inset-0 opacity-[0.5] [background-image:linear-gradient(rgba(139,106,43,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(139,106,43,.06)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(70%_50%_at_50%_0%,#000,transparent)] dark:[background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)]" />
    </div>
  )
}

function Finale({ data, firstName, onGo }: { data: SetupData; firstName: string; onGo: (id: SetupStepId) => void }) {
  const skipped = data.steps.filter(s => s.status === 'skipped')
  const todo = data.steps.filter(s => s.status === 'todo')
  const hub = data.plan && ['PREMIUM', 'IDX', 'PRO_NO_MLS'].includes(data.plan)
  const hubUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/${data.slug}`
  const [copied, setCopied] = useState(false)
  const links: { label: string; href: string; ext?: boolean }[] = []
  if (hub) links.push({ label: 'Open my Agent Hub', href: `/${data.slug}?intro=0`, ext: true })
  if (data.plan === 'IDX' || data.plan === 'PRO_NO_MLS') links.push({ label: 'My email signature', href: '/studio/email-signature' })
  if (data.plan === 'IDX') links.push({ label: 'My website', href: '/studio/website' })
  return (
    <div className="relative overflow-hidden rounded-[32px] border border-[#C9A24D]/30 bg-white px-6 py-12 text-center shadow-[0_50px_90px_-60px_rgba(139,106,43,.85)] dark:border-white/[0.08] dark:bg-[#121214] sm:px-12 sm:py-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(232,201,122,.35),transparent_70%)] dark:bg-[radial-gradient(60%_50%_at_50%_0%,rgba(201,162,77,.18),transparent_70%)]" />
      {[...Array(14)].map((_, k) => (
        <motion.span key={k} aria-hidden className="absolute left-1/2 top-24 h-1.5 w-1.5 rounded-full bg-[#e8c97a] shadow-[0_0_10px_2px_rgba(232,201,122,.7)]" initial={{ x: 0, y: 0, opacity: 0 }} animate={{ x: Math.cos((k / 14) * Math.PI * 2) * (120 + (k % 3) * 50), y: Math.sin((k / 14) * Math.PI * 2) * (80 + (k % 3) * 30), opacity: [0, 1, 0] }} transition={{ duration: 1.6, delay: 0.2 + (k % 4) * 0.05, ease: 'easeOut' }} />
      ))}
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 180, damping: 14, delay: 0.1 }} className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-[26px] bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a] shadow-[0_24px_44px_-18px_rgba(17,24,39,.9)] ring-1 ring-[#C9A24D]/50">
        <Sparkles className="h-9 w-9" />
      </motion.div>
      <h1 className="relative mt-6 font-serif text-[34px] font-black leading-tight tracking-tight sm:text-[46px]">
        {todo.length ? <>Almost <em className="bg-gradient-to-r from-[#a8803a] via-[#C9A24D] to-[#d9b867] bg-clip-text pb-[0.1em] pr-[0.12em] italic text-transparent [box-decoration-break:clone]">there</em>{firstName ? `, ${firstName}` : ''}</> : <>You&apos;re all <em className="bg-gradient-to-r from-[#a8803a] via-[#C9A24D] to-[#d9b867] bg-clip-text pb-[0.1em] pr-[0.12em] italic text-transparent [box-decoration-break:clone]">set</em>{firstName ? `, ${firstName}` : ''}!</>}
      </h1>
      <p className="relative mx-auto mt-3 max-w-xl text-[16.5px] font-medium leading-relaxed text-gray-600 dark:text-gray-300">
        {!data.approved
          ? 'You’re ahead of the game. We’ll email you the moment your broker approves your account - then you’ll pick your plan and the rest is ready.'
          : !data.plan
            ? 'Your info is saved. Pick your plan to unlock the rest of your setup.'
            : todo.length ? 'A few steps still need you - they’re listed below.' : 'Everything you added is already live across your pages. You can change any of it anytime.'}
      </p>
      {links.length > 0 && (
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          {links.map(l => <a key={l.label} href={l.href} target={l.ext ? '_blank' : undefined} rel="noreferrer" className="inline-flex h-12 items-center gap-2 rounded-2xl border-2 border-[#C9A24D]/40 bg-white px-5 text-[15px] font-black text-[#111827] transition hover:-translate-y-0.5 hover:border-[#C9A24D] dark:bg-white/5 dark:text-white">{l.label}{l.ext && <ExternalLink className="h-4 w-4" />}</a>)}
          {hub && <button type="button" onClick={() => { navigator.clipboard.writeText(hubUrl); setCopied(true) }} className="inline-flex h-12 items-center gap-2 rounded-2xl border-2 border-[#C9A24D]/40 bg-white px-5 text-[15px] font-black text-[#111827] dark:bg-white/5 dark:text-white">{copied ? <><Check className="h-4 w-4 text-emerald-600" /> Link copied</> : 'Copy my hub link'}</button>}
        </div>
      )}
      {(skipped.length > 0 || todo.length > 0) && (
        <div className="relative mx-auto mt-10 max-w-xl rounded-[22px] bg-[#f7f3ea] p-5 text-left dark:bg-white/[0.04]">
          <p className="text-[14px] font-black">{todo.length ? 'Still to do' : 'Skipped - finish anytime'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[...todo, ...skipped].map(s => <button key={s.id} type="button" onClick={() => onGo(s.id)} className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#C9A24D]/30 bg-white px-3.5 py-2 text-[13.5px] font-bold text-[#111827] transition hover:border-[#C9A24D] dark:bg-white/5 dark:text-white">{stepCopy(s.id, data.plan, data.has_mls).label}{s.status === 'skipped' && <span className="text-[11px] text-gray-400">· skipped</span>}<ArrowRight className="h-3.5 w-3.5" /></button>)}
          </div>
        </div>
      )}
      <div className="relative mt-10">
        {data.approved && data.plan
          ? <Link href="/dash" className="inline-flex h-14 items-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#111827] to-[#2a2218] px-9 text-[17px] font-black text-white shadow-[0_18px_34px_-16px_rgba(17,24,39,.9)] ring-1 ring-[#C9A24D]/40 dark:from-[#C9A24D] dark:to-[#e8c97a] dark:text-[#111827]">Go to my dashboard <ArrowRight className="h-5 w-5" /></Link>
          : data.approved
            ? <Link href="/checkout" className="inline-flex h-14 items-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#111827] to-[#2a2218] px-9 text-[17px] font-black text-white ring-1 ring-[#C9A24D]/40">Pick my plan <ArrowRight className="h-5 w-5" /></Link>
            : <Link href="/broker-authorization" className="inline-flex h-14 items-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#111827] to-[#2a2218] px-9 text-[17px] font-black text-white ring-1 ring-[#C9A24D]/40">Done for now <ArrowRight className="h-5 w-5" /></Link>}
        {data.steps.length > 0 && <p className="mt-5"><button type="button" onClick={() => onGo(data.steps[0].id)} className="text-[14px] font-black text-[#8b6a2b] underline-offset-4 hover:underline dark:text-[#e8c97a]">Go through every step again</button></p>}
      </div>
    </div>
  )
}
