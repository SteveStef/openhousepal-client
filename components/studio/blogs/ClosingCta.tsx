'use client'

import { motion } from 'framer-motion'
import { ArrowRight, CalendarCheck, Home, KeyRound, MessageCircle } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/api-service'
import { BLOG_CTA_FORMS } from '@/lib/studio/blogTopics'

// The article's closing call to action ("Have a question about your move?") - the moment a reader
// becomes a lead. A dark, lit card in the article's accent: the agent's photo, the question, one
// clear primary action, and three one-tap intents. Every button opens one of the agent's own forms
// (Home Value, Schedule a Showing...) in a window over the article - or the question box for "Ask me
// anything" / an agent without that form. No claims the agent didn't make (no "replies in an hour").
// Agents with an Email Signature card get that card here instead (BlogArticleBody).

export default function ClosingCta({ heading, label, formType = 'how_can_i_help', accent = '#C9A24D', agent, onAction }: {
  heading?: string
  label?: string
  /** What the main button opens (BLOG_CTA_FORMS). */
  formType?: string
  accent?: string
  agent: { name: string; photoUrl?: string | null; title?: string | null; brokerage?: string | null }
  /** Opens that form (or the question box), titled with the button's words. */
  onAction: (formType: string, label: string) => void
}) {
  const first = (agent.name || '').trim().split(/\s+/)[0] || 'me'
  const mainLabel = label || BLOG_CTA_FORMS.find(f => f.formType === formType)?.label || 'Contact Me'
  const intents = [
    { icon: Home, label: "What's my home worth?", formType: 'home_value' },
    { icon: CalendarCheck, label: 'See a home in person', formType: 'showing' },
    { icon: KeyRound, label: 'Ready to buy or sell?', formType: 'how_can_i_help' },
    { icon: MessageCircle, label: 'Ask me anything', formType: 'question' },
  ].filter(it => it.formType !== formType).slice(0, 3)
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="not-prose relative my-12 overflow-hidden rounded-[28px] p-[1.5px] shadow-[0_40px_90px_-46px_rgba(0,0,0,.85)]"
      style={{ background: `linear-gradient(135deg, ${accent}, rgba(255,255,255,.18) 40%, ${accent}aa)` }}
    >
      <style>{CTA_CSS}</style>
      <div className="relative overflow-hidden rounded-[26.5px] px-6 py-8 text-white sm:px-10 sm:py-10"
        style={{ background: `radial-gradient(120% 120% at 100% 0%, ${accent}55, transparent 55%), radial-gradient(80% 90% at 0% 100%, ${accent}22, transparent 60%), linear-gradient(135deg, #0b0f0e 0%, #111827 55%, #1d1810 100%)` }}>
        <span aria-hidden className="cta-edge pointer-events-none absolute inset-x-0 top-0 h-px" style={{ ['--cta-accent' as any]: accent }} />
        <svg aria-hidden className="cta-motif pointer-events-none absolute -right-4 bottom-0 h-40 w-40 sm:h-52 sm:w-52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth=".55" strokeLinecap="round" strokeLinejoin="round" style={{ color: `${accent}40` }}>
          <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M10 20v-5h4v5" />
        </svg>
        {[['12%', '22%', 0], ['78%', '18%', 1.6], ['88%', '62%', 3.1], ['40%', '84%', 2.2]].map(([l, t, d], k) => (
          <span key={k} aria-hidden className="cta-spark pointer-events-none absolute" style={{ left: l as string, top: t as string, animationDelay: `${d}s`, ['--cta-accent' as any]: accent }} />
        ))}

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          {agent.photoUrl && (
            <motion.div initial={{ scale: 0.85, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 18 }}
              className="relative h-20 w-20 shrink-0 sm:h-24 sm:w-24">
              <span aria-hidden className="cta-ring absolute -inset-1.5 rounded-full" style={{ background: `conic-gradient(from 0deg, ${accent}, transparent 40%, ${accent} 70%, transparent)` }} />
              <img src={resolveMediaUrl(agent.photoUrl)} alt={agent.name} className="relative h-full w-full rounded-full object-cover ring-2 ring-[#0b0f0e]" />
            </motion.div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.32em]" style={{ color: accent }}>Talk to {first}</p>
            <p className="mt-2 font-serif text-2xl font-black leading-tight sm:text-[1.9rem]">{heading || 'Have a question about your move?'}</p>
            <p className="mt-2 max-w-md text-sm font-medium leading-relaxed text-white/65">
              Send a quick note - it goes straight to {first}{agent.brokerage ? ` at ${agent.brokerage}` : ''}, with no obligation.
            </p>
          </div>
        </div>

        <div className="relative mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
          <motion.button type="button" whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} onClick={() => onAction(formType, mainLabel)}
            className="cta-shine relative inline-flex shrink-0 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-2xl px-7 py-3.5 text-sm font-black text-[#111827] shadow-[0_18px_36px_-16px_rgba(0,0,0,.9)]"
            style={{ background: `linear-gradient(135deg, #ffffff, ${accent} 140%)` }}>
            {mainLabel} <ArrowRight className="h-4 w-4" />
          </motion.button>
          <div className="flex flex-wrap gap-2">
            {intents.map((it, k) => (
              <motion.button key={it.label} type="button" onClick={() => onAction(it.formType, it.label)}
                initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.25 + k * 0.08 }}
                whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-2 text-xs font-bold text-white/85 transition hover:border-white/40 hover:bg-white/[0.12] hover:text-white">
                <it.icon className="h-3.5 w-3.5" style={{ color: accent }} /> {it.label}
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  )
}

const CTA_CSS = `
.cta-edge{background:linear-gradient(90deg,transparent 10%,var(--cta-accent) 50%,transparent 90%);background-size:200% 100%;animation:ctaEdge 6s ease-in-out infinite}
@keyframes ctaEdge{0%{background-position:150% 0}100%{background-position:-50% 0}}
.cta-motif{animation:ctaFloat 14s ease-in-out infinite alternate}
@keyframes ctaFloat{from{transform:translateY(0) rotate(-4deg)}to{transform:translateY(-10px) rotate(2deg)}}
.cta-spark{width:4px;height:4px;border-radius:999px;background:var(--cta-accent);box-shadow:0 0 10px 2px var(--cta-accent);opacity:0;animation:ctaSpark 7s ease-in-out infinite}
@keyframes ctaSpark{0%{opacity:0;transform:translateY(0) scale(.5)}30%{opacity:.9;transform:translateY(-16px) scale(1)}100%{opacity:0;transform:translateY(-60px) scale(.5)}}
.cta-ring{animation:ctaSpin 9s linear infinite;opacity:.9}
@keyframes ctaSpin{to{transform:rotate(360deg)}}
.cta-shine:after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.7) 50%,transparent 65%);transform:translateX(-100%);animation:ctaShine 3.6s ease-in-out infinite}
@keyframes ctaShine{0%,55%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
@media (prefers-reduced-motion:reduce){.cta-edge,.cta-motif,.cta-spark,.cta-ring,.cta-shine:after{animation:none}}
`
