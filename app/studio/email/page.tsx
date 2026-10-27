'use client'

// Studio -> Email (user, 10/17): one place for every email rule, for THIS agent only.
// - Sending from: connect Gmail / Outlook (SendAsPanel - moved here from Integrations and the
//   Emails tracker).
// - Emails to your clients, by importance: switch each kind off, pick which address sends it, send
//   the open house Showcase invite sooner than the 1-hour default, slow Showcase updates to weekly.
// - Emails to you: the same per-kind switches as Settings -> Notifications, grouped by importance,
//   plus the time the daily briefing arrives.
// Everything here can only send LESS than the standard rules (backend email_settings_service
// enforces it at send time) - nothing can add emails.

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import {
  AlertCircle, BellRing, Check, ChevronDown, Clock, Inbox, Lock, Mail, MailCheck, Send, ShieldCheck, Sparkles, Star,
} from 'lucide-react'
import AuthGuard from '@/components/AuthGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import StudioPageHeader from '@/components/studio/StudioPageHeader'
import SendAsPanel, { InboxRules } from '@/components/integrations/SendAsPanel'
import OhpSwitch from '@/components/ui/OhpSwitch'
import OhpLoader from '@/components/brand/OhpLoader'
import api, { type EmailSettings, type EmailSettingsClientRow, type EmailSettingsPatch } from '@/lib/api-service'

const rise: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 26 } },
}

const DELAY_LABEL: Record<number, string> = { 0: 'Right away', 15: '15 min', 30: '30 min', 60: '1 hour' }

function timeLabel(t: string): string {
  const [h, m] = t.split(':').map(Number)
  return `${(h % 12) || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

export default function EmailSettingsPage() {
  return (
    <AuthGuard>
      <SubscriptionGuard>
        <Suspense fallback={<OhpLoader label="Loading your email settings" />}>
          <EmailSettingsInner />
        </Suspense>
      </SubscriptionGuard>
    </AuthGuard>
  )
}

function EmailSettingsInner() {
  const params = useSearchParams()
  const mailboxResult = params.get('mailbox')
  const [s, setS] = useState<EmailSettings | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [busy, setBusy] = useState('')
  const [savedKey, setSavedKey] = useState('')
  const [error, setError] = useState('')
  const [rulesOpen, setRulesOpen] = useState(false)

  const load = useCallback(async () => {
    const r = await api.emailSettings.get()
    if (r.success && r.data) { setS(r.data); setLoadError(false) } else setLoadError(true)
  }, [])
  useEffect(() => { load() }, [load])

  const save = async (key: string, patch: EmailSettingsPatch, optimistic: EmailSettings) => {
    const before = s
    setS(optimistic); setBusy(key); setError('')
    const r = await api.emailSettings.update(patch)
    setBusy('')
    if (r.success && r.data) {
      setS(r.data)
      setSavedKey(key)
      window.setTimeout(() => setSavedKey(k => (k === key ? '' : k)), 1600)
    } else {
      setS(before)
      setError(r.error || "That didn't save - please try again.")
    }
  }

  const setClient = (row: EmailSettingsClientRow, change: Partial<EmailSettingsClientRow>) => {
    if (!s) return
    save(row.key, { client: { [row.key]: change } }, { ...s, client: s.client.map(c => (c.key === row.key ? { ...c, ...change } : c)) })
  }
  const setReceive = (id: string, on: boolean) => {
    if (!s) return
    save(`r:${id}`, { receive: { [id]: on } }, {
      ...s, receive: s.receive.map(t => ({ ...t, categories: t.categories.map(c => (c.id === id ? { ...c, email: on } : c)) })),
    })
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]">
      <div className="mx-auto max-w-5xl px-4 py-4 sm:py-6">
        <StudioPageHeader
          icon={Mail}
          kicker="Email"
          title={<>Every email, <em>your way</em></>}
          subtitle="Choose which emails go out, which address sends them, and which ones come to you. These settings only ever send less than our standard - never more."
        />

        {!s ? (
          loadError ? (
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" /> Your email settings didn&apos;t load.
              <button type="button" onClick={load} className="ml-auto rounded-full bg-white px-3 py-1 text-xs font-black text-rose-700 ring-1 ring-rose-200 dark:bg-white/10 dark:text-rose-200">Try again</button>
            </div>
          ) : <OhpLoader fullScreen={false} label="Loading your email settings" />
        ) : (
          <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.07 } } }} className="space-y-5">
            <AnimatePresence>
              {error && (
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 overflow-hidden rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                </motion.p>
              )}
            </AnimatePresence>

            {/* 1. Sending from */}
            <motion.section variants={rise} id="send-as" className="scroll-mt-24 overflow-hidden rounded-3xl border border-[#C9A24D]/25 bg-white shadow-sm dark:border-white/[0.07] dark:bg-[#121214]">
              <SectionHead icon={MailCheck} kicker="Sending from" title={<>Send from <em>your own email</em></>}
                sub="Client emails come from your real address - they land in the inbox and show in your Sent folder. If it ever can't send, OpenHousePal sends it instead, so nothing is lost." />
              {mailboxResult && (
                <p className={`mx-5 mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-bold sm:mx-6 ${mailboxResult === 'connected' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'}`}>
                  {mailboxResult === 'connected' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  {mailboxResult === 'connected' ? 'Connected - your client emails now go out from you.' : "That didn't connect - please try again."}
                </p>
              )}
              <div className="p-5 sm:p-6"><SendAsPanel back="emails" onChange={() => load()} hideRules /></div>
            </motion.section>

            {/* 2. Emails to your clients */}
            <motion.section variants={rise} className="overflow-hidden rounded-3xl border border-[#C9A24D]/25 bg-white shadow-sm dark:border-white/[0.07] dark:bg-[#121214]">
              <SectionHead icon={Send} kicker="Emails to your clients" title={<>What your clients <em>get</em></>}
                sub={s.client.some(c => c.key.startsWith('showcase'))
                  ? 'Turn any of these off, or choose which address sends it. Off means it never goes out - their Showcase and your follow-ups still work.'
                  : 'Turn any of these off, or choose which address sends it. Off means it never goes out - your follow-ups still work.'} />
              <div className="space-y-6 p-5 sm:p-6">
                {/* Only the groups this plan has emails in (No-MLS plans have no automatic updates). */}
                {([1, 2] as const).filter(tier => s.client.some(c => c.tier === tier)).map(tier => (
                  <div key={tier}>
                    <TierTitle tier={tier} title={tier === 1 ? 'Most important' : 'Automatic updates'}
                      blurb={tier === 1 ? 'The emails that win clients - keep these on.' : 'Sent by themselves when something changes. Quiet days send nothing.'} />
                    <div className="mt-3 space-y-3">
                      {s.client.filter(c => c.tier === tier).map((row, i) => (
                        <ClientRow key={row.key} row={row} index={i} settings={s} busy={busy === row.key} saved={savedKey === row.key}
                          onChange={change => setClient(row, change)}
                          onDelay={d => save(row.key, { invite_delay: d }, { ...s, invite_delay: d })} />
                      ))}
                    </div>
                  </div>
                ))}
                <div className="rounded-2xl border border-[#C9A24D]/20 bg-[#fbf8f1] dark:border-white/10 dark:bg-white/[0.03]">
                  <button type="button" onClick={() => setRulesOpen(o => !o)} className="flex w-full items-center gap-2 px-4 py-3 text-left text-[13px] font-black text-[#6b5a45] dark:text-white/80">
                    <ShieldCheck className="h-4 w-4 text-[#C9A24D]" /> How we keep your emails in the inbox
                    <ChevronDown className={`ml-auto h-4 w-4 transition-transform duration-300 ${rulesOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence initial={false}>
                    {rulesOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                        <div className="px-4 pb-4"><InboxRules /></div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.section>

            {/* 3. Emails to you */}
            <motion.section variants={rise} className="overflow-hidden rounded-3xl border border-[#C9A24D]/25 bg-white shadow-sm dark:border-white/[0.07] dark:bg-[#121214]">
              <SectionHead icon={Inbox} kicker="Emails to you" title={<>What lands in <em>your inbox</em></>}
                sub="Your bell inside OpenHousePal always shows everything - these only decide what's also emailed to you." />
              <div className="space-y-6 p-5 sm:p-6">
                {s.receive.map(t => (
                  <div key={t.tier}>
                    <TierTitle tier={t.tier} title={t.title} blurb={t.blurb} />
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {t.categories.map((c, i) => (
                        <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i }}
                          className={`rounded-2xl border p-4 transition-colors ${c.email ? 'border-[#C9A24D]/35 bg-[#fffdf8] dark:border-[#C9A24D]/25 dark:bg-[#17150f]' : 'border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.02]'}`}>
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-1.5 text-[14px] font-black text-[#111827] dark:text-white">
                                {c.label}<SavedTick on={savedKey === `r:${c.id}`} />
                              </p>
                              <p className="mt-0.5 text-[12px] font-medium leading-snug text-gray-500 dark:text-gray-400">{c.help}</p>
                            </div>
                            <OhpSwitch on={c.email} busy={busy === `r:${c.id}`} label={c.label} onChange={on => setReceive(c.id, on)} />
                          </div>
                          {c.id === 'showcase_digest' && (
                            <AnimatePresence initial={false}>
                              {c.email && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                  <label className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#C9A24D]/15 pt-3 text-[12px] font-black text-[#6b5a45] dark:border-white/10 dark:text-white/70">
                                    <Clock className="h-3.5 w-3.5 text-[#C9A24D]" /> Arrives at
                                    <select value={s.briefing_time} disabled={busy === 'briefing'}
                                      onChange={e => save('briefing', { briefing_time: e.target.value }, { ...s, briefing_time: e.target.value })}
                                      className="rounded-xl border border-[#C9A24D]/35 bg-white px-2.5 py-1.5 text-[13px] font-black text-[#111827] outline-none focus:border-[#C9A24D] dark:border-white/15 dark:bg-[#1a1a1d] dark:text-white">
                                      {s.briefing_times.map(t => <option key={t} value={t}>{timeLabel(t)}</option>)}
                                    </select>
                                    <span className="font-semibold text-gray-400">Eastern time</span>
                                    <SavedTick on={savedKey === 'briefing'} />
                                  </label>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-gray-50 px-4 py-3 text-[12px] font-semibold text-gray-500 dark:bg-white/[0.03] dark:text-gray-400">
                  <Lock className="h-3.5 w-3.5 shrink-0" /> Always sent, so your account keeps working:
                  {s.always_on.map(a => <span key={a} className="rounded-full bg-white px-2.5 py-0.5 font-black text-gray-600 ring-1 ring-gray-200 dark:bg-white/[0.06] dark:text-gray-300 dark:ring-white/10">{a}</span>)}
                </div>
              </div>
            </motion.section>
          </motion.div>
        )}
      </div>
    </div>
  )
}

function SectionHead({ icon: Icon, kicker, title, sub }: { icon: React.ComponentType<{ className?: string }>; kicker: string; title: React.ReactNode; sub: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-[#C9A24D]/15 bg-[radial-gradient(120%_160%_at_100%_0%,rgba(201,162,77,.14),transparent_55%),linear-gradient(140deg,#fffdf8_0%,#fbf6ec_100%)] px-5 py-4 dark:border-white/[0.06] dark:bg-[radial-gradient(120%_160%_at_100%_0%,rgba(201,162,77,.14),transparent_55%),linear-gradient(140deg,#0b0f0e_0%,#151517_100%)] sm:px-6">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a] shadow-md ring-1 ring-[#C9A24D]/30 dark:from-[#e8c97a] dark:to-[#C9A24D] dark:text-[#111827]">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8b7355] dark:text-[#e8c97a]">{kicker}</p>
        <h2 className="font-serif text-xl font-black text-[#111827] dark:text-white [&_em]:text-[#C9A24D]">{title}</h2>
        <p className="mt-0.5 text-[12.5px] font-medium leading-snug text-gray-500 dark:text-gray-400">{sub}</p>
      </div>
    </div>
  )
}

function TierTitle({ tier, title, blurb }: { tier: number; title: string; blurb: string }) {
  const Icon = tier === 1 ? Star : tier === 2 ? BellRing : Sparkles
  return (
    <div className="flex items-center gap-3">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${tier === 1 ? 'bg-[#C9A24D] text-[#111827]' : 'bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#e8c97a]'}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-black uppercase tracking-[0.12em] text-[#111827] dark:text-white">{title}</p>
        <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">{blurb}</p>
      </div>
      <span className="ml-2 hidden h-px flex-1 bg-gradient-to-r from-[#C9A24D]/30 to-transparent sm:block" />
    </div>
  )
}

function SavedTick({ on }: { on: boolean }) {
  return (
    <AnimatePresence>
      {on && (
        <motion.span initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
          className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          <Check className="h-3 w-3" /> Saved
        </motion.span>
      )}
    </AnimatePresence>
  )
}

function ClientRow({ row, index, settings, busy, saved, onChange, onDelay }: {
  row: EmailSettingsClientRow; index: number; settings: EmailSettings; busy: boolean; saved: boolean
  onChange: (c: Partial<EmailSettingsClientRow>) => void; onDelay: (d: number) => void
}) {
  const mailbox = settings.mailbox
  const mine = mailbox.connected
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * index }}
      className={`rounded-2xl border p-4 transition-colors ${row.on ? 'border-[#C9A24D]/35 bg-[#fffdf8] dark:border-[#C9A24D]/25 dark:bg-[#17150f]' : 'border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.02]'}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-[14.5px] font-black text-[#111827] dark:text-white">
            {row.label}
            {row.key === 'showcase_invite' && <span className="rounded-full bg-[#C9A24D]/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#8b7355] dark:text-[#e8c97a]">#1 lead winner</span>}
            <SavedTick on={saved} />
          </p>
          <p className="mt-0.5 text-[12.5px] font-medium leading-snug text-gray-500 dark:text-gray-400">{row.help}</p>
        </div>
        <OhpSwitch on={row.on} busy={busy} label={row.label} onChange={on => onChange({ on })} />
      </div>
      <AnimatePresence initial={false}>
        {row.on ? (
          <motion.div key="opts" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="mt-3 flex flex-col gap-3 border-t border-[#C9A24D]/15 pt-3 dark:border-white/10 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-6">
              <Option label="Sends from">
                <Segmented id={`${row.key}-via`} value={mine ? row.via : 'openhousepal'} onChange={v => onChange({ via: v as 'mine' | 'openhousepal' })}
                  options={[
                    { value: 'mine', label: mine ? 'Your email' : 'Your email', hint: mine ? (mailbox.account_email || '') : 'Connect it above', disabled: !mine },
                    { value: 'openhousepal', label: 'OpenHousePal' },
                  ]} />
              </Option>
              {row.delay && (
                <Option label="Goes out">
                  <Segmented id={`${row.key}-delay`} value={String(settings.invite_delay)} onChange={v => onDelay(Number(v))}
                    options={settings.invite_delays.map(d => ({ value: String(d), label: d === 60 ? '1 hour after' : d === 0 ? 'Right away' : `${DELAY_LABEL[d]} after` }))} />
                </Option>
              )}
              {row.modes && (
                <Option label="How often">
                  <Segmented id={`${row.key}-mode`} value={row.mode || 'daily'} onChange={v => onChange({ mode: v as 'daily' | 'weekly' })}
                    options={[{ value: 'daily', label: 'Up to daily' }, { value: 'weekly', label: 'Once a week' }]} />
                </Option>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.p key="off" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-2 text-[12px] font-bold text-gray-400">
            Off - this email never goes out.
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function Option({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <span className="shrink-0 text-[11px] font-black uppercase tracking-[0.14em] text-gray-400">{label}</span>
      {children}
    </div>
  )
}

/** A pill row where the gold highlight glides to the picked option. */
function Segmented({ id, value, options, onChange }: {
  id: string; value: string
  options: { value: string; label: string; hint?: string; disabled?: boolean }[]
  onChange: (v: string) => void
}) {
  return (
    <div className="flex max-w-full flex-wrap gap-1 rounded-2xl bg-[#f3eee3] p-1 dark:bg-white/[0.06]">
      {options.map(o => {
        const active = o.value === value
        return (
          <button key={o.value} type="button" disabled={o.disabled || active} onClick={() => onChange(o.value)} title={o.hint || undefined}
            className={`relative rounded-xl px-3 py-1.5 text-left text-[12px] font-black transition-colors disabled:cursor-default ${active ? 'text-[#111827]' : o.disabled ? 'text-gray-400 opacity-70' : 'text-[#6b5a45] hover:text-[#111827] dark:text-white/70 dark:hover:text-white'}`}>
            {active && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-xl bg-white shadow-sm ring-1 ring-[#C9A24D]/40 dark:bg-[#e8c97a]" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
            <span className="relative block leading-tight">{o.label}</span>
            {o.hint && <span className={`relative block max-w-[180px] truncate text-[10px] font-semibold ${active ? 'text-gray-500' : 'text-gray-400'}`}>{o.hint}</span>}
          </button>
        )
      })}
    </div>
  )
}
