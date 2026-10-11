'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, CalendarDays, MessageSquare, Phone, Sparkles } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/api-service'
import { openHousePalPublicUrl } from '@/lib/publicResourceLinks'
import { visitSource } from '@/lib/visitSource'
import FormWindow from '@/components/forms/FormWindow'
import {
  AboutHome, AgentPanel, AskForm, ShowingPicker, BrightNotice, EveryDetail, LocationBlock, OpenHouseList,
  PhoneBar, PriceHistory, HERO_COLS, HeroShareActions, PropertyHero, PropertySurface, SectionDivider, SectionTitle, hasDetails, homeFromIdx, pp,
} from '@/components/property/PropertyKit'
import PropertyLocationMap from './PropertyLocationMap'
import PaymentCalculator from './PaymentCalculator'
import { fontClass } from './blocks/fontClass'
import type { SiteTheme } from './types'

// The IDX site's property page, built from the shared property design (components/property/
// PropertyKit) in the site's own theme. The photos and the address | price summary sit beside the
// agent's card, so the price and "Request a tour" show without scrolling. Its own extras: the
// breadcrumb, "Request a tour" opening the agent's showing form in a window with this address
// filled in, Call/Text, the "get homes like this first" Showcase invite, the quick Ask-a-question
// box (a lead + follow-up for the agent), the town's neighborhood guide, Explore Nearby and
// Similar homes. The agent's own listing with a published Spotlight never lands here - the
// server sends it to the Spotlight instead.

export type IdxProperty = Record<string, any> & { listing_key: string }

// The HOA fee as a monthly number, from the listing record's fee + how often it's charged.
function hoaMonthly(report?: Record<string, any> | null): number | null {
  const fee = Number(report?.AssociationFee)
  if (!fee || fee <= 0) return null
  const f = String(report?.AssociationFeeFrequency || 'Monthly').toLowerCase()
  if (f.startsWith('annual') || f.startsWith('year')) return fee / 12
  if (f.startsWith('semi')) return fee / 6
  if (f.startsWith('quarter')) return fee / 3
  return fee
}

export default function IdxPropertyPage({ p, theme, basePrefix, siteId, agent, showing, matchedArea, nearby, similar }: {
  p: IdxProperty
  theme: SiteTheme
  basePrefix: string
  siteId?: string
  agent?: { name?: string | null; title?: string | null; brokerage?: string | null; photo_url?: string | null; phone?: string | null; text_phone?: string | null; email?: string | null } | null
  /** The agent's showing form on OpenHousePal ("/{hubSlug}/{formSlug}") - opens in a window. */
  showing?: { path: string; questionId?: string } | null
  matchedArea?: { slug: string; name: string } | null
  nearby?: ReactNode
  similar?: ReactNode
}) {
  const home = useMemo(() => homeFromIdx(p, { photo: u => resolveMediaUrl(u) || u }), [p])
  const serif = fontClass(theme.heading_font, 'font-serif')
  const agentTel = agent?.phone ? String(agent.phone).replace(/[^\d+]/g, '') : ''
  const agentTextTel = String(agent?.text_phone || agent?.phone || '').replace(/[^\d+]/g, '')
  const agentFirst = (agent?.name || '').split(' ')[0]
  const agentPhoto = agent?.photo_url ? resolveMediaUrl(agent.photo_url) : null

  const [tourOpen, setTourOpen] = useState(false)
  const tourUrl = showing ? openHousePalPublicUrl(showing.path) : null
  const requestTour = () => { if (tourUrl) setTourOpen(true); else window.location.assign(`${basePrefix}/contact`) }

  // Where they came from (Google, a shared link...) - sent with their question.
  const scope = `idx:${p.listing_key}`
  useEffect(() => { visitSource(scope) }, [scope])
  const ask = async (v: { name: string; email: string; phone: string; message: string }) => {
    if (!siteId) return false
    const res = await fetch(`/api/website-properties/${encodeURIComponent(siteId)}/${encodeURIComponent(p.listing_key)}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...v, address: home.fullAddress, came_from: visitSource(scope) }),
    })
    return res.ok
  }
  const toAsk = () => document.getElementById('idx-ask')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  const comingSoonNoDate = /coming\s*soon/i.test(home.status || '') && !(p.expected_on_market_date && new Date(`${String(p.expected_on_market_date).slice(0, 10)}T12:00:00`).getTime() >= Date.now() - 86400000)


  return (
    <PropertySurface surface="site" gold={theme.secondary_color} ink={theme.primary_color} serif={serif}>
      <main className="relative pb-24 lg:pb-0">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[620px]" style={{ background: 'radial-gradient(70% 60% at 85% 0%, var(--pp-gold-wash), transparent 70%)' }} />

        <div className="relative mx-auto max-w-7xl px-5 pt-5 sm:px-8 sm:pt-6">
          <nav className={`mb-4 flex flex-wrap items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] ${pp.faint}`}>
            <a href={`${basePrefix}/`} className="transition hover:text-[color:var(--pp-heading)]">Home</a><span>/</span>
            <a href={`${basePrefix}/search`} className="transition hover:text-[color:var(--pp-heading)]">Search</a>
            {matchedArea && (<><span>/</span><a href={`${basePrefix}/${matchedArea.slug}`} className="transition hover:text-[color:var(--pp-heading)]">{matchedArea.name}</a></>)}
            <span>/</span><span className={pp.muted}>{home.street}</span>
          </nav>

          {/* The photos take the whole top. Under them: the summary, with the agent's card riding beside it
              all on desktop (phones: summary, the card, then the rest). */}
          <PropertyHero home={home} actions={<HeroShareActions home={home} />} />
          <div className={`mt-9 grid gap-x-6 gap-y-6 ${HERO_COLS}`}>
            <aside className="lg:col-start-2 lg:row-start-1">
              <div className="pp-stick space-y-4">
                <AgentPanel kicker="" backdrop={home.photos[0]} agent={agent?.name ? { name: agent.name, photo: agentPhoto, line: [agent.title, agent.brokerage].filter(Boolean).join(' · ') } : null}>
                  <ShowingPicker onOpen={requestTour} status={home.status} onAsk={toAsk} availableFrom={p.expected_on_market_date} />
                  <div className="mt-2 space-y-2">
                    {agentTel && (
                      <div className="grid grid-cols-2 gap-2">
                        <a href={`tel:${agentTel}`} className={pp.smallBtn}><Phone className="h-3.5 w-3.5" />Call</a>
                        <a href={`sms:${agentTextTel}?&body=${encodeURIComponent(`Hi ${agentFirst}, I'm interested in ${home.street}.`)}`} className={pp.smallBtn}><MessageSquare className="h-3.5 w-3.5" />Text</a>
                      </div>
                    )}
                  </div>
                  <OpenHouseList home={home} />
                  <AskForm
                    embedded
                    id="idx-ask"
                  title="Ask a quick question"
                  sub={`Straight to ${agentFirst || 'the agent'}, with this home attached. A phone or an email is enough.`}
                  agentFirst={agentFirst}
                  onSend={ask}
                />
                </AgentPanel>

                <a href={`${basePrefix}/create-showcase?site_chrome=1`} className={`group flex items-center gap-3 p-4 transition hover:-translate-y-0.5 ${pp.card}`}>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--pp-ink)] text-[color:var(--pp-gold)]"><Sparkles className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-base font-black leading-tight ${pp.heading} ${serif}`}>Get homes like this first</span>
                    <span className={`block text-xs font-semibold ${pp.muted}`}>Your own Showcase - new matches the moment they list.</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[color:var(--pp-gold)] transition-transform group-hover:translate-x-0.5" />
                </a>


              </div>
            </aside>

            <div className="min-w-0 lg:col-start-1 lg:row-start-1">

              <section id="overview" className="scroll-mt-40 pt-2">
                <SectionTitle kicker="Overview" title="About this home" />
                <AboutHome home={home} />
              </section>

              {hasDetails(home) && (
                <section id="details" className="scroll-mt-40">
                  <SectionDivider />
                  <SectionTitle kicker="Details" title="Every detail" sub="Straight from the listing record." />
                  <EveryDetail home={home} />
                </section>
              )}

              {home.price != null && (
                <section id="price" className="scroll-mt-40">
                  <SectionDivider />
                  <SectionTitle kicker="Price" title="Price history" />
                  <div className="mt-6"><PriceHistory home={home} events={p.price_history || []} /></div>
                </section>
              )}

              {home.price != null && home.price > 0 && !/closed|sold/i.test(home.status || '') && (
                <section id="payment" className="scroll-mt-40">
                  <SectionDivider />
                  <SectionTitle kicker="Affordability" title="Your monthly payment" sub="Move the sliders - taxes are this home's real numbers." />
                  <PaymentCalculator price={home.price} annualTaxes={Number(p.report?.TaxAnnualAmount) || null} hoaMonthly={hoaMonthly(p.report)} address={home.fullAddress} basePrefix={basePrefix} serif={serif} />
                </section>
              )}

              {home.lat != null && home.lng != null && (
                <section id="location" className="scroll-mt-40">
                  <SectionDivider />
                  <SectionTitle kicker="Location" title="On the map" sub={home.fullAddress || undefined} />
                  <LocationBlock home={home} map={<PropertyLocationMap latitude={home.lat} longitude={home.lng} address={p.address || ''} theme={theme} />}>
                    {matchedArea && (
                      <a href={`${basePrefix}/${matchedArea.slug}`} className="group mt-4 flex items-center justify-between gap-3 rounded-[22px] bg-[var(--pp-ink)] p-5 text-white shadow-[0_24px_50px_-30px_rgba(0,0,0,.6)] transition hover:-translate-y-0.5">
                        <span>
                          <span className="block text-[10px] font-black uppercase tracking-[0.26em] text-[color:var(--pp-gold)]">Neighborhood guide</span>
                          <span className={`mt-0.5 block text-xl font-black ${serif}`}>Living in {matchedArea.name}</span>
                          <span className="block text-xs font-semibold text-white/55">Homes for sale, schools, market numbers and local favorites.</span>
                        </span>
                        <ArrowRight className="h-5 w-5 shrink-0 text-[color:var(--pp-gold)] transition-transform group-hover:translate-x-1" />
                      </a>
                    )}
                  </LocationBlock>
                </section>
              )}
            </div>
          </div>

          {nearby && <div className="-mx-5 mt-16 sm:-mx-8">{nearby}</div>}

          {similar && (
            <section id="similar" className="scroll-mt-40">
                  <SectionDivider />
              <SectionTitle kicker="You may also like" title="Similar homes" />
              <div className="mt-7">{similar}</div>
            </section>
          )}

          {/* The full IDX notice is the site's MLS footer right under this page. */}
          <BrightNotice home={home} short />
        </div>

        <PhoneBar photo={agentPhoto}>
          {/* Coming Soon with no on-market date yet: no showing requests (Bright) - the question box instead */}
          {comingSoonNoDate
            ? <button type="button" onClick={toAsk} className="flex-1 rounded-xl bg-[var(--pp-gold)] py-3 text-center text-[11px] font-black uppercase tracking-widest text-[color:var(--pp-ink)]">Notify me</button>
            : <button type="button" onClick={requestTour} className="flex-1 rounded-xl bg-[var(--pp-gold)] py-3 text-center text-[11px] font-black uppercase tracking-widest text-[color:var(--pp-ink)]">Request a tour</button>}
          <button type="button" onClick={toAsk} className="rounded-xl border border-white/20 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-white">Ask</button>
          {agentTel && <a href={`tel:${agentTel}`} aria-label="Call" className="rounded-xl border border-white/20 px-3 py-3 text-white"><Phone className="h-4 w-4" /></a>}
        </PhoneBar>

        <FormWindow url={tourOpen ? tourUrl : null} title="Request a tour" prefill={showing?.questionId ? { [showing.questionId]: home.fullAddress } : { property_of_interest: home.fullAddress }} onClose={() => setTourOpen(false)} />
      </main>
    </PropertySurface>
  )
}
