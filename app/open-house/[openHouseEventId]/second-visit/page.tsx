'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import OpenHouseRequestForm, { OpenHouseRequestFormData } from '@/components/OpenHouseRequestForm'
import { Property } from '@/types'
import api from '@/lib/api-service'
import OhpLoader from '@/components/brand/OhpLoader'
import { MlsUpdatedText } from '@/components/MLSComplianceFooter'

const ComplianceFooter = () => (
  <div className="mt-12 text-center max-w-3xl mx-auto pb-4 px-4">
    <p className="text-[10px] text-gray-400 font-medium leading-relaxed uppercase tracking-wider">
      © BRIGHT, All Rights Reserved | Information Deemed Reliable But Not Guaranteed. Some properties which appear for sale may no longer be available.
      <span className="block sm:inline ml-0 sm:ml-1"><MlsUpdatedText /></span>
    </p>
  </div>
)

export default function OpenHouseSecondVisitRequestPage() {
  const router = useRouter()
  const params = useParams()
  const [property, setProperty] = useState<Property | null>(null)
  const [theme, setTheme] = useState<{ accentColor: string; darkMode: boolean } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const openHouseEventId = params.openHouseEventId as string

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      const result = await api.public.getOpenHouseProperty(openHouseEventId)
      if (result.success && result.data) {
        setProperty(result.data)
        setTheme((result as any).theme || null)
        setError(null)
      } else {
        setError(result.error || 'Failed to load property information. Please try again.')
      }
      setIsLoading(false)
    }
    if (openHouseEventId) fetchData()
  }, [openHouseEventId])

  const handleFormSubmit = async (formData: OpenHouseRequestFormData) => {
    try {
      setIsSubmitting(true)
      await api.public.submitOpenHouseFormRequest(openHouseEventId, {
        form_type: 'second_visit',
        full_name: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        preferred_visit_time: formData.preferredVisitTime,
        wants_disclosure: formData.wantsDisclosure,
      })
      setSuccess(true)
    } catch (err) {
      console.error('Error submitting second visit request:', err)
      setSuccess(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  const darkClass = theme?.darkMode ? 'dark' : ''

  if (isLoading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center bg-[#FAFAF7] dark:bg-[#0B0B0B] p-4 transition-colors duration-300 ${darkClass}`}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <OhpLoader guest fullScreen={false} className="!py-0" label="Opening the home" />
          </div>
        </div>
        <ComplianceFooter />
      </div>
    )
  }

  if (error) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center bg-[#FAFAF7] dark:bg-[#0B0B0B] px-4 p-4 transition-colors duration-300 ${darkClass}`}>
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-md w-full bg-white dark:bg-[#151517] rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-8 text-center border border-gray-100 dark:border-gray-800">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h2 className="text-xl font-black text-[#0B0B0B] dark:text-white mb-2 tracking-tight">This link isn't working</h2>
            <p className="text-[#6B7280] dark:text-gray-400 mb-8 leading-relaxed">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-[#111827] dark:bg-white hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] text-white dark:text-[#111827] dark:hover:text-white font-bold py-3.5 px-6 rounded-xl shadow-lg transition-all duration-300 hover:scale-[1.02]"
            >
              Try Again
            </button>
          </div>
        </div>
        <ComplianceFooter />
      </div>
    )
  }

  if (success) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center bg-[#FAFAF7] dark:bg-[#0B0B0B] px-4 p-4 transition-colors duration-300 ${darkClass}`}>
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-md w-full bg-white dark:bg-[#151517] rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-8 text-center border border-gray-100 dark:border-gray-800">
            <div className="w-20 h-20 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h2 className="text-3xl font-black text-[#0B0B0B] dark:text-white mb-3 tracking-tight">Request Sent!</h2>
            <p className="text-[#6B7280] dark:text-gray-400 mb-8 leading-relaxed font-medium">
              The agent will reach out to confirm your second visit. You can close this page now.
            </p>
          </div>
        </div>
        <ComplianceFooter />
      </div>
    )
  }

  if (!property) {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-[#FAFAF7] dark:bg-[#0B0B0B] px-4 transition-colors duration-300 ${darkClass}`}>
        <div className="max-w-md w-full bg-white dark:bg-[#151517] rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-8 text-center border border-gray-100 dark:border-gray-800">
          <h2 className="text-xl font-black text-[#0B0B0B] dark:text-white mb-2 tracking-tight">Property Not Found</h2>
          <p className="text-[#6B7280] dark:text-gray-400 leading-relaxed">
            This property listing may have been removed or is no longer available.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-[#FAFAF7] dark:bg-[#0B0B0B] flex flex-col items-center justify-center p-4 transition-colors duration-300 ${darkClass}`}>
      <div className="flex-1 flex items-center justify-center w-full">
        <div className="w-full max-w-lg">
          <OpenHouseRequestForm property={property} variant="second_visit" onSubmit={handleFormSubmit} isLoading={isSubmitting} accentColor={theme?.accentColor} />
        </div>
      </div>
      <ComplianceFooter />
    </div>
  )
}
