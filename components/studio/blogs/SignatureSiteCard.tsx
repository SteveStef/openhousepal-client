'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import FormWindow from '@/components/forms/FormWindow'
import { API_BASE_URL } from '@/lib/api-service'
import { buildSignatureSiteInput } from '@/lib/signatureSiteData'
import SignatureWebCard from './SignatureWebCard'

// The agent's Email Signature, Site Version, closing a page (blog article, Spotlight) in place of
// the small contact card - full motion, real links. Plans with Email Signature only: the backend
// returns 404 for everyone else (or an agent with no saved signature) and `fallback` shows.
//   - Always laid out at its full width (740) and scaled to fit the column - never squeezed or
//     re-flowed, so on a phone it's the same card, just smaller.
//   - Listings rotate (towns the page is about first), with a Recent Sales slide for agents with
//     only one or two listings - see buildSignatureSiteInput's `rotate`.
//   - `match` = the page's own colors (a bronze Luxe article -> a bronze card; a non-Luxe card takes
//     the page's accent), so the card reads as part of the page.
//   - Social / website / Agent Hub links open in a new tab; the agent's form buttons open right
//     here in a window over the page, so readers never leave - and the window closes itself when
//     the form is finished.
// 10/24 (user: "the website version always looks strange - buttons tiny, doesn't match the page"):
// no longer the email card shrunk into an iframe - it's SignatureWebCard, a layout made for the web
// (real-size buttons, stacked on a phone, two columns on a computer) from the very same data. The
// EMAIL signature itself is untouched.

// Too dark to use as a card accent (an Editorial article's near-black) - the card keeps its own.
const tooDark = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return true
  const n = parseInt(m[1], 16)
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255 < 0.25
}

export default function SignatureSiteCard({ hubSlug, fallback = null, towns, match }: {
  hubSlug: string; fallback?: React.ReactNode; towns?: string[]
  match?: { metal?: string | null; accent?: string | null }
}) {
  const [data, setData] = useState<any>(null)
  const [missing, setMissing] = useState(false)
  const [form, setForm] = useState<{ url: string; label: string } | null>(null)

  useEffect(() => {
    let alive = true
    fetch(`${API_BASE_URL}/agent-hub/public/${encodeURIComponent(hubSlug)}/signature-card`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive) { setData(d); setMissing(!d) } })
      .catch(() => { if (alive) setMissing(true) })
    return () => { alive = false }
  }, [hubSlug])

  const townsKey = (towns || []).join('|')
  const input = useMemo(() => {
    if (!data) return null
    let config = data.config
    if (config?.luxe && match?.metal) config = { ...config, luxeMetal: match.metal }
    else if (!config?.luxe && match?.accent && !tooDark(match.accent)) config = { ...config, accentColor: match.accent }
    return buildSignatureSiteInput({
      config, hubConfig: data.hub_config || {}, agentHubSlug: data.slug, ownerId: data.owner_id,
      forms: data.forms || [], fallbackPhoto: data.fallback_photo || '', rotate: { towns: towns || [] },
    })
  }, [data, townsKey, match?.metal, match?.accent]) // eslint-disable-line react-hooks/exhaustive-deps
  const formPaths = useMemo(() => (data?.forms || []).map((f: any) => `/${data.slug}/${f.slug}`), [data])

  if (missing) return <>{fallback}</>
  if (!input) return null
  const name = String(data?.hub_config?.profile?.name || '').trim()
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="pt-4">
      <div className="mb-4 flex items-center justify-center gap-3 text-[#8b7355] dark:text-white/60">
        <span className="h-px w-8 bg-gradient-to-r from-transparent to-current opacity-60 sm:w-12" />
        <p className="text-center">
          <span className="block font-serif text-[15px] italic leading-tight">Let&rsquo;s connect</span>
          {name && <span className="mt-0.5 block text-[10px] font-black uppercase tracking-[0.3em] opacity-80">Meet {name}</span>}
        </p>
        <span className="h-px w-8 bg-gradient-to-l from-transparent to-current opacity-60 sm:w-12" />
      </div>
      <div className="mx-auto w-full min-w-0 max-w-[860px]">
        <SignatureWebCard input={input} formPaths={formPaths} onForm={(url, label) => setForm({ url, label })} />
      </div>

      <FormWindow url={form ? `${form.url}${form.url.includes('?') ? '&' : '?'}src=signature` : null} title={form?.label.replace(/[→]/g, '').trim() || 'Contact'} onClose={() => setForm(null)} />
    </motion.div>
  )
}
