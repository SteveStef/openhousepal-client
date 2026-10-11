'use client'

// Tap-to-text page, linked from every follow-up's calendar event ("📲 Text Sarah from your
// phone"). One tap opens the agent's own Messages app with the guest's number and the suggested
// text already written - it goes from the agent's real cell, so replies and calls come straight
// back to their phone - and the same tap checks the follow-up off (with an Undo). Just opening
// this page never checks anything off: link previews and accidental opens must not clear a
// follow-up. On a computer: the text with a Copy button, and a QR code that opens this page on
// the phone. No login - the code is the key, like the Mark-as-done page.
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { AlertTriangle, Check, CheckCircle2, Copy, Loader2, MessageSquare, Phone, RotateCcw, Smartphone, XCircle } from 'lucide-react'
import api from '@/lib/api-service'
import type { PublicFollowupText } from '@/types'
import { OhpWordmark } from '@/components/brand/OhpBrand'
import { copyText } from '@/lib/copyText'
import { isPhoneDevice, smsHref } from '@/lib/smsLink'
import { useQrDataUrl } from '@/lib/qr'

const prettyPhone = (p: string) => {
  const d = p.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p
}

export default function TapToTextPage() {
  const { code } = useParams<{ code: string }>()
  const [data, setData] = useState<PublicFollowupText | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'nophone' | 'error'>('loading')
  const [phone, setPhone] = useState<boolean | null>(null)
  const [sentNow, setSentNow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pageUrl, setPageUrl] = useState('')
  const qr = useQrDataUrl(phone === false ? pageUrl : null, { size: 360, margin: 1 })

  useEffect(() => {
    setPhone(isPhoneDevice())
    setPageUrl(window.location.href)
  }, [])

  useEffect(() => {
    if (!code) return
    api.tasks.publicText(code).then(r => {
      if (r.success && r.data) { setData(r.data); setState('ready') }
      else setState(/phone number/i.test(r.error || '') ? 'nophone' : 'error')
    })
  }, [code])

  const first = data?.first_name || 'them'

  // The real tap: Messages opens from the link itself (the browser needs the tap for that), and the
  // follow-up is checked off in the same moment.
  const onText = () => {
    if (!data || data.done) return
    setSentNow(true)
    setData({ ...data, done: true })
    api.tasks.publicDone(code).then(r => { if (r.success && r.data) setData(d => (d ? { ...d, ...r.data!, done: r.data!.done } : d)) })
  }

  const undo = async () => {
    setBusy(true)
    const r = await api.tasks.publicUndo(code)
    if (r.success && r.data) setData(d => (d ? { ...d, ...r.data!, done: r.data!.done } : d))
    setSentNow(false)
    setBusy(false)
  }

  const copy = () => {
    if (!data) return
    copyText(data.message).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-gradient-to-br from-[#0B0B0B] via-[#1a2438] to-[#4a3820] px-4 py-8 sm:items-center">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white text-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] dark:bg-[#151517]">
        {state === 'loading' && (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-gray-400">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm font-bold">Getting the text ready…</p>
          </div>
        )}

        {(state === 'error' || state === 'nophone') && (
          <div className="px-6 py-12">
            <XCircle className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-3 text-lg font-black text-[#111827] dark:text-white">{state === 'nophone' ? 'No phone number on this one' : 'This link isn’t active'}</p>
            <p className="mt-1 text-sm font-medium text-gray-500">
              {state === 'nophone' ? 'This guest didn’t leave a phone number - their follow-up is still on your list to email or call.' : 'The follow-up may have been deleted. You can manage all of them in OpenHousePal.'}
            </p>
            <a href="/leads/tasks" className="mt-5 inline-block rounded-xl bg-[#C9A24D] px-5 py-2.5 text-sm font-black text-[#111827]">Open Follow-ups</a>
          </div>
        )}

        {state === 'ready' && data && (
          <>
            <div className="bg-gray-50 px-6 pb-5 pt-7 dark:bg-white/5">
              <OhpWordmark className="text-lg text-[#111827] dark:text-white" />
              <p className="mt-2 text-2xl font-black text-[#111827] dark:text-white">Text {first}</p>
              {data.context && <p className="mt-0.5 text-sm font-medium text-gray-500 dark:text-gray-400">{data.context}</p>}
              <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">{prettyPhone(data.phone)}</p>
            </div>

            {data.fill_ins.length > 0 && (
              <div className="mx-5 mt-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-left text-xs font-bold text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Before you send: replace {data.fill_ins.join(' and ')} in Messages.</span>
              </div>
            )}

            {/* The message, as it will appear in Messages */}
            <div className="px-5 pt-4 text-left">
              <div className="ml-auto max-w-[92%] whitespace-pre-wrap rounded-[20px] rounded-br-md bg-[#0A84FF] px-3.5 py-2.5 text-[13.5px] font-medium leading-snug text-white shadow-sm">
                {data.message}
              </div>
            </div>

            <div className="px-5 pb-5 pt-4">
              {phone !== false ? (
                data.done ? (
                  <div className="rounded-2xl bg-emerald-50 px-4 py-3 dark:bg-emerald-900/20">
                    <p className="flex items-center justify-center gap-1.5 text-sm font-black text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" /> {sentNow ? 'Sent? Checked off.' : 'Already checked off.'}
                    </p>
                    <p className="mt-0.5 text-[11px] font-semibold text-emerald-700/70 dark:text-emerald-300/70">Off your follow-up list and your calendar.</p>
                    <div className="mt-2 flex items-center justify-center gap-2">
                      <button onClick={undo} disabled={busy} className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black text-gray-500 hover:bg-white hover:text-[#111827] disabled:opacity-60 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white">
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Didn&apos;t send it - undo
                      </button>
                      <a href={smsHref(data.phone, data.message)} className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black text-[#8b7355] hover:bg-white dark:text-[#d7b974] dark:hover:bg-white/10">
                        <MessageSquare className="h-3.5 w-3.5" /> Open again
                      </a>
                    </div>
                  </div>
                ) : (
                  <>
                    <a href={smsHref(data.phone, data.message)} onClick={onText}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-5 py-4 text-base font-black text-[#111827] shadow-lg shadow-[#C9A24D]/30 transition active:scale-[0.98]">
                      <MessageSquare className="h-5 w-5" /> Text {first}
                    </a>
                    <p className="mt-2 text-[11px] font-semibold text-gray-400">Opens Messages with this text written - from your own number. Tapping it checks this follow-up off.</p>
                  </>
                )
              ) : (
                // On a computer: scan to open this page on the phone, or copy the text.
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-2xl border border-gray-200 p-3 text-left dark:border-gray-800">
                    {qr ? <img src={qr} alt="Scan with your phone" className="h-24 w-24 shrink-0 rounded-lg" /> : <div className="h-24 w-24 shrink-0 animate-pulse rounded-lg bg-gray-100 dark:bg-white/5" />}
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm font-black text-[#111827] dark:text-white"><Smartphone className="h-4 w-4 text-[#C9A24D]" /> Scan with your phone</p>
                      <p className="mt-0.5 text-[11px] font-semibold leading-snug text-gray-500 dark:text-gray-400">It opens this page there - one tap and Messages opens with the text written, from your own number.</p>
                    </div>
                  </div>
                  <button onClick={copy} className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-black text-[#111827] transition hover:border-[#C9A24D] dark:border-gray-700 dark:text-white">
                    {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy the text'}
                  </button>
                  {data.done && (
                    <p className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Checked off
                      <button onClick={undo} disabled={busy} className="font-black text-gray-500 underline-offset-2 hover:underline">Undo</button>
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-4 border-t border-gray-100 px-6 py-3 dark:border-gray-800">
              <a href={`tel:${data.sms_to}`} className="inline-flex items-center gap-1 text-xs font-black text-[#8b7355] hover:underline dark:text-[#d7b974]"><Phone className="h-3.5 w-3.5" /> Call instead</a>
              <a href="/leads/tasks" className="text-xs font-black text-[#8b7355] hover:underline dark:text-[#d7b974]">All follow-ups →</a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
