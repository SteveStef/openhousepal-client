'use client'

import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Check, Copy, Mail, Send } from 'lucide-react'
import { copyText } from '@/lib/copyText'
import { normalizeImageUrl } from '@/lib/utils'
import { FlowFooter, HostFlowWindow, SentMoment } from './HostFlowParts'

// Request to Host when the listing agent ISN'T on OpenHousePal (user, 10/24 - the old pop-up "looked
// bad, no animation"): the same lit, slide-up step window as the regular Request to Host. (1) the
// note we wrote for them - change it if you like, (2) who it goes to, with one-tap copies and
// "Open my email" (their own email app, pre-filled - nothing is sent by us), then a short "ready" moment.

const titleCase = (v?: string) => (v && v === v.toUpperCase() ? v.toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase()) : v || '')

export default function EmailHostFlow({ property, user, onClose }: { property: any; user: any; onClose: () => void }) {
  const [open, setOpen] = useState(true)
  const [step, setStep] = useState<'note' | 'send' | 'done'>('note')
  const [dir, setDir] = useState(1)
  const [copied, setCopied] = useState<string | null>(null)
  const agentFirstName = (property.ListAgentFullName || '').trim().split(/\s+/)[0] || 'there'
  const street = titleCase(property.Street) || 'this listing'
  const [subject, setSubject] = useState(`Hosting an Open House for ${street}`)
  const [body, setBody] = useState(`Hi ${agentFirstName},\n\nMy name is ${user?.first_name || ''} ${user?.last_name || ''}${user?.brokerage ? ` from ${user.brokerage}` : ''}. I saw your listing at ${street}${property.City ? ` in ${titleCase(property.City)}` : ''} and would love to help you host an open house this upcoming weekend.\n\nBest regards,\n\n${user?.first_name || ''} ${user?.last_name || ''}\n${user?.phone || ''}`.trim())
  const to = property.ListingAgentEmail || ''

  const closing = useRef(false)
  const close = () => {
    if (closing.current) return
    closing.current = true
    setOpen(false)
    window.setTimeout(onClose, 280)
  }
  const go = (s: typeof step) => { setDir(s === 'note' ? -1 : 1); setStep(s) }
  const copy = (key: string, text: string) => {
    copyText(text).then(() => {
      setCopied(key)
      window.setTimeout(() => setCopied(c => (c === key ? null : c)), 1600)
    })
  }
  const openEmail = () => {
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    go('done')
  }

  const place = [titleCase(property.City), [property.State, property.Zipcode].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const facts = [property.Price, property.Beds ? `${property.Beds} bd` : '', property.Baths ? `${property.Baths} ba` : ''].filter(Boolean).join(' · ')
  const CopyBtn = ({ k, text, label = 'Copy' }: { k: string; text: string; label?: string }) => (
    <motion.button type="button" whileTap={{ scale: 0.92 }} onClick={() => copy(k, text)} disabled={!text}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[10px] font-black uppercase tracking-widest transition ${copied === k ? 'bg-emerald-500 text-white' : 'bg-[#C9A24D]/12 text-[#7a5f22] hover:bg-[#C9A24D]/20 dark:text-[#e8c97a]'}`}>
      {copied === k ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Copy className="h-3.5 w-3.5" />} {copied === k ? 'Copied' : label}
    </motion.button>
  )

  return (
    <HostFlowWindow
      open={open}
      onClose={close}
      photo={property.Image ? normalizeImageUrl(property.Image) : null}
      street={titleCase(property.Street) || 'This listing'}
      place={place}
      facts={facts}
      kicker="Request to host"
      steps={['Your note to them', 'Send it from your email']}
      stepNo={step === 'note' ? 1 : 2}
      done={step === 'done'}
      title={step === 'note' ? `Say hi to ${agentFirstName}` : 'Send it your way'}
      stepKey={step}
      dir={dir}
      footer={step === 'note'
        ? <FlowFooter onNext={() => go('send')} nextLabel="Continue" nextIcon={<ArrowRight className="h-4 w-4" />} />
        : <FlowFooter onBack={() => go('note')} onNext={openEmail} disabled={!to} nextLabel="Open email" nextIcon={<Send className="h-4 w-4" />} />}
    >
      {step === 'note' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-[#C9A24D]/35 bg-[#C9A24D]/[0.07] p-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#e8c97a] to-[#C9A24D] text-[#111827]"><Mail className="h-4 w-4" /></span>
            <p className="text-[13px] font-semibold leading-snug text-[#5c4a1f] dark:text-[#e8cf8a]">
              {`${String(property.ListAgentFullName || 'This listing agent').trim()} isn’t on OpenHousePal yet, so ask them by email. We wrote the note - change anything you like.`}
            </p>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Subject</span>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              className="block w-full rounded-2xl border border-gray-200 bg-[#FAFAF7] px-4 py-3 text-[15px] font-bold text-[#111827] outline-none transition focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/15 dark:border-white/10 dark:bg-[#0b0b0c] dark:text-white" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Your note</span>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={8}
              className="block w-full resize-none rounded-2xl border border-gray-200 bg-[#FAFAF7] px-4 py-3 text-[15px] font-medium leading-relaxed text-[#111827] outline-none transition focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/15 dark:border-white/10 dark:bg-[#0b0b0c] dark:text-white" />
          </label>
        </div>
      )}
      {step === 'send' && (
        <div className="space-y-3">
          {[
            { k: 'to', label: 'To', value: to || 'No email on file for this agent' },
            { k: 'subject', label: 'Subject', value: subject },
          ].map((r, i) => (
            <motion.div key={r.k} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, type: 'spring', stiffness: 380, damping: 30 }}
              className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a8843a] dark:text-[#e8c97a]">{r.label}</p>
                <p className="truncate text-[15px] font-bold text-[#111827] dark:text-white">{r.value}</p>
              </div>
              {(r.k !== 'to' || to) && <CopyBtn k={r.k} text={r.k === 'to' ? to : r.value} />}
            </motion.div>
          ))}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, type: 'spring', stiffness: 380, damping: 30 }}
            className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a8843a] dark:text-[#e8c97a]">Note</p>
              <CopyBtn k="body" text={body} />
            </div>
            <p className="line-clamp-5 whitespace-pre-line text-[13px] font-medium leading-relaxed text-gray-600 dark:text-gray-300">{body}</p>
          </motion.div>
          <p className="text-center text-[12px] font-semibold text-gray-400">&ldquo;Open email&rdquo; starts it in your own email app, filled in - you press send.</p>
        </div>
      )}
      {step === 'done' && (
        <SentMoment title="Your email is ready" text={<>Send it from your email app. When {agentFirstName} joins OpenHousePal you can ask in one tap.</>} onClose={close} />
      )}
    </HostFlowWindow>
  )
}
