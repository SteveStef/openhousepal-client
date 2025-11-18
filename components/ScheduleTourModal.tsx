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
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200/60 max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200/60 bg-gradient-to-r from-[#8b7355] to-[#7a6549]">
          <div className="flex items-center space-x-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Calendar className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Schedule a Tour</h2>
              <p className="text-white/90 text-sm mt-1">Choose your preferred viewing times</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6">
          {/* Property Info */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-xl p-4 mb-6 border border-gray-200">
            <div className="flex items-start space-x-4">
              {property.imageUrl && (
                <Image
                  src={property.imageUrl}
                  alt={property.address}
                  width={80}
                  height={80}
                  className="w-20 h-20 object-cover rounded-lg"
                />
              )}
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-1">{property.address}</h3>
                <p className="text-gray-600 text-sm">
                  {property.city}, {property.state} {property.zipCode}
                </p>
                <div className="flex items-center space-x-4 mt-2 text-xs text-gray-600">
                  <span>{property.beds} beds</span>
                  <span>•</span>
                  <span>{property.baths} baths</span>
                  {property.squareFeet && (
                    <>
                      <span>•</span>
                      <span>{property.squareFeet.toLocaleString()} sqft</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Preferred Tour Times */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Preferred Tour Times</h4>
              <p className="text-sm text-gray-600">Select up to 3 preferred dates and times for the tour</p>

              {/* First Choice */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h5 className="text-sm font-semibold text-gray-900 mb-3">First Choice *</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="preferredDate" className="block text-sm font-medium text-gray-700 mb-2">
                      Date *
                    </label>
                    <input
                      id="preferredDate"
                      type="date"
                      value={preferredDate}
                      onChange={(e) => setPreferredDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355] transition-colors"
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="preferredTime" className="block text-sm font-medium text-gray-700 mb-2">
                      Time *
                    </label>
                    <select
                      id="preferredTime"
                      value={preferredTime}
                      onChange={(e) => setPreferredTime(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355] transition-colors"
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
                  </div>
                </div>
              </div>

              {/* Second Choice */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h5 className="text-sm font-semibold text-gray-900 mb-3">Second Choice (Optional)</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="preferredDate2" className="block text-sm font-medium text-gray-700 mb-2">
                      Date
                    </label>
                    <input
                      id="preferredDate2"
                      type="date"
                      value={preferredDate2}
                      onChange={(e) => setPreferredDate2(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355] transition-colors"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label htmlFor="preferredTime2" className="block text-sm font-medium text-gray-700 mb-2">
                      Time
                    </label>
                    <select
                      id="preferredTime2"
                      value={preferredTime2}
                      onChange={(e) => setPreferredTime2(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355] transition-colors"
                      disabled={isSubmitting}
                    >
                      <option value="">Select time...</option>
                      {TIME_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Third Choice */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h5 className="text-sm font-semibold text-gray-900 mb-3">Third Choice (Optional)</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="preferredDate3" className="block text-sm font-medium text-gray-700 mb-2">
                      Date
                    </label>
                    <input
                      id="preferredDate3"
                      type="date"
                      value={preferredDate3}
                      onChange={(e) => setPreferredDate3(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355] transition-colors"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label htmlFor="preferredTime3" className="block text-sm font-medium text-gray-700 mb-2">
                      Time
                    </label>
                    <select
                      id="preferredTime3"
                      value={preferredTime3}
                      onChange={(e) => setPreferredTime3(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355] transition-colors"
                      disabled={isSubmitting}
                    >
                      <option value="">Select time...</option>
                      {TIME_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Message (Optional)
                </label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355] transition-colors resize-none"
                  placeholder="Any special requests or questions..."
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-600 text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-lg font-medium hover:shadow-lg hover:shadow-[#8b7355]/25 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send size={18} />
                <span className="whitespace-nowrap">{isSubmitting ? 'Sending...' : 'Send Request'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
