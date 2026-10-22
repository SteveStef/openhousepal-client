'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { CalendarDays } from 'lucide-react'
import ScheduleTourModal from '@/components/ScheduleTourModal'
import { normalizeImageUrl } from '@/lib/utils'
import { Property, TourRequest } from '@/types'
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

  // From the showing window: their times (top pick first) in the same "Sat, Oct 24 · 1:00 PM" words
  // the agent already sees for a second visit; throws so the window can show the problem.
  const handleTourSubmit = async (d: TourRequest, wantsDisclosure: boolean) => {
    const when = (date?: string, time?: string) => {
      if (!date) return ''
      const day = new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      if (!time) return day
      const [h, m] = time.split(':').map(Number)
      return `${day} · ${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
    }
    const backups = [when(d.preferredDate2, d.preferredTime2), when(d.preferredDate3, d.preferredTime3)].filter(Boolean)
    const text = [when(d.preferredDate, d.preferredTime), backups.length ? `(or ${backups.join(', or ')})` : '', d.message ? `- ${d.message}` : ''].filter(Boolean).join(' ')
    const res = await api.public.submitOpenHouseFormRequest(openHouseEventId, {
      form_type: 'second_visit',
      full_name: d.visitorName || '',
      email: d.visitorContact || '',
      phone: d.visitorPhone || '',
      preferred_visit_time: text,
      wants_disclosure: wantsDisclosure,
    })
    if (res && (res as { success?: boolean }).success === false) throw new Error((res as { error?: string }).error || 'That didn’t go through - please try again.')
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
          <SecondVisit property={property} onSubmit={handleTourSubmit} onSent={() => setSuccess(true)} />
        </div>
      </div>
      <ComplianceFooter />
    </div>
  )
}

// "Schedule a Second Visit" uses the same Private showing window as Schedule a Showing (user,
// 10/22): the home is already known, so the window opens straight away - pick a day, then the part
// of the day, then the times (up to 3), then your details. The page behind keeps the home and the
// "seller's disclosure too?" question, and a button to reopen the window.
function SecondVisit({ property, onSubmit, onSent }: {
  property: Property
  onSubmit: (d: TourRequest, wantsDisclosure: boolean) => Promise<void>
  onSent: () => void
}) {
  const [open, setOpen] = useState(false)
  const [wantsDisclosure, setWantsDisclosure] = useState(false)
  const sent = useRef(false)
  useEffect(() => { const t = window.setTimeout(() => setOpen(true), 450); return () => window.clearTimeout(t) }, [])
  const photo = property.ListPictureURL ? normalizeImageUrl(property.ListPictureURL) : ''
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      className="overflow-hidden rounded-[28px] border border-black/[0.06] bg-white shadow-[0_30px_80px_-40px_rgba(17,24,39,.55)] dark:border-white/[0.08] dark:bg-[#141416]">
      <div className="relative isolate aspect-[16/10] overflow-hidden bg-[#0b0b0c] text-white">
        {photo && <img src={photo} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(120%_90%_at_100%_0%,rgba(201,162,77,.4),transparent_55%),linear-gradient(180deg,rgba(11,11,12,.05),rgba(11,11,12,.85))]" />
        <span className="absolute left-4 top-4 rounded-full bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em]">Second visit</span>
        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="font-serif text-2xl font-black leading-tight sm:text-3xl">{String(property.FullStreetAddress || '').split(',')[0]}</p>
          <p className="mt-0.5 text-sm font-semibold text-white/75">{[property.City, [property.StateOrProvince, property.PostalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</p>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <p className="text-center text-sm font-medium text-gray-500 dark:text-gray-400">Pick a few times to come back for another look - it takes about a minute.</p>
        <div className="rounded-2xl bg-[#FAFAF7] p-4 text-center dark:bg-[#0b0b0c]">
          <p className="text-sm font-bold text-[#111827] dark:text-white">Would you also like the seller&apos;s disclosure?</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {([[false, 'No thanks'], [true, 'Yes please']] as const).map(([v, label]) => (
              <button key={label} type="button" onClick={() => setWantsDisclosure(v)}
                className={`rounded-xl border-2 py-3 text-xs font-black uppercase tracking-widest transition ${wantsDisclosure === v ? 'border-[#111827] bg-[#111827] text-white dark:border-white dark:bg-white dark:text-[#111827]' : 'border-gray-200 text-gray-500 hover:border-[#C9A24D] dark:border-white/10 dark:text-gray-400'}`}>{label}</button>
            ))}
          </div>
        </div>
        <motion.button type="button" whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} onClick={() => setOpen(true)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#111827] text-xs font-black uppercase tracking-widest text-white shadow-[0_16px_34px_-14px_rgba(17,24,39,.9)] dark:bg-white dark:text-[#111827]">
          <CalendarDays className="h-4 w-4" /> Pick your times
        </motion.button>
      </div>
      <ScheduleTourModal
        property={property}
        isOpen={open}
        onClose={() => { setOpen(false); if (sent.current) onSent() }}
        onSubmit={async d => { await onSubmit(d, wantsDisclosure); sent.current = true }}
        showContactFields
        contactStyle="full"
      />
    </motion.div>
  )
}
