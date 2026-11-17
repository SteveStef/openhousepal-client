'use client'

// The client's CMA link. The report itself is components/cma/report/CmaReportView - the same component the
// agent edits on in the Review step - so this page only loads the report and adds the visitor's own controls
// (light / dark, open or save the PDF).
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Download, ExternalLink, Home, Loader2, Moon, Sun } from 'lucide-react'
import api from '@/lib/api-service'
import { usePdfFile } from '@/lib/pdfFile'
import { CmaPublicResponse } from '@/types'
import { CmaPresentationDocument } from '@/lib/pdfs'
import CmaReportView from '@/components/cma/report/CmaReportView'

export default function PublicCmaPage() {
  const { slug } = useParams<{ slug: string }>()
  const [data, setData] = useState<CmaPublicResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    let dead = false
    // What came back last time, as text: a re-check that brings the same report changes nothing on the page
    // (it used to hand the whole report a new object every 30 seconds, redrawing the map under the reader).
    let lastBody = ''
    const fetchReport = (showLoading = false) => {
      if (showLoading) setLoading(true)
      api.public.getCmaReport(slug).then(res => {
        if (cancelled) return
        if (res.success && res.data) {
          hasLoadedRef.current = true
          const body = JSON.stringify(res.data)
          if (body !== lastBody) { lastBody = body; setData(res.data) }
          setError(null)
        } else if (!hasLoadedRef.current) {
          setError(res.error || "This CMA link isn't active.")
          // A link that doesn't exist (or was taken down) stays that way - stop re-checking it.
          if (res.status === 404 || res.status === 410) dead = true
        }
        setLoading(false)
      })
    }
    const refreshIfVisible = () => {
      if (!dead && document.visibilityState === 'visible') fetchReport(false)
    }
    fetchReport(true)
    window.addEventListener('focus', refreshIfVisible)
    document.addEventListener('visibilitychange', refreshIfVisible)
    const interval = window.setInterval(refreshIfVisible, 30000)
    return () => {
      cancelled = true
      window.removeEventListener('focus', refreshIfVisible)
      document.removeEventListener('visibilitychange', refreshIfVisible)
      window.clearInterval(interval)
    }
  }, [slug])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf9f7] dark:bg-[#0B0B0B]">
        <Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#faf9f7] px-6 text-center dark:bg-[#0B0B0B]">
        <Home className="h-10 w-10 text-gray-300" />
        <p className="text-lg font-black text-[#111827] dark:text-white">This link isn't active</p>
        <p className="max-w-sm text-sm font-semibold text-gray-400">{error && !/isn.t active/i.test(error) ? error : 'Ask your agent for an updated link.'}</p>
      </div>
    )
  }

  return <ClientReport data={data} />
}

function ClientReport({ data }: { data: CmaPublicResponse }) {
  const { subject, agent, presentation } = data
  const [embedded, setEmbedded] = useState(false)
  const [dark, setDark] = useState(true)
  const [pdfBusy, setPdfBusy] = useState<'' | 'open' | 'download'>('')
  // iPhones get the PDF built ahead of time so a tap can hand it over (lib/pdfFile)
  const pdfFile = usePdfFile(
    () => <CmaPresentationDocument report={data as any} agent={agent} />,
    `CMA-${(subject.street_address || 'Report').replace(/[^a-z0-9]+/gi, '-')}.pdf`,
    `${String((data as any).id ?? subject.street_address ?? '')}:${data.updated_at ?? ''}`, true,
  )

  // applyDark is the one place that ever touches the <dark> class on <html> - both the initial
  // embedded-vs-direct default below and the toggle button call this directly, so there's no ordering race
  // between "what the class should start as" and "what a passive effect eventually syncs it to" on first paint.
  const applyDark = (value: boolean) => {
    document.documentElement.classList.toggle('dark', value)
    setDark(value)
  }

  // Ignores the app-wide next-themes class on <html> and decides the real default from scratch: the agent's
  // own choice (Review step) on OpenHousePal's own share link - dark unless they picked light - but always
  // light with no toggle inside the IDX site's iframe, since a client viewing the CMA embedded in their
  // agent's own site should never see a dark page there.
  useLayoutEffect(() => {
    const root = document.documentElement
    const hadDark = root.classList.contains('dark')
    const isEmbedded = window.self !== window.top
    setEmbedded(isEmbedded)
    applyDark(!isEmbedded && presentation?.default_theme !== 'light')
    return () => { root.classList.toggle('dark', hadDark) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B] print:bg-white">
      {/* Floating actions - hidden when printing */}
      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2 print:hidden">
        {!embedded && (
          <button
            type="button"
            onClick={() => applyDark(!dark)}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#111827] text-white shadow-2xl transition hover:bg-black dark:bg-white dark:text-[#111827]"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        )}
        {/* Save as a file, or open in a new tab - this page never gets replaced (user, 10/21) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!!pdfBusy}
            onClick={async () => {
              setPdfBusy('open')
              try { await pdfFile.run('tab') } catch { /* nothing to show - the button resets */ } finally { setPdfBusy('') }
            }}
            title="Open the PDF in a new tab"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#111827] shadow-2xl ring-1 ring-black/10 transition hover:bg-gray-50 disabled:opacity-60 dark:bg-[#1c1f25] dark:text-white dark:ring-white/10"
          >
            {pdfBusy === 'open' || pdfFile.iosHint === 'preparing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            <span className="sr-only">Open PDF</span>
          </button>
          <button
            type="button"
            disabled={!!pdfBusy}
            onClick={async () => {
              setPdfBusy('download')
              try { await pdfFile.run('share') } catch { /* nothing to show - the button resets */ } finally { setPdfBusy('') }
            }}
            className="inline-flex items-center gap-2 rounded-full bg-[#111827] px-5 py-3 text-xs font-black uppercase tracking-wide text-white shadow-2xl transition hover:bg-black disabled:opacity-60 dark:bg-white dark:text-[#111827]"
          >
            {pdfBusy === 'download' || pdfFile.iosHint === 'preparing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {pdfFile.iosHint === 'preparing' ? 'Preparing…' : pdfFile.iosHint === 'tap' ? 'Tap again to save' : 'Save PDF'}
          </button>
        </div>
      </div>

      <CmaReportView data={data} />
    </div>
  )
}
