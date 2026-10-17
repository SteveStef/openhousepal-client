'use client'

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, BarChart3, Check, ClipboardList, Eye, FileText, Home, Layers, Loader2, Moon, MonitorPlay, Percent, Sparkles, Sun, Ticket, Trophy, X } from 'lucide-react'
import type { PrintPref } from '@/lib/printPrefs'

// The last part of "Generate Kit", in two steps (user, 10/16):
//   1. Your kit - every document with its settings on the same line as its name, and a live
//      preview of the real page on the right that changes the moment a setting does (Brand on the
//      flyer, Light / Dark on the guest's sign-in screen, Match % on Similar Homes, Sold Stats on
//      the Brag Sheet).
//   2. After a guest signs in - Guest Pass / Guest Showcases (defaults already set by the existing
//      rules, e.g. Showcases start off on your own listing), with a phone showing what guests get.
// Then Save & Finish.

export type KitDocMode = 'flyer' | 'recommendations' | 'bragSheet' | 'cheatSheet'

type GuestPrefs = { autoShowcase: boolean; guestPass: boolean; afterSignin: 'hub' | 'none' }

const DOC_TITLE: Record<KitDocMode, string> = { flyer: 'Sign-In Flyer', recommendations: 'Similar Homes', bragSheet: 'Brag Sheet', cheatSheet: 'Cheat Sheet' }

function Chip({ on, label, icon: Icon, hint, onClick }: { on: boolean; label: string; icon?: React.ComponentType<{ className?: string }>; hint: string; onClick: () => void }) {
  return (
    <button type="button" title={hint} onClick={e => { e.stopPropagation(); onClick() }}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition-all duration-300 active:scale-95 ${on
        ? 'border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-300'
        : 'border-gray-200 bg-white text-gray-400 hover:text-gray-600 dark:border-gray-700 dark:bg-[#0B0B0B] dark:hover:text-gray-300'}`}>
      {on
        ? <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="h-2.5 w-2.5" strokeWidth={4} /></span>
        : <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-gray-300 dark:border-gray-600"><X className="h-2.5 w-2.5" strokeWidth={3.5} /></span>}
      {Icon && <Icon className="h-3 w-3" />}{label}
    </button>
  )
}

function ThemeChoice({ dark, onChange }: { dark: boolean; onChange: (dark: boolean) => void }) {
  const base = 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition-colors'
  return (
    <div onClick={e => e.stopPropagation()} className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 p-0.5 dark:border-gray-700 dark:bg-[#0B0B0B]" title="Theme of the sign-in screen guests see when they scan the QR code or use the kiosk. Doesn't change the printed flyer.">
      <button type="button" onClick={() => onChange(false)} className={`${base} ${!dark ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200' : 'text-gray-400 hover:text-gray-600'}`}><Sun className={`h-3 w-3 ${!dark ? 'text-amber-500' : ''}`} strokeWidth={3} />Light</button>
      <button type="button" onClick={() => onChange(true)} className={`${base} ${dark ? 'bg-[#111111] text-white shadow-sm ring-1 ring-white/10' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}><Moon className="h-3 w-3" strokeWidth={3} />Dark</button>
    </div>
  )
}

// One document in "Your kit": icon, name and its settings on one line, preview link at the end.
function DocRow({ mode, icon: Icon, active, onSelect, onPreview, children, index }: {
  mode: KitDocMode; icon: React.ComponentType<{ className?: string }>; active: boolean; onSelect: () => void; onPreview: () => void; children?: React.ReactNode; index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + index * 0.06, duration: 0.45, ease: [0.22, 0.61, 0.36, 1] }}
      role="button" tabIndex={0} onClick={onSelect} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
      className={`group relative cursor-pointer rounded-2xl border p-3 transition-all duration-300 ${active
        ? 'border-[#C9A24D] bg-white shadow-[0_18px_40px_-28px_rgba(139,115,85,.9)] ring-4 ring-[#C9A24D]/10 dark:bg-[#1a1a1c]'
        : 'border-gray-100 bg-[#faf9f7] hover:border-[#C9A24D]/50 dark:border-gray-800 dark:bg-[#141416]'}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-300 ${active ? 'bg-gradient-to-br from-[#e8c97a] to-[#b8913f] text-[#111827]' : 'bg-[#C9A24D]/15 text-[#8b7355] dark:bg-[#C9A24D]/15 dark:text-[#e8c97a]'}`}><Icon className="h-4 w-4" /></span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-black text-[#111827] dark:text-white"><Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={3.5} />{DOC_TITLE[mode]}</span>
        </span>
        <span className="flex flex-1 flex-wrap items-center gap-1.5">{children}</span>
        <button type="button" onClick={e => { e.stopPropagation(); onPreview() }} title="Open the full PDF preview"
          className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black text-[#8b7355] transition hover:bg-[#C9A24D]/10 dark:text-[#e8c97a]">
          <Eye className="h-3.5 w-3.5" /> PDF
        </button>
      </div>
    </motion.div>
  )
}

// The guest's on-screen sign-in page (scan the QR / kiosk), light or dark.
function SignInPhone({ dark, photo, street }: { dark: boolean; photo?: string; street: string }) {
  return (
    <div className="w-[150px] rounded-[26px] border-[5px] border-[#111827] bg-[#111827] shadow-[0_24px_50px_-20px_rgba(0,0,0,.55)]">
      <div className={`overflow-hidden rounded-[20px] transition-colors duration-500 ${dark ? 'bg-[#0B0B0B]' : 'bg-[#FAFAF7]'}`}>
        <div className="relative h-[86px] bg-cover bg-center" style={{ backgroundImage: photo ? `url(${photo})` : undefined }}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <span className="absolute left-2 top-2 h-3.5 w-14 rounded-full bg-white/85" />
        </div>
        <div className="space-y-1.5 p-2.5">
          <p className={`truncate font-serif text-[11px] font-black transition-colors duration-500 ${dark ? 'text-white' : 'text-[#111827]'}`}>{street || 'Your listing'}</p>
          {['Name', 'Email', 'Phone'].map(f => (
            <div key={f} className={`flex h-5 items-center rounded-md px-1.5 text-[7.5px] font-bold transition-colors duration-500 ${dark ? 'bg-white/10 text-white/45' : 'border border-gray-200 bg-white text-gray-400'}`}>{f}</div>
          ))}
          <div className="flex h-5 items-center justify-center rounded-md bg-[#C9A24D] text-[8px] font-black text-[#111827]">Sign In</div>
        </div>
      </div>
    </div>
  )
}

// What a guest's phone opens right after signing in.
function GuestPassPhone({ prefs, photo, street, similar }: { prefs: GuestPrefs; photo?: string; street: string; similar: boolean }) {
  const row = 'flex h-6 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 text-[8.5px] font-black text-[#111827]'
  return (
    <div className="w-[190px] rounded-[30px] border-[6px] border-[#111827] bg-[#111827] shadow-[0_30px_60px_-24px_rgba(0,0,0,.55)]">
      <div className="h-[330px] overflow-hidden rounded-[24px] bg-[#FAFAF7]">
        <AnimatePresence mode="wait" initial={false}>
          {prefs.guestPass ? (
            <motion.div key="pass" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.35 }}>
              <div className="relative h-[110px] bg-cover bg-center" style={{ backgroundImage: photo ? `url(${photo})` : undefined }}>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <p className="absolute bottom-2 left-2.5 text-[7px] font-black uppercase tracking-[0.2em] text-[#e8c97a]">Your Guest Pass</p>
              </div>
              <div className="space-y-1.5 p-2.5">
                <p className="truncate font-serif text-[12px] font-black text-[#111827]">{street || 'Your listing'}</p>
                <div className={row}><FileText className="h-3 w-3 text-[#C9A24D]" />Cheat Sheet</div>
                {similar && <div className={row}><Layers className="h-3 w-3 text-[#C9A24D]" />Similar Homes</div>}
                <div className={row}><ClipboardList className="h-3 w-3 text-[#C9A24D]" />Request the disclosure</div>
                <div className={row}><Home className="h-3 w-3 text-[#C9A24D]" />Book a second tour</div>
                <AnimatePresence initial={false}>
                  {prefs.autoShowcase && (
                    <motion.div key="sc" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}
                      className="flex h-7 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#b8913f] to-[#e8c97a] px-2 text-[8.5px] font-black text-[#111827]">
                      <Sparkles className="h-3 w-3" />Your Showcase of homes
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : (
            <motion.div key="thanks" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.35 }}
              className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="h-5 w-5" strokeWidth={3} /></span>
              <p className="font-serif text-[13px] font-black text-[#111827]">Thanks for signing in!</p>
              <p className="text-[8.5px] font-semibold text-gray-500">Just the thank-you screen - nothing opens on their phone.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// pdf.js (loaded once, only when the Review step opens) draws the real PDF page as a picture - an
// embedded PDF shows blank on phones (Android Chrome won't show one inside a page) and in some
// browsers' settings, a picture shows everywhere.
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174'
let pdfjsLoading: Promise<any> | null = null
function loadPdfJs(): Promise<any> {
  const w = window as any
  if (w.pdfjsLib) return Promise.resolve(w.pdfjsLib)
  if (!pdfjsLoading) {
    pdfjsLoading = new Promise((resolve, reject) => {
      const tag = document.createElement('script')
      tag.src = `${PDFJS}/pdf.min.js`
      tag.async = true
      tag.onload = () => { w.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS}/pdf.worker.min.js`; resolve(w.pdfjsLib) }
      tag.onerror = () => { pdfjsLoading = null; reject(new Error('pdf.js did not load')) }
      document.head.appendChild(tag)
    })
  }
  return pdfjsLoading
}
async function pdfFirstPageImage(blob: Blob, cssWidth: number): Promise<string> {
  const lib = await loadPdfJs()
  const doc = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
  try {
    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: (cssWidth * Math.min(2, window.devicePixelRatio || 1)) / base.width })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    return canvas.toDataURL('image/jpeg', 0.9)
  } finally {
    doc.destroy()
  }
}

// The live preview: the real PDF page (rendered in the browser, same documents as "Preview PDF").
function LivePage({ mode, build, prefs, onError }: {
  mode: KitDocMode
  build: (mode: KitDocMode, opts?: { brand?: boolean }) => Promise<any | null>
  prefs: Record<PrintPref, boolean>
  onError?: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [asImage, setAsImage] = useState(true)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(true)
  const cache = useRef<Record<string, any>>({})
  const lastUrl = useRef<string | null>(null)
  useEffect(() => { setUrl(null) }, [mode])
  const dep = mode === 'flyer' ? `flyer:${prefs.flyerBrand}` : mode === 'recommendations' ? `rec:${prefs.matchScore}` : mode === 'bragSheet' ? `brag:${prefs.bragStats}` : 'cheat'
  useEffect(() => {
    let alive = true
    setBusy(true)
    setFailed(false)
    const t = setTimeout(async () => {
      try {
        const key = mode === 'flyer' ? `flyer:${prefs.flyerBrand}` : mode
        if (!(key in cache.current)) cache.current[key] = await build(mode, { brand: prefs.flyerBrand })
        const data = cache.current[key]
        if (!alive) return
        if (!data) { setUrl(null); setFailed(true); setBusy(false); onError?.(); return }
        const [{ pdf }, docs] = await Promise.all([import('@react-pdf/renderer'), import('@/lib/pdfs')])
        const el = mode === 'flyer' ? <docs.OpenHouseFlyerDocument data={data} />
          : mode === 'recommendations' ? <docs.SimilarPropertiesDocument properties={data.properties} address={data.address} openHouseEventId={data.openHouseEventId} showMatchScore={prefs.matchScore} />
          : mode === 'bragSheet' ? <docs.AgentBragSheetDocument agent={data.agent} recentSales={data.recentSales} showcaseSampleProperties={data.showcaseSampleProperties} showcaseQrUrl={data.showcaseQrUrl} showSalesStats={prefs.bragStats} stats={data.stats} />
          : <docs.OpenHouseCheatSheetDocument property={data.property} agent={data.agent} amenities={data.amenities} fit={await docs.fitCheatSheetLevel(data)} />
        const blob = await pdf(el).toBlob()
        if (!alive) return
        try {
          const img = await pdfFirstPageImage(blob, 460)
          if (!alive) return
          setAsImage(true)
          setUrl(img)
        } catch {
          // pdf.js unavailable - fall back to the browser's own PDF view.
          const next = URL.createObjectURL(blob)
          if (lastUrl.current) URL.revokeObjectURL(lastUrl.current)
          lastUrl.current = next
          setAsImage(false)
          setUrl(next)
        }
      } catch {
        if (alive) { setUrl(null); setFailed(true) }
        onError?.()
      } finally {
        if (alive) setBusy(false)
      }
    }, 180)
    return () => { alive = false; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep])
  useEffect(() => () => { if (lastUrl.current) URL.revokeObjectURL(lastUrl.current) }, [])
  return (
    <div className="relative mx-auto aspect-[8.5/11] w-full max-w-[460px] overflow-hidden rounded-xl bg-white shadow-[0_30px_60px_-30px_rgba(17,24,39,.55)] ring-1 ring-black/5">
      <AnimatePresence initial={false}>
        {url && (asImage ? (
          <motion.img key={url} src={url} alt={`${DOC_TITLE[mode]} preview`}
            initial={{ opacity: 0, scale: 1.01 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
            className="absolute inset-0 h-full w-full object-contain" />
        ) : (
          <motion.iframe key={url} src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`} title={`${DOC_TITLE[mode]} preview`}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}
            className="absolute inset-0 h-full w-full border-0" />
        ))}
      </AnimatePresence>
      {failed && !busy && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
          <FileText className="h-8 w-8 text-gray-300" />
          <p className="text-sm font-black text-gray-600">This page can&apos;t be previewed here</p>
          <p className="text-xs font-semibold text-gray-400">Tap PDF on its row to open the full preview.</p>
        </div>
      )}
      {busy && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px] dark:bg-[#0B0B0B]/40">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-[#8b7355] shadow">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating preview
          </span>
        </div>
      )}
    </div>
  )
}

export default function KitReviewDialog({
  address, street, selectedImage, hasRecommendations, hasBragSheet, hasCheatSheet, similarAvailable, ownListing,
  kitPrefs, onKitPrefChange, guestPrefs, onGuestPrefChange, showcasesAvailable, guestPassAvailable, afterSigninAvailable,
  onSimilarChange, onPreview, buildDocData, onSave, onCancel, embedded = false, onStepChange,
}: {
  address: string
  street: string
  selectedImage?: { url: string } | null
  hasRecommendations: boolean
  hasBragSheet: boolean
  hasCheatSheet: boolean
  similarAvailable: boolean
  ownListing: boolean
  kitPrefs: Record<PrintPref, boolean>
  onKitPrefChange: (pref: PrintPref, on: boolean) => void
  guestPrefs: GuestPrefs
  onGuestPrefChange: (key: keyof GuestPrefs, value: unknown) => void
  showcasesAvailable: boolean
  guestPassAvailable: boolean
  afterSigninAvailable: boolean
  onSimilarChange: (on: boolean) => void
  onPreview: (mode: KitDocMode) => void
  buildDocData: (mode: KitDocMode, opts?: { brand?: boolean }) => Promise<any | null>
  onSave: () => Promise<void>
  onCancel: () => void
  /** Inside the kit flow's window (KitFlowShell draws the frame and header). */
  embedded?: boolean
  onStepChange?: (step: 1 | 2) => void
}) {
  const [step, setStep] = useState<1 | 2>(1)
  useEffect(() => { onStepChange?.(step) }, [step, onStepChange])
  const [focus, setFocus] = useState<KitDocMode>('flyer')
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<string>('')
  const hasGuestStep = (guestPassAvailable || showcasesAvailable || afterSigninAvailable) && !!guestPrefs
  const photo = selectedImage?.url

  // A setting changed: show that document and say what changed on it.
  const change = (mode: KitDocMode, pref: PrintPref, on: boolean, text: string) => {
    onKitPrefChange(pref, on)
    setFocus(mode)
    setNote(text)
  }
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(''), 4200); return () => clearTimeout(t) }, [note])

  const save = async () => {
    setSaving(true)
    try { await onSave() } finally { setSaving(false) }
  }

  const docs: KitDocMode[] = ['flyer', ...(hasRecommendations ? ['recommendations' as const] : []), ...(hasBragSheet ? ['bragSheet' as const] : []), ...(hasCheatSheet ? ['cheatSheet' as const] : [])]
  const caption: Record<KitDocMode, string> = {
    flyer: kitPrefs.flyerBrand ? 'Brand on: your photo, name and brokerage across the top of the photo.' : 'Brand off: a clean photo, no agent pill.',
    recommendations: kitPrefs.matchScore ? 'Match % on: every home shows its match badge, best match first.' : 'Match % off: the match badges come off every home.',
    bragSheet: kitPrefs.bragStats ? 'Sold Stats on: your homes sold, volume and average price up top.' : 'Sold Stats off: just your recent sales, no numbers row.',
    cheatSheet: kitPrefs.recap ? 'Recap on: the long MLS description becomes a short "Highlights of" paragraph when the kit is made.' : 'Recap off: the full MLS description prints as-is.',
  }

  const body = (
    <>
        <AnimatePresence mode="wait" initial={false}>
          {step === 1 ? (
            <motion.div key="kit" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
              className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,540px)]">
              <div className="min-w-0">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#8b7355] dark:text-[#e8c97a]">Your kit includes</p>
                    <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">Tap a document to see it on the right. Your choices are remembered for next time.</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#C9A24D]/15 px-2.5 py-1 text-[10px] font-black text-[#8b6a2b] dark:text-[#e8c97a]">{docs.length} {docs.length === 1 ? 'page' : 'pages'}</span>
                </div>
                <div className="space-y-2.5">
                  <DocRow index={0} mode="flyer" icon={ClipboardList} active={focus === 'flyer'} onSelect={() => setFocus('flyer')} onPreview={() => onPreview('flyer')}>
                    <Chip on={kitPrefs.flyerBrand} label="Brand" hint="Your photo, name and brokerage across the top of the printed flyer's photo." onClick={() => change('flyer', 'flyerBrand', !kitPrefs.flyerBrand, !kitPrefs.flyerBrand ? 'Brand on - your pill is back on the flyer.' : 'Brand off - the pill comes off the flyer.')} />
                    <ThemeChoice dark={kitPrefs.qrDark} onChange={d => change('flyer', 'qrDark', d, d ? "Guests' sign-in screen is now dark." : "Guests' sign-in screen is now light.")} />
                  </DocRow>
                  {similarAvailable && !hasRecommendations && (
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.45 }}
                      className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-[#141416]">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-400 dark:bg-white/5"><Layers className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1 text-sm font-black text-gray-400">Similar Homes <span className="text-xs font-bold">· off{ownListing ? ' (your listing)' : ''}</span></span>
                      <Chip on={false} label="Include" hint="Adds the Similar Homes sheet and shows those homes on each guest's Guest Pass. You'll pick the homes next." onClick={() => onSimilarChange(true)} />
                    </motion.div>
                  )}
                  {hasRecommendations && (
                    <DocRow index={1} mode="recommendations" icon={Layers} active={focus === 'recommendations'} onSelect={() => setFocus('recommendations')} onPreview={() => onPreview('recommendations')}>
                      <Chip on={kitPrefs.matchScore} icon={Percent} label="Match" hint="The % Match badge on each home, best match first." onClick={() => change('recommendations', 'matchScore', !kitPrefs.matchScore, !kitPrefs.matchScore ? 'Match % on - badges added to each home.' : 'Match % off - badges removed from each home.')} />
                      {similarAvailable && <Chip on label="Include" hint="Included. Tap to leave Similar Homes out - guests stay focused on this home." onClick={() => onSimilarChange(false)} />}
                    </DocRow>
                  )}
                  {hasBragSheet && (
                    <DocRow index={2} mode="bragSheet" icon={Trophy} active={focus === 'bragSheet'} onSelect={() => setFocus('bragSheet')} onPreview={() => onPreview('bragSheet')}>
                      <Chip on={kitPrefs.bragStats} icon={BarChart3} label="Sold Stats" hint="Your homes sold, total volume and average price across the top." onClick={() => change('bragSheet', 'bragStats', !kitPrefs.bragStats, !kitPrefs.bragStats ? 'Sold Stats on.' : 'Sold Stats off.')} />
                    </DocRow>
                  )}
                  {hasCheatSheet && (
                    <DocRow index={3} mode="cheatSheet" icon={FileText} active={focus === 'cheatSheet'} onSelect={() => setFocus('cheatSheet')} onPreview={() => onPreview('cheatSheet')}>
                      <Chip on={kitPrefs.recap} icon={Sparkles} label="Recap" hint="Replaces the long MLS description with a short AI 'Highlights of' paragraph (3 lines max)." onClick={() => change('cheatSheet', 'recap', !kitPrefs.recap, !kitPrefs.recap ? 'Recap on - written when the kit is made.' : 'Recap off - the full description prints.')} />
                    </DocRow>
                  )}
                </div>
              </div>

              {/* live preview */}
              <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
                <div className="rounded-3xl border border-gray-200/80 bg-gradient-to-b from-[#f1efe9] to-[#e9e5dc] p-4 shadow-inner dark:border-white/10 dark:from-[#0f0f11] dark:to-[#0B0B0B]">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                      <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
                      Live preview · {DOC_TITLE[focus]}
                    </p>
                  </div>
                  {/* the flyer, with the guest's on-screen sign-in page beside it (Light / Dark) */}
                  <div className={focus === 'flyer' ? 'flex items-end gap-3' : ''}>
                    <div className="min-w-0 flex-1"><LivePage mode={focus} build={buildDocData} prefs={kitPrefs} /></div>
                    {focus === 'flyer' && (
                      <motion.div key={String(kitPrefs.qrDark)} initial={{ scale: 0.92, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        className="hidden shrink-0 sm:block" title="What guests see on screen when they scan the QR code or use the kiosk">
                        <SignInPhone dark={kitPrefs.qrDark} photo={photo} street={street} />
                        <p className="mt-1.5 text-center text-[9px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Guest screen<br />{kitPrefs.qrDark ? 'Dark' : 'Light'}</p>
                      </motion.div>
                    )}
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.p key={note || caption[focus]} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}
                      className={`mt-4 rounded-xl px-3 py-2 text-xs font-bold ${note ? 'bg-[#C9A24D]/15 text-[#6b5320] dark:text-[#e8c97a]' : 'text-gray-500 dark:text-gray-400'}`}>
                      {note || caption[focus]}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="guests" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
              className="grid items-start gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#8b7355] dark:text-[#e8c97a]">After a guest signs in</p>
                <p className="mb-4 mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">Already set for this home - you can change these any time on this open house&apos;s card.</p>
                {ownListing && showcasesAvailable && (
                  <p className="mb-3 rounded-xl border border-[#C9A24D]/25 bg-[#fbf6ea] px-3 py-2 text-xs font-bold text-[#8b7355] dark:border-[#C9A24D]/20 dark:bg-[#C9A24D]/[0.06] dark:text-[#e8c97a]">You&apos;re the listing agent here, so Guest Showcases start off - guests stay focused on your listing instead of shopping other homes.</p>
                )}
                <div className="space-y-2.5">
                  {guestPassAvailable && (
                    <GuestRow index={0} icon={Ticket} title="Guest Pass" on={guestPrefs.guestPass} onToggle={() => onGuestPrefChange('guestPass', !guestPrefs.guestPass)}
                      body={`Their phone opens this home, your ${hasRecommendations ? 'Similar Homes + ' : ''}Cheat Sheet as web pages, and one-tap disclosure / second tour requests. Never on a Kiosk tablet.`} />
                  )}
                  {showcasesAvailable && (
                    <GuestRow index={1} icon={Sparkles} title="Guest Showcases" on={guestPrefs.autoShowcase} onToggle={() => onGuestPrefChange('autoShowcase', !guestPrefs.autoShowcase)}
                      body="Everyone who signs in without an agent gets their own Showcase of similar homes (and a Showcase button on their Guest Pass). Off: no Showcases from this open house." />
                  )}
                  {afterSigninAvailable && (
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}
                      className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-[#1a1a1c]">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#111827] text-[#e8c97a] dark:bg-white/10"><MonitorPlay className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-gray-800 dark:text-gray-100">After sign-in, open</p>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Your Agent Hub (once it&apos;s set up), or just the thank-you screen. Never on a Kiosk tablet.</p>
                      </div>
                      <div className="inline-flex shrink-0 rounded-full border border-gray-200 bg-white p-0.5 dark:border-gray-700 dark:bg-[#0B0B0B]">
                        {(['hub', 'none'] as const).map(v => (
                          <button key={v} type="button" onClick={() => onGuestPrefChange('afterSignin', v)}
                            className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide transition ${guestPrefs.afterSignin === v ? 'bg-[#C9A24D] text-[#111827]' : 'text-gray-400 hover:text-gray-600'}`}>
                            {v === 'hub' ? 'Agent Hub' : 'Nothing'}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
              {guestPassAvailable && (
                <div className="flex flex-col items-center rounded-3xl border border-gray-200/80 bg-gradient-to-b from-[#f1efe9] to-[#e9e5dc] p-5 shadow-inner dark:border-white/10 dark:from-[#0f0f11] dark:to-[#0B0B0B]">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">What guests get</p>
                  <GuestPassPhone prefs={guestPrefs} photo={photo} street={street} similar={hasRecommendations} />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* footer */}
        <div className="flex flex-col gap-3 border-t border-gray-200/60 px-5 py-4 sm:flex-row sm:px-8 dark:border-gray-800">
          <button type="button" onClick={() => (step === 2 ? setStep(1) : onCancel())} disabled={saving}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3.5 font-bold text-[#111827] transition-all duration-200 hover:bg-gray-50 active:scale-95 disabled:opacity-50 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white dark:hover:bg-[#151515]">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          {step === 1 && hasGuestStep ? (
            <button type="button" onClick={() => setStep(2)}
              className="lx-shine group relative inline-flex flex-[2] items-center justify-center gap-2 overflow-hidden rounded-xl bg-[#111827] px-6 py-3.5 font-bold text-white shadow-[0_10px_20px_-5px_rgba(17,24,39,0.2)] transition-all duration-300 hover:bg-[#C9A24D] hover:text-[#111827] active:scale-95 dark:bg-white dark:text-[#111827]">
              Looks good - next <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          ) : (
            <button type="button" onClick={save} disabled={saving}
              className="inline-flex flex-[2] items-center justify-center gap-2 rounded-xl bg-[#111827] px-6 py-3.5 font-bold text-white shadow-[0_10px_20px_-5px_rgba(17,24,39,0.2)] transition-all duration-300 hover:bg-[#C9A24D] hover:text-[#111827] active:scale-95 disabled:cursor-wait disabled:opacity-80 dark:bg-white dark:text-[#111827]">
              {saving ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> Generating Kit...</> : <>Save &amp; Finish <Check className="h-4 w-4" strokeWidth={3} /></>}
            </button>
          )}
        </div>
    </>
  )
  if (embedded) return body
  if (typeof document === 'undefined') return null
  return createPortal(
    <motion.div className="fixed inset-0 z-[120] flex justify-center overflow-y-auto bg-black/60 p-3 sm:p-5 print:hidden"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className="relative my-auto w-full max-w-[1180px] overflow-hidden rounded-[2rem] border border-white/50 bg-[#FAFAF7] shadow-2xl dark:border-gray-800 dark:bg-[#151517]">
        {/* header + steps */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200/60 bg-white/60 px-5 py-4 sm:px-8 dark:border-gray-800 dark:bg-[#0B0B0B]/50">
          <div className="flex min-w-0 items-center gap-3">
            {photo && <span className="h-12 w-12 shrink-0 rounded-xl bg-cover bg-center shadow-inner ring-1 ring-black/5" style={{ backgroundImage: `url(${photo})` }} />}
            <div className="min-w-0">
              <h3 className="text-xl font-black tracking-tight text-[#0B0B0B] sm:text-2xl dark:text-white">{step === 1 ? 'Review your kit' : 'After a guest signs in'}</h3>
              <p className="truncate text-sm font-medium text-[#6B7280] dark:text-gray-400">{address}</p>
            </div>
          </div>
          {hasGuestStep && (
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide">
              {[1, 2].map(n => (
                <React.Fragment key={n}>
                  {n === 2 && <span className={`h-px w-6 transition-colors duration-500 ${step === 2 ? 'bg-[#C9A24D]' : 'bg-gray-300 dark:bg-gray-700'}`} />}
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors duration-500 ${step === n ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : step > n ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'text-gray-400'}`}>
                    {step > n ? <Check className="h-3 w-3" strokeWidth={3.5} /> : <span>{n}</span>}{n === 1 ? 'Your kit' : 'Guests'}
                  </span>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {body}
      </motion.div>
    </motion.div>,
    document.body,
  )
}

function GuestRow({ icon: Icon, title, body, on, onToggle, index }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string; on: boolean; onToggle: () => void; index: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 + index * 0.06, duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
      className={`flex items-start gap-3 rounded-2xl border p-4 transition-colors duration-300 ${on ? 'border-[#C9A24D]/40 bg-white dark:bg-[#1a1a1c]' : 'border-gray-100 bg-[#faf9f7] dark:border-gray-800 dark:bg-[#141416]'}`}>
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-300 ${on ? 'bg-gradient-to-br from-[#e8c97a] to-[#b8913f] text-[#111827]' : 'bg-gray-200 text-gray-400 dark:bg-white/10'}`}><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-gray-800 dark:text-gray-100">{title} <span className={`ml-1 text-[10px] font-black uppercase tracking-wide transition-colors duration-300 ${on ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>{on ? 'On' : 'Off'}</span></p>
        <p className="text-xs font-medium leading-relaxed text-gray-500 dark:text-gray-400">{body}</p>
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label={title} onClick={onToggle}
        className={`relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-300 ${on ? 'bg-[#C9A24D] shadow-[0_0_0_4px_rgba(201,162,77,.15)]' : 'bg-gray-300 dark:bg-gray-600'}`}>
        <motion.span className="h-5 w-5 rounded-full bg-white shadow-md" initial={false} animate={{ x: on ? 20 : 0 }} transition={{ type: 'spring', stiffness: 520, damping: 32 }} />
      </button>
    </motion.div>
  )
}
