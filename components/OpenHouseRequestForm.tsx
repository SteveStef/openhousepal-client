'use client'

import { useState } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import { MapPin, Bed, Bath, Square } from 'lucide-react'
import { Property } from '@/types'
import { todayLocal } from '@/lib/relativeDays'

export interface OpenHouseRequestFormData {
  fullName: string
  email: string
  phone: string
  wantsAnotherTour?: boolean
  anotherTourTime?: string
  preferredVisitTime?: string
  wantsDisclosure?: boolean
}

interface OpenHouseRequestFormProps {
  property: Property
  variant: 'disclosure' | 'second_visit'
  onSubmit: (formData: OpenHouseRequestFormData) => Promise<void>
  isLoading?: boolean
  // Agent-configurable theme (Forms tab > Open House Requests > Edit Theme) - defaults match the
  // original hardcoded look.
  accentColor?: string
}

// Shared by the "Request Seller Disclosure" and "Schedule a Second Visit" guest forms scanned
// from the Cheat Sheet - same property-header treatment as OpenHouseSignInForm, but a single
// short step since there's no property/agent lookup left for the guest to do.
export default function OpenHouseRequestForm({
  property,
  variant,
  onSubmit,
  isLoading = false,
  accentColor = '#C9A24D',
}: OpenHouseRequestFormProps) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [wantsAnotherTour, setWantsAnotherTour] = useState<boolean | null>(null)
  const [anotherTourDate, setAnotherTourDate] = useState('')
  const [anotherTourTimeWindow, setAnotherTourTimeWindow] = useState('')
  const [preferredVisitDate, setPreferredVisitDate] = useState('')
  const [preferredVisitTimeWindow, setPreferredVisitTimeWindow] = useState('')
  const [wantsDisclosure, setWantsDisclosure] = useState<boolean | null>(null)

  const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10)
    if (digits.length < 4) return digits
    if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  const isValid = () => {
    if (!fullName.trim() || !email.trim() || !validateEmail(email) || !phone.trim()) return false
    if (variant === 'second_visit' && !preferredVisitDate.trim()) return false
    return true
  }

  const formatVisitDate = (value: string) => {
    if (!value) return ''
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid() || isLoading) return
    await onSubmit({
      fullName,
      email,
      phone,
      ...(variant === 'disclosure' ? {
        wantsAnotherTour: wantsAnotherTour ?? false,
        anotherTourTime: wantsAnotherTour
          ? [formatVisitDate(anotherTourDate), anotherTourTimeWindow.trim()].filter(Boolean).join(' · ') || undefined
          : undefined,
      } : {
        preferredVisitTime: preferredVisitTimeWindow.trim()
          ? `${formatVisitDate(preferredVisitDate)} · ${preferredVisitTimeWindow.trim()}`
          : formatVisitDate(preferredVisitDate),
        wantsDisclosure: wantsDisclosure ?? false,
      }),
    })
  }

  const formatPrice = (price?: number) => (price ? `$${price.toLocaleString()}` : 'Price Available Upon Request')
  const imageSrc = property.ListPictureURL || ''

  const heading = variant === 'disclosure' ? 'Request Seller Disclosure' : 'Schedule a Second Visit'
  const subheading = variant === 'disclosure'
    ? "We'll send over the seller disclosure and property documents."
    : "Let us know when you'd like to come back for another look."

  return (
    <div
      style={{ '--accent': accentColor } as React.CSSProperties}
      className="max-w-lg w-full bg-white dark:bg-[#151517] rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 dark:border-gray-800 overflow-hidden transition-colors duration-300"
    >
      {/* Property Info Header */}
      <div className="p-6 bg-[#FAFAF7] dark:bg-[#1A1A1C] border-b border-gray-100 dark:border-gray-800">
        <div className="text-center mb-6">
          <h1 className="text-xl font-black text-[#0B0B0B] dark:text-white tracking-tight uppercase relative inline-block">
            {heading}
            <span className="absolute -bottom-2 left-0 right-0 h-1 bg-[var(--accent)] rounded-full opacity-30"></span>
          </h1>
          <p className="text-xs text-[#6B7280] dark:text-gray-400 font-medium mt-3">{subheading}</p>
        </div>

        <div className="bg-white dark:bg-[#151517] rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 flex shadow-sm">
          {imageSrc && (
            <div className="relative w-40 h-40 flex-shrink-0 bg-gray-100 dark:bg-gray-800">
              <Image src={imageSrc} alt={property.FullStreetAddress} fill sizes="320px" quality={90} className="object-cover" />

              {/* Status Badge (Top Left) - same treatment as PropertyCard */}
              <div className="absolute top-2 left-2">
                <span className="bg-green-500 text-white font-black px-2 py-1 rounded-lg text-[8px] uppercase tracking-widest shadow-lg border border-white/10">
                  Active
                </span>
              </div>

              {/* City overlay (Bottom Center) - same treatment as OpenHouseCard / discovery rows */}
              {property.City && (
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-2 pb-2 pt-8">
                  <MapPin size={11} className="shrink-0 text-white" />
                  <span className="max-w-[80%] truncate text-[10px] font-black uppercase tracking-wide text-white">
                    {property.City}
                  </span>
                </div>
              )}
            </div>
          )}
          <div className="flex-1 p-4 flex flex-col justify-center min-w-0">
            <h2 className="text-sm font-black text-[#0B0B0B] dark:text-white mb-2 leading-tight truncate">
              {property.FullStreetAddress}
            </h2>
            <div className="space-y-3">
              <span className="text-base font-black text-[var(--accent)] tracking-tight">{formatPrice(property.ListPrice)}</span>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] font-bold uppercase tracking-wide text-[#6B7280] dark:text-gray-400">
                {property.BedroomsTotal && (
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    <Bed size={12} className="text-gray-400 dark:text-gray-500 shrink-0" />
                    <span className="text-[#111827] dark:text-white">{property.BedroomsTotal}</span> Beds
                  </span>
                )}
                {property.BathroomsTotal && (
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    <Bath size={12} className="text-gray-400 dark:text-gray-500 shrink-0" />
                    <span className="text-[#111827] dark:text-white">{property.BathroomsTotal}</span> Baths
                  </span>
                )}
                {property.LivingArea && (
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    <Square size={12} className="text-gray-400 dark:text-gray-500 shrink-0" />
                    <span className="text-[#111827] dark:text-white">{property.LivingArea.toLocaleString()}</span> SqFt
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5">
        <div>
          <label className="block text-[10px] font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">Full Name*</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-4 py-3.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white font-medium focus:outline-none focus:ring-4 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-all"
            placeholder="Enter your full name"
            required
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">Email Address*</label>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailError(null) }}
            onBlur={() => setEmailError(email && !validateEmail(email) ? 'Please enter a valid email address' : null)}
            className={`w-full px-4 py-3.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border rounded-xl text-[#0B0B0B] dark:text-white font-medium focus:outline-none focus:ring-4 transition-all ${
              emailError ? 'border-red-500 focus:ring-red-500/10 focus:border-red-500' : 'border-gray-200 dark:border-gray-700 focus:ring-[var(--accent)] focus:border-[var(--accent)]'
            }`}
            placeholder="name@example.com"
            required
          />
          {emailError && <p className="mt-2 text-xs text-red-500 font-bold ml-1">{emailError}</p>}
        </div>

        <div>
          <label className="block text-[10px] font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">Phone Number*</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
            className="w-full px-4 py-3.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white font-medium focus:outline-none focus:ring-4 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-all"
            placeholder="(555) 000-0000"
            required
          />
        </div>

        {variant === 'second_visit' && (
          <div>
            <label className="block text-[10px] font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">Provide the date and time window you'd like*</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={preferredVisitDate}
                onChange={(e) => setPreferredVisitDate(e.target.value)}
                min={todayLocal()}
                className="w-[42%] shrink-0 px-3 py-3.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white font-medium focus:outline-none focus:ring-4 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-all"
                required
              />
              <input
                type="text"
                value={preferredVisitTimeWindow}
                onChange={(e) => setPreferredVisitTimeWindow(e.target.value)}
                className="flex-1 min-w-0 px-4 py-3.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white font-medium focus:outline-none focus:ring-4 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-all"
                placeholder="e.g. 10am - 12pm"
              />
            </div>
          </div>
        )}

        {variant === 'second_visit' && (
          <div className="bg-[#FAFAF7] dark:bg-[#1A1A1C] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 text-center">
            <p className="text-[#0B0B0B] dark:text-white text-sm font-bold">Would you also like the seller's disclosure?</p>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                type="button"
                onClick={() => setWantsDisclosure(false)}
                className={`py-3 px-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all duration-300 border-2 ${
                  wantsDisclosure === false
                    ? 'bg-[#111827] dark:bg-white border-[#111827] dark:border-white text-white dark:text-[#111827]'
                    : 'bg-white dark:bg-[#0B0B0B] border-gray-100 dark:border-gray-800 text-[#6B7280] dark:text-gray-400 hover:border-[var(--accent)] hover:text-[var(--accent)]'
                }`}
              >
                No
              </button>
              <button
                type="button"
                onClick={() => setWantsDisclosure(true)}
                className={`py-3 px-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all duration-300 border-2 ${
                  wantsDisclosure === true
                    ? 'bg-[#111827] dark:bg-white border-[#111827] dark:border-white text-white dark:text-[#111827]'
                    : 'bg-white dark:bg-[#0B0B0B] border-gray-100 dark:border-gray-800 text-[#6B7280] dark:text-gray-400 hover:border-[var(--accent)] hover:text-[var(--accent)]'
                }`}
              >
                Yes
              </button>
            </div>
          </div>
        )}

        {variant === 'disclosure' && (
          <div className="space-y-3">
            <div className="bg-[#FAFAF7] dark:bg-[#1A1A1C] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 text-center">
              <p className="text-[#0B0B0B] dark:text-white text-sm font-bold">Would you like to schedule another tour?</p>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setWantsAnotherTour(false)}
                  className={`py-3 px-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all duration-300 border-2 ${
                    wantsAnotherTour === false
                      ? 'bg-[#111827] dark:bg-white border-[#111827] dark:border-white text-white dark:text-[#111827]'
                      : 'bg-white dark:bg-[#0B0B0B] border-gray-100 dark:border-gray-800 text-[#6B7280] dark:text-gray-400 hover:border-[var(--accent)] hover:text-[var(--accent)]'
                  }`}
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => setWantsAnotherTour(true)}
                  className={`py-3 px-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all duration-300 border-2 ${
                    wantsAnotherTour === true
                      ? 'bg-[#111827] dark:bg-white border-[#111827] dark:border-white text-white dark:text-[#111827]'
                      : 'bg-white dark:bg-[#0B0B0B] border-gray-100 dark:border-gray-800 text-[#6B7280] dark:text-gray-400 hover:border-[var(--accent)] hover:text-[var(--accent)]'
                  }`}
                >
                  Yes
                </button>
              </div>
            </div>
            <AnimatePresence initial={false}>
              {wantsAnotherTour && (
                <motion.div
                  key="another-tour-time"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="pt-1">
                    <label className="block text-[10px] font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">Provide the date and time window you'd like</label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={anotherTourDate}
                        onChange={(e) => setAnotherTourDate(e.target.value)}
                        min={todayLocal()}
                        className="w-[42%] shrink-0 px-3 py-3.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white font-medium focus:outline-none focus:ring-4 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-all"
                      />
                      <input
                        type="text"
                        value={anotherTourTimeWindow}
                        onChange={(e) => setAnotherTourTimeWindow(e.target.value)}
                        className="flex-1 min-w-0 px-4 py-3.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white font-medium focus:outline-none focus:ring-4 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-all"
                        placeholder="e.g. 10am - 12pm"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !isValid()}
          className="w-full bg-[#111827] dark:bg-white hover:bg-[var(--accent)] dark:hover:bg-[var(--accent)] text-white dark:text-[#111827] dark:hover:text-white font-black uppercase tracking-widest py-4 px-6 rounded-2xl transition-all duration-300 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] text-xs"
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white dark:text-[#111827]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Submitting...
            </span>
          ) : 'Submit'}
        </button>
      </form>
    </div>
  )
}
