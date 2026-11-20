'use client'

// "Fix grammar" wherever an agent types (owner 11/19: "this should prob show up anytime an agent manually types
// somewhere, like we have this in blogs"). One small pill that follows whatever writing box the agent is in, on the
// agent's own pages - no page has to add it, and a new box gets it too. Tap it: the same before / after window as the
// CMA report's Fix grammar (components/ui/GrammarFix, backend grammar_fix_service): spelling, grammar and wording
// only, every fact and number kept; nothing changes until the agent picks "Use the fixed version".
// Not on: pages clients or guests fill in, the AI chat, boxes that are instructions to the AI, or pasted reviews
// (those boxes carry data-no-grammar), and never on a box with only a few words in it.
import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Loader2, SpellCheck } from 'lucide-react'
import api from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import { GrammarCompare, type GrammarChange } from '@/components/ui/GrammarFix'

const AGENT_PAGES = /^\/(studio|dash|leads|showcases|open-houses|settings|setup|tools|activity|discovery|agent-hub|idx-websites)(\/|$)/
const MIN_WORDS = 4

function eligible(t: EventTarget | null): t is HTMLTextAreaElement {
  return t instanceof HTMLTextAreaElement && !t.readOnly && !t.disabled && !t.closest('[data-no-grammar]')
}

/** Put text into a box the way typing would, so the page's own handler (React's onChange) sees it. */
function typeInto(el: HTMLTextAreaElement, text: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
  if (setter) setter.call(el, text)
  else el.value = text
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

export default function GrammarAssist() {
  const pathname = usePathname() || ''
  const { isAuthenticated } = useAuth()
  const on = isAuthenticated && AGENT_PAGES.test(pathname)
  const [box, setBox] = useState<HTMLTextAreaElement | null>(null)
  const [pos, setPos] = useState<{ top: number, left: number } | null>(null)
  const [words, setWords] = useState(0)
  const [busy, setBusy] = useState(false)
  const [changes, setChanges] = useState<GrammarChange[] | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean, text: string } | null>(null)
  const working = useRef(false)          // the window or a check is open: keep the box even though focus left it
  working.current = busy || !!changes

  const place = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el || !el.isConnected) { setPos(null); return }
    const r = el.getBoundingClientRect()
    if (r.width < 120 || r.bottom < 0 || r.top > window.innerHeight) { setPos(null); return }
    setPos({ top: Math.min(r.bottom + 6, window.innerHeight - 44), left: Math.max(8, r.right - 132) })
  }, [])
  const count = (el: HTMLTextAreaElement | null) => setWords(el ? el.value.trim().split(/\s+/).filter(Boolean).length : 0)

  useEffect(() => {
    if (!on) { setBox(null); return }
    let blurTimer: ReturnType<typeof setTimeout> | null = null
    const onIn = (e: FocusEvent) => {
      if (blurTimer) { clearTimeout(blurTimer); blurTimer = null }
      if (eligible(e.target)) { setBox(e.target); count(e.target); place(e.target) }
    }
    const onOut = () => {
      if (blurTimer) clearTimeout(blurTimer)
      blurTimer = setTimeout(() => { if (!working.current && !eligible(document.activeElement)) setBox(null) }, 250)
    }
    document.addEventListener('focusin', onIn)
    document.addEventListener('focusout', onOut)
    return () => {
      document.removeEventListener('focusin', onIn)
      document.removeEventListener('focusout', onOut)
      if (blurTimer) clearTimeout(blurTimer)
    }
  }, [on, place])

  useEffect(() => {
    if (!box) { setPos(null); return }
    let raf = 0
    const follow = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => place(box)) }
    const onInput = () => { count(box); follow() }
    box.addEventListener('input', onInput)
    window.addEventListener('scroll', follow, true)
    window.addEventListener('resize', follow)
    return () => {
      cancelAnimationFrame(raf)
      box.removeEventListener('input', onInput)
      window.removeEventListener('scroll', follow, true)
      window.removeEventListener('resize', follow)
    }
  }, [box, place])

  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 3500); return () => clearTimeout(t) }, [msg])
  useEffect(() => { setBox(null); setChanges(null) }, [pathname])

  const run = async () => {
    if (!box || busy) return
    setBusy(true); setMsg(null)
    try {
      const r = await api.ai.fixGrammar({ passages: [{ id: 'box', text: box.value }], where: `an agent's ${box.getAttribute('aria-label') || box.placeholder || 'writing'}`.slice(0, 120) })
      if (!r.data) { setMsg({ ok: false, text: r.error || r.message || 'The grammar check did not go through. Try again.' }); return }
      if (!r.data.changes.length) setMsg({ ok: true, text: 'Looks good - nothing to fix.' })
      else setChanges(r.data.changes)
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'The grammar check did not go through. Try again.' })
    } finally { setBusy(false) }
  }

  if (!on) return null
  const show = !!box && !!pos && (words >= MIN_WORDS || busy)
  return (
    <>
      {show && (
        <div className="fixed z-[80] flex flex-col items-end gap-1" style={{ top: pos!.top, left: pos!.left, width: 132 }}>
          <button type="button" data-grammar-assist
            onMouseDown={e => e.preventDefault()}         /* keep the agent's place in the box */
            onClick={() => void run()} disabled={busy}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#C9A24D]/60 bg-white px-3 text-[12px] font-black text-[#8b7355] shadow-md transition hover:bg-[#fffaf0] active:scale-95 disabled:opacity-70 dark:bg-[#1b1b1e] dark:text-[#e8c97a]">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SpellCheck className="h-3.5 w-3.5" />} {busy ? 'Checking…' : 'Fix grammar'}
          </button>
          {msg && <span role="status" data-grammar-msg className={`w-max max-w-[15rem] rounded-xl px-3 py-1.5 text-[12px] font-black shadow-lg ${msg.ok ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>{msg.text}</span>}
        </div>
      )}
      {changes && box && (
        <GrammarCompare changes={changes} labels={{}}
          onKeep={() => { setChanges(null); box.focus() }}
          onUse={picked => {
            const fix = picked.find(c => c.id === 'box')
            if (fix && box.isConnected && box.value.trim() === fix.before.trim()) typeInto(box, fix.after)
            else if (fix) setMsg({ ok: false, text: 'The text changed while checking - tap Fix grammar again.' })
            setChanges(null)
            box.focus()
            if (fix) setMsg(m => m || { ok: true, text: 'Fixed.' })
          }} />
      )}
    </>
  )
}
