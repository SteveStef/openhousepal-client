/**
 * Offline queue for open-house sign-ins.
 *
 * At an in-person open house the wifi is often flaky. If a submit fails (offline, timeout, 5xx)
 * we stash the sign-in in localStorage and keep the guest moving with a normal thank-you. A
 * background flusher retries the queue whenever the browser comes back online (and on a slow
 * interval), so nobody who signed in is ever lost.
 *
 * localStorage, not IndexedDB: a sign-in payload is a few hundred bytes and a busy open house is
 * dozens, not thousands — well within the 5MB budget — and this keeps it dependency-free and
 * synchronous to read for the "N waiting" badge.
 */
import api from '@/lib/api-service'

// Matches api.public.submitSignIn's argument exactly.
export interface SignInPayload {
  full_name: string
  email: string
  phone: string
  has_agent: string
  open_house_event_id: string
  interested_in_similar: boolean
}

export interface QueuedSignIn {
  id: string
  queued_at: number
  attempts: number
  payload: SignInPayload
}

const KEY = 'ohp-kiosk-signin-queue-v1'

function read(): QueuedSignIn[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function write(items: QueuedSignIn[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    /* storage full / blocked — nothing we can safely do here */
  }
}

export function queueCount(): number {
  return read().length
}

export function enqueueSignIn(payload: SignInPayload): void {
  const items = read()
  items.push({
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    queued_at: Date.now(),
    attempts: 0,
    payload,
  })
  write(items)
}

let flushing = false

/** Try to send everything in the queue. Safe to call often — it no-ops if already running or
 *  the queue is empty. Returns how many were sent. */
export async function flushQueue(): Promise<number> {
  if (flushing || typeof window === 'undefined') return 0
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 0
  let items = read()
  if (items.length === 0) return 0

  flushing = true
  let sent = 0
  try {
    for (const item of items) {
      try {
        const { success } = await api.public.submitSignIn(item.payload)
        if (success) {
          sent += 1
          items = items.filter(i => i.id !== item.id)
          write(items)
        } else {
          item.attempts += 1
          write(items)
        }
      } catch {
        item.attempts += 1
        write(items)
        // A hard failure almost certainly means we're offline again — stop and wait for the
        // next trigger rather than hammering.
        break
      }
    }
  } finally {
    flushing = false
  }
  return sent
}

/** Wire up automatic flushing. Call once from the kiosk page; returns a cleanup fn.
 *  `onChange` fires with the current queue length after any attempt, for a "N waiting" badge.
 *
 *  The queue lives in localStorage, so it survives the tab being backgrounded, the browser
 *  closing, and the device being powered off for hours or days — it's on disk. It only drains
 *  while an open-house page is open (that's where this runs), so a long-offline kiosk flushes as
 *  soon as it's reopened, when the tab is refocused, or when the connection returns. */
export function startQueueFlusher(onChange?: (count: number) => void): () => void {
  const tick = async () => {
    await flushQueue()
    onChange?.(queueCount())
  }
  const onOnline = () => { tick() }
  const onVisible = () => { if (document.visibilityState === 'visible') tick() }
  window.addEventListener('online', onOnline)
  window.addEventListener('focus', onOnline)
  document.addEventListener('visibilitychange', onVisible)
  const interval = window.setInterval(tick, 30_000)
  tick()
  return () => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('focus', onOnline)
    document.removeEventListener('visibilitychange', onVisible)
    window.clearInterval(interval)
  }
}
