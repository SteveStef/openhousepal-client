'use client'

// Studio won't make or download a design until the agent's profile has what advertising rules
// require on it (lib/studio/designCompliance.profileGaps). Everything missing can be filled in
// right here - it saves to the same profile Settings and the setup flow use.
import { useState } from 'react'
import Link from 'next/link'
import { Loader2, ShieldCheck } from 'lucide-react'
import api from '@/lib/api-service'
import type { ProfileGap } from '@/lib/studio/designCompliance'

const formatPhone = (v: string) => {
  const d = v.replace(/\D/g, '').replace(/^1(?=\d{10})/, '')
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : v
}

const HINT: Record<ProfileGap['key'], string> = {
  name: 'As clients should see it.',
  brokerage: 'Every ad has to name your brokerage.',
  photo: 'A clear JPG headshot - it goes on your designs (you can hide it per design).',
  phone: 'The number clients call or text you on.',
  officePhone: 'Printed under your number on mailers, flyers and door hangers - most states require the brokerage\'s phone on print ads.',
}

export default function ProfileGate({ gaps, onSaved, compact = false }: { gaps: ProfileGap[]; onSaved: () => Promise<void> | void; compact?: boolean }) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)

  const digitsOk = (v?: string) => (v || '').replace(/\D/g, '').length >= 10
  const ready = gaps.every(g => g.key === 'photo' ? !!photo : g.key === 'phone' || g.key === 'officePhone' ? digitsOk(values[g.key]) : !!values[g.key]?.trim())

  const save = async () => {
    setSaving(true)
    setError('')
    const profile: Record<string, string> = {}
    if (values.name?.trim()) profile.name = values.name.trim()
    if (values.brokerage?.trim()) profile.brokerage = values.brokerage.trim()
    // The brokerage's main number (compliance) - its own field, never the Save Contact office line.
    if (values.officePhone) profile.brokeragePhone = formatPhone(values.officePhone)
    const patch: Parameters<typeof api.setup.patchInfo>[0] = {}
    if (Object.keys(profile).length) patch.profile = profile
    if (values.phone) patch.contact = { call: formatPhone(values.phone) }
    if (Object.keys(patch).length) {
      const r = await api.setup.patchInfo(patch)
      if (!r.success) { setSaving(false); setError(r.error || 'Could not save. Please try again.'); return }
    }
    if (photo) {
      if (photo.type !== 'image/jpeg') { setSaving(false); setError('Please choose a JPG photo.'); return }
      const r = await api.setup.uploadPhoto(photo)
      if (!r.success) { setSaving(false); setError(r.error || 'Could not upload the photo. Please try a JPG under 5MB.'); return }
    }
    await onSaved()
    setSaving(false)
  }

  const input = 'mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-[#111827] outline-none focus:border-[#C9A24D] dark:border-white/10 dark:bg-[#0B0B0B] dark:text-white'
  return (
    <div className={`rounded-3xl border border-[#C9A24D]/40 bg-[#fffaf0] ${compact ? 'p-4' : 'p-5 sm:p-6'} dark:border-[#C9A24D]/30 dark:bg-[#C9A24D]/[0.06]`} data-testid="profile-gate">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#C9A24D]/15 text-[#8b6a2b]"><ShieldCheck className="h-5 w-5" /></span>
        <div className="min-w-0">
          <p className="text-base font-black text-[#111827] dark:text-white">A few details first</p>
          <p className="mt-0.5 text-sm font-semibold text-gray-600 dark:text-gray-300">Real estate ads have to show who they&apos;re from. Add these once and every design fills them in.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {gaps.map(g => (
          <label key={g.key} className={`block ${g.key === 'officePhone' || g.key === 'photo' ? 'sm:col-span-2' : ''}`}>
            <span className="text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">{g.label}</span>
            {g.key === 'photo' ? (
              <input type="file" accept="image/jpeg" onChange={e => setPhoto(e.target.files?.[0] || null)}
                className="mt-1.5 block w-full cursor-pointer text-sm font-semibold file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#111827] file:px-3 file:py-2 file:text-sm file:font-black file:text-white dark:text-gray-300 dark:file:bg-white dark:file:text-[#111827]" />
            ) : (
              <input value={values[g.key] || ''} onChange={e => setValues(v => ({ ...v, [g.key]: e.target.value }))}
                onBlur={() => (g.key === 'phone' || g.key === 'officePhone') && setValues(v => ({ ...v, [g.key]: formatPhone(v[g.key] || '') }))}
                type={g.key === 'phone' || g.key === 'officePhone' ? 'tel' : 'text'} inputMode={g.key === 'phone' || g.key === 'officePhone' ? 'tel' : undefined}
                placeholder={g.key === 'officePhone' ? '(610) 555-0100' : g.key === 'phone' ? '(610) 555-0134' : g.key === 'brokerage' ? 'Main Line Realty' : 'Jane Smith'}
                className={input} />
            )}
            <span className="mt-1 block text-[11px] font-semibold text-gray-500 dark:text-gray-400">{HINT[g.key]}</span>
          </label>
        ))}
      </div>
      {error && <p className="mt-3 text-sm font-bold text-red-600">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={!ready || saving}
          className="inline-flex items-center gap-2 rounded-xl bg-[#111827] px-5 py-2.5 text-sm font-black text-white transition hover:bg-black disabled:opacity-50 dark:bg-white dark:text-[#111827]">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save and continue
        </button>
        <Link href="/settings" target="_blank" className="text-xs font-bold text-gray-500 underline decoration-gray-300 underline-offset-2 hover:text-[#C9A24D]">Or edit everything in Settings</Link>
      </div>
    </div>
  )
}
