'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Globe, Loader2, PowerOff } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/lib/api-service'
import type { LinkDomainState } from '@/types'

// Shown right after someone buys / upgrades to IDX (idx_domain_migration_agreed_at is null - the
// backend clears it whenever a plan moves ONTO IDX, see site_service.reset_idx_site_question_on_upgrade).
// First it ASKS whether they want to use their IDX website at all - an agent who already has a
// site of their own says no and it's switched off (Settings -> IDX Website, editable any time).
// Saying yes explains that their links move to their IDX address. Mounted globally in
// app/layout.tsx next to AssistantWidget so it's impossible to dodge by navigating around it.
export default function IdxDomainMigrationModal() {
  const { user, isAuthenticated, isLoading, refreshUser } = useAuth()
  const [state, setState] = useState<LinkDomainState | null>(null)
  const [step, setStep] = useState<'ask' | 'yes' | 'no'>('ask')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const shouldShow = isAuthenticated && !isLoading && user?.plan_tier === 'IDX' && !user?.idx_domain_migration_agreed_at

  useEffect(() => {
    if (!shouldShow) return
    api.sites.getLinkDomain().then(({ success, data }) => { if (success && data) setState(data) })
  }, [shouldShow])

  if (!shouldShow) return null

  const choose = async (useSite: boolean) => {
    setBusy(true); setError('')
    const { success, data } = await api.sites.setSiteEnabled(useSite)
    setBusy(false)
    if (!success || !data) { setError("Couldn't save your choice - try again."); return }
    setState(data)
    setStep(useSite ? 'yes' : 'no')
  }

  const finish = async () => {
    setBusy(true)
    const { success } = await api.sites.agreeToIdxDomainMigration()
    if (success) await refreshUser()
    setBusy(false)
  }

  const defaultHost = state?.default_base_url?.replace(/^https?:\/\//, '')

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 animate-fadeIn">
      <div key={step} className="ohp-modal-pop relative w-full max-w-lg rounded-[2rem] border-2 border-[#C9A24D] bg-white p-8 shadow-2xl dark:bg-[#151517]">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#C9A24D] text-[#111827] shadow-md">
            {step === 'no' ? <PowerOff className="h-6 w-6" strokeWidth={2.5} /> : <Globe className="h-6 w-6" strokeWidth={2.5} />}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#C9A24D]">Welcome to IDX</p>
            <h3 className="text-xl font-black leading-tight text-[#0B0B0B] dark:text-white">
              {step === 'ask' ? 'Do you want to use your IDX website?' : step === 'yes' ? 'Everything moves to your IDX link' : 'Your IDX website is off'}
            </h3>
          </div>
        </div>

        {step === 'ask' && (
          <>
            <p className="mb-5 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              Your plan includes a full IDX website with live property search, built from your listings, sales and blogs{defaultHost ? <> at <span className="font-bold text-[#111827] dark:text-white">{defaultHost}</span></> : ''}. If you already have a website you&apos;re happy with, you can keep this one switched off.
            </p>
            <div className="space-y-2.5">
              <button onClick={() => choose(true)} disabled={busy} className="flex w-full items-start gap-3 rounded-2xl border-2 border-[#C9A24D] bg-[#C9A24D]/10 p-4 text-left transition hover:bg-[#C9A24D]/20 disabled:opacity-60">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#8b7355] dark:text-[#C9A24D]" />
                <span>
                  <span className="block text-sm font-black text-[#111827] dark:text-white">Yes, use my IDX website</span>
                  <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400">Customize and publish it in Studio → Website — once it's live, your QR codes and links use its address.</span>
                </span>
              </button>
              <button onClick={() => choose(false)} disabled={busy} className="flex w-full items-start gap-3 rounded-2xl border-2 border-gray-200 p-4 text-left transition hover:border-gray-300 disabled:opacity-60 dark:border-gray-700">
                <PowerOff className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
                <span>
                  <span className="block text-sm font-black text-[#111827] dark:text-white">No, I already have a website</span>
                  <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400">We&apos;ll keep it switched off. Links keep using openhousepal.com.</span>
                </span>
              </button>
            </div>
            {busy && <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-gray-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</p>}
            {error && <p className="mt-3 text-center text-xs font-bold text-red-500">{error}</p>}
            <p className="mt-4 text-center text-[11px] font-semibold text-gray-400">You can change this any time in Settings → IDX Website.</p>
          </>
        )}

        {step === 'yes' && (
          <>
            <p className="mb-4 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              From now on, every new open house sign-in, cheat sheet, form, and showcase you create will carry your IDX address instead of the shared OpenHousePal link.
            </p>
            {(state?.own_base_url || state?.default_base_url) && (
              <div className="mb-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-white/5">
                <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Your IDX link</p>
                <p className="break-all text-sm font-bold text-[#111827] dark:text-white">{state.own_base_url || state.default_base_url}</p>
              </div>
            )}
            <ul className="mb-6 space-y-2 text-xs text-gray-500 dark:text-gray-400">
              <li>• Anything already printed or shared keeps working exactly as it does today.</li>
              <li>• You start on your free default address ({defaultHost || 'yourname.openhousepal.com'}) automatically — no setup needed.</li>
              <li>• Connect a domain of your own any time in Settings → IDX Website, and everything new follows it from that point on.</li>
            </ul>
            <button onClick={finish} disabled={busy} className="w-full rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#b38e3e] py-3.5 font-bold text-[#111827] transition-all hover:shadow-lg hover:shadow-[#C9A24D]/30 disabled:opacity-60">
              {busy ? 'Saving…' : 'Got it, continue'}
            </button>
          </>
        )}

        {step === 'no' && (
          <>
            <p className="mb-4 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              Your IDX website won&apos;t be shown to anyone, and your QR codes, Agent Hub, email signature and other links keep using openhousepal.com. Everything else in your plan works as normal.
            </p>
            <p className="mb-6 text-xs font-semibold text-gray-500 dark:text-gray-400">
              Change your mind? Turn it on in <Link href="/settings#idx" onClick={finish} className="font-black text-[#8b7355] underline underline-offset-2 dark:text-[#d7b974]">Settings → IDX Website</Link> — it&apos;s ready whenever you are.
            </p>
            <button onClick={finish} disabled={busy} className="w-full rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#b38e3e] py-3.5 font-bold text-[#111827] transition-all hover:shadow-lg hover:shadow-[#C9A24D]/30 disabled:opacity-60">
              {busy ? 'Saving…' : 'Done'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
