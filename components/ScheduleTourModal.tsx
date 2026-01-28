'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X, Calendar, Send } from 'lucide-react'
import { Property } from '@/types'

interface ScheduleTourModalProps {
  property: Property | null
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: TourRequest) => Promise<void>
}

export interface TourRequest {
  propertyId: string | number
  propertyAddress: string
  preferredDate: string
  preferredTime: string
  preferredDate2?: string
  preferredTime2?: string
  preferredDate3?: string
  preferredTime3?: string
  message?: string
}

// Generate time options from 6:00 AM to 8:00 PM in 30-minute increments
const generateTimeOptions = () => {
  const options = []
  const startHour = 6  // 6 AM
  const endHour = 20   // 8 PM

  for (let hour = startHour; hour <= endHour; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      // Stop after 8:00 PM (don't include 8:30 PM)
      if (hour === endHour && minute > 0) break

      const hourStr = hour.toString().padStart(2, '0')
      const minuteStr = minute.toString().padStart(2, '0')
      const value = `${hourStr}:${minuteStr}`

      // Format for display (12-hour format with AM/PM)
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
      const period = hour >= 12 ? 'PM' : 'AM'
      const label = `${displayHour}:${minuteStr} ${period}`

      options.push({ value, label })
    }
  }

  return options
}

const TIME_OPTIONS = generateTimeOptions()

export default function ScheduleTourModal({
  property,
  isOpen,
  onClose,
  onSubmit
}: ScheduleTourModalProps) {
  const [preferredDate, setPreferredDate] = useState('')
  const [preferredTime, setPreferredTime] = useState('')
  const [preferredDate2, setPreferredDate2] = useState('')
  const [preferredTime2, setPreferredTime2] = useState('')
  const [preferredDate3, setPreferredDate3] = useState('')
  const [preferredTime3, setPreferredTime3] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen || !property) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!preferredDate || !preferredTime) {
      setError('Please select at least your first choice date and time')
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        propertyId: property.id!,
        propertyAddress: property.address,
        preferredDate,
        preferredTime,
        preferredDate2: preferredDate2 || undefined,
        preferredTime2: preferredTime2 || undefined,
        preferredDate3: preferredDate3 || undefined,
        preferredTime3: preferredTime3 || undefined,
        message: message.trim() || undefined
      })

      // Reset form
      setPreferredDate('')
      setPreferredTime('')
      setPreferredDate2('')
      setPreferredTime2('')
      setPreferredDate3('')
      setPreferredTime3('')
      setMessage('')
      onClose()
    } catch (err) {
      setError('Failed to schedule tour. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // Get minimum datetime (current time)
  const getMinDateTime = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  return (
    <div
      className="fixed inset-0 bg-[#111827]/60 z-50 flex items-center justify-center p-4 transition-all duration-300"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-gray-100 max-w-2xl w-full max-h-[90vh] overflow-hidden transform transition-all">
        {/* Header */}
        <div className="p-8 border-b border-gray-100 bg-white/95 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-[#FAFAF7] p-3 rounded-2xl border border-gray-100 shadow-sm">
                <Calendar className="text-[#C9A24D]" size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-[#0B0B0B] tracking-tight">Schedule a Tour</h2>
                <p className="text-[#6B7280] text-sm font-medium mt-1">Choose your preferred viewing times</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="group p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X size={24} className="text-gray-400 group-hover:text-[#111827] transition-colors" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-8">
          {/* Property Info */}
          <div className="bg-[#FAFAF7] rounded-2xl p-5 mb-10 border border-gray-100 shadow-sm">
            <div className="flex items-center space-x-5">
              {property.imageUrl && (
                <div className="relative w-20 h-20 flex-shrink-0">
                  <Image
                    src={property.imageUrl}
                    alt={property.address}
                    fill
                    className="object-cover rounded-xl shadow-sm"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-[#0B0B0B] text-lg tracking-tight truncate">{property.address}</h3>
                <p className="text-[#6B7280] text-sm font-medium">
                  {property.city}, {property.state} {property.zipCode}
                </p>
                <div className="flex items-center space-x-4 mt-2 text-xs font-bold text-[#C9A24D] uppercase tracking-widest">
                  <span>{property.beds} beds</span>
                  <span className="text-gray-300">•</span>
                  <span>{property.baths} baths</span>
                  {property.squareFeet && (
                    <>
                      <span className="text-gray-300">•</span>
                      <span>{property.squareFeet.toLocaleString()} sqft</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-10">
            {/* Preferred Tour Times */}
            <div className="space-y-6">
              <div className="flex items-center space-x-3 pb-2 border-b border-gray-100">
                <div className="w-1 h-6 bg-[#C9A24D] rounded-full"></div>
                <h4 className="text-lg font-black text-[#0B0B0B] tracking-tight uppercase">Preferred Tour Times</h4>
              </div>
              <p className="text-sm font-medium text-[#6B7280] bg-gray-50 p-4 rounded-xl border border-gray-100">
                <span className="font-bold text-[#111827]">Tip:</span> Select up to 3 preferred dates and times for the tour.
              </p>

              {/* First Choice */}
              <div className="p-6 rounded-2xl border border-[#C9A24D] bg-[#FAFAF7] shadow-md transition-all duration-300">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="bg-[#C9A24D] text-white p-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest">
                    Choice 1
                  </div>
                  <h5 className="text-md font-black text-[#111827] uppercase tracking-wide">First Choice *</h5>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="preferredDate" className="block text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-2 ml-1">
                      Date *
                    </label>
                    <input
                      id="preferredDate"
                      type="date"
                      value={preferredDate}
                      onChange={(e) => setPreferredDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="block w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-[#0B0B0B] placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:border-[#C9A24D]/30"
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="preferredTime" className="block text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-2 ml-1">
                      Time *
                    </label>
                    <div className="relative">
                      <select
                        id="preferredTime"
                        value={preferredTime}
                        onChange={(e) => setPreferredTime(e.target.value)}
                        className="block w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-[#0B0B0B] focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:border-[#C9A24D]/30 appearance-none cursor-pointer"
                        disabled={isSubmitting}
                        required
                      >
                        <option value="">Select time...</option>
                        {TIME_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Second Choice */}
              <div className="p-6 rounded-2xl border border-gray-200 bg-white hover:border-gray-300 transition-all duration-300">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="bg-gray-100 text-[#6B7280] p-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest">
                    Choice 2
                  </div>
                  <h5 className="text-md font-black text-[#6B7280] uppercase tracking-wide">Second Choice (Optional)</h5>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="preferredDate2" className="block text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-2 ml-1">
                      Date
                    </label>
                    <input
                      id="preferredDate2"
                      type="date"
                      value={preferredDate2}
                      onChange={(e) => setPreferredDate2(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="block w-full px-4 py-3.5 bg-[#FAFAF7] border border-gray-200 rounded-xl text-[#0B0B0B] placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:bg-white hover:border-[#C9A24D]/30"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label htmlFor="preferredTime2" className="block text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-2 ml-1">
                      Time
                    </label>
                    <div className="relative">
                      <select
                        id="preferredTime2"
                        value={preferredTime2}
                        onChange={(e) => setPreferredTime2(e.target.value)}
                        className="block w-full px-4 py-3.5 bg-[#FAFAF7] border border-gray-200 rounded-xl text-[#0B0B0B] focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:bg-white hover:border-[#C9A24D]/30 appearance-none cursor-pointer"
                        disabled={isSubmitting}
                      >
                        <option value="">Select time...</option>
                        {TIME_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Third Choice */}
              <div className="p-6 rounded-2xl border border-gray-200 bg-white hover:border-gray-300 transition-all duration-300">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="bg-gray-100 text-[#6B7280] p-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest">
                    Choice 3
                  </div>
                  <h5 className="text-md font-black text-[#6B7280] uppercase tracking-wide">Third Choice (Optional)</h5>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="preferredDate3" className="block text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-2 ml-1">
                      Date
                    </label>
                    <input
                      id="preferredDate3"
                      type="date"
                      value={preferredDate3}
                      onChange={(e) => setPreferredDate3(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="block w-full px-4 py-3.5 bg-[#FAFAF7] border border-gray-200 rounded-xl text-[#0B0B0B] placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:bg-white hover:border-[#C9A24D]/30"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label htmlFor="preferredTime3" className="block text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-2 ml-1">
                      Time
                    </label>
                    <div className="relative">
                      <select
                        id="preferredTime3"
                        value={preferredTime3}
                        onChange={(e) => setPreferredTime3(e.target.value)}
                        className="block w-full px-4 py-3.5 bg-[#FAFAF7] border border-gray-200 rounded-xl text-[#0B0B0B] focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:bg-white hover:border-[#C9A24D]/30 appearance-none cursor-pointer"
                        disabled={isSubmitting}
                      >
                        <option value="">Select time...</option>
                        {TIME_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="message" className="block text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-2 ml-1">
                  Additional Message (Optional)
                </label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="block w-full px-4 py-3.5 bg-[#FAFAF7] border border-gray-200 rounded-xl text-[#0B0B0B] placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:bg-white hover:border-[#C9A24D]/30 resize-none"
                  placeholder="Any special requests or questions..."
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center shadow-sm">
                <div className="p-2 bg-red-100 rounded-full mr-3">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-red-700">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-4 pt-8 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-6 py-3.5 bg-white border border-gray-200 hover:bg-gray-50 text-[#6B7280] font-bold rounded-xl transition-all duration-300 uppercase tracking-wide text-xs shadow-sm hover:shadow"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-8 py-3.5 bg-[#111827] hover:bg-[#C9A24D] text-white font-black rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed uppercase tracking-widest text-xs flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Send Request</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
