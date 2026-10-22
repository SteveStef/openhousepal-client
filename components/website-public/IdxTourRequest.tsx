'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ScheduleTourModal from '@/components/ScheduleTourModal'
import TourStatusWindow from '@/components/TourStatusWindow'
import FormWindow from '@/components/forms/FormWindow'
import { canUseShowingFlow } from '@/components/forms/ShowingRequestFlow'
import api, { resolveMediaUrl } from '@/lib/api-service'
import { applyAccentRecolor } from '@/lib/accentRecolor'
import { formVisitContext, type FormVisitContext } from '@/lib/formTracking'
import { openHousePalPublicUrl } from '@/lib/publicResourceLinks'
import { readVisitor } from '@/lib/visitor'
import type { Property, PublicFormConfig, ShowingStatus, TourRequest } from '@/types'

// "Request a tour" on an IDX property page, native on the page (user, 10/22 - "tour requests should
// use the gorgeous new tour flow"): the same animated times window the agent's Schedule a Showing
// form opens (ScheduleTourModal - a bottom sheet on phones, the agent's calendar busy times crossed
// out), sent through the very same public form submission as that form (lead, emails, Forms ->
// Results, Pending status), then the same Pending window. The request is remembered under the same
// device key the form page uses (ohp-showings:<formId>), so opening the agent's form link later
// shows it too. A showing form the agent gave extra questions can't be answered here - that one
// still opens in the form window.

export type TourHome = {
  fullAddress: string
  street: string
  city?: string | null
  state?: string | null
  zip?: string | null
  photo?: string | null
  price?: number | null
  beds?: number | null
  baths?: number | null
  sqft?: number | null
  listingKey?: string | null
}

const storeKey = (formId: string) => `ohp-showings:${formId}`
const readIds = (formId: string): string[] => {
  try { const v = JSON.parse(localStorage.getItem(storeKey(formId)) || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [] } catch { return [] }
}
const writeIds = (formId: string, ids: string[]) => {
  try { localStorage.setItem(storeKey(formId), JSON.stringify(ids.slice(0, 10))) } catch { /* private mode */ }
}
const newSessionKey = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)
const titleCase = (v?: string | null) => {
  const t = String(v || '').trim()
  return t && t === t.toUpperCase() ? t.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, a, c) => a + c.toUpperCase()) : t
}

// The form's settings, fetched once per page (it counts as a visit to the form, like opening it did).
const configs = new Map<string, Promise<PublicFormConfig | null>>()
function loadConfig(hub: string, form: string) {
  const key = `${hub}/${form}`
  let p = configs.get(key)
  if (!p) {
    p = api.public.getPublicForm(hub, form).then(r => (r.success && r.data ? r.data : null)).catch(() => null)
    p.then(v => { if (!v) configs.delete(key) })
    configs.set(key, p)
  }
  return p
}

export default function IdxTourRequest({ open, onClose, hubSlug, formSlug, formId, home, accent, agentName }: {
  open: boolean
  onClose: () => void
  hubSlug: string
  formSlug: string
  /** The showing form's id, when the page knows it (remembers the request on this device). */
  formId?: string | null
  home: TourHome
  /** The site's accent - the window's golds are re-tinted to it while it's open. */
  accent?: string | null
  agentName?: string | null
}) {
  const [mode, setMode] = useState<'tour' | 'iframe' | null>(null)
  const [status, setStatus] = useState<ShowingStatus | null>(null)
  const sessionKey = useRef(newSessionKey())
  const visit = useRef<FormVisitContext | null>(null)
  const sentId = useRef<string | null>(null)
  const config = useRef<PublicFormConfig | null>(null)

  const track = useCallback((stepIndex: number, questionId: string | null, completed = false, answers?: Record<string, unknown>) => {
    visit.current = visit.current || formVisitContext(true)
    api.public.trackFormProgress(hubSlug, formSlug, { sessionKey: sessionKey.current, stepIndex, questionId, completed, answers, ...visit.current }).catch(() => {})
  }, [hubSlug, formSlug])

  // Opened: the times window straight away (the home is known), the form's settings alongside.
  useEffect(() => {
    if (!open) return
    sessionKey.current = newSessionKey()
    setMode('tour')
    let alive = true
    loadConfig(hubSlug, formSlug).then(cfg => {
      if (!alive) return
      config.current = cfg
      if (cfg && !canUseShowingFlow(cfg)) { setMode('iframe'); return }
      track(0, null)
      track(1, 'property_of_interest', false, { property_of_interest: home.fullAddress })
    })
    return () => { alive = false }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // While anything is up: the window wears the site's colour, and the site's dark mode.
  const showing = mode === 'tour' || !!status
  useEffect(() => {
    if (!showing) return
    const stopColor = accent ? applyAccentRecolor(accent) : () => {}
    const html = document.documentElement
    const dark = document.getElementById('ohp-site-shell')?.getAttribute('data-mode') === 'dark'
    const hadDark = html.classList.contains('dark')
    if (dark && !hadDark) html.classList.add('dark')
    return () => { stopColor(); if (dark && !hadDark) html.classList.remove('dark') }
  }, [showing, accent])

  const property = useMemo(() => ({
    id: home.listingKey || 'idx', ListingKey: home.listingKey || '', FullStreetAddress: home.street,
    City: titleCase(home.city), StateOrProvince: home.state || '', PostalCode: home.zip || '', MlsStatus: 'Active',
    ListPictureURL: home.photo || undefined, BedroomsTotal: home.beds || undefined, BathroomsTotal: home.baths || undefined,
    LivingArea: home.sqft || undefined, ListPrice: home.price || undefined,
  } as unknown as Property), [home])

  const submit = async (d: TourRequest) => {
    const answers = [
      { questionId: 'property_of_interest', value: home.fullAddress },
      { questionId: 'property_listing_key', value: home.listingKey || '' },
      { questionId: 'preferred_date_1', value: d.preferredDate },
      { questionId: 'preferred_time_1', value: d.preferredTime },
      { questionId: 'preferred_date_2', value: d.preferredDate2 || '' },
      { questionId: 'preferred_time_2', value: d.preferredTime2 || '' },
      { questionId: 'preferred_date_3', value: d.preferredDate3 || '' },
      { questionId: 'preferred_time_3', value: d.preferredTime3 || '' },
      { questionId: 'full_name', value: d.visitorName || '' },
      { questionId: 'email', value: d.visitorContact || '' },
      { questionId: 'phone', value: d.visitorPhone || '' },
      { questionId: 'showing_note', value: d.message || '' },
    ].filter(a => a.value !== '')
    const { success, data, error } = await api.public.submitPublicForm(hubSlug, formSlug, answers, { sessionKey: sessionKey.current })
    if (!success || !data?.success) throw new Error(data?.message || error || 'That didn’t go through - please try again.')
    track(3, 'contact_info', true, Object.fromEntries(answers.map(a => [a.questionId, a.value])))
    const id = formId || config.current?.formId
    if (data.submissionId) {
      sentId.current = data.submissionId
      if (id) writeIds(id, [data.submissionId, ...readIds(id).filter(x => x !== data.submissionId)])
    }
  }

  const closeTour = () => {
    setMode(null)
    const id = sentId.current
    sentId.current = null
    if (!id) { onClose(); return }
    // The "sent" moment hands off to the same Pending window the form page shows.
    window.setTimeout(async () => {
      const r = await api.public.getShowingStatus(hubSlug, formSlug, id)
      if (r.success && r.data) setStatus(r.data)
      else onClose()
    }, 320)
  }

  const closeStatus = () => { setStatus(null); onClose() }
  const requestAnother = () => { setStatus(null); sessionKey.current = newSessionKey(); setMode('tour') }

  const statusHome = useMemo(() => status ? {
    photo: status.home.photo ? resolveMediaUrl(status.home.photo) || status.home.photo : null,
    street: titleCase(status.home.street || status.home.address.split(',')[0]),
    place: [titleCase(status.home.city), [status.home.state, status.home.zipcode].filter(Boolean).join(' ')].filter(Boolean).join(', '),
  } : null, [status])

  const visitor = typeof window !== 'undefined' ? readVisitor() : null

  return (
    <>
      <ScheduleTourModal
        property={property}
        isOpen={mode === 'tour'}
        onClose={closeTour}
        onSubmit={submit}
        showContactFields
        contactStyle="full"
        initialName={visitor?.name || ''}
        initialContact={visitor?.email || ''}
        // Only times the agent is free (their connected calendar).
        loadBusy={() => api.public.getHubBusy(hubSlug)}
      />
      <TourStatusWindow
        tour={status}
        address={statusHome?.street}
        agentName={agentName || config.current?.agentName}
        home={statusHome}
        onClose={closeStatus}
        onRequestAnother={requestAnother}
      />
      <FormWindow
        url={mode === 'iframe' ? openHousePalPublicUrl(`/${hubSlug}/${formSlug}`) : null}
        title="Request a tour"
        prefill={{ property_of_interest: home.fullAddress }}
        onClose={() => { setMode(null); onClose() }}
      />
    </>
  )
}
