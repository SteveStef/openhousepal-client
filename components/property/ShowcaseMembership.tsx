'use client'

// Under a home's photos, agent side only (user, 10/18): which of the agent's Showcases already have
// this home (tap one to open it), and "Add to a Showcase" - a picker with the Showcases that don't
// have it on top and the ones that do greyed out below. An added home is the agent's pick
// (Recommended) in that Showcase, so it stays there when the Showcase refreshes from its search.
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Layers, Loader2, Plus, Search, Star, X } from 'lucide-react'
import api, { API_BASE_URL } from '@/lib/api-service'
import { getToken } from '@/lib/token'
import { pp } from './PropertyKit'

type Row = { id: string; name: string; client: string | null; status: string; homes: number; contains: boolean; recommended: boolean }
const label = (r: Row) => (r.client ? `${r.client.split(' ')[0]}'s Showcase` : r.name.replace(/^Showcase for /, '') || 'Showcase')
const initials = (r: Row) => (r.client || r.name).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || 'S'

export default function ShowcaseMembership({ propertyId, listingKey, street, zIndex = 60 }: {
  propertyId?: string | null
  listingKey?: string | null
  street: string
  /** Above the window the home is shown in. */
  zIndex?: number
}) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => { setHost(document.body) }, [])

  useEffect(() => {
    if (!propertyId && !listingKey) return
    let cancelled = false
    setRows(null)
    api.collections.membership({ propertyId, listingKey }).then(r => { if (!cancelled) setRows(r.success && r.data ? r.data.showcases : []) })
    return () => { cancelled = true }
  }, [propertyId, listingKey])

  const inIt = useMemo(() => (rows || []).filter(r => r.contains), [rows])
  const notIn = useMemo(() => (rows || []).filter(r => !r.contains), [rows])
  const match = (r: Row) => !q.trim() || `${r.client || ''} ${r.name}`.toLowerCase().includes(q.trim().toLowerCase())

  const add = async (r: Row) => {
    if (busy) return
    setBusy(r.id); setError('')
    const res = await api.collections.addHome(r.id, { propertyId, listingKey })
    setBusy(null)
    if (!res.success) { setError(res.error || 'That didn’t go through - please try again.'); return }
    setRows(rs => (rs || []).map(x => (x.id === r.id ? { ...x, contains: true, recommended: true, homes: x.homes + (res.data?.added ? 1 : 0) } : x)))
  }

  if (!rows) return <div className={`mt-4 h-[58px] animate-pulse rounded-2xl ${pp.card}`} />
  if (!rows.length) return null

  return (
    <>
      {/* Phones (user, 10/18 - three Showcases looked terrible in one cut-off row): the names wrap as
          small name tags - first names with their initials - four at most, then "+N more" (opens the
          list); the button gets its own full-width row. */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className={`mt-4 rounded-2xl p-3.5 ${pp.card}`}>
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--pp-gold-wash)] text-[color:var(--pp-gold)]"><Layers className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <p className={`pt-0.5 text-[11px] font-black uppercase tracking-[0.16em] ${pp.faint}`}>
              {inIt.length ? `In ${inIt.length} of your Showcases` : 'Not in any of your Showcases yet'}
            </p>
            {inIt.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {inIt.map((r, i) => (
                  <a key={r.id} href={`/showcases?showcase=${encodeURIComponent(r.id)}`}
                    className={`${i >= 4 ? 'hidden sm:inline-flex' : 'inline-flex'} max-w-full items-center gap-1.5 rounded-full border border-[color:var(--pp-gold-line)] bg-[var(--pp-bg)] py-1 pl-1 pr-2.5 text-[12px] font-black transition hover:border-[color:var(--pp-gold)] ${pp.heading}`}>
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--pp-ink)] text-[8.5px] font-black text-[color:var(--pp-gold)]">{initials(r)}</span>
                    <span className="truncate"><span className="sm:hidden">{(r.client || label(r)).split(' ')[0]}</span><span className="hidden sm:inline">{label(r)}</span></span>
                    {r.recommended && <Star className="h-3 w-3 shrink-0 fill-[var(--pp-gold)] text-[color:var(--pp-gold)]" />}
                  </a>
                ))}
                {inIt.length > 4 && (
                  <button type="button" onClick={() => { setOpen(true); setQ(''); setError('') }}
                    className={`inline-flex items-center rounded-full bg-[var(--pp-gold-wash)] px-2.5 py-1 text-[12px] font-black sm:hidden ${pp.heading}`}>+{inIt.length - 4} more</button>
                )}
              </div>
            )}
          </div>
          <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={() => { setOpen(true); setQ(''); setError('') }}
            className={`${pp.goldBtn} hidden h-10 shrink-0 !px-4 !py-0 text-[11px] sm:inline-flex`}>
            <Plus className="h-4 w-4" /> Add to a Showcase
          </motion.button>
        </div>
        <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={() => { setOpen(true); setQ(''); setError('') }}
          className={`${pp.goldBtn} mt-3 h-11 w-full !py-0 text-[11px] sm:hidden`}>
          <Plus className="h-4 w-4" /> Add to a Showcase
        </motion.button>
      </motion.div>

      {host && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div className="fixed inset-0 flex items-end justify-center bg-black/60 sm:items-center sm:p-6" style={{ zIndex }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
              <motion.div role="dialog" aria-modal="true" aria-label="Add to a Showcase" onClick={e => e.stopPropagation()}
                initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                className="flex max-h-[82vh] w-full max-w-md flex-col overflow-hidden rounded-t-[26px] bg-white shadow-2xl sm:rounded-[26px] dark:bg-[#141416]">
                <div className="flex items-start justify-between gap-3 border-b border-black/5 px-5 pb-3 pt-5 dark:border-white/10">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a8843a] dark:text-[#e8c97a]">Add to a Showcase</p>
                    <p className="mt-0.5 truncate font-serif text-lg font-black text-[#111827] dark:text-white">{street}</p>
                    <p className="text-[11.5px] font-semibold text-gray-500 dark:text-gray-400">It shows as your pick and stays even when their search changes.</p>
                  </div>
                  <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-full bg-black/5 p-1.5 text-gray-500 transition hover:bg-black/10 dark:bg-white/10 dark:text-white/70"><X className="h-4 w-4" /></button>
                </div>
                {rows.length > 6 && (
                  <label className="mx-5 mt-3 flex items-center gap-2 rounded-xl bg-gray-100 px-3 dark:bg-white/5">
                    <Search className="h-4 w-4 text-gray-400" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find a client…" className="h-10 min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#111827] outline-none dark:text-white" />
                  </label>
                )}
                <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-2">
                  {notIn.filter(match).length > 0 && <p className="px-2 pb-1 pt-2 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Add it to</p>}
                  <AnimatePresence initial={false}>
                    {notIn.filter(match).map(r => (
                      <motion.button key={r.id} layout type="button" onClick={() => add(r)} disabled={!!busy}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}
                        className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition hover:bg-[#C9A24D]/[0.08] disabled:opacity-60">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#111827] text-[12px] font-black text-[#e8c97a] dark:bg-white/10">{initials(r)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-black text-[#111827] dark:text-white">{label(r)}</span>
                          <span className="block text-[11.5px] font-semibold text-gray-500 dark:text-gray-400">{r.homes} home{r.homes === 1 ? '' : 's'}{r.status !== 'ACTIVE' ? ' · paused' : ''}</span>
                        </span>
                        {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin text-[#C9A24D]" /> : <span className="grid h-8 w-8 place-items-center rounded-full bg-[#C9A24D] text-[#111827]"><Plus className="h-4 w-4" /></span>}
                      </motion.button>
                    ))}
                  </AnimatePresence>
                  {inIt.filter(match).length > 0 && <p className="px-2 pb-1 pt-4 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Already has this home</p>}
                  {inIt.filter(match).map(r => (
                    <motion.div key={r.id} layout className="flex items-center gap-3 rounded-2xl p-2.5 opacity-45 grayscale" aria-disabled>
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gray-200 text-[12px] font-black text-gray-500 dark:bg-white/10 dark:text-white/50">{initials(r)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-black text-[#111827] dark:text-white">{label(r)}</span>
                        <span className="block text-[11.5px] font-semibold text-gray-500 dark:text-gray-400">{r.homes} home{r.homes === 1 ? '' : 's'}</span>
                      </span>
                      <Check className="h-4 w-4 text-gray-500" strokeWidth={3} />
                    </motion.div>
                  ))}
                  {error && <p className="mx-2 mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        host,
      )}
    </>
  )
}

/** The same "Showcases" strip on the public property pages (Listing Page, IDX property page) when
 *  the person looking is a signed-in agent (user, 10/24) - which of their Showcases have this home,
 *  and add it to one. Guests (no session) see the regular page: nothing renders. */
export function SignedInShowcases(props: Parameters<typeof ShowcaseMembership>[0]) {
  const [signedIn, setSignedIn] = useState(false)
  useEffect(() => {
    // A raw check first: a stale session cookie on a guest's phone must never bounce them to sign-in.
    const t = getToken()
    if (!t) return
    const q = new URLSearchParams()
    if (props.propertyId) q.set('property_id', props.propertyId)
    if (props.listingKey) q.set('listing_key', props.listingKey)
    let alive = true
    fetch(`${API_BASE_URL}/collections/membership?${q}`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => { if (alive && r.ok) setSignedIn(true) }).catch(() => {})
    return () => { alive = false }
  }, [props.propertyId, props.listingKey])
  if (!signedIn) return null
  return <ShowcaseMembership {...props} />
}
