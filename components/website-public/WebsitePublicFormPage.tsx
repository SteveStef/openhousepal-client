'use client'

import { formVisitContext, type FormVisitContext } from '@/lib/formTracking'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import FormRunner from '@/components/forms/FormRunner'
import OhpLoader from '@/components/brand/OhpLoader'
import { useFormViewportLock } from '@/components/forms/FormRunnerParts'
import { PublicFormConfig } from '@/types'
import { API_BASE_URL } from '@/lib/api-service'
import { useForcedLightMode } from '@/lib/useForcedLightMode'

function generateSessionKey() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function resolvePhotoUrl(photoUrl?: string | null) {
  if (!photoUrl) return undefined
  return photoUrl.startsWith('http') ? photoUrl : `${API_BASE_URL}${photoUrl}`
}

function PublicFormBackButton({ fallbackHref = '/' }: { fallbackHref?: string }) {
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
      className="relative z-20 ml-4 mt-3 inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-gray-200 bg-white/90 px-3 py-2 text-xs font-black uppercase tracking-wide text-[#111827] shadow-sm transition hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15 sm:absolute sm:left-6 sm:top-6 sm:ml-0 sm:mt-0"
    >
      <ArrowLeft className="h-4 w-4" />
      Back
    </button>
  )
}

export default function WebsitePublicFormPage({
  siteId,
  formId,
  agentHubPath,
  basePrefix = '',
  initialForm = null,
  mode = 'form',
  forceLightMode = false,
  embeddedInSiteChrome = false,
  campaignToken = null,
}: {
  siteId: string
  formId?: string
  agentHubPath?: string | null
  basePrefix?: string
  initialForm?: PublicFormConfig | null
  mode?: 'form' | 'showcaseCreator'
  forceLightMode?: boolean
  embeddedInSiteChrome?: boolean
  // Which Campaign this visit came from (a separately-tracked link for the same premade form) -
  // absent/invalid just means General, resolved server-side (forms_service.py). Read from the
  // page's own ?c= query param by the caller (ohp-site-render route), not read here directly,
  // since this component doesn't otherwise touch the URL's search params.
  campaignToken?: string | null
}) {
  const [form, setForm] = useState<PublicFormConfig | null>(initialForm)
  const [isLoading, setIsLoading] = useState(!initialForm)
  const [notFound, setNotFound] = useState(false)
  const sessionKeyRef = useRef(generateSessionKey())
  const visitRef = useRef<FormVisitContext | null>(null)
  const apiPath = mode === 'showcaseCreator'
    ? `/api/website-showcase-creator?site_id=${encodeURIComponent(siteId)}`
    : formId
      ? `/api/website-forms/${encodeURIComponent(formId)}?site_id=${encodeURIComponent(siteId)}`
      : ''
  const progressApiPath = mode === 'showcaseCreator'
    ? `/api/website-showcase-creator/progress?site_id=${encodeURIComponent(siteId)}`
    : formId
      ? `/api/website-forms/${encodeURIComponent(formId)}/progress?site_id=${encodeURIComponent(siteId)}`
      : ''
  useForcedLightMode(forceLightMode)
  // A form on its own page sits still - the phone's keyboard can't drag it down (forms group, 10/24).
  const pinnedRef = useFormViewportLock(!!form && !embeddedInSiteChrome)

  useEffect(() => {
    const fetchForm = async () => {
      if (initialForm) return
      if (!apiPath) { setNotFound(true); setIsLoading(false); return }
      setIsLoading(true)
      const res = await fetch(apiPath, { cache: 'no-store' })
      if (res.ok) {
        setForm(await res.json())
        setNotFound(false)
      } else {
        setNotFound(true)
      }
      setIsLoading(false)
    }
    fetchForm()
  }, [apiPath, initialForm])

  if (isLoading) {
    // the house only - a visitor's page never shows the OpenHousePal wordmark
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

  const useDarkMode = Boolean(form.darkMode && !forceLightMode)
  const heightClass = embeddedInSiteChrome ? 'relative h-[calc(100vh-5rem)]' : 'fixed inset-x-0 top-0 h-[100dvh]'
  const backHref = `${basePrefix || ''}/`
  // A campaign link's own after-submit choice wins (own-domain pages are short: /hub, /sales).
  const campaignAfter = form.afterSubmitMode === 'none' ? { enabled: false, url: '' }
    : form.afterSubmitMode === 'custom' && form.afterSubmitUrl ? { enabled: true, url: form.afterSubmitUrl }
      : form.afterSubmitMode === 'sales' ? { enabled: true, url: `${basePrefix || ''}/sales` }
        : form.afterSubmitMode === 'agent_hub' && agentHubPath ? { enabled: true, url: agentHubPath }
          : null
  const redirectAfterSubmit = campaignAfter || (embeddedInSiteChrome
    ? { enabled: true, url: backHref || '/' }
    : { enabled: Boolean(form.redirectToAgentHub && agentHubPath), url: agentHubPath || '/' })

  return (
    <div ref={pinnedRef} className={`${embeddedInSiteChrome ? 'flex flex-col' : ''} ${forceLightMode ? 'ohp-force-light' : ''} ${useDarkMode ? 'dark bg-[#0B0B0B]' : 'bg-[#FAFAF7]'} ${heightClass}`}>
      {embeddedInSiteChrome && <PublicFormBackButton fallbackHref={backHref} />}
      <div className={embeddedInSiteChrome ? 'min-h-0 flex-1' : 'contents'}>
      <FormRunner
        formId={form.formId}
        questions={form.questions}
        linkedProperty={form.linkedProperty}
        propertyPhotoCarousel={form.propertyPhotoCarousel}
        backgroundEffects={form.backgroundEffects !== false}
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
        agentHubRedirect={redirectAfterSubmit}
        redirectDelayMs={embeddedInSiteChrome ? 3000 : undefined}
        forceLightMode={forceLightMode}
        showcasePreview={form.formType === 'showcase_request'}
        exampleProperties={form.exampleProperties}
        onProgress={(stepIndex, questionId, completed, answers) => {
          if (!progressApiPath) return
          visitRef.current = visitRef.current || formVisitContext(true)
          fetch(progressApiPath, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            keepalive: true,
            body: JSON.stringify({ sessionKey: sessionKeyRef.current, stepIndex, questionId, completed, campaignToken, answers, ...visitRef.current }),
          }).catch(() => {})
        }}
        onSubmit={async answers => {
          if (!apiPath) return { success: false, message: 'This form is not available right now.' }
          const res = await fetch(apiPath, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers, sessionKey: sessionKeyRef.current, campaignToken }),
          })
          const body = await res.json().catch(() => null)
          if (res.ok && body?.success) {
            return {
              ...body,
              redirectUrl: embeddedInSiteChrome ? undefined : body.redirectUrl?.startsWith('/') && basePrefix ? `${basePrefix}${body.redirectUrl}` : body.redirectUrl,
            }
          }
          return { success: false, message: body?.detail || body?.message || 'Something went wrong. Please try again.' }
        }}
      />
      </div>
    </div>
  )
}
