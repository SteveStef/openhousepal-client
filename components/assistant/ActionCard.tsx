'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, Loader2, X, AlertTriangle, ArrowRight, Download } from 'lucide-react'
import api from '@/lib/api-service'
import { AIToolCallRef } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { runClientAction } from './clientActions'

type Made = AIToolCallRef['made']

// A design the helper made, right in the chat: its picture (the same render as the Studio's own
// download) plus Download buttons - no trip to the Studio needed.
function MadeDesign({ made, fresh }: { made: NonNullable<Made> & { design_id?: string; is_print?: string }; fresh?: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  useEffect(() => {
    if (!made.design_id) return
    let live = true
    let objectUrl: string | null = null
    api.designs.exportPng(made.design_id).then(r => {
      if (!live) return
      if (r.success && r.blob) { objectUrl = URL.createObjectURL(r.blob); setUrl(objectUrl) } else setFailed(true)
    })
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [made.design_id])
  const fileName = (made.title || 'design').replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'design'
  const downloadPdf = async () => {
    if (!made.design_id) return
    setPdfBusy(true)
    const r = await api.designs.exportPdf(made.design_id)
    setPdfBusy(false)
    if (r.success && r.blob) {
      const a = document.createElement('a'); a.href = URL.createObjectURL(r.blob); a.download = `${fileName}.pdf`; a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    }
  }
  return (
    <div ref={boxRef} className="mt-2.5">
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50 dark:border-zinc-800 dark:bg-zinc-800/60">
        {url ? <img src={url} alt={made.title || 'Your design'} className="ohp-ai-reveal block h-auto w-full"
                    onLoad={() => { if (fresh) boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }} />
          : failed ? <div className="flex h-40 items-center justify-center px-4 text-center text-xs text-gray-400">Preview not ready - open it in the Studio.</div>
          : <div className="ohp-skeleton flex aspect-square w-full items-end justify-center pb-4"><span className="ohp-ai-shimmer text-xs font-semibold">Drawing your design...</span></div>}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {url && (
          <a href={url} download={`${fileName}.png`} className="ohp-ai-card-in ohp-ai-press inline-flex min-w-[7rem] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#8b7355] px-3 py-2 text-sm font-bold text-white hover:bg-[#7a6549]">
            <Download className="h-4 w-4" /> Download
          </a>
        )}
        {made.is_print && (
          <button onClick={downloadPdf} disabled={pdfBusy} style={{ ['--i' as string]: 1 }} className="ohp-ai-card-in ohp-ai-press inline-flex min-w-[7rem] flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
            {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Print PDF
          </button>
        )}
      </div>
    </div>
  )
}

// Something the helper SET UP for the agent (10/30) - nothing happens until they tap Confirm.
// The server keeps the status, so a reload shows Done / Cancelled, never a second Confirm.
export default function ActionCard({ messageId, action }: { messageId: string; action: AIToolCallRef }) {
  const { user } = useAuth()
  const [state, setState] = useState<{ status: string; message: string; link: string; made?: Made }>({
    status: action.status || 'pending',
    message: action.result_message || '',
    link: action.result_link || '',
    made: action.made,
  })
  const [busy, setBusy] = useState<'confirm' | 'cancel' | null>(null)
  const [fresh, setFresh] = useState(false)  // made just now (not a reopened chat) - bring it into view

  const act = async (kind: 'confirm' | 'cancel') => {
    setBusy(kind)
    const r = kind === 'confirm'
      ? await api.ai.confirmAction(action.record_id, messageId)
      : await api.ai.cancelAction(action.record_id, messageId)
    const data = r.data as (typeof r.data & { client_action?: string; payload?: Record<string, unknown> }) | undefined
    if (r.success && data?.status === 'running' && data.client_action) {
      // Built here in the browser (a design), then recorded on the card.
      setState(st => ({ ...st, status: 'running', message: 'Making it...' }))
      const out = await runClientAction(data.client_action, data.payload || {}, user)
      const saved = await api.ai.clientActionResult(action.record_id, messageId, out)
      setFresh(true)
      setState({ status: saved.data?.status || (out.ok ? 'done' : 'failed'), message: saved.data?.result_message || out.message, link: saved.data?.result_link || out.link || '', made: (saved.data as any)?.made || (out.made as Made) })
    } else if (r.success && r.data) {
      setState({ status: r.data.status || 'failed', message: r.data.result_message || '', link: r.data.result_link || '' })
    } else {
      setState({ status: 'failed', message: r.error || 'Something went wrong - nothing was changed.', link: '' })
    }
    setBusy(null)
  }

  const pending = state.status === 'pending'
  return (
    <div className={`ohp-ai-card-in mt-2 w-full rounded-2xl border bg-white p-3.5 text-left shadow-sm transition-colors duration-300 dark:bg-zinc-900 ${
      state.status === 'done' ? 'border-emerald-200 dark:border-emerald-900/50' : 'border-[#C9A24D]/40 dark:border-[#C9A24D]/30'}`}>
      <p className="text-sm font-bold text-[#111827] dark:text-white">{action.title}</p>
      {!!action.details?.length && (
        <ul className="mt-1.5 space-y-1">
          {action.details.map((d, i) => (
            <li key={i} className="flex gap-1.5 text-xs leading-snug text-gray-600 dark:text-zinc-300">
              <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-[#C9A24D]" />
              <span className="min-w-0 [overflow-wrap:anywhere]">{d}</span>
            </li>
          ))}
        </ul>
      )}
      {action.warning && pending && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" /> {action.warning}
        </p>
      )}
      {pending ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => act('confirm')}
            disabled={!!busy}
            className="ohp-ai-press inline-flex min-w-[7rem] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#8b7355] px-3 py-2 text-sm font-bold text-white shadow-sm shadow-[#8b7355]/30 hover:bg-[#7a6549] disabled:opacity-60"
          >
            {busy === 'confirm' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {action.confirm_label || 'Confirm'}
          </button>
          <button
            onClick={() => act('cancel')}
            disabled={!!busy}
            className="ohp-ai-press inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" /> Cancel
          </button>
        </div>
      ) : (
        <div key={state.status} className={`ohp-ai-fade mt-2.5 rounded-lg px-2.5 py-2 text-xs font-semibold ${
          state.status === 'done' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300'
            : state.status === 'running' ? 'bg-gray-50 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300'
            : 'bg-gray-50 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300'
        }`}>
          {state.status === 'done' && <span className="ohp-ai-check mr-1 h-4 w-4 items-center justify-center rounded-full bg-emerald-500 align-[-3px] text-white"><Check className="h-3 w-3" strokeWidth={3} /></span>}
          {state.status === 'running'
            ? <span className="ohp-ai-shimmer">{state.message || 'Working on it...'}</span>
            : state.message || 'Done.'}
          {state.status === 'done' && state.made?.kind === 'design' && <MadeDesign made={state.made as any} fresh={fresh} />}
          {state.status === 'done' && state.link && (
            <Link href={state.link} className="group mt-1.5 flex items-center gap-1 font-bold text-[#8b7355] dark:text-[#C9A24D]">
              Open it <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
