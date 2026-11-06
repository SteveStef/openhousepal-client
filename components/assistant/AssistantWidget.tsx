'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { OhpBot } from './OhpBot'
import { useFabLift } from './useFabLift'
import { X, Volume2, VolumeX, MessageSquarePlus, Maximize2, Minimize2 } from 'lucide-react'
import api from '@/lib/api-service'
import { AIConversation } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import MonthlyAiUsageMeter from '@/components/MonthlyAiUsageMeter'
import AssistantHome from './AssistantHome'
import ChatThread from './ChatThread'
import Link from 'next/link'
import ChatInput from './ChatInput'
import type { DroppedPhoto } from './PhotoDrop'
import TalkToOHP from './TalkToOHP'
import { useSpeech } from './useSpeech'
import WorkingStrip, { type WorkingJob } from './WorkingStrip'

// Matches the LEADS_REFRESH_EVENT / OPEN_HOUSE_REFRESH_EVENT convention already used by
// dash/page.tsx and NotificationBell.tsx - a plain window CustomEvent so unrelated
// components (the Dashboard's Daily Digest panel) can open this globally-mounted widget
// without needing a shared React context.
const ASSISTANT_OPEN_EVENT = 'assistant-widget:open'

// The chat you were in comes with you - page to page (this widget never unmounts) and across a
// reload (owner, 10/30). Per-viewer convenience only, so plain browser storage.
const CONV_KEY = 'ohp-helper:conversation'
const UI_KEY = 'ohp-helper:ui'
// An on-call helper, not a long thread (owner, 11/01): 30 minutes after the last message, opening
// the helper starts a fresh chat. There is no chat history (owner, 11/01): starting a chat tidies the
// old ones away on the server (POST /ai/conversations); one with news (an AI CMA that finished) still
// opens itself.
const FRESH_AFTER_MS = 30 * 60 * 1000
function staleChat(c: AIConversation | null): boolean {
  if (!c) return false
  const last = c.messages[c.messages.length - 1]?.created_at || c.last_message_at || c.created_at
  return !!last && Date.now() - new Date(last).getTime() > FRESH_AFTER_MS
}
const store = {
  get(k: string, session = false): string | null { try { return (session ? sessionStorage : localStorage).getItem(k) } catch { return null } },
  set(k: string, v: string | null, session = false) {
    try { const s = session ? sessionStorage : localStorage; if (v === null) s.removeItem(k); else s.setItem(k, v) } catch { /* private mode */ }
  },
}

function useIsPhone() {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const on = () => setPhone(mq.matches)
    on(); mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return phone
}

// Phone keyboard open: the part of the screen still showing (above the keyboard), else null.
// The sheet is sized to the whole screen, so with the keyboard up the page behind showed between
// the chat box and the keyboard (owner, 11/01) - while typing the chat fills exactly what's left.
// Newer iPhones (iOS 26) shrink window.innerHeight along with the keyboard, so "innerHeight minus
// what's showing" missed the keyboard and the page showed again under the chat box (owner, 11/03).
// Now: a text box is in use and the screen showing is well short of its full height (the tallest
// seen with no keyboard). When the keyboard goes away the page is put back where it was - iOS left
// it scrolled, so the sheet looked like it dropped.
// While the chat is closing it keeps the size it has (`hold`): the keyboard is going down at the same
// moment, and following it made the sheet jump to its normal height mid-exit (owner, 11/05).
function useKeyboardSpace(on: boolean, hold: boolean) {
  const [space, setSpace] = useState<{ top: number; height: number } | null>(null)
  const holdRef = useRef(hold)
  holdRef.current = hold
  useEffect(() => {
    const vv = window.visualViewport
    if (!on || !vv) { setSpace(null); return }
    const typing = () => { const el = document.activeElement as HTMLElement | null; return !!el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable) }
    let full = Math.max(window.innerHeight, vv.height)
    let openAt: number | null = null
    const fit = () => {
      if (holdRef.current) return
      const t = typing()
      if (!t) full = Math.max(full, window.innerHeight, vv.height)
      const open = (t && full - vv.height > 120) || window.innerHeight - vv.height > 120
      if (open) {
        if (openAt === null) openAt = window.scrollY
        setSpace({ top: Math.round(vv.offsetTop), height: Math.round(vv.height) })
      } else {
        setSpace(null)
        if (openAt !== null) {
          const y = openAt
          openAt = null
          requestAnimationFrame(() => window.scrollTo(window.scrollX, y))
          setTimeout(() => { if (!typing()) window.scrollTo(window.scrollX, y) }, 350)
        }
      }
    }
    fit()
    vv.addEventListener('resize', fit)
    vv.addEventListener('scroll', fit)
    // focus changes don't always resize the screen right away
    const later = () => setTimeout(fit, 60)
    document.addEventListener('focusin', later)
    document.addEventListener('focusout', later)
    return () => {
      vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit)
      document.removeEventListener('focusin', later); document.removeEventListener('focusout', later)
      // Closed with the keyboard up: the page still goes back to where it was.
      if (openAt !== null) {
        const y = openAt
        requestAnimationFrame(() => window.scrollTo(window.scrollX, y))
        setTimeout(() => window.scrollTo(window.scrollX, y), 350)
      }
    }
  }, [on])
  return space
}

type ChatNews = { id: string; text: string; ok: boolean; link?: string | null; link_label?: string; conversation_id?: string | null; at: string }

export default function AssistantWidget() {
  const { user, isAuthenticated, isLoading: isCheckingAuth } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const { showToast } = useToast()
  const isPhone = useIsPhone()
  const [isOpen, setIsOpen] = useState(false)
  // Computer: the corner panel or the big window. Phone: a sheet swiped up to full height.
  const [big, setBig] = useState(false)
  const [activeConversation, setActiveConversation] = useState<AIConversation | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(false)
  const [isTalking, setIsTalking] = useState(false)
  // Every paying plan since 10/30 (unless Admin switched it off); voice stays admin-only.
  const [helper, setHelper] = useState<{ enabled: boolean; voice: boolean } | null>(null)
  // Phone: the sheet's height while a finger drags its top bar (null = not dragging).
  const [dragH, setDragH] = useState<number | null>(null)
  const dragFrom = useRef<{ y: number; h: number; dy: number } | null>(null)
  const restored = useRef(false)
  const panelRef = useRef<HTMLDivElement>(null)
  // The round button moves up off any page button / bottom bar under it (owner, 11/01).
  const fabRef = useRef<HTMLButtonElement>(null)
  const fabLift = useFabLift(fabRef, [pathname, isOpen])
  const [closing, setClosing] = useState(false)
  // Phone: after a link in the chat opened a page, the sheet sits low as a peek (owner, 10/31).
  const [peek, setPeek] = useState(false)
  useEffect(() => { if (!isOpen) { setPeek(false); setDragH(null) } }, [isOpen])
  const kb = useKeyboardSpace(isPhone && isOpen && !peek, closing)
  // The iPhone's keyboard and the bars above it are see-through, and it doesn't paint pinned layers
  // past the keyboard line - a cover or the dim layer never reached there, so the page showed through
  // (owner, 11/04). While it's up the page itself is hidden (globals.css), the chat stays.
  // (Closing: the page comes back right away, behind the chat, so it's there as the chat slides off.)
  const kbOpen = !!kb && !closing
  useEffect(() => {
    const root = document.documentElement
    if (kbOpen) root.setAttribute('data-ohp-chat-kb', '')
    return () => root.removeAttribute('data-ohp-chat-kb')
  }, [kbOpen])

  // Closing plays its exit first (a beat), then unmounts.
  const kbUp = useRef(false)
  kbUp.current = !!kb
  const close = useCallback(() => {
    // the keyboard starts down now, so it and the chat leave together
    const typingIn = document.activeElement as HTMLElement | null
    if (typingIn && panelRef.current?.contains(typingIn)) typingIn.blur()
    setClosing(true)
    window.setTimeout(() => { setIsOpen(false); setClosing(false) }, !isPhone ? 200 : kbUp.current ? 310 : 230)
  }, [isPhone])

  // Bigger / smaller: a quick settle on the new size instead of a hard jump.
  const sized = useRef(false)
  useEffect(() => {
    if (!sized.current) { sized.current = true; return }
    const el = panelRef.current
    // (Phones: the sheet's own height glide is the motion - a fade on top of it flickered.)
    if (!el || isPhone || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    el.animate([{ opacity: 0.6, transform: 'scale(0.985)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
  }, [big])
  const speech = useSpeech()

  useEffect(() => {
    if (!isAuthenticated) { setHelper(null); return }
    api.ai.getHelperStatus().then((r) => setHelper(r.success && r.data ? r.data : { enabled: false, voice: false }))
  }, [isAuthenticated, user?.id])

  // Restore the open window + the chat you were in, once per page load.
  useEffect(() => {
    if (!helper?.enabled || restored.current) return
    restored.current = true
    try {
      const ui = JSON.parse(store.get(UI_KEY, true) || '{}')
      if (ui.open) setIsOpen(true)
      if (ui.big) setBig(true)
      // a link in the chat opened this page on a phone - keep the sheet down as a peek here too
      if (ui.peek && window.matchMedia('(max-width: 639px)').matches) setPeek(true)
    } catch { /* ignore */ }
    const id = store.get(CONV_KEY)
    if (id) {
      api.ai.getConversation(id).then((r) => {
        if (r.success && r.data && !staleChat(r.data)) setActiveConversation(r.data)
        else store.set(CONV_KEY, null)
      })
    }
  }, [helper?.enabled])

  useEffect(() => { if (restored.current) store.set(UI_KEY, JSON.stringify({ open: isOpen, big, peek }), true) }, [isOpen, big, peek])
  useEffect(() => { if (restored.current) store.set(CONV_KEY, activeConversation?.id ?? null) }, [activeConversation?.id])

  const openChat = useCallback(async (id: string) => {
    if (activeConversation?.id === id) return
    const r = await api.ai.getConversation(id)
    if (r.success && r.data) setActiveConversation(r.data)
    else showToast('That chat could not be opened.', 'error')
  }, [activeConversation?.id, showToast])

  // Something the helper finished while they were away (an AI CMA, 11/01): the chat it's in shows as
  // unread - a count on the closed button, on any device - until that chat is open on screen.
  const [unread, setUnread] = useState<string[]>([])
  // what's still being made, for the strip under the top bar (any chat - 11/01)
  const [working, setWorking] = useState<WorkingJob[]>([])
  // Finished jobs not told yet (owner, 11/05: "it tells them that it finished only one time"): shown
  // at the top of the chat the first time it's open afterwards, whichever chat that is, then gone for
  // good. The job's own message stays in its chat as usual.
  const [news, setNews] = useState<ChatNews[]>([])
  const [told, setTold] = useState<ChatNews[]>([])
  // While a card in this chat is still making something (an AI CMA, a blog draft) the news is checked
  // every few seconds, not every 30 (owner, 11/01: "I wouldn't have known it finished").
  const workingHere = !!activeConversation?.messages.some(m => (m.tool_calls || []).some((t: any) => t.record_type === 'action' && (t.status === 'working' || t.status === 'running')))
  useEffect(() => {
    if (!helper?.enabled) return
    let live = true
    const tick = () => { api.ai.unread().then(r => { if (live && r.success && r.data) { setUnread(r.data.conversations); setWorking(r.data.working || []); setNews(r.data.news || []) } }) }
    tick()
    const t = window.setInterval(tick, workingHere || working.length ? 6000 : 30000)
    window.addEventListener('focus', tick)
    return () => { live = false; window.clearInterval(t); window.removeEventListener('focus', tick) }
  }, [helper?.enabled, workingHere, working.length > 0])
  // Something finished: a short notice wherever they are (the chat's newest message says what).
  const seenUnread = useRef<string[] | null>(null)
  useEffect(() => {
    const before = seenUnread.current
    seenUnread.current = unread
    if (before === null) return   // the first check on page load isn't news
    const fresh = unread.filter(id => !before.includes(id))
    if (!fresh.length) return
    api.ai.getConversation(fresh[0]).then(r => {
      const last = r.success && r.data ? [...r.data.messages].reverse().find(m => m.role === 'assistant') : null
      const line = (last?.content || '').split(/(?<=[.!?])\s/)[0].slice(0, 120)
      showToast(line || 'Your AI helper finished something - tap the robot to see it.', 'success')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread])
  // Opening the helper goes to the chat with the news...
  useEffect(() => {
    if (!isOpen || !unread.length || (activeConversation && unread.includes(activeConversation.id))) return
    if (!activeConversation || !activeConversation.messages.some(m => m.id.startsWith('temp-'))) void openChat(unread[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, unread])
  // ...and once it's on screen, it shows the news (the finished card + message) and is read.
  useEffect(() => {
    const id = activeConversation?.id
    if (!isOpen || !id || !unread.includes(id)) return
    api.ai.getConversation(id).then(r => { if (r.success && r.data) setActiveConversation(r.data) })
    api.ai.markRead(id).then(r => { if (r.success && r.data) setUnread(r.data.conversations) })
  }, [isOpen, activeConversation?.id, unread])

  useEffect(() => {
    if (!isOpen || !news.length) return
    const here = activeConversation?.id
    const fresh = news.filter(n => !told.some(t => t.id === n.id))
    if (!fresh.length) return
    // In the chat they're looking at, the message itself is the news.
    setTold(t => [...t, ...fresh.filter(n => n.conversation_id !== here)])
    api.ai.newsSeen(fresh.map(n => n.id))
    Array.from(new Set(fresh.map(n => n.conversation_id).filter(c => c && c !== here))).forEach(c => api.ai.markRead(c as string).then(r => { if (r.success && r.data) setUnread(r.data.conversations) }))
    setNews([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, news, activeConversation?.id])

  const [dragging, setDragging] = useState(false)
  const newChat = useCallback(() => { setActiveConversation(null) }, [])
  // Any page change while the chat is open (a Go there button that moves the page itself, not only
  // a link - owner, 11/01: "make a new Open House Kit" kept the sheet over it): it steps aside the
  // same way - computer: the big window back to the corner; phone: down to the peek.
  const lastPath = useRef(pathname)
  useEffect(() => {
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    if (!isOpen) return
    setBig(false)
    if (isPhone) setPeek(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])
  // A card that finishes on another page (an Open House Kit, 11/01) moves the page there - the chat then
  // steps aside like any page change.
  useEffect(() => {
    const go = (e: Event) => { const url = (e as CustomEvent<string>).detail; if (typeof url === 'string' && url.startsWith('/')) router.push(url) }
    window.addEventListener('ohp:navigate', go)
    return () => window.removeEventListener('ohp:navigate', go)
  }, [router])
  // Opened again after a while: a clean slate (a chat being answered right now is left alone).
  useEffect(() => {
    if (isOpen && !isSending && staleChat(activeConversation)) newChat()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const handleSend = useCallback(async (typed: string, photos?: DroppedPhoto[]) => {
    const text = typed
    const shown = typed + (photos || []).map(p => `\n[Photo attached: ${p.url}]`).join('')
    // A new message means the agent is actively talking again - cut off whatever spoken
    // reply might still be playing instead of letting it talk over the new turn.
    speech.stop()
    setIsSending(true)
    const tempId = `temp-${Date.now()}`
    const optimisticUser = { id: tempId, role: 'user' as const, content: shown, created_at: new Date().toISOString() }

    let conversationId = activeConversation?.id

    try {
      if (!conversationId) {
        const created = await api.ai.createConversation()
        if (!created.success || !created.data) {
          throw new Error(created.error || 'Could not start a new conversation.')
        }
        conversationId = created.data.id
        setActiveConversation({ id: conversationId, title: null, created_at: created.data.created_at, last_message_at: null, messages: [optimisticUser] })
      } else {
        setActiveConversation((prev) => (prev ? { ...prev, messages: [...prev.messages, optimisticUser] } : prev))
      }

      // voice_mode: true whenever replies are being read aloud, so the model answers in one
      // short spoken sentence instead of a bullet-list dump that takes forever to listen to.
      const response = await api.ai.sendMessage(conversationId, text, voiceOutputEnabled, photos?.map(p => p.id))
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Something went wrong sending that message.')
      }

      const { user_message, assistant_message } = response.data
      setActiveConversation((prev) => {
        if (!prev) return prev
        const withoutTemp = prev.messages.filter((m) => m.id !== tempId)
        return { ...prev, title: prev.title || (text.length <= 80 ? text : `${text.slice(0, 79).replace(/\s+\S*$/, '')}…`), messages: [...withoutTemp, user_message, assistant_message] }
      })
      return true
    } catch (err) {
      setActiveConversation((prev) => (prev ? { ...prev, messages: prev.messages.filter((m) => m.id !== tempId) } : prev))
      showToast(err instanceof Error ? err.message : 'Something went wrong sending that message.', 'error')
      return false   // the typing box puts their words back
    } finally {
      setIsSending(false)
    }
  }, [activeConversation, showToast, voiceOutputEnabled, speech.stop])

  // Opened from elsewhere in the app (e.g. the Dashboard's Daily Digest "Chat about this")
  // with an optional prefill that gets sent immediately, mirroring how AssistantHome's own
  // insight cards already behave (one click, one send).
  useEffect(() => {
    const handler = (e: Event) => {
      setIsOpen(true)
      const prefill = (e as CustomEvent<{ prefill?: string }>).detail?.prefill
      if (prefill) handleSend(prefill)
    }
    window.addEventListener(ASSISTANT_OPEN_EVENT, handler)
    return () => window.removeEventListener(ASSISTANT_OPEN_EVENT, handler)
  }, [handleSend])


  // Phone sheet: drag the top bar up for full screen, down to shrink, further down to close. The sheet's
  // height follows the finger, then glides to where it lands (owner, 11/01: going full screen was
  // glitchy - the sheet used to lift off the bottom while dragged, snap back, then grow).
  const onTouchStart = (e: React.TouchEvent) => {
    const h = panelRef.current?.getBoundingClientRect().height
    if (h) dragFrom.current = { y: e.touches[0].clientY, h, dy: 0 }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    const d = dragFrom.current
    if (!d) return
    d.dy = e.touches[0].clientY - d.y
    if (Math.abs(d.dy) > 4) setDragH(Math.min(window.innerHeight, Math.max(60, d.h - d.dy)))
  }
  const onTouchEnd = () => {
    const d = dragFrom.current
    dragFrom.current = null
    if (!d) return
    const dy = d.dy
    if (peek) { setDragH(null); if (dy > 40) close(); else if (dy < -30) setPeek(false); return }
    if (dy > 70 && !big) { close(); return }   // slides out from where the finger left it
    setDragH(null)
    if (dy < -50) setBig(true)
    else if (dy > 70) setBig(false)
  }

  // Nothing to show before login, while auth is still resolving, on the full-page experience
  // itself (no point floating a shortcut to the page you're already on), or when the helper
  // isn't on for this account (no active plan, or the Admin switch is off).
  if (isCheckingAuth || !isAuthenticated || !helper?.enabled || pathname === '/assistant') {
    return null
  }

  // A single persistent instance for the life of the call - toggling isOpen just flips its
  // `minimized` prop (pill vs. chat-panel-sized card with live transcript) rather than
  // mounting/unmounting the component, which would tear down the WebRTC connection.
  if (isTalking) {
    return (
      <TalkToOHP
        onClose={() => setIsTalking(false)}
        minimized={!isOpen}
        onExpand={() => setIsOpen(true)}
        onMinimize={() => setIsOpen(false)}
      />
    )
  }

  if (!isOpen) {
    return (
      // The helper's button: Chat Pal on a gold coin (owner, 11/01: "don't want him to have a black
      // background"), a gold ring that sweeps around it a few times when it appears, lifts on hover.
      <button
        ref={fabRef}
        style={fabLift ? { transform: `translateY(-${fabLift}px)` } : undefined}
        onClick={() => setIsOpen(true)}
        aria-label="Open AI Assistant"
        title="Ask OpenHousePal"
        className="ohp-ai-fab group fixed bottom-6 right-6 z-40 grid h-[60px] w-[60px] place-items-center rounded-full"
      >
        <span aria-hidden className="ohp-ai-fab-ring absolute -inset-[3px] rounded-full" />
        <span aria-hidden className="absolute inset-0 rounded-full bg-gradient-to-br from-[#f0d58e] via-[#C9A24D] to-[#a8803a] shadow-[0_14px_30px_-10px_rgba(168,128,58,.85),inset_0_1px_0_rgba(255,255,255,.45)] ring-2 ring-white dark:ring-zinc-900" />
        <OhpBot size={56} coin={false} className="ohp-ai-fab-icon relative" />
        {unread.length > 0 && (
          <span data-testid="ai-unread-badge" className="ohp-ai-check absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[11px] font-black text-white ring-2 ring-white dark:ring-zinc-900">
            {unread.length}
          </span>
        )}
      </button>
    )
  }

  const frame = isPhone
    // peek: just the handle + title bar, under any window the page opens (its own buttons stay tappable)
    ? `fixed inset-x-0 bottom-0 rounded-t-3xl transition-[height] duration-300 ease-out ${peek ? 'z-30 h-[76px] cursor-pointer' : big ? 'z-50 h-[100dvh] rounded-t-none' : 'z-50 h-[72dvh]'}`
    : big
      ? 'fixed inset-4 lg:inset-y-8 lg:left-[8%] lg:right-[8%] z-50 rounded-3xl'
      : 'fixed bottom-6 right-6 z-40 w-96 h-[560px] max-h-[calc(100vh-3rem)] rounded-2xl'
  const iconBtn = 'ohp-ai-press p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300'
  const motionIn = isPhone ? (closing ? (kb ? 'ohp-ai-sheet-out-kb' : 'ohp-ai-sheet-out') : 'ohp-ai-sheet-in') : closing ? 'ohp-ai-panel-out' : 'ohp-ai-panel-in'

  return (
    <>
      {(big || isPhone) && !peek && (
        <div data-scroll-lock={isPhone ? 'soft' : undefined} className={`fixed inset-0 touch-none bg-black/30 ${closing ? 'ohp-ai-fade-out' : 'ohp-ai-fade'}`} style={{ zIndex: 49 }} onClick={() => (isPhone ? close() : setBig(false))} />
      )}
      {/* Under the see-through keyboard: the chat's own color, not the page behind it. */}
      {kbOpen && kb && <div aria-hidden className="fixed inset-x-0 bg-white dark:bg-zinc-900" style={{ top: kb.top + kb.height - 1, height: '100vh', zIndex: 50 }} />}
      <div
        ref={panelRef}
        data-ohp-chat-panel
        // A photo dragged anywhere on the chat goes with the next message (a card's own drop spot keeps its own).
        onDragOver={e => { if (Array.from(e.dataTransfer.types).includes('Files')) { e.preventDefault(); setDragging(true) } }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false) }}
        onDrop={e => { e.preventDefault(); setDragging(false); const files = Array.from(e.dataTransfer.files || []); if (files.length) window.dispatchEvent(new CustomEvent('ohp:chat-files', { detail: files })) }}
        // Tapping a "Create a Showcase" / "Open it" button inside the chat goes there and the chat
        // steps aside (owner, 10/31: on a phone the sheet stayed over the create window). The
        // conversation is kept - the bubble reopens it.
        // Computer: the big window drops back to the corner; phone: the sheet slides down to a short
        // peek so the page it opened shows (tap the peek to bring the chat back up).
        onClickCapture={e => {
          const a = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null
          if (!a || !a.getAttribute('href')?.startsWith('/') || a.target === '_blank' || a.hasAttribute('download')) return
          setBig(false)
          if (isPhone) setPeek(true)
          // saved right now - the page change can rebuild the chat before an effect would save it
          store.set(UI_KEY, JSON.stringify({ open: true, big: false, peek: isPhone }), true)
        }}
        onClick={() => { if (peek) setPeek(false) }}
        // Phones never pin the page under the sheet, full screen included (it covers it all anyway);
        // pinning mid-swipe made the page jump behind it.
        data-scroll-lock={peek || !(big || isPhone) ? 'off' : isPhone ? 'soft' : 'on'}
        style={kb
          ? { top: kb.top, bottom: 'auto', height: kb.height, borderRadius: 0, transition: 'none' }
          : dragH !== null ? { height: dragH, transition: 'none' } : undefined}
        className={`${frame} ${motionIn} bg-white dark:bg-zinc-900 shadow-2xl shadow-black/20 border border-gray-100 dark:border-zinc-800 flex flex-col overflow-hidden`}
      >
        {isPhone && !kb && (
          <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onClick={() => setBig((b) => !b)}
               className="relative flex justify-center pt-2 pb-1 cursor-grab touch-none" aria-label={big ? 'Swipe down to shrink' : 'Swipe up for full screen'}>
            <span className="h-1.5 w-10 rounded-full bg-gray-300 dark:bg-zinc-600" />
          </div>
        )}
        <div
          onTouchStart={isPhone ? onTouchStart : undefined} onTouchMove={isPhone ? onTouchMove : undefined} onTouchEnd={isPhone ? onTouchEnd : undefined}
          className={`flex items-center gap-1 px-3 ${kb ? 'py-1.5' : 'py-2.5'} border-b border-gray-100 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 flex-shrink-0`}
        >
          <OhpBot size={26} className="mx-0.5 flex-shrink-0" />
          {/* Always "AI Assistant", the chat's usage bar beside it on the same line (owner, 11/01) */}
          <span className="shrink-0 text-sm font-bold leading-snug text-[#111827] dark:text-white">AI Assistant</span>
          {/* ...in its own little pill, like the AI Usage pill on the rest of the site (owner, 11/01) */}
          <MonthlyAiUsageMeter kind="chat" variant="inline" slimOnly pill refreshKey={`${activeConversation?.messages.length || 0}:${isSending}`}
            className="mx-1.5 min-w-0 flex-1" />
          <span className="flex-1 empty:hidden" />
          {activeConversation && (
            <button onClick={newChat} title="Start a new chat" aria-label="Start a new chat" className={iconBtn}><MessageSquarePlus className="w-4 h-4" /></button>
          )}
          {helper.voice && (
            <button
              onClick={() => setVoiceOutputEnabled((v) => !v)}
              title={voiceOutputEnabled ? 'Turn off spoken replies' : 'Have replies read aloud'}
              className={`p-1.5 rounded-lg transition-colors ${voiceOutputEnabled ? 'bg-[#8b7355]/10 text-[#8b7355] dark:text-[#C9A24D]' : 'text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
            >
              {voiceOutputEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          )}
          <button onClick={() => setBig((b) => !b)} title={big ? 'Make smaller' : 'Make bigger'} aria-label={big ? 'Make smaller' : 'Make bigger'} className={iconBtn}>
            {big ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button onClick={close} aria-label="Close" className={iconBtn}><X className="w-4 h-4" /></button>
        </div>

        {dragging && <div className="pointer-events-none absolute inset-2 z-20 grid place-items-center rounded-2xl border-2 border-dashed border-[#C9A24D] bg-white/90 text-sm font-black text-[#8b7355] dark:bg-zinc-900/90 dark:text-[#e8c97a]" data-testid="ai-drop-hint">Drop your photo here</div>}
        <WorkingStrip jobs={working} />
        {told.length > 0 && (
          <div className="flex-shrink-0 space-y-1 border-b border-emerald-100 bg-emerald-50 px-3 py-2 dark:border-emerald-900/40 dark:bg-emerald-900/20" data-testid="ai-news">
            {told.map(n => (
              <div key={n.id} className="ohp-ai-fade flex items-center gap-2 text-[12px] font-semibold text-emerald-900 dark:text-emerald-200">
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{n.text}</span>
                {n.link && <Link href={n.link} className="shrink-0 font-black underline underline-offset-2">{n.link_label || 'Open it'}</Link>}
              </div>
            ))}
            <button type="button" onClick={() => setTold([])} className="text-[11px] font-bold text-emerald-800/70 hover:underline dark:text-emerald-200/70">Got it</button>
          </div>
        )}

        <div className="flex-1 min-h-0 flex">
          <div className="flex-1 min-w-0 flex flex-col">
              <>
                <div className="flex-1 min-h-0 flex flex-col">
                  {activeConversation ? (
                    <ChatThread messages={activeConversation.messages} isSending={isSending} autoSpeak={voiceOutputEnabled} conversationId={activeConversation.id} speech={speech} canSpeak={helper.voice} onReply={handleSend} />
                  ) : (
                    <AssistantHome onPrompt={handleSend} />
                  )}
                </div>
                <div className={kb ? undefined : "pb-[env(safe-area-inset-bottom)]"}>
                  {/* The chat's own allowance: a slim line that moves after each reply; near / at the limit the full bar + upgrade offer (11/01) */}
                  {/* (Below 80% it's the slim bar in the top line; near the limit the full bar + upgrade offer shows here too.) */}
                  {activeConversation && <MonthlyAiUsageMeter kind="chat" variant="inline" onlyNearLimit refreshKey={`${activeConversation.messages.length}:${isSending}`} className="px-4 pt-2" />}
                  <ChatInput
                    onSend={handleSend}
                    disabled={isSending}
                    onUserSpeaking={speech.stop}
                    onStartCall={helper.voice ? () => { if (!isSending) setIsTalking(true) } : undefined}
                    tight={!!kb}
                  />
                </div>
              </>
          </div>
        </div>
      </div>
    </>
  )
}
