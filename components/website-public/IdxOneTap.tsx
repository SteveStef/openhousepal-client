'use client'

// Google One Tap on the agent's IDX website (user, 10/18 - "like Luxury Presence has"). A visitor
// already signed into Google sees a small "Continue as Jane" box in the corner; one tap and the agent
// gets them as a lead, and every form on the site fills in their name + email (lib/visitor.ts).
//
// - Never the moment a page opens: after they've looked at a second page, or spent a little while on
//   one. Once per visit, and never again after they've signed in.
// - Only on the agent's *.openhousepal.com address - Google can't run One Tap on an agent's own
//   separate domain (different site), so those sites just don't show it.
// - The box itself runs in a frame from openhousepal.com (app/gsi/onetap) - Google's supported way
//   to show One Tap on many subdomains; the Google token never reaches this page.
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { readVisitor, VISITOR_EVENT } from '@/lib/visitor'

const OHP_BASE_DOMAIN = process.env.NEXT_PUBLIC_OHP_BASE_DOMAIN || 'openhousepal.com'
const SHOWN_KEY = 'ohp-onetap-shown'
const VIEWS_KEY = 'ohp-site-views'
const DELAY_MS = 15000

export default function IdxOneTap({ siteId, listingKey }: { siteId: string; listingKey?: string | null }) {
  const [hello, setHello] = useState<string | null>(null)

  useEffect(() => {
    if (readVisitor()) return
    const host = window.location.hostname
    const local = host === 'localhost'
    if (!local && !host.endsWith(`.${OHP_BASE_DOMAIN}`)) return
    let views = 0
    try {
      if (sessionStorage.getItem(SHOWN_KEY)) return
      views = Number(sessionStorage.getItem(VIEWS_KEY) || 0) + 1
      sessionStorage.setItem(VIEWS_KEY, String(views))
    } catch { /* private mode: still fine, just once */ }

    let poll: number | undefined
    const show = () => {
      if (readVisitor() || document.getElementById('g_id_intermediate_iframe')) return
      try { sessionStorage.setItem(SHOWN_KEY, '1') } catch { /* ignore */ }
      const params = new URLSearchParams({ site: siteId, page: window.location.href })
      if (listingKey) params.set('lk', listingKey)
      const frameOrigin = local ? window.location.origin : `https://${OHP_BASE_DOMAIN}`
      const holder = document.createElement('div')
      holder.id = 'g_id_intermediate_iframe'
      holder.dataset.src = `${frameOrigin}/gsi/onetap?${params}`
      document.body.appendChild(holder)
      const s = document.createElement('script')
      s.src = 'https://accounts.google.com/gsi/intermediate'
      s.async = true
      document.head.appendChild(s)
      // The frame saves the visitor in a cookie we can read; notice it and say hello.
      const started = Date.now()
      poll = window.setInterval(() => {
        const v = readVisitor()
        if (v) {
          window.clearInterval(poll)
          window.dispatchEvent(new Event(VISITOR_EVENT))
          setHello(v.firstName || v.name.split(' ')[0] || 'there')
          window.setTimeout(() => setHello(null), 6000)
        } else if (Date.now() - started > 10 * 60 * 1000) {
          window.clearInterval(poll)
        }
      }, 1000)
    }
    const timer = window.setTimeout(show, views >= 2 ? 2500 : DELAY_MS)
    return () => { window.clearTimeout(timer); if (poll) window.clearInterval(poll) }
  }, [siteId, listingKey])

  return (
    <AnimatePresence>
      {hello && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
          className="fixed bottom-24 left-1/2 z-[120] flex -translate-x-1/2 items-center gap-2.5 rounded-full border px-4 py-2.5 text-sm font-bold shadow-xl"
          style={{ background: 'var(--site-surface, #fff)', color: 'var(--site-ink, #111827)', borderColor: 'var(--site-line, rgba(0,0,0,.08))' }}>
          <span className="grid h-6 w-6 place-items-center rounded-full" style={{ background: 'var(--site-accent, #C9A24D)', color: 'var(--site-on-accent, #111827)' }}><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
          Thanks, {hello} - forms on this site will fill in for you.
        </motion.div>
      )}
    </AnimatePresence>
  )
}
