'use client'

import { Fragment, memo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, Check, Compass, Eye, Handshake, Home, Mail, Map as MapIcon, MapPin, MoreHorizontal,
  Phone, Search, ShieldCheck, Tag, TrendingUp, User, UserX, Users, X,
} from 'lucide-react'
import LuxeHero from '@/components/ui/LuxeHero'
import OhpSwitch from '@/components/ui/OhpSwitch'

// Who the showcase is for - steps 1 and 2 of creating one. Step 3 (the search itself) is the same
// full-screen map + grid editor used to edit a showcase (ShowcaseMapEditor in create mode).
export type ShowcaseClientInfo = {
  showcaseName: string
  fullName: string
  email: string
  phone: string
  visitingReason: string
  hasAgent: string
  /** Email them their Showcase (link + a few homes) the moment it's made. */
  emailClient: boolean
}

interface CreateCollectionModalProps {
  isOpen: boolean
  onClose: () => void
  /** Steps 1-2 are filled in - move on to the search step. */
  onContinue: (info: ShowcaseClientInfo) => void
}

const STEPS = [
  { label: 'Client', icon: User },
  { label: 'About them', icon: Compass },
  { label: 'Search area', icon: MapIcon },
]

const REASONS = [
  { id: 'BUYING_SOON', label: 'Looking to buy soon', icon: Home },
  { id: 'BROWSING', label: 'Just browsing', icon: Eye },
  { id: 'NEIGHBORHOOD', label: 'Interested in area', icon: MapPin },
  { id: 'INVESTMENT', label: 'Investment opportunity', icon: TrendingUp },
  { id: 'CURIOUS', label: 'Curious about property', icon: Search },
  { id: 'OTHER', label: 'Other', icon: MoreHorizontal },
]

const AGENT = [
  { id: 'YES', label: 'Yes, they have an agent', icon: ShieldCheck },
  { id: 'NO', label: "No, they don't have an agent", icon: UserX },
  { id: 'LOOKING', label: "They're looking for an agent", icon: Handshake },
]

const firstName = (full: string) => full.trim().split(/\s+/)[0] || ''

export const CreateCollectionModal = memo(function CreateCollectionModal({ isOpen, onClose, onContinue }: CreateCollectionModalProps) {
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [info, setInfo] = useState<ShowcaseClientInfo>({
    showcaseName: '', fullName: '', email: '', phone: '', visitingReason: 'BUYING_SOON', hasAgent: 'NO', emailClient: true,
  })
  // The showcase name follows the client's name until the agent types their own.
  const [nameTouched, setNameTouched] = useState(false)
  const first = firstName(info.fullName)

  const set = (field: Exclude<keyof ShowcaseClientInfo, 'emailClient'>, value: string) => setInfo(prev => {
    const next = { ...prev, [field]: value }
    if (field === 'fullName' && !nameTouched) {
      const f = firstName(value)
      next.showcaseName = f ? `${f}'s Home Search` : ''
    }
    return next
  })

  const goTo = (n: number) => { setDir(n > step ? 1 : -1); setStep(n) }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (step === 0) goTo(1)
    else onContinue({ ...info, fullName: info.fullName.trim(), email: info.email.trim(), showcaseName: info.showcaseName.trim() })
  }

  const field = 'block w-full rounded-2xl border border-gray-200 bg-white py-3.5 pl-11 pr-4 text-[15px] font-semibold text-[#0B0B0B] shadow-sm transition-all placeholder:font-medium placeholder:text-gray-400 focus:border-[#C9A24D] focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/30'
  const label = 'mb-1.5 ml-1 block text-[10px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#e8c97a]/80'

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed inset-0 z-50 flex overflow-y-auto bg-[#111827]/60 p-3 sm:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative m-auto w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-[0_40px_90px_-30px_rgba(17,24,39,.6)] dark:bg-[#111113]"
            onClick={(e) => e.stopPropagation()}
          >
            <LuxeHero
              compact
              className="!rounded-b-none !border-x-0 !border-t-0 !shadow-none"
              kicker="New Showcase"
              icon={Users}
              badge={
                <button type="button" onClick={onClose} aria-label="Close" className="-my-1.5 grid h-8 w-8 place-items-center rounded-full border border-[#C9A24D]/25 bg-white/70 text-[#8b7355] transition hover:rotate-90 hover:border-[#C9A24D] dark:border-white/10 dark:bg-white/[0.06] dark:text-[#e8c97a]">
                  <X className="h-4 w-4" />
                </button>
              }
              title={<>Homes picked <em>for {first || 'your client'}.</em></>}
              subtitle={step === 0 ? 'Who is this showcase for?' : `Where ${first || 'they'} ${first ? 'is' : 'are'} in the search - so it fits.`}
              tabs={
                <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
                  {STEPS.map((s, i) => {
                    const on = i === step
                    const done = i < step
                    const Icon = done ? Check : s.icon
                    return (
                      <Fragment key={s.label}>
                        <button
                          type="button"
                          disabled={!done}
                          onClick={() => goTo(i)}
                          aria-current={on ? 'step' : undefined}
                          className={`relative flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-black transition-colors ${on ? 'text-white dark:text-[#111827]' : done ? 'text-[#8b7355] hover:bg-[#C9A24D]/10 dark:text-[#e8c97a]' : 'cursor-default text-gray-400 dark:text-white/35'}`}
                        >
                          {on && (
                            <motion.span
                              layoutId="ohp-showcase-step"
                              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                              className="absolute inset-0 rounded-xl bg-[#111827] shadow-lg shadow-[#111827]/20 dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a]"
                            />
                          )}
                          <Icon className={`relative h-3.5 w-3.5 ${on ? 'text-[#e8c97a] dark:text-[#111827]' : ''}`} />
                          <span className="relative">{s.label}</span>
                        </button>
                        {i < STEPS.length - 1 && (
                          <span className="relative h-px min-w-6 flex-1 overflow-hidden rounded-full bg-[#C9A24D]/20">
                            <motion.span
                              className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#C9A24D] to-[#e8c97a]"
                              initial={false}
                              animate={{ width: i < step ? '100%' : '0%' }}
                              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            />
                          </span>
                        )}
                      </Fragment>
                    )
                  })}
                </div>
              }
            />

            <form onSubmit={submit}>
              <div className="relative overflow-hidden">
                <AnimatePresence mode="wait" custom={dir} initial={false}>
                  <motion.div
                    key={step}
                    custom={dir}
                    initial={{ opacity: 0, x: dir * 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: dir * -40 }}
                    transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                    className="p-5 sm:p-8"
                  >
                    {step === 0 ? (
                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className={label}>Client&apos;s full name *</label>
                          <div className="relative">
                            <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C9A24D]" />
                            <input autoFocus type="text" required value={info.fullName} onChange={(e) => set('fullName', e.target.value)} className={field} placeholder="Customer's full name" />
                          </div>
                        </div>
                        <div>
                          <label className={label}>Email *</label>
                          <div className="relative">
                            <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C9A24D]" />
                            <input type="email" required value={info.email} onChange={(e) => set('email', e.target.value)} className={field} placeholder="customer@email.com" />
                          </div>
                        </div>
                        <div>
                          <label className={label}>Phone</label>
                          <div className="relative">
                            <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C9A24D]" />
                            <input type="tel" value={info.phone} onChange={(e) => set('phone', e.target.value)} className={field} placeholder="(555) 123-4567" />
                          </div>
                        </div>
                        <div className="sm:col-span-2">
                          <label className={label}>Showcase name *</label>
                          <div className="relative">
                            <Tag className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C9A24D]" />
                            <input type="text" required value={info.showcaseName} onChange={(e) => { setNameTouched(true); set('showcaseName', e.target.value) }} className={field} placeholder="e.g., West Chester Family Showcase" />
                          </div>
                          {!nameTouched && info.showcaseName && (
                            <p className="ml-1 mt-1.5 text-[11px] font-semibold text-gray-400 dark:text-white/40">Named from your client - change it to anything.</p>
                          )}
                        </div>
                        <div className="sm:col-span-2">
                          <div className="flex items-center gap-3 rounded-2xl border border-[#C9A24D]/30 bg-[#C9A24D]/[0.06] px-4 py-3">
                            <Mail className="h-4 w-4 shrink-0 text-[#C9A24D]" />
                            <div className="min-w-0 flex-1 leading-tight">
                              <p className="text-sm font-black text-[#111827] dark:text-white">Email {first || 'them'} their Showcase</p>
                              <p className="mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-white/50">When you create it: their link, what it looks for and a few of the homes.</p>
                            </div>
                            <OhpSwitch on={info.emailClient} onChange={(v) => setInfo(prev => ({ ...prev, emailClient: v }))} label={`Email ${first || 'them'} their Showcase`} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-7">
                        <ChoiceGroup title={`Why ${first ? `is ${first}` : 'are they'} looking?`} group="reason" items={REASONS} value={info.visitingReason} onChange={(v) => set('visitingReason', v)} cols="sm:grid-cols-3" />
                        <ChoiceGroup title={`Does ${first || 'your client'} have an agent?`} group="agent" items={AGENT} value={info.hasAgent} onChange={(v) => set('hasAgent', v)} cols="sm:grid-cols-3" />
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-[#FAFAF7]/80 px-5 py-4 dark:border-white/[0.06] dark:bg-white/[0.02] sm:px-8">
                {step === 0 ? (
                  <button type="button" onClick={onClose} className="rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest text-gray-500 transition hover:bg-gray-100 hover:text-[#111827] dark:text-white/50 dark:hover:bg-white/[0.06] dark:hover:text-white">Cancel</button>
                ) : (
                  <button type="button" onClick={() => goTo(0)} className="group flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest text-gray-500 transition hover:bg-gray-100 hover:text-[#111827] dark:text-white/50 dark:hover:bg-white/[0.06] dark:hover:text-white">
                    <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" /> Back
                  </button>
                )}
                <button
                  type="submit"
                  className="group relative flex items-center gap-2 overflow-hidden rounded-xl bg-[#111827] px-6 py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-[#111827]/25 transition-all hover:shadow-xl dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a] dark:text-[#111827]"
                >
                  <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                  {step === 0 ? 'Continue' : <><MapIcon className="h-4 w-4 text-[#e8c97a] dark:text-[#111827]" /> Set the search area</>}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})

function ChoiceGroup({ title, group, items, value, onChange, cols }: {
  title: string
  group: string
  items: { id: string; label: string; icon: React.ComponentType<{ className?: string }> }[]
  value: string
  onChange: (id: string) => void
  cols: string
}) {
  return (
    <div>
      <p className="mb-3 font-serif text-lg font-black text-[#111827] dark:text-white">{title}</p>
      <div className={`grid grid-cols-1 gap-2.5 ${cols}`} role="radiogroup" aria-label={title}>
        {items.map((it, k) => {
          const on = it.id === value
          return (
            <motion.button
              key={it.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(it.id)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: k * 0.04, ease: [0.16, 1, 0.3, 1] }}
              className={`group relative flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-[border-color,background-color,box-shadow,transform] duration-300 ${on
                ? 'border-[#C9A24D] bg-[#fbf3df] shadow-[0_14px_30px_-20px_rgba(201,162,77,.95)] dark:bg-[#C9A24D]/[0.12]'
                : 'border-gray-200 bg-white hover:-translate-y-0.5 hover:border-[#C9A24D]/50 hover:shadow-md dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-[#C9A24D]/40'}`}
            >
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors duration-300 ${on ? 'bg-gradient-to-br from-[#C9A24D] to-[#e8c97a] text-[#111827]' : 'bg-[#FAFAF7] text-[#8b7355] group-hover:text-[#C9A24D] dark:bg-white/[0.06] dark:text-[#e8c97a]'}`}>
                <it.icon className="h-4 w-4" />
              </span>
              <span className={`min-w-0 pr-5 text-[13px] font-bold leading-snug ${on ? 'text-[#111827] dark:text-white' : 'text-gray-600 dark:text-white/70'}`}>{it.label}</span>
              {on && (
                <motion.span
                  layoutId={`ohp-choice-${group}`}
                  transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                  className="absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full bg-[#111827] text-[#e8c97a] dark:bg-[#e8c97a] dark:text-[#111827]"
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </motion.span>
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
