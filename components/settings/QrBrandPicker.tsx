'use client'

// What sits in the middle of every QR code this agent prints or shares (user, 10/17): the
// OpenHousePal house logo for everyone, or - IDX plan - their own Brand Kit logo or initials.
// Old printed codes keep scanning (the link inside never changes); everything drawn from now on
// uses the new look. Used in Settings -> Profile and the setup flow's brand step.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Check, Lock, QrCode } from 'lucide-react'
import api from '@/lib/api-service'
import { styledQrSvg, type QrCenter } from '@/lib/qrStyle'
import { setQrOwner } from '@/lib/qr'
import { useAuth } from '@/contexts/AuthContext'

type Choice = 'ohp' | 'logo' | 'initials'
type Info = { kind: Choice; choice: Choice; allowed: boolean; initials?: string; logo?: string; has_logo: boolean }

const SAMPLE = 'https://openhousepal.com/open-house/sample-qr-preview'

function Preview({ center }: { center: QrCenter }) {
  const parts = useMemo(() => styledQrSvg(SAMPLE, { center }), [center])
  if (!parts) return null
  return <svg viewBox={`-1 -1 ${parts.size + 2} ${parts.size + 2}`} className="h-full w-full rounded-lg bg-white" dangerouslySetInnerHTML={{ __html: parts.body }} />
}

export default function QrBrandPicker({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth()
  const [info, setInfo] = useState<Info | null>(null)
  const [busy, setBusy] = useState<Choice | ''>('')
  const [err, setErr] = useState('')
  useEffect(() => { api.qrBrand.get().then(r => { if (r.success && r.data) setInfo(r.data as Info) }) }, [])

  const pick = async (c: Choice) => {
    if (!info || busy || c === info.choice) return
    setBusy(c); setErr('')
    const r = await api.qrBrand.set(c)
    setBusy('')
    if (r.success && r.data) {
      setInfo(r.data as Info)
      if (user?.id) setQrOwner(user.id, { refresh: true })   // every QR on screen redraws with it
    } else setErr(r.error || "That didn't save - please try again.")
  }

  if (!info) return <div className="h-28 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/[0.04]" />
  const initials = info.initials || '?'
  const options: { id: Choice; title: string; sub: string; center: QrCenter; needsLogo?: boolean }[] = [
    { id: 'ohp', title: 'OpenHousePal', sub: 'Our house logo', center: { kind: 'ohp' } },
    { id: 'logo', title: 'Your logo', sub: info.has_logo ? 'From your Brand Kit' : 'Add one in Brand Kit', center: info.logo ? { kind: 'logo', logo: info.logo } : { kind: 'ohp' }, needsLogo: !info.has_logo },
    { id: 'initials', title: 'Your initials', sub: initials, center: { kind: 'initials', initials } },
  ]
  return (
    <div>
      {!compact && (
        <div className="mb-3 flex items-start gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#111827] text-[#e8c97a] dark:bg-white/10"><QrCode className="h-4 w-4" /></span>
          <div>
            <p className="text-sm font-black text-[#111827] dark:text-white">The middle of your QR codes</p>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">On every kit, design, form and sign-in screen. Codes you already printed keep working.</p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2.5">
        {options.map((o, i) => {
          const locked = o.id !== 'ohp' && !info.allowed
          const disabled = locked || (o.id === 'logo' && o.needsLogo)
          const active = (info.allowed ? info.choice : 'ohp') === o.id
          return (
            <motion.button key={o.id} type="button" onClick={() => !disabled && pick(o.id)} disabled={!!busy}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className={`relative flex flex-col items-center gap-2 rounded-2xl border p-2.5 text-center transition ${active ? 'border-[#C9A24D] bg-[#fffaf0] shadow-[0_0_0_3px_rgba(201,162,77,.18)] dark:bg-[#C9A24D]/10' : 'border-gray-200 bg-white hover:border-[#C9A24D]/60 dark:border-white/10 dark:bg-white/[0.03]'} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}>
              {active && <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#C9A24D] text-[#111827]"><Check className="h-3 w-3" strokeWidth={3} /></span>}
              {locked && <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-gray-500 dark:bg-white/10"><Lock className="h-3 w-3" /></span>}
              <div className="aspect-square w-full max-w-[96px] p-1"><Preview center={o.center} /></div>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-black text-[#111827] dark:text-white">{busy === o.id ? 'Saving...' : o.title}</p>
                <p className="truncate text-[10.5px] font-semibold text-gray-500 dark:text-gray-400">{locked ? 'IDX plan' : o.sub}</p>
              </div>
            </motion.button>
          )
        })}
      </div>
      {!info.allowed && <p className="mt-2 text-[11.5px] font-semibold text-gray-500 dark:text-gray-400">Your own logo or initials in your QR codes comes with the IDX plan.</p>}
      {info.allowed && !info.has_logo && <p className="mt-2 text-[11.5px] font-semibold text-gray-500 dark:text-gray-400">Want your logo? <Link href="/studio/brand-kit" className="font-black text-[#8b7355] underline dark:text-[#e8c97a]">Add it in your Brand Kit</Link>, then pick it here.</p>}
      {err && <p className="mt-2 text-xs font-bold text-rose-600">{err}</p>}
    </div>
  )
}
