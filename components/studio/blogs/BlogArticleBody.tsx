'use client'

import { contrastRatio } from '@/lib/siteTheme'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { qrDataUrl } from '@/lib/qr'
import { ArrowRight, Bath, Bed, Check, ClipboardList, ExternalLink, Home, LandPlot, Lightbulb, Loader2, MapPin, Maximize, Quote, Send, X } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/api-service'
import { ctaFormTypeOf, textStyleClasses } from '@/lib/studio/blogTopics'
import FormWindow from '@/components/forms/FormWindow'
import { escapeHtml, sanitizeInlineHtml } from '@/lib/studio/sanitizeHtml'
import { BlogBlock, LinkedProperty } from '@/types'
import AreaSpotlightSection from './AreaSpotlightSection'
import { PaymentExample, SourcesList, type PaymentExampleData, type SourcesData } from './ArticleDataBlocks'
import SignatureSiteCard from './SignatureSiteCard'
import { PropertyShowcase, VideoShowcase } from './ShowcaseBlocks'
import ClosingCta from './ClosingCta'

// New blocks store rich text as sanitized HTML (data.html); older blocks only have plain data.text.
function richHtml(data: { html?: string; text?: string }): string {
  return data.html ? sanitizeInlineHtml(data.html) : escapeHtml(data.text || '')
}

export interface NeighborhoodLink { slug: string; name: string; url: string; photo?: string | null; median_price?: number | null; active_count?: number | null }

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Turns the FIRST mention of each linked town in the article into a link to its IDX
 *  neighborhood page (new tab). Only plain text is touched - never inside a tag or an existing link.
 *  `used` carries across blocks so each town is linked once per article. */
function linkTownsInHtml(html: string, links: NeighborhoodLink[], used: Set<string>): string {
  const todo = links.filter(l => !used.has(l.slug) && l.name)
  if (!todo.length) return html
  const parts = html.split(/(<[^>]+>)/)
  let inLink = 0
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (part.startsWith('<')) {
      if (/^<a[\s>]/i.test(part)) inLink++
      else if (/^<\/a>/i.test(part)) inLink = Math.max(0, inLink - 1)
      continue
    }
    if (inLink || !part.trim()) continue
    let text = part
    for (const l of todo) {
      if (used.has(l.slug)) continue
      const re = new RegExp(`\\b(${escRe(l.name)})\\b`)
      if (re.test(text)) {
        text = text.replace(re, `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener" class="ohp-town-link" title="${escapeHtml(`Explore ${l.name} - opens in a new tab`)}">$1</a>`)
        used.add(l.slug)
      }
    }
    parts[i] = text
  }
  return parts.join('')
}

export interface BlogArticleAgentInfo {
  name: string
  brokerage?: string | null
  photoUrl?: string | null
  title?: string | null
}

function youtubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/)
  return match ? match[1] : null
}

export interface BlogLeadPayload { name: string; email?: string; phone?: string; message?: string }
export interface BlogRelatedArticle { slug: string; title: string; category?: string | null; coverImageUrl?: string | null; readingTimeMinutes?: number }

interface BlogArticleBodyProps {
  blocks: BlogBlock[]
  agent: BlogArticleAgentInfo
  accentColor?: string
  onEvent?: (eventType: 'link_click' | 'property_click' | 'contact_click' | 'video_play', meta?: Record<string, unknown>) => void
  /** Public article only: sends a reader's question (Contact Form block / Call to Action) as a lead. */
  onLead?: (payload: BlogLeadPayload) => Promise<{ ok: boolean; error?: string }>
  /** Public article only: the agent's other articles, for the Related Articles block. */
  related?: BlogRelatedArticle[]
  relatedHref?: (slug: string) => string
  /** Where a Lead Form block's form lives for this audience (Agent Hub or IDX site). */
  formHref?: (formSlug: string) => string
  /** The agent's Agent Hub slug when the article should end with their Email Signature card - it
   *  takes the small contact card's place (and falls back to it if the agent has no signature). */
  signatureHubSlug?: string | null
  /** Towns the article is about - the signature card's listings in those towns show first. */
  signatureTowns?: string[]
  /** The article's colors for the signature card (its Luxe metal, else its accent). */
  signatureMatch?: { metal?: string | null; accent?: string | null }
  /** The agent's forms - the closing section's buttons open them in a window over the article. */
  forms?: { formType: string; slug: string; title?: string }[]
  /** Leave the closing section out (the page ends with the agent's signature some other way). */
  hideCta?: boolean
  /** IDX neighborhood pages the agent linked - each town's first mention links to its page and an
   *  "Explore the neighborhoods" row closes the article. Both open in a new tab. */
  neighborhoodLinks?: NeighborhoodLink[]
}

/** Sections the agent switched off in the editor (a heading with data.hidden) are left out of the
 *  article - the heading and everything under it, up to the next heading. */
export function visibleBlocks(blocks: BlogBlock[]): BlogBlock[] {
  const out: BlogBlock[] = []
  let hiding = false
  for (const b of blocks) {
    if (b.type === 'heading') hiding = !!b.data?.hidden
    if (!hiding) out.push(b)
  }
  return out
}

export default function BlogArticleBody(props: BlogArticleBodyProps) {
  const { accentColor = '#C9A24D', signatureHubSlug } = props
  // false = closed; a string = open, titled for what the reader asked about.
  const [contactOpen, setContactOpen] = useState<false | string>(false)
  // One of the agent's forms open in a window over the article (from the closing section).
  const [formWin, setFormWin] = useState<{ url: string; title: string } | null>(null)
  let blocks = visibleBlocks(props.blocks)
  // With the signature on, it IS the closing section: the first Call to Action / contact card
  // becomes the signature, and any later one is dropped (never both, never twice).
  if (signatureHubSlug) {
    const first = blocks.findIndex(b => b.type === 'cta' || b.type === 'agent_profile')
    blocks = blocks.flatMap((b, i) => {
      if (b.type !== 'cta' && b.type !== 'agent_profile') return [b]
      return i === first ? [{ ...b, type: 'agent_profile', data: {} } as BlogBlock] : []
    })
  }
  // An article with no contact card still closes with the signature (before "Keep reading").
  if (signatureHubSlug && !blocks.some(b => b.type === 'agent_profile')) {
    const at = blocks.findIndex(b => b.type === 'related_articles')
    const sig = { id: 'auto-signature', type: 'agent_profile', data: {} } as BlogBlock
    blocks = at === -1 ? [...blocks, sig] : [...blocks.slice(0, at), sig, ...blocks.slice(at)]
  }
  // Linked neighborhoods: the first mention of each town becomes a link, and a row of the towns'
  // pages sits just before the closing (contact card / signature / keep reading).
  const nLinks = props.neighborhoodLinks || []
  if (nLinks.length) {
    const used = new Set<string>()
    blocks = blocks.map(b => (b.type === 'paragraph' && (b.data?.html || b.data?.text)
      ? { ...b, data: { ...b.data, __linkedHtml: linkTownsInHtml(richHtml(b.data || {}), nLinks, used) } } as BlogBlock
      : b))
    const at = blocks.findIndex(b => ['cta', 'agent_profile', 'related_articles'].includes(b.type))
    const row = { id: 'auto-neighborhoods', type: 'neighborhood_links', data: {} } as unknown as BlogBlock
    blocks = at === -1 ? [...blocks, row] : [...blocks.slice(0, at), row, ...blocks.slice(at)]
  }
  return (
    <div className="blog-article space-y-6 text-[17px]">
      {blocks.map(block => (
        <Block key={block.id} block={block} {...props} accentColor={accentColor}
          openContact={(intent?: string) => setContactOpen(intent || 'Ask me anything')}
          openForm={(formType, label) => {
            const form = formType === 'question' ? null : props.forms?.find(f => f.formType === formType)
            if (form && props.formHref) setFormWin({ url: props.formHref(form.slug), title: label })
            else setContactOpen(formType === 'question' ? `Ask ${(props.agent.name || '').trim().split(/\s+/)[0] || 'me'} a question` : label)
          }} />
      ))}
      <FormWindow url={formWin?.url || null} title={formWin?.title} onClose={() => setFormWin(null)} />
      <AnimatePresence>
        {contactOpen && (
          <motion.div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setContactOpen(false)}>
            <motion.div
              onClick={e => e.stopPropagation()}
              initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              className="relative w-full max-w-lg"
            >
              <button onClick={() => setContactOpen(false)} aria-label="Close" className="absolute right-3 top-3 z-10 rounded-full bg-black/5 p-1.5 text-gray-500 hover:bg-black/10 dark:bg-white/10 dark:text-white/70"><X className="h-4 w-4" /></button>
              <ContactFormCard agent={props.agent} accentColor={accentColor} onLead={props.onLead} heading={contactOpen || 'Ask me anything'} sheet />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Block({ block, agent, accentColor, onEvent, onLead, related, relatedHref, formHref, openContact, openForm, signatureHubSlug, signatureTowns, signatureMatch, hideCta, neighborhoodLinks }: BlogArticleBodyProps & { block: BlogBlock; accentColor: string; openContact: (intent?: string) => void; openForm: (formType: string, label: string) => void }) {
  const data = block.data || {}
  switch (block.type) {
    case 'heading':
      return data.text || data.html ? <h2 className={`pt-4 font-serif text-[1.7rem] font-black leading-tight tracking-[-0.01em] text-[#111827] dark:text-white sm:text-3xl ${textStyleClasses(data)}`} dangerouslySetInnerHTML={{ __html: richHtml(data) }} /> : null
    case 'subheading':
      return data.text || data.html ? <h3 className={`font-serif text-xl font-black leading-snug text-[#111827] dark:text-white ${textStyleClasses(data)}`} dangerouslySetInnerHTML={{ __html: richHtml(data) }} /> : null
    case 'paragraph':
      return data.text || data.html ? <p className={`leading-[1.85] text-[#1f2937] dark:text-gray-200 [&_a]:font-bold [&_a]:underline [&_a]:decoration-[#C9A24D]/60 [&_a]:underline-offset-4 ${textStyleClasses(data, { allowSize: true })}`} dangerouslySetInnerHTML={{ __html: (data as any).__linkedHtml ?? richHtml(data) }} /> : null
    case ('neighborhood_links' as BlogBlock['type']):
      return neighborhoodLinks?.length ? <NeighborhoodLinksRow links={neighborhoodLinks} accentColor={accentColor} onOpen={slug => onEvent?.('link_click', { neighborhood: slug })} /> : null
    case 'quote':
      return (data.text || data.html) ? (
        <blockquote className={`relative my-2 border-l-4 py-2 pl-6 pr-2 ${textStyleClasses(data)}`} style={{ borderColor: accentColor }}>
          <Quote className="mb-1.5 h-6 w-6 opacity-40" style={{ color: accentColor }} />
          <span className="block font-serif text-2xl font-light italic leading-snug text-[#111827] dark:text-white" dangerouslySetInnerHTML={{ __html: richHtml(data) }} />
        </blockquote>
      ) : null
    case 'bulleted_list':
      return (
        <ul className="space-y-2.5">
          {(data.items || []).filter((item: string) => item?.trim()).map((item: string, i: number) => (
            <li key={i} className="flex gap-3 leading-relaxed text-[#1f2937] dark:text-gray-200">
              <span className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accentColor }} />{item}
            </li>
          ))}
        </ul>
      )
    case 'numbered_list':
      return (
        <ol className="space-y-3">
          {(data.items || []).filter((item: string) => item?.trim()).map((item: string, i: number) => (
            <li key={i} className="flex gap-3 leading-relaxed text-[#1f2937] dark:text-gray-200">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black" style={{ background: `${accentColor}22`, color: accentColor }}>{i + 1}</span>
              <span className="pt-0.5">{item}</span>
            </li>
          ))}
        </ol>
      )
    case 'divider':
      return (
        <div className="flex items-center justify-center gap-3 py-2" aria-hidden>
          <span className="h-px w-16" style={{ background: `linear-gradient(90deg, transparent, ${accentColor})` }} />
          <span className="h-1.5 w-1.5 rotate-45" style={{ background: accentColor }} />
          <span className="h-px w-16" style={{ background: `linear-gradient(-90deg, transparent, ${accentColor})` }} />
        </div>
      )
    case 'callout':
      return (data.text || data.html) ? (
        <div className={`flex gap-3 rounded-2xl border p-5 ${textStyleClasses(data)}`} style={{ borderColor: `${accentColor}55`, backgroundColor: `${accentColor}12` }}>
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0" style={{ color: accentColor }} />
          <div className="font-semibold leading-relaxed text-[#111827] dark:text-white" dangerouslySetInnerHTML={{ __html: richHtml(data) }} />
        </div>
      ) : null
    case 'button':
      return (
        <a href={data.url || '#'} onClick={() => onEvent?.('link_click', { label: data.label })} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5" style={{ backgroundColor: accentColor }}>
          {data.label || 'Learn More'} <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )
    case 'image':
      return data.url ? (
        <figure className="-mx-1 sm:-mx-6">
          <img src={resolveMediaUrl(data.url)} alt={data.alt || ''} className="w-full rounded-2xl object-cover shadow-[0_24px_50px_-30px_rgba(0,0,0,.5)]" />
          {data.caption && <figcaption className="mt-2.5 text-center text-sm font-medium italic text-gray-500 dark:text-gray-400">{data.caption}</figcaption>}
        </figure>
      ) : null
    case 'gallery':
      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(data.images || []).map((url: string, i: number) => <img key={i} src={resolveMediaUrl(url)} alt="" className="aspect-square w-full rounded-xl object-cover transition duration-500 hover:scale-[1.02]" />)}
        </div>
      )
    case 'property_showcase':
      return <PropertyShowcase title={data.title} kind={data.kind === 'listings' ? 'listings' : 'sales'} properties={data.properties || []} accent={accentColor} />
    case 'video_showcase':
      return <VideoShowcase title={data.title} videos={data.videos || []} accent={accentColor} onPlay={url => onEvent?.('video_play', { url })} />
    case 'youtube': {
      const id = data.url ? youtubeId(data.url) : null
      if (!id) return null
      return (
        <figure>
          <div className="relative aspect-video overflow-hidden rounded-2xl shadow-[0_24px_50px_-30px_rgba(0,0,0,.6)]">
            <iframe
              src={`https://www.youtube.com/embed/${id}`}
              title={data.title || 'Video'}
              allowFullScreen
              onLoad={() => onEvent?.('video_play', { url: data.url })}
              className="absolute inset-0 h-full w-full"
            />
          </div>
          {data.title && <figcaption className="mt-2.5 text-center text-sm font-bold text-gray-500 dark:text-gray-400">{data.title}</figcaption>}
        </figure>
      )
    }
    case 'property_card':
      return <PropertyCardDisplay property={data.property} size={data.displaySize === 'large' ? 'large' : 'compact'} onEvent={onEvent} />
    case 'agent_profile': {
      const small = (
        <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#151517]">
          {agent.photoUrl && <img src={resolveMediaUrl(agent.photoUrl)} alt={agent.name} className="h-16 w-16 rounded-full object-cover ring-2" style={{ ['--tw-ring-color' as any]: accentColor }} />}
          <div className="min-w-0 flex-1">
            <p className="font-serif text-lg font-black text-[#111827] dark:text-white">{agent.name}</p>
            <p className="text-xs font-bold text-gray-500">{agent.title ? `${agent.title} · ` : ''}{agent.brokerage}</p>
          </div>
          <button type="button" onClick={() => { onEvent?.('contact_click'); openContact() }} className="shrink-0 rounded-xl px-4 py-2.5 text-xs font-black transition hover:-translate-y-0.5" style={{ backgroundColor: accentColor, color: /^#[0-9a-f]{6}$/i.test(accentColor) && contrastRatio(accentColor, '#ffffff') < contrastRatio(accentColor, '#111827') ? '#111827' : '#ffffff' }}>Contact</button>
        </div>
      )
      return signatureHubSlug ? <SignatureSiteCard hubSlug={signatureHubSlug} fallback={small} towns={signatureTowns} match={signatureMatch} /> : small
    }
    case 'contact_form':
      return <ContactFormCard agent={agent} accentColor={accentColor} onLead={onLead} heading={data.label || 'Ask me a question'} onEvent={onEvent} />
    case 'lead_form':
      return <LeadFormCard data={data} accentColor={accentColor} href={data.formSlug && formHref ? formHref(data.formSlug) : null} onEvent={onEvent} />
    case 'qr_code':
      return <QrBlock url={data.url} label={data.label} />
    case 'cta':
      if (hideCta) return null
      return <ClosingCta heading={data.heading} label={data.label} formType={ctaFormTypeOf(data)} accent={accentColor} agent={agent} onAction={(formType, label) => { onEvent?.('link_click', { label }); openForm(formType, label) }} />
    case 'related_articles':
      if (!related) return <p className="rounded-2xl border border-dashed border-gray-300 p-4 text-center text-xs font-bold uppercase tracking-wide text-gray-400 dark:border-gray-700">Your other articles appear here once published.</p>
      if (!related.length) return null
      return (
        <div>
          <p className="mb-3 text-[11px] font-black uppercase tracking-[0.25em]" style={{ color: accentColor }}>Keep reading</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {related.map(r => (
              <a key={r.slug} href={relatedHref ? relatedHref(r.slug) : '#'} className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-gray-800 dark:bg-[#151517]">
                <div className="aspect-[16/10] overflow-hidden bg-gradient-to-br from-[#fbf6ec] to-[#f1e3c2] dark:from-[#1d1810] dark:to-[#111827]">
                  {r.coverImageUrl && <img src={resolveMediaUrl(r.coverImageUrl)} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
                </div>
                <div className="p-3">
                  {r.category && <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: accentColor }}>{r.category}</p>}
                  <p className="mt-0.5 line-clamp-2 font-serif text-sm font-black leading-snug text-[#111827] dark:text-white">{r.title}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )
    case 'area_spotlight':
      return data.area ? <AreaSpotlightSection area={data.area} accent={accentColor} /> : null
    case 'payment_example':
      return <PaymentExample data={data as PaymentExampleData} accent={accentColor} onAction={() => { onEvent?.('link_click', { label: 'Payment example' }); openForm(data.cta_form || 'buying', 'Get my numbers for a home') }} />
    case 'sources':
      return <SourcesList data={data as SourcesData} accent={accentColor} />
    case 'disclaimer':
      return <p className="border-t border-gray-200 pt-4 text-[11px] font-semibold leading-relaxed text-gray-400 dark:border-gray-800">{data.text}</p>
    default:
      return null
  }
}

// The Contact Form block (and the Call to Action's pop-up): a real form - the reader's question
// goes to the agent as a lead. In the editor's preview (no onLead) it shows, but can't send.
function ContactFormCard({ agent, accentColor, onLead, heading, sheet = false, onEvent }: {
  agent: BlogArticleAgentInfo; accentColor: string; onLead?: BlogArticleBodyProps['onLead']; heading: string; sheet?: boolean; onEvent?: BlogArticleBodyProps['onEvent']
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')
  const live = !!onLead
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!onLead || state === 'sending') return
    if (!name.trim() || !(email.trim() || phone.trim())) { setError('Add your name and an email or phone number.'); setState('error'); return }
    setState('sending'); setError('')
    onEvent?.('contact_click')
    const res = await onLead({ name: name.trim(), email: email.trim() || undefined, phone: phone.trim() || undefined, message: message.trim() || undefined })
    if (res.ok) setState('sent')
    else { setError(res.error || "That didn't go through - try again in a moment."); setState('error') }
  }
  const field = 'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm font-semibold text-[#111827] outline-none transition placeholder:font-medium placeholder:text-gray-400 focus:ring-4 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white'
  return (
    <div id="blog-contact" className={`relative overflow-hidden border border-gray-200 bg-white p-6 shadow-[0_24px_50px_-34px_rgba(0,0,0,.45)] dark:border-gray-800 dark:bg-[#151517] sm:p-7 ${sheet ? 'rounded-t-[28px] sm:rounded-[28px]' : 'rounded-[24px]'}`}>
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-25 blur-3xl" style={{ background: accentColor }} />
      <AnimatePresence mode="wait" initial={false}>
        {state === 'sent' ? (
          <motion.div key="sent" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="relative py-6 text-center">
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }} className="mx-auto grid h-14 w-14 place-items-center rounded-full text-white shadow-lg" style={{ background: accentColor }}>
              <Check className="h-7 w-7" strokeWidth={3} />
            </motion.span>
            <p className="mt-4 font-serif text-2xl font-black text-[#111827] dark:text-white">Sent to {agent.name.split(' ')[0] || 'me'}</p>
            <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">I&apos;ll get back to you personally - usually the same day.</p>
          </motion.div>
        ) : (
          <motion.form key="form" onSubmit={submit} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative">
            <div className="flex items-center gap-3">
              {agent.photoUrl && <img src={resolveMediaUrl(agent.photoUrl)} alt={agent.name} className="h-12 w-12 rounded-full object-cover" />}
              <div className="min-w-0">
                <p className="font-serif text-xl font-black leading-tight text-[#111827] dark:text-white">{heading}</p>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{agent.name}{agent.brokerage ? ` · ${agent.brokerage}` : ''}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
              <input value={name} onChange={e => setName(e.target.value)} disabled={!live} placeholder="Your name" className={`${field} sm:col-span-2`} style={{ ['--tw-ring-color' as any]: `${accentColor}33` }} />
              <input value={email} onChange={e => setEmail(e.target.value)} disabled={!live} type="email" placeholder="Email" className={field} style={{ ['--tw-ring-color' as any]: `${accentColor}33` }} />
              <input value={phone} onChange={e => setPhone(e.target.value)} disabled={!live} type="tel" placeholder="Phone" className={field} style={{ ['--tw-ring-color' as any]: `${accentColor}33` }} />
              <textarea value={message} onChange={e => setMessage(e.target.value)} disabled={!live} rows={3} placeholder="What would you like to know?" className={`${field} resize-none sm:col-span-2`} style={{ ['--tw-ring-color' as any]: `${accentColor}33` }} />
            </div>
            {state === 'error' && <p className="mt-2 text-xs font-bold text-red-500">{error}</p>}
            <button type="submit" disabled={!live || state === 'sending'} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60" style={{ backgroundColor: accentColor }}>
              {state === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {live ? 'Send' : 'Live on your published article'}
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  )
}

// The Lead Form block: one of the agent's own forms (What's My Home Worth?, I'm Buying...) as an
// inviting card in the article - tapping it opens that form; its answers land in Leads like any
// other form response.
function LeadFormCard({ data, accentColor, href, onEvent }: { data: any; accentColor: string; href: string | null; onEvent?: BlogArticleBodyProps['onEvent'] }) {
  if (!data.formSlug) {
    return <p className="rounded-2xl border border-dashed border-gray-300 p-4 text-center text-xs font-bold uppercase tracking-wide text-gray-400 dark:border-gray-700">Pick one of your forms for this block.</p>
  }
  const inner = (
    <>
      <div className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full opacity-30 blur-3xl" style={{ background: accentColor }} />
      <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white shadow-lg" style={{ background: accentColor }}><ClipboardList className="h-6 w-6" /></span>
      <span className="relative min-w-0 flex-1">
        <span className="block text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: accentColor }}>Free · about a minute</span>
        <span className="block font-serif text-xl font-black leading-tight text-[#111827] dark:text-white">{data.title || 'Tell me what you need'}</span>
        {data.description && <span className="mt-0.5 block text-sm font-medium leading-snug text-gray-500 dark:text-gray-400">{data.description}</span>}
      </span>
      <span className="relative inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-black text-white shadow-md transition group-hover:-translate-y-0.5" style={{ backgroundColor: accentColor }}>
        {data.label || 'Start'} <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </>
  )
  const cls = 'group relative flex flex-wrap items-center gap-4 overflow-hidden rounded-[24px] border bg-white p-5 shadow-[0_24px_50px_-34px_rgba(0,0,0,.45)] transition hover:-translate-y-0.5 dark:bg-[#151517] sm:flex-nowrap'
  return href
    ? <a href={href} onClick={() => onEvent?.('link_click', { label: `Form: ${data.title}` })} className={cls} style={{ borderColor: `${accentColor}55` }}>{inner}</a>
    : <div className={cls} style={{ borderColor: `${accentColor}55` }}>{inner}</div>
}


// Listing status pill colors on the large property card (MLS strings like "ACTIVE-BRIGHT").
function statusBadgeClass(status?: string | null): string {
  const up = String(status || '').toUpperCase()
  if (up.includes('CLOSED') || up.includes('SOLD')) return 'bg-rose-500 text-white'
  if (up.includes('CONTRACT') || up.includes('PENDING')) return 'bg-amber-500 text-white'
  if (up.includes('COMING SOON')) return 'bg-indigo-500 text-white'
  if (up.includes('ACTIVE') || up.includes('FOR SALE')) return 'bg-emerald-500 text-white'
  return 'bg-white/90 text-[#111827]'
}

// Two sizes: 'compact' is the original small thumbnail-and-address row, 'large' mirrors the fuller
// property presentation from the Agent Forms property integration (full photo, status badge, price
// drop, and a beds/baths/sqft/acres stat row) for posts that want to showcase a listing in depth.
export function PropertyCardDisplay({ property, size = 'compact', onEvent }: { property?: LinkedProperty; size?: 'compact' | 'large'; onEvent?: BlogArticleBodyProps['onEvent'] }) {
  if (!property) return null

  if (size !== 'large') {
    return (
      <button onClick={() => onEvent?.('property_click', { address: property.address })} className="flex w-full items-center gap-3 overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-[#151517]">
        <div className="h-20 w-24 shrink-0 bg-gray-100 dark:bg-gray-800">
          {property.image_url ? <img src={resolveMediaUrl(property.image_url)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Home className="h-5 w-5 text-gray-300" /></div>}
        </div>
        <div className="min-w-0 flex-1 p-2">
          <p className="truncate text-sm font-black text-[#111827] dark:text-white">{property.address}</p>
          <p className="mt-0.5 flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400">
            {property.price ? <span>${Number(property.price).toLocaleString()}</span> : null}
            {property.beds ? <span className="inline-flex items-center gap-0.5"><Bed className="h-3 w-3" />{property.beds}</span> : null}
            {property.baths ? <span className="inline-flex items-center gap-0.5"><Bath className="h-3 w-3" />{property.baths}</span> : null}
            {property.sqft ? <span className="inline-flex items-center gap-0.5"><Maximize className="h-3 w-3" />{Number(property.sqft).toLocaleString()}</span> : null}
          </p>
        </div>
      </button>
    )
  }

  const location = [property.city, property.state].filter(Boolean).join(', ')
  const priceDrop = property.original_price && property.price && property.original_price > property.price ? property.original_price - property.price : 0
  const stats = [
    property.beds ? { icon: Bed, label: `${property.beds} bd` } : null,
    property.baths ? { icon: Bath, label: `${property.baths} ba` } : null,
    property.sqft ? { icon: Maximize, label: `${Number(property.sqft).toLocaleString()} sqft` } : null,
    property.acres ? { icon: LandPlot, label: `${property.acres} ac` } : null,
  ].filter((stat): stat is { icon: typeof Bed; label: string } => Boolean(stat))

  return (
    <button onClick={() => onEvent?.('property_click', { address: property.address })} className="block w-full overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-800 dark:bg-[#151517]">
      <div className="relative h-56 w-full bg-gray-100 dark:bg-gray-800">
        {property.image_url ? <img src={resolveMediaUrl(property.image_url)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Home className="h-8 w-8 text-gray-300" /></div>}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        {property.status && (
          <span className={`absolute left-4 top-4 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest shadow-sm ${statusBadgeClass(property.status)}`}>
            {String(property.status).replace(/-BRIGHT$/i, '')}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 px-5 pb-4 pt-6 text-white">
          <p className="flex items-baseline gap-2 text-2xl font-black leading-none">
            {property.price ? `$${Number(property.price).toLocaleString()}` : 'Price upon request'}
            {priceDrop > 0 && <span className="text-xs font-bold text-emerald-300">${priceDrop.toLocaleString()} drop</span>}
          </p>
          <p className="mt-1.5 truncate text-sm font-bold text-white/90">{property.address}</p>
        </div>
      </div>
      <div className="space-y-3 p-5">
        {location && <p className="flex items-center gap-1.5 text-xs font-bold text-gray-400"><MapPin className="h-3.5 w-3.5" /> {location}</p>}
        {stats.length > 0 && (
          <div className="flex flex-wrap items-center gap-4 text-sm font-bold text-[#111827] dark:text-white">
            {stats.map((stat, i) => (
              <span key={i} className="inline-flex items-center gap-1.5"><stat.icon className="h-4 w-4 text-gray-400" /> {stat.label}</span>
            ))}
          </div>
        )}
      </div>
    </button>
  )
}

function QrBlock({ url, label }: { url?: string; label?: string }) {
  const [dataUrl, setDataUrl] = useState('')
  useEffect(() => {
    if (!url) return
    let cancelled = false
    qrDataUrl(url, { size: 320, margin: 1 }).then(d => { if (!cancelled) setDataUrl(d) }).catch(() => {})
    return () => { cancelled = true }
  }, [url])
  if (!url) return null
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
      {dataUrl && <img src={dataUrl} alt="QR code" className="h-16 w-16" />}
      <p className="text-sm font-black text-[#111827] dark:text-white">{label || 'Scan for more'}</p>
    </div>
  )
}

/** "Explore the neighborhoods" - the article's linked towns as photo cards, each opening the town's
 *  page on the agent's IDX website in a new tab (the article stays open). */
function NeighborhoodLinksRow({ links, accentColor, onOpen }: { links: NeighborhoodLink[]; accentColor: string; onOpen?: (slug: string) => void }) {
  const money = (n?: number | null) => (n ? (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M` : `$${Math.round(n / 1000)}K`) : '')
  return (
    <section className="not-prose my-10 rounded-3xl border border-black/5 bg-[#faf8f3] p-5 dark:border-white/10 dark:bg-white/[0.03] sm:p-6" data-testid="blog-neighborhood-links">
      <p className="text-[10px] font-black uppercase tracking-[0.26em]" style={{ color: accentColor }}>Explore the neighborhoods</p>
      <p className="mt-1 font-serif text-2xl font-black text-[#111827] dark:text-white">{links.length === 1 ? `Living in ${links[0].name}` : 'The towns in this article'}</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Homes for sale, prices, schools and local favorites - opens in a new tab.</p>
      <div className={`mt-4 grid gap-3 ${links.length === 1 ? '' : 'sm:grid-cols-2'}`}>
        {links.map(l => (
          <a key={l.slug} href={l.url} target="_blank" rel="noopener" onClick={() => onOpen?.(l.slug)}
            className="group relative flex h-28 items-end overflow-hidden rounded-2xl text-white no-underline shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
            <span className="absolute inset-0 bg-cover bg-center transition duration-700 group-hover:scale-105" style={{ backgroundImage: l.photo ? `url(${resolveMediaUrl(l.photo)})` : undefined, backgroundColor: '#1f2937' }} />
            <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            <span className="relative flex w-full items-end justify-between gap-3 p-4">
              <span className="min-w-0">
                <span className="block truncate font-serif text-xl font-black">{l.name}</span>
                <span className="block text-xs font-semibold text-white/75">{[l.active_count ? `${l.active_count} homes for sale` : '', l.median_price ? `${money(l.median_price)} median list` : ''].filter(Boolean).join(' · ') || 'Neighborhood guide'}</span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-black">Explore <ExternalLink className="h-3 w-3" /></span>
            </span>
          </a>
        ))}
      </div>
    </section>
  )
}
