'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { PropertyDetailResponse, TourRequest } from '@/types'
import api from '@/lib/api-service'
import { Info, ArrowLeft, CalendarDays } from 'lucide-react'
import Link from 'next/link'
import ScheduleTourModal from '@/components/ScheduleTourModal'
import MLSComplianceFooter from '@/components/MLSComplianceFooter'
import PropertyMap from '@/components/PropertyMap'
import {
  AboutHome, AgentPanel, AskForm, ShowingPicker, BrightNotice, EveryDetail, LocationBlock, PhoneBar,
  PriceHistory, HERO_COLS, HeroShareActions, PropertyHero, PropertySurface, SectionDivider, SectionTitle, hasDetails, homeFromMls, pp,
} from '@/components/property/PropertyKit'
import { useToast } from '@/contexts/ToastContext'
import { normalizeImageUrl } from '@/lib/utils'
import { visitSource, type CameFrom } from '@/lib/visitSource'
import OhpLoader from '@/components/brand/OhpLoader'

export interface PropertyDetailViewProps {
  propertyId: string
  agentId: string
  // ?action= on the public page: "tour" opens the tour form, "disclosure" starts a message.
  initialAction?: string | null
  // Their name + email/phone, already known (a Guest Pass) - the message + tour forms start filled.
  prefill?: { name: string; contact: string }
  // Where they came from, when the page itself knows (a Guest Pass) instead of the link's ?src=.
  cameFrom?: CameFrom
  // Shown as a back button above the photos (a Guest Pass going back to its Similar Homes).
  onBack?: () => void
  backLabel?: string
  hideFooter?: boolean
}

const GOLD = '#C9A24D'
const INK = '#111827'

// The Listing Page - where one home opens from a Similar Homes QR, an Agent Hub listing card, the
// email signature's featured listing, or a Guest Pass (embedded). Built from the shared property
// design (components/property/PropertyKit) in the app's ivory and gold. Its own extras: "Presented
// by" the agent, Schedule a showing (the tour form, prefilled on a Guest Pass), the message form
// (?action=disclosure starts a seller-disclosure request in it), where the visitor came from sent
// with both, the Guest Pass back button, and the phone action bar + MLS footer when it's a page.
// app/property/[propertyId]/[agentId] is the public page.
export default function PropertyDetailView({ propertyId, agentId, initialAction, prefill, cameFrom, onBack, backLabel, hideFooter }: PropertyDetailViewProps) {
  const [property, setProperty] = useState<PropertyDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isTourModalOpen, setIsTourModalOpen] = useState(false)
  // ?action=disclosure starts their question as a seller-disclosure request.
  const [askMessage, setAskMessage] = useState('')

  const { showToast } = useToast()
  // Where they came from (e.g. the QR under this home on an open house's Similar Homes sheet) -
  // captured on arrival, sent with the tour request / message.
  const sourceScope = `listing:${propertyId}`
  useEffect(() => { if (!cameFrom) visitSource(sourceScope) }, [sourceScope, cameFrom])
  const came = () => cameFrom || visitSource(sourceScope)

  // The showing window shows its own "sent" moment and closes itself; a failure is thrown back to
  // it so it can say so and stay open.
  async function handleTourSubmit(data: TourRequest) {
    const { success, error } = await api.properties.scheduleTour({ ...data, agentId, cameFrom: came() })
    if (!success) throw new Error(error || 'That didn’t go through - please try again.')
  }

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        setLoading(true)
        const { success, data, error: apiError } = await api.properties.getPropertyForAgent(propertyId, agentId)
        if (success && data) setProperty(data)
        else setError(apiError || 'Property not found')
      } catch (err) {
        setError('An unexpected error occurred')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    if (propertyId && agentId) fetchProperty()
  }, [propertyId, agentId])

  useEffect(() => {
    if (!property) return
    if (initialAction === 'tour') setIsTourModalOpen(true)
    if (initialAction === 'disclosure') {
      setAskMessage(`Hi, I would like to request the seller disclosure for ${property.FullStreetAddress}.`)
      setTimeout(() => document.getElementById('property-message-agent')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
    }
  }, [property, initialAction])

  // The agent's own listing with a published Listing Spotlight: the Spotlight IS its page. (Not when
  // it's shown inside a Guest Pass - that page has its own way to the Spotlight.)
  const embedded = !!onBack || !!hideFooter
  useEffect(() => {
    if (property?.spotlightUrl && !embedded) window.location.replace(property.spotlightUrl)
  }, [property?.spotlightUrl, embedded])

  const home = useMemo(() => (property ? homeFromMls(property, { photo: u => normalizeImageUrl(u) || u }) : null), [property])

  const sendQuestion = async (v: { name: string; email: string; phone: string; message: string }) => {
    if (!property) return false
    try {
      const { success, error } = await api.properties.sendMessageToAgent({
        agentId,
        propertyId,
        propertyAddress: property.FullStreetAddress,
        visitorName: v.name,
        visitorContact: v.email || v.phone,
        visitorPhone: v.phone || undefined,
        message: v.message,
        cameFrom: came(),
      })
      if (!success) console.error('Message failed:', error)
      return !!success
    } catch (err) {
      console.error('Error sending message:', err)
      return false
    }
  }

  const scrollToMessage = () => document.getElementById('property-message-agent')?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center bg-[#faf9f7] dark:bg-[#0B0B0B]">
        <OhpLoader guest fullScreen={false} className="!py-0" label="Opening the home" />
      </div>
    )
  }

  if (property?.spotlightUrl && !embedded) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center bg-[#faf9f7] dark:bg-[#0B0B0B]">
        <OhpLoader guest fullScreen={false} className="!py-0" />
      </div>
    )
  }

  if (error || !property || !home) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center bg-[#faf9f7] p-4 dark:bg-[#0B0B0B]">
        <div className="w-full max-w-md rounded-3xl border border-[#C9A24D]/25 bg-white p-10 text-center shadow-[0_24px_50px_-34px_rgba(139,115,85,.55)] dark:border-white/[0.08] dark:bg-[#151517]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#C9A24D]/10 text-[#8b7355]"><Info size={28} /></div>
          <h2 className="mt-5 font-serif text-2xl font-black text-[#111827] dark:text-white">Listing not found</h2>
          <p className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-400">{error || 'This property is no longer available or the link is invalid.'}</p>
          <Link href="/" className="mt-7 inline-flex items-center justify-center rounded-full bg-[#111827] px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-black dark:bg-white dark:text-[#111827]">Return home</Link>
        </div>
      </div>
    )
  }

  const agentName = property.agentName || ''
  const agentFirst = agentName.split(' ')[0]
  const agentPhoto = property.agentPhotoUrl ? normalizeImageUrl(property.agentPhotoUrl) : null

  const prefillContact = (prefill?.contact || '').trim()
  return (
    <PropertySurface surface="app" gold={GOLD} ink={INK} className="relative min-h-screen flex-1 bg-[var(--pp-bg)] transition-colors duration-300">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[560px]" style={{ background: 'radial-gradient(70% 60% at 85% 0%, var(--pp-gold-wash), transparent 70%)' }} />
      <div className={`relative mx-auto max-w-7xl px-5 pt-5 sm:px-8 sm:pt-7 ${hideFooter ? 'pb-10' : 'pb-28 lg:pb-14'}`}>
        {onBack && (
          <button type="button" onClick={onBack} className={`group mb-4 inline-flex items-center gap-2 rounded-full border border-[color:var(--pp-gold-line)] bg-[var(--pp-card)] px-4 py-2 text-xs font-black uppercase tracking-widest shadow-sm transition hover:border-[color:var(--pp-gold)] ${pp.heading}`}>
            <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
            {backLabel || 'Back'}
          </button>
        )}

        {/* The photos take the whole top. Under them: the summary, with the agent's card + question box
            riding beside it all on desktop (phones: summary, those, then the rest). */}
        <PropertyHero home={home} actions={<HeroShareActions home={home} />} />
        <div className={`mt-9 grid gap-x-6 gap-y-6 ${HERO_COLS}`}>
          <aside className="lg:col-start-2 lg:row-start-1">
            <div className="pp-stick space-y-4">
              <AgentPanel kicker="" backdrop={home.photos[0]} agent={agentName ? { name: agentName, photo: agentPhoto, line: property.agentBrokerage || null } : null}>
                <ShowingPicker onOpen={() => setIsTourModalOpen(true)} status={home.status} onAsk={scrollToMessage} availableFrom={(property as any)?.expectedOnMarketDate} />
              <AskForm
                embedded
                id="property-message-agent"
                title={agentName ? `Ask ${agentFirst} a question` : 'Ask a quick question'}
                sub={`Straight to ${agentFirst || 'the agent'}, with this home attached. A phone or an email is enough.`}
                agentFirst={agentFirst}
                initial={{
                  name: prefill?.name,
                  email: prefillContact.includes('@') ? prefillContact : '',
                  phone: prefillContact && !prefillContact.includes('@') ? prefillContact : '',
                  message: askMessage,
                }}
                onSend={sendQuestion}
              />
              </AgentPanel>
            </div>
          </aside>

          <div className="min-w-0 lg:col-start-1 lg:row-start-1">

            <section id="lp-overview" className="scroll-mt-24 pt-2">
              <SectionTitle kicker="Overview" title={home.street ? `Welcome to ${home.street}` : 'About this home'} />
              <AboutHome home={home} />
            </section>

            {hasDetails(home) && (
              <section id="lp-details" className="scroll-mt-24">
                  <SectionDivider />
                <SectionTitle kicker="Details" title="Every detail" sub="Straight from the listing record." />
                <EveryDetail home={home} />
              </section>
            )}

            {home.price != null && (
              <section id="lp-price" className="scroll-mt-24">
                  <SectionDivider />
                <SectionTitle kicker="Price" title="Price history" />
                <div className="mt-6"><PriceHistory home={home} events={(property as any)?.priceHistory || []} /></div>
              </section>
            )}

            {home.lat != null && home.lng != null && (
              <section id="lp-location" className="scroll-mt-24">
                  <SectionDivider />
                <SectionTitle kicker="Location" title="On the map" sub={home.fullAddress || undefined} />
                <LocationBlock home={home} map={<PropertyMap latitude={home.lat} longitude={home.lng} address={property.FullStreetAddress} />} />
              </section>
            )}
          </div>
        </div>

        {/* Embedded (a Guest Pass) there's no MLS footer under the page, so the full notice shows here. */}
        <BrightNotice home={home} updatedAt={property.updated_at} short={!hideFooter} />
      </div>

      {!hideFooter && (
        <PhoneBar photo={agentPhoto}>
          <button type="button" onClick={() => setIsTourModalOpen(true)} className="flex-1 rounded-xl bg-[var(--pp-gold)] py-3 text-center text-[11px] font-black uppercase tracking-widest text-[color:var(--pp-ink)]">Schedule a showing</button>
          <button type="button" onClick={scrollToMessage} className="rounded-xl border border-white/20 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-white">Ask</button>
        </PhoneBar>
      )}

      {!hideFooter && <div className="bg-[#0B0B0B] pb-[84px] lg:pb-0"><MLSComplianceFooter /></div>}

      <ScheduleTourModal
        isOpen={isTourModalOpen}
        onClose={() => setIsTourModalOpen(false)}
        property={property}
        onSubmit={handleTourSubmit}
        loadBusy={() => api.properties.getAgentBusy(agentId)}
        showContactFields={true}
        initialName={prefill?.name}
        initialContact={prefill?.contact}
      />
    </PropertySurface>
  )
}
