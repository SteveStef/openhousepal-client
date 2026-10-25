'use client'

import { formVisitContext, type FormVisitContext } from '@/lib/formTracking'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import FormRunner from '@/components/forms/FormRunner'
import OhpLoader from '@/components/brand/OhpLoader'
import { useFormViewportLock } from '@/components/forms/FormRunnerParts'
import ShowingRequestFlow, { canUseShowingFlow } from '@/components/forms/ShowingRequestFlow'
import { PublicFormConfig } from '@/types'
import api, { API_BASE_URL } from '@/lib/api-service'
import { useForcedLightMode } from '@/lib/useForcedLightMode'
import useHubColorMode from '@/components/agent-hub/useHubColorMode'
import { applyAccentRecolor } from '@/lib/accentRecolor'
import { formLookOf, formPaint, type FormLook } from '@/lib/formLook'

function generateSessionKey() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function resolvePhotoUrl(photoUrl?: string | null) {
  if (!photoUrl) return undefined
  return photoUrl.startsWith('http') ? photoUrl : `${API_BASE_URL}${photoUrl}`
}

function PublicFormBackButton({ fallbackHref }: { fallbackHref: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          window.history.back()
        } else {
          window.location.href = fallbackHref
        }
      }}
      className="absolute left-4 top-4 z-20 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/90 px-3 py-2 text-xs font-black uppercase tracking-wide text-[#111827] shadow-sm transition hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15 sm:left-6 sm:top-6"
    >
      <ArrowLeft className="h-4 w-4" />
      Back
    </button>
  )
}

export default function PublicFormPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string
  const formSlug = params.formSlug as string
  const forceLightMode = searchParams.get('idx_light') === '1'
  const idxReturn = searchParams.get('idx_return')
  const idxFallbackHref = idxReturn || `/${slug}?idx_light=1`
  // Which Campaign this visit came from (a separately-tracked link for the same premade form) -
  // absent/invalid just means General, resolved server-side (forms_service.py).
  const campaignToken = searchParams.get('c')
  // Opened in a window over another page (a signature card's form button): no decorative
  // backdrop (it made the window feel sluggish), and finishing closes the window instead of
  // sending the reader off to the Agent Hub.
  const embedded = searchParams.get('src') === 'signature' || searchParams.get('embed') === '1'
  // prefill_<questionId>=value - what the page that opened this form already knows.
  const prefill = useMemo(() => {
    const out: Record<string, string> = {}
    searchParams.forEach((value, key) => { if (key.startsWith('prefill_') && value) out[key.slice('prefill_'.length)] = value })
    return out
  }, [searchParams])

  const [form, setForm] = useState<PublicFormConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const sessionKeyRef = useRef(generateSessionKey())
  const visitRef = useRef<FormVisitContext | null>(null)
  useForcedLightMode(forceLightMode)
  // ?preview=1: a live preview inside an editor (form Settings, the setup flow) - the editor hands
  // over the look being picked, so it changes the instant a choice is tapped. Not a visit.
  const preview = searchParams.get('preview') === '1'
  const [liveLook, setLiveLook] = useState<FormLook | null>(null)
  useEffect(() => {
    if (!preview) return
    const on = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === 'ohp-form-look') setLiveLook(formLookOf(e.data.look))
    }
    window.addEventListener('message', on)
    return () => window.removeEventListener('message', on)
  }, [preview])
  useEffect(() => {
    if (preview && form) window.parent?.postMessage({ type: 'ohp-form-preview-ready' }, window.location.origin)
  }, [preview, form])
  // The form's look - the Agent Hub's unless the form has its own (resolved by the backend).
  // Every gold class on the page follows its colour / metal (lib/accentRecolor).
  // ?look=luxe-silver-dark / classic-2563EB-light: design review on this computer only.
  const reviewLook = process.env.NODE_ENV !== 'production' ? searchParams.get('look') : null
  const look = useMemo(() => {
    if (!form) return null
    if (liveLook) return liveLook
    const [theme, pick, mode] = (reviewLook || '').split('-')
    if (theme === 'luxe' || theme === 'classic') return formLookOf({ theme, metal: pick, accent: `#${pick}`, dark: mode === 'dark' })
    return formLookOf(form.look, form.darkMode)
  }, [form, reviewLook, liveLook])
  const recolor = look ? formPaint(look).recolor : null
  useEffect(() => (recolor ? applyAccentRecolor(recolor) : undefined), [recolor])
  // The form's own light/dark choice, never the app's: an agent who uses OpenHousePal in dark mode
  // put 'dark' on <html> for this whole browser, turning a light form's text white (user, 10/18).
  useHubColorMode(!!look?.dark, !!form && !forceLightMode)
  // The question pages sit still: the phone's keyboard can't drag the page down (user, 10/24).
  const pinnedRef = useFormViewportLock(!!form && !canUseShowingFlow(form))

  useEffect(() => {
    const fetchForm = async () => {
      setIsLoading(true)
      const { success, data } = await api.public.getPublicForm(slug, formSlug, campaignToken, preview)
      if (success && data) {
        setForm(data)
        setNotFound(false)
      } else {
        setNotFound(true)
      }
      setIsLoading(false)
    }

    if (slug && formSlug) fetchForm()
  }, [slug, formSlug])

  useEffect(() => {
    if (!slug) return
    const isFromQrCode = new URLSearchParams(window.location.search).get('src') === 'qr'
    if (isFromQrCode) api.public.trackAgentHubEvent(slug, 'qr_scan')
  }, [slug])

  if (isLoading) {
    // The house only - a visitor's page never shows the OpenHousePal wordmark.
    return <OhpLoader guest />
  }

  if (notFound || !form) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAF7] px-6 dark:bg-[#0B0B0B]">
        <div className="max-w-sm text-center">
          <h1 className="font-serif text-2xl font-black text-[#0B0B0B] dark:text-white">This form isn't available</h1>
          <p className="mt-3 text-sm font-medium text-[#5f6673] dark:text-gray-300">
            The link may be outdated, or this form has been turned off. Please check with your agent for the latest link.
          </p>
        </div>
      </div>
    )
  }

  const trackProgress = (stepIndex: number, questionId: string | null, completed?: boolean, answers?: Record<string, unknown>) => {
    if (preview) return
    visitRef.current = visitRef.current || formVisitContext()
    api.public.trackFormProgress(slug, formSlug, { sessionKey: sessionKeyRef.current, stepIndex, questionId, completed, campaignToken, answers, ...visitRef.current }).catch(() => {})
  }

  // Schedule a Showing: find the home, then the Showcase's tour window + Pending/Confirmed status.
  const dark = !!look?.dark && !forceLightMode
  const pageBg = look?.theme === 'luxe' ? (dark ? 'dark bg-[#0c0c0e]' : 'bg-[#fffdf8]') : dark ? 'dark bg-[#0B0B0B]' : 'bg-[#FAFAF7]'
  const shownLook = look && forceLightMode ? { ...look, dark: false } : look

  if (canUseShowingFlow(form)) {
    return (
      <div className={`relative ${forceLightMode ? 'ohp-force-light' : ''} ${pageBg} min-h-screen`}>
        {forceLightMode && <PublicFormBackButton fallbackHref={idxFallbackHref} />}
        <ShowingRequestFlow
          form={{ ...form, agentPhotoUrl: resolvePhotoUrl(form.agentPhotoUrl), showBranding: forceLightMode ? false : form.showBranding }}
          agentSlug={slug}
          formSlug={formSlug}
          look={shownLook}
          prefillAddress={prefill.property_of_interest}
          prefillName={prefill.full_name || prefill.name}
          prefillEmail={prefill.email}
          onProgress={trackProgress}
          onComplete={embedded ? () => { try { window.parent?.postMessage({ type: 'ohp-form-complete' }, '*') } catch { /* no host */ } } : undefined}
          onSubmitAnswers={async answers => {
            const { success, data, error } = await api.public.submitPublicForm(slug, formSlug, answers, { sessionKey: sessionKeyRef.current, campaignToken })
            return success && data ? data : { success: false, message: error }
          }}
        />
      </div>
    )
  }

  return (
    <div ref={pinnedRef} className={`fixed inset-x-0 top-0 ${forceLightMode ? 'ohp-force-light' : ''} ${pageBg} h-[100dvh]`}>
      {forceLightMode && <PublicFormBackButton fallbackHref={idxFallbackHref} />}
      <FormRunner
        formId={form.formId}
        questions={form.questions}
        linkedProperty={form.linkedProperty}
        propertyPhotoCarousel={form.propertyPhotoCarousel}
        backgroundEffects={!embedded && form.backgroundEffects !== false}
        welcomeTextEffects={form.welcomeTextEffects !== false}
        brandingLayout={form.brandingLayout}
        branding={{
          title: form.headline || form.title,
          subtitle: form.subtitle,
          accentColor: form.accentColor,
          showBranding: forceLightMode ? false : form.showBranding,
          agentName: form.agentName,
          agentBrokerage: form.agentBrokerage,
          agentPhotoUrl: resolvePhotoUrl(form.agentPhotoUrl),
          agentTitle: form.agentTitle,
          agentMarket: form.agentMarket,
          agentState: form.agentState,
        }}
        successHeading={form.successHeading}
        successMessage={form.successMessage}
        agentHubRedirect={embedded ? null : forceLightMode ? { enabled: true, url: idxFallbackHref } : {
          // a campaign link can send people elsewhere after submitting (its own after-submit choice)
          enabled: form.afterSubmitMode === 'none' ? false : form.redirectToAgentHub,
          url: form.afterSubmitMode === 'custom' && form.afterSubmitUrl ? form.afterSubmitUrl : form.afterSubmitMode === 'sales' ? `/${slug}/sales` : `/${slug}`,
        }}
        prefill={prefill}
        onComplete={embedded ? () => { try { window.parent?.postMessage({ type: 'ohp-form-complete' }, '*') } catch { /* no host */ } } : undefined}
        redirectDelayMs={forceLightMode ? 3000 : undefined}
        redirectTarget={forceLightMode && idxReturn ? '_top' : '_self'}
        forceLightMode={forceLightMode}
        showcasePreview={form.formType === 'showcase_request'}
        exampleProperties={form.exampleProperties}
        look={shownLook}
        onProgress={trackProgress}
        onSubmit={async answers => {
          const { success, data, error } = await api.public.submitPublicForm(slug, formSlug, answers, { sessionKey: sessionKeyRef.current, campaignToken })
          if (success && data) return forceLightMode ? { ...data, redirectUrl: undefined } : data
          return { success: false, message: error }
        }}
      />
    </div>
  )
}
