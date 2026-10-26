'use client'

// ONE save status for every autosaving page (owner 10/26: "people can't tell whether their changes
// are saving"). Used by Setup, Settings and Branding - no Save buttons, but the status is always in
// view: a sticky bar at the top of the page (phones and computers), or the Setup flow's own header.
//
//   const save = useSaveStatus({ flush })          // owner of the page; flush = send any typing now
//   <SaveStatusContext.Provider value={save}>      // so deep components can report their saves
//   <SaveStatusBar store={save} label="Branding" /> // or <SaveStatusPill store={save} />
//
//   save.track(() => api.x.update(...), { key })   // a save happening now
//   save.schedule(key, job, 700)                   // a save after typing stops ("Unsaved changes…")
//   useSaveTracker()?.track(...)                   // from any component under the Provider
//
// States: "Saving…" (spinner) -> "All changes saved" (stays - it never fades) | "Couldn't save"
// (red) with a working Try again | "Unsaved changes…" while a typed change waits to be sent.
// A save only counts as saved when the request really succeeded: a job that returns an API
// response with success: false (or throws) is a failure. Same `key` = the same thing being saved,
// so a newer save of it replaces an older failed one (Try again never re-sends a stale value).
// Leaving the page while something is unsaved or still saving asks first (beforeunload), and a
// link to another app page with a failed save asks too.
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { motion } from 'framer-motion'
import { Check, CircleAlert, CloudCheck, Loader2, RotateCw } from 'lucide-react'

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'
type Job = () => Promise<unknown>
type TrackOpts = { key?: string; retry?: Job }
const MIN_SAVING_MS = 450

/** A result counts as failed when it is an API response with success: false, or `false`. */
function failed(r: unknown): boolean {
  if (r === false) return true
  return !!r && typeof r === 'object' && 'success' in (r as Record<string, unknown>) && (r as { success: unknown }).success === false
}

export class SaveStore {
  private inflight = 0
  private dirty = new Set<string>()
  private failures = new Map<string, Job>()
  private gen = new Map<string, number>()
  private timers = new Map<string, { t: number; job: Job; opts: TrackOpts }>()
  private everSaved = false
  private seq = 0
  private listeners = new Set<() => void>()
  private state: SaveState = 'idle'
  /** The page's own "send what's waiting now" (Setup's typed info). */
  flushHook: (() => unknown) | null = null

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  getState = (): SaveState => this.state
  private emit() {
    const next: SaveState = this.inflight > 0 ? 'saving'
      : this.failures.size ? 'error'
      : this.dirty.size || this.timers.size ? 'dirty'
      : this.everSaved ? 'saved' : 'idle'
    if (next === this.state) return
    this.state = next
    this.listeners.forEach(fn => fn())
  }

  hasError = () => this.failures.size > 0
  /** Anything typed but not sent yet, or still on its way. */
  isBusy = () => this.inflight > 0 || this.dirty.size > 0 || this.timers.size > 0

  /** Run a save now and report it. Returns whatever the job returns. */
  track = <T,>(job: () => Promise<T>, opts: TrackOpts = {}): Promise<T> => {
    const key = opts.key ?? `save-${++this.seq}`
    const g = (this.gen.get(key) || 0) + 1
    this.gen.set(key, g)
    this.dirty.delete(key)
    const pendingTimer = this.timers.get(key)
    if (pendingTimer) { window.clearTimeout(pendingTimer.t); this.timers.delete(key) }
    this.inflight++
    this.emit()
    const started = Date.now()
    const p = Promise.resolve().then(job)
    const settle = (ok: boolean) => {
      // "Saving…" stays up long enough to be seen (a local save can take 20ms - a flash nobody reads)
      const wait = MIN_SAVING_MS - (Date.now() - started)
      if (wait > 0) { window.setTimeout(() => settle(ok), wait); return }
      this.inflight--
      // only the newest save of a key decides whether that key is saved
      if (this.gen.get(key) === g) {
        if (ok) { this.failures.delete(key); this.everSaved = true }
        else this.failures.set(key, opts.retry || (job as Job))
      }
      this.emit()
    }
    p.then(r => settle(!failed(r)), () => settle(false))
    return p
  }

  /** Save after a pause (typing): shows "Unsaved changes…" until it is sent. Same key = restart. */
  schedule = (key: string, job: Job, delay: number, opts: Omit<TrackOpts, 'key'> = {}) => {
    const prev = this.timers.get(key)
    if (prev) window.clearTimeout(prev.t)
    const t = window.setTimeout(() => {
      this.timers.delete(key)
      void this.track(job, { ...opts, key })
    }, delay)
    this.timers.set(key, { t, job, opts })
    this.emit()
  }

  /** Something changed that isn't ready to send yet (a half-typed color, the page's own timer). */
  markDirty = (key = 'typing') => { this.dirty.add(key); this.emit() }
  clearDirty = (key = 'typing') => { if (this.dirty.delete(key)) this.emit() }

  /** Send everything waiting right now (leaving the page, Continue). */
  flush = (): Promise<unknown> => {
    const started: Promise<unknown>[] = []
    this.timers.forEach(({ t, job, opts }, key) => {
      window.clearTimeout(t)
      this.timers.delete(key)
      started.push(this.track(job, { ...opts, key }).catch(() => undefined))
    })
    if (this.flushHook) started.push(Promise.resolve(this.flushHook()).catch(() => undefined))
    this.emit()
    return Promise.all(started)
  }

  /** Try every failed save again (the newest version of each). */
  retry = () => {
    const jobs = Array.from(this.failures.entries())
    jobs.forEach(([key, job]) => { void this.track(job, { key, retry: job }).catch(() => undefined) })
  }
}

/** Owns the save status for one page. */
export function useSaveStatus({ flush }: { flush?: () => unknown } = {}): SaveStore {
  const [store] = useState(() => new SaveStore())
  store.flushHook = flush || null
  useEffect(() => {
    // Closing / reloading the tab mid-save: send what's waiting and ask first.
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!store.isBusy() && !store.hasError()) return
      void store.flush()
      e.preventDefault()
      e.returnValue = ''
    }
    // A link to another app page: the save keeps going (same tab, nothing unloads), so just send
    // anything waiting - but a save that FAILED would be lost, so ask.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return
      let url: URL
      try { url = new URL(a.href, window.location.href) } catch { return }
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return
      if (store.hasError()) {
        if (!window.confirm('Some of your changes didn’t save. Leave this page anyway?')) { e.preventDefault(); e.stopPropagation() }
        return
      }
      if (store.isBusy()) void store.flush()
    }
    window.addEventListener('beforeunload', onUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onUnload)
      document.removeEventListener('click', onClick, true)
      // leaving the page in the app: typed changes still go out
      void store.flush()
    }
  }, [store])
  return store
}

export function useSaveState(store: SaveStore | null): SaveState {
  return useSyncExternalStore(
    store ? store.subscribe : noopSubscribe,
    store ? store.getState : idleState,
    idleState,
  )
}
const noopSubscribe = () => () => {}
const idleState = (): SaveState => 'idle'

export const SaveStatusContext = createContext<SaveStore | null>(null)
/** The page's save status, for a component that saves on its own (null outside such a page). */
export const useSaveTracker = () => useContext(SaveStatusContext)

const LABEL: Record<SaveState, { long: string; short: string }> = {
  idle: { long: 'Changes save automatically', short: 'Autosave on' },
  dirty: { long: 'Unsaved changes…', short: 'Unsaved…' },
  saving: { long: 'Saving…', short: 'Saving…' },
  saved: { long: 'All changes saved', short: 'All saved' },
  error: { long: 'Couldn’t save', short: 'Couldn’t save' },
}

const TONE: Record<SaveState, string> = {
  idle: 'bg-white text-gray-500 ring-gray-200 dark:bg-white/[0.05] dark:text-gray-400 dark:ring-white/10',
  dirty: 'bg-amber-50 text-amber-800 ring-amber-300 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/40',
  saving: 'bg-[#fff8e8] text-[#8b6a2b] ring-[#C9A24D]/50 dark:bg-[#C9A24D]/10 dark:text-[#e8c97a] dark:ring-[#C9A24D]/40',
  saved: 'bg-emerald-50 text-emerald-700 ring-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/40',
  error: 'bg-red-50 text-red-700 ring-red-400 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/50',
}

/** The pill itself. `compact` = the short words (tight phone headers). */
export function SaveStatusPill({ store, compact = false, className = '' }: { store: SaveStore | null; compact?: boolean; className?: string }) {
  const state = useSaveState(store)
  const text = compact ? LABEL[state].short : LABEL[state].long
  return (
    <div role="status" aria-live="polite" data-testid="save-status" data-state={state}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full pl-2.5 text-[12.5px] font-black ring-1 transition-colors duration-200 ${state === 'error' ? 'pr-1' : 'pr-3'} ${TONE[state]} ${className}`}>
      {/* Swaps at once (no exit fade, so the words never lag behind the real state); the new
          state just eases in. */}
      <motion.span key={state} className="inline-flex items-center gap-1.5"
          initial={{ opacity: 0.2, y: 3, scale: state === 'saved' ? 0.9 : 1 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.18 }}>
          {state === 'saving' && <Loader2 className="h-4 w-4 animate-spin" />}
          {state === 'saved' && <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-emerald-600 text-white dark:bg-emerald-500"><Check className="h-3 w-3" strokeWidth={3.5} /></span>}
          {state === 'idle' && <CloudCheck className="h-4 w-4" />}
          {state === 'dirty' && <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-70" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" /></span>}
          {state === 'error' && <CircleAlert className="h-4 w-4" />}
          <span>{text}</span>
          {state === 'error' && (
            <button type="button" onClick={() => store?.retry()} data-testid="save-retry"
              className="ml-0.5 inline-flex h-6 items-center gap-1 rounded-full bg-red-600 px-2.5 text-[12px] font-black text-white shadow-sm transition hover:bg-red-700 active:scale-95">
              <RotateCw className="h-3 w-3" strokeWidth={3} /> Try again
            </button>
          )}
      </motion.span>
    </div>
  )
}

/** A slim bar pinned to the top of the page while it scrolls: the page's name and the status. */
export function SaveStatusBar({ store, label, shortLabel, hint = 'Your changes save on their own - no Save button needed.', className = '' }: {
  store: SaveStore | null; label: string; /** phones (the pill needs the room) */ shortLabel?: string; hint?: string; className?: string
}) {
  return (
    <div data-testid="save-status-bar"
      className={`sticky top-0 z-30 -mx-4 mb-3 flex h-12 items-center gap-3 border-b border-[#C9A24D]/20 bg-[#faf9f7] px-4 shadow-[0_10px_24px_-22px_rgba(17,24,39,.6)] dark:border-white/[0.07] dark:bg-[#0B0B0B] ${className}`}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-black uppercase tracking-[0.22em] text-[#8b7355] dark:text-[#e8c97a]">
          {shortLabel ? <><span className="sm:hidden">{shortLabel}</span><span className="max-sm:hidden">{label}</span></> : label}
        </p>
        <p className="hidden truncate text-[11.5px] font-semibold text-gray-500 dark:text-gray-400 sm:block">{hint}</p>
      </div>
      <SaveStatusPill store={store} />
    </div>
  )
}
