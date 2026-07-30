'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import FormRunner from '@/components/forms/FormRunner'
import { PublicFormConfig } from '@/types'
import api, { API_BASE_URL } from '@/lib/api-service'

function resolvePhotoUrl(photoUrl?: string | null) {
  if (!photoUrl) return undefined
  return photoUrl.startsWith('http') ? photoUrl : `${API_BASE_URL}${photoUrl}`
}

export default function PublicFormPage() {
  const params = useParams()
  const slug = params.slug as string
  const formSlug = params.formSlug as string

  const [form, setForm] = useState<PublicFormConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const fetchForm = async () => {
      setIsLoading(true)
      const { success, data } = await api.public.getPublicForm(slug, formSlug)
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAF7] dark:bg-[#0B0B0B]">
        <Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" />
      </div>
    )
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

  return (
    <div className={form.darkMode ? 'dark h-screen' : 'h-screen'}>
      <FormRunner
        questions={form.questions}
        linkedProperty={form.linkedProperty}
        propertyPhotoCarousel={form.propertyPhotoCarousel}
        brandingLayout={form.brandingLayout}
        branding={{
          title: form.headline || form.title,
          subtitle: form.subtitle,
          accentColor: form.accentColor,
          showBranding: form.showBranding,
          agentName: form.agentName,
          agentBrokerage: form.agentBrokerage,
          agentPhotoUrl: resolvePhotoUrl(form.agentPhotoUrl),
          agentTitle: form.agentTitle,
          agentMarket: form.agentMarket,
        }}
        successHeading={form.successHeading}
        successMessage={form.successMessage}
        agentHubRedirect={{ enabled: form.redirectToAgentHub, url: `/${slug}` }}
        onSubmit={async answers => {
          const { success, data, error } = await api.public.submitPublicForm(slug, formSlug, answers)
          if (success && data) return data
          return { success: false, message: error }
        }}
      />
    </div>
  )
}
