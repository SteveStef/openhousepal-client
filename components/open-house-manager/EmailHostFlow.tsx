'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Check, Mail, MessageSquare, RotateCcw } from 'lucide-react'
import { normalizeImageUrl } from '@/lib/utils'
import { mailtoHref, smsHref, useMessageTemplate } from '@/lib/messageTemplates'
import { FlowFooter, HostFlowWindow, SentMoment } from './HostFlowParts'

// Request to Host by text or email, sent from the agent's own phone / email app (owner, 10/31) - when
// the listing agent ISN'T on OpenHousePal, or as an extra nudge after an in-app request ("also" mode).
// (1) the note - their own wording, remembered for every future request (the other agent's name and
// the address fill in fresh - lib/messageTemplates), (2) Text or Email: their app opens filled in.
// Never a link to the listing on OpenHousePal - listing agents don't want that; the address says it.

const titleCase = (v?: string) => (v && v === v.toUpperCase() ? v.toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase()) : v || '')

/** "(484) 614-5712" for a US number; anything else as given. */
const nicePhone = (v: string) => {
  const d = v.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : v
}

export default function EmailHostFlow({ property, user, onClose, also = false }: { property: any; user: any; onClose: () => void; also?: boolean }) {
  const [open, setOpen] = useState(true)
  const [step, setStep] = useState<'note' | 'send' | 'done'>('note')
  const [dir, setDir] = useState(1)
  const [via, setVia] = useState<'text' | 'email' | null>(null)
  const agentName = String(property.ListAgentFullName || '').trim()
  const agentFirstName = agentName.split(/\s+/)[0] || 'there'
  const street = titleCase(property.Street) || 'this listing'
  const city = titleCase(property.City)
  const myName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim()
  const vars = { agent_first_name: agentFirstName, address: street, city, my_name: myName, my_brokerage: user?.brokerage || '', my_phone: user?.phone || '' }
  // OpenHousePal's own wording (what this window always said) until they change it.
  const fallback = {
    subject: `Hosting an Open House for ${street}`,
    body: `Hi ${agentFirstName},\n\nMy name is ${myName}${user?.brokerage ? ` from ${user.brokerage}` : ''}. I saw your listing at ${street}${city ? ` in ${city}` : ''} and would love to help you host an open house this upcoming weekend.\n\nBest regards,\n\n${myName}\n${user?.phone || ''}`.trim(),
  }
  const tpl = useMessageTemplate('host_request', fallback, vars)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [remember, setRemember] = useState(true)
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current || !tpl.message) return
    seeded.current = true
    setSubject(tpl.message.subject); setBody(tpl.message.body)
  }, [tpl.message])

  const email = property.ListingAgentEmail || ''
  const phone = property.ListAgentPreferredPhone && property.ListAgentPreferredPhone !== 'N/A' ? property.ListAgentPreferredPhone : ''

  const closing = useRef(false)
  const close = () => {
    if (closing.current) return
    closing.current = true
    setOpen(false)
    window.setTimeout(onClose, 280)
  }
  const go = (s: typeof step) => { setDir(s === 'note' ? -1 : 1); setStep(s) }
  const edited = !!tpl.message && (subject !== tpl.message.subject || body !== tpl.message.body)
  const toNote = () => { if (remember && edited) tpl.remember({ subject, body }); go('send') }
  const send = (how: 'text' | 'email') => {
    setVia(how)
    window.location.href = how === 'text' ? smsHref(phone, body) : mailtoHref(email, subject, body)
    window.setTimeout(() => go('done'), 400)
  }

  const place = [city, [property.State, property.Zipcode].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const facts = [property.Price, property.Beds ? `${property.Beds} bd` : '', property.Baths ? `${property.Baths} ba` : ''].filter(Boolean).join(' · ')
  const Option = ({ how, icon, title, sub, disabled }: { how: 'text' | 'email'; icon: React.ReactNode; title: string; sub: string; disabled: boolean }) => (
    <motion.button type="button" whileTap={disabled ? undefined : { scale: 0.97 }} disabled={disabled} onClick={() => send(how)} data-testid={`host-outreach-${how}`}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: how === 'email' ? 0.06 : 0, type: 'spring', stiffness: 380, damping: 30 }}
      className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition ${disabled
        ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-60 dark:border-white/10 dark:bg-white/[0.02]'
        : 'border-[#C9A24D]/40 bg-white shadow-[0_14px_30px_-24px_rgba(139,115,85,.9)] hover:border-[#C9A24D] dark:border-white/10 dark:bg-white/[0.04]'}`}>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${disabled ? 'bg-gray-200 text-gray-400 dark:bg-white/10' : 'bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a]'}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-black text-[#111827] dark:text-white">{title}</span>
        <span className="block truncate text-[12.5px] font-semibold text-gray-500 dark:text-gray-400">{sub}</span>
      </span>
      {!disabled && <ArrowRight className="h-4 w-4 shrink-0 text-[#C9A24D]" />}
    </motion.button>
  )

  return (
    <HostFlowWindow
      open={open}
      onClose={close}
      photo={property.Image ? normalizeImageUrl(property.Image) : null}
      street={street}
      place={place}
      facts={facts}
      kicker={also ? 'Also reach out' : 'Request to host'}
      steps={['Your note to them', 'Text or email']}
      stepNo={step === 'note' ? 1 : 2}
      done={step === 'done'}
      title={step === 'note' ? `Say hi to ${agentFirstName}` : `Send it to ${agentFirstName}`}
      stepKey={step}
      dir={dir}
      footer={step === 'note'
        ? <FlowFooter onNext={toNote} disabled={!body.trim()} nextLabel="Continue" nextIcon={<ArrowRight className="h-4 w-4" />} />
        : step === 'send' ? <FlowFooter onBack={() => go('note')} onNext={close} nextLabel="Done" nextIcon={<Check className="h-4 w-4" />} /> : undefined}
    >
      {step === 'note' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-[#C9A24D]/35 bg-[#C9A24D]/[0.07] p-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#e8c97a] to-[#C9A24D] text-[#111827]"><MessageSquare className="h-4 w-4" /></span>
            <p className="text-[13px] font-semibold leading-snug text-[#5c4a1f] dark:text-[#e8cf8a]">
              {also
                ? `Your request is in their OpenHousePal. Want to nudge ${agentFirstName} directly too? Text or email it from your own phone.`
                : `${agentName || 'This listing agent'} isn’t on OpenHousePal yet, so ask by text or email from your own phone. Change anything you like.`}
            </p>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Subject <span className="normal-case tracking-normal text-gray-400/80">(email only)</span></span>
            <input value={subject} onChange={e => setSubject(e.target.value)} data-testid="host-outreach-subject"
              className="block w-full rounded-2xl border border-gray-200 bg-[#FAFAF7] px-4 py-3 text-[15px] font-bold text-[#111827] outline-none transition focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/15 dark:border-white/10 dark:bg-[#0b0b0c] dark:text-white" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Your note</span>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={8} data-testid="host-outreach-body"
              className="block w-full resize-none rounded-2xl border border-gray-200 bg-[#FAFAF7] px-4 py-3 text-[15px] font-medium leading-relaxed text-[#111827] outline-none transition focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/15 dark:border-white/10 dark:bg-[#0b0b0c] dark:text-white" />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-[13px] font-bold text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="h-4 w-4 accent-[#C9A24D]" />
              Use my wording for every request
            </label>
            {tpl.customized && (
              <button type="button" onClick={async () => { await tpl.reset(); setSubject(fallback.subject); setBody(fallback.body) }}
                className="inline-flex items-center gap-1 text-[12px] font-bold text-[#8b7355] hover:underline dark:text-[#e8c97a]">
                <RotateCcw className="h-3.5 w-3.5" /> Use OpenHousePal&apos;s note
              </button>
            )}
          </div>
          <p className="text-[11.5px] font-medium text-gray-400">Their name and the address fill in on their own each time.</p>
        </div>
      )}
      {step === 'send' && (
        <div className="space-y-3">
          <Option how="text" icon={<MessageSquare className="h-5 w-5" />} title={`Text ${agentFirstName}`} sub={phone ? nicePhone(phone) : 'No phone number on file'} disabled={!phone} />
          <Option how="email" icon={<Mail className="h-5 w-5" />} title={`Email ${agentFirstName}`} sub={email || 'No email on file'} disabled={!email} />
          <p className="pt-1 text-center text-[12px] font-semibold text-gray-400">Opens your own Messages or email app, filled in - you press send.</p>
        </div>
      )}
      {step === 'done' && (
        <SentMoment title={via === 'text' ? 'Your text is ready' : 'Your email is ready'}
          text={<>Send it from your {via === 'text' ? 'Messages' : 'email'} app.{!also && <> When {agentFirstName} joins OpenHousePal you can ask in one tap.</>}</>} onClose={close} />
      )}
    </HostFlowWindow>
  )
}
