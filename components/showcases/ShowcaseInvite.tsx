'use client'

import { useState } from 'react'
import { AlertTriangle, Check, Mail, Send } from 'lucide-react'
import api from '@/lib/api-service'
import { ShowcaseInviteStatus } from '@/types'
import { useToast } from '@/contexts/ToastContext'
import MotionModal from '@/components/ui/MotionModal'

// The client's Showcase invite email (owner, 11/01: "the invite email is pretty important"): a line
// saying whether it reached them, and Send invite / Send invite again behind a short "here's what's
// about to happen" step. Used on the Showcases cards and on the lead's page.

const when = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }), hour: 'numeric', minute: '2-digit' })
}

/** One line: "Invite emailed Oct 31, 2:14 PM" / "Invite never sent" / why it can't go. */
export function InviteLine({ invite, className = '' }: { invite?: ShowcaseInviteStatus | null; className?: string }) {
  if (!invite) return null
  const sent = invite.state === 'sent'
  const text = sent ? `Invite emailed ${when(invite.at)}`
    : invite.state === 'sending' ? 'Invite sending now'
    : invite.state === 'held' ? `Invite not sent - ${(invite.why || 'held back').replace(/^Held back/, 'held back')}`
    : invite.state === 'failed' ? "Invite didn't go through"
    : 'Invite never sent'
  return (
    <p data-testid="showcase-invite-line" data-state={invite.state}
      className={`flex items-center gap-1.5 ${sent || invite.state === 'sending' ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'} ${className}`}>
      {sent ? <Check className="h-3.5 w-3.5 shrink-0" /> : invite.state === 'sending' ? <Send className="h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
      <span className="min-w-0">{text}{!sent && invite.blocked ? ` · ${invite.blocked}` : ''}</span>
    </p>
  )
}

/** The button + its confirm step. size "icon": the card's small Email button once they've had it;
 *  "warn": the bigger amber Send invite when they never did; "full": the lead page's row button. */
export function SendInviteButton({ collectionId, invite, name, email, homes, size, compact = false, onSent }: {
  collectionId: string
  invite?: ShowcaseInviteStatus | null
  name?: string | null
  email?: string | null
  homes?: number
  size: 'icon' | 'warn' | 'full'
  /** a crowded card bar: shorter words */
  compact?: boolean
  onSent: (invite: ShowcaseInviteStatus) => void
}) {
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  if (!invite || !invite.can_send) return null
  const again = invite.state === 'sent'
  const first = (name || '').trim().split(' ')[0] || 'them'

  const send = async () => {
    setSending(true)
    const r = await api.collections.sendInvite(collectionId)
    setSending(false)
    if (!r.success || !r.data) { showToast(r.error || "The invite couldn't be sent.", 'error'); return }
    setOpen(false)
    onSent(r.data.invite)
    showToast(`Invite on its way to ${first}`, 'success')
  }

  const label = again ? 'Send invite again' : 'Send invite'
  const btn = size === 'icon'
    ? <button type="button" onClick={e => { e.stopPropagation(); setOpen(true) }} title={label} aria-label={label} data-testid="showcase-invite-btn"
        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-[11px] font-black text-gray-600 hover:border-[#C9A24D] dark:border-white/10 dark:text-gray-300">
        <Mail className="h-3.5 w-3.5" />{!compact && ' Email'}
      </button>
    : size === 'warn'
      ? <button type="button" onClick={e => { e.stopPropagation(); setOpen(true) }} data-testid="showcase-invite-btn"
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-black text-amber-800 hover:border-amber-400 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5" /> {compact ? 'Invite' : label}
        </button>
      : <button type="button" onClick={() => setOpen(true)} data-testid="showcase-invite-btn"
          className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-black ${again
            ? 'border border-gray-200 text-gray-600 hover:border-[#C9A24D] dark:border-white/10 dark:text-gray-300'
            : 'border border-amber-300 bg-amber-50 text-amber-800 hover:border-amber-400 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200'}`}>
          {again ? <Mail className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />} {label}
        </button>

  // (Inside a clickable card: nothing in here - the pop-up included - opens the card.)
  return (
    <span className="contents" onClick={e => e.stopPropagation()}>
      {btn}
      <MotionModal open={open} onBackdropClick={() => !sending && setOpen(false)} className="z-[70] bg-black/55">
        <div onClick={e => e.stopPropagation()} data-testid="showcase-invite-confirm" className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#151517]">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#e8c97a]"><Mail className="h-5 w-5" /></span>
          <h3 className="mt-3 text-lg font-black text-[#111827] dark:text-white">{again ? `Send ${first} the invite again?` : `Send ${first} their invite?`}</h3>
          <p className="mt-1.5 text-sm font-medium text-gray-500 dark:text-gray-400">
            We&apos;ll email {email ? <b className="text-gray-700 dark:text-gray-200">{email}</b> : 'them'} their Showcase link{homes ? <> with the <b className="text-gray-700 dark:text-gray-200">{homes} home{homes === 1 ? '' : 's'}</b> in it</> : ''}, from you, right now.
          </p>
          {again && invite.at && <p className="mt-2 text-xs font-semibold text-gray-400">They got it {when(invite.at)}.</p>}
          {!again && invite.state === 'held' && <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">Last time it was held back by your email settings - this one goes anyway.</p>}
          <div className="mt-5 flex gap-2">
            <button onClick={() => setOpen(false)} disabled={sending} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-bold dark:border-white/10 dark:text-white">Not now</button>
            <button onClick={send} disabled={sending} data-testid="showcase-invite-send"
              className="flex-1 rounded-xl bg-[#111827] py-2.5 text-sm font-bold text-white disabled:opacity-50 dark:bg-[#C9A24D] dark:text-[#111827]">
              {sending ? 'Sending...' : label}
            </button>
          </div>
        </div>
      </MotionModal>
    </span>
  )
}
