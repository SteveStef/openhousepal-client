'use client'

import { OhpSpinner } from '@/components/brand/OhpLoader'
import MotionModal from '@/components/ui/MotionModal'
import { useState } from 'react'
import Image from 'next/image'
import { X, Calendar, Phone, Mail, User, MapPin, AlertTriangle, Check } from 'lucide-react'
import { PropertyTour } from '@/types'
import { useEscapeToClose } from '@/components/ui/windowMotion'

interface ViewToursModalProps {
  isOpen: boolean
  onClose: () => void
  tours: PropertyTour[]
  onUpdateCompletion: (tourId: string, isCompleted: boolean) => Promise<void>
  onConfirmTour: (tourId: string, confirmedDate: string, confirmedTime: string) => Promise<void>
  onUnconfirmTour: (tourId: string) => Promise<void>
  isLoading: boolean
  // "All Showcases" inbox mode - each request also says whose Showcase it came from.
  subtitle?: string
}

export default function ViewToursModal({
  isOpen,
  onClose,
  tours,
  onUpdateCompletion,
  onConfirmTour,
  onUnconfirmTour,
  isLoading,
  subtitle
}: ViewToursModalProps) {
  const [updatingTourId, setUpdatingTourId] = useState<string | null>(null)
  // Tour whose "confirm this?" warning panel is expanded, and which of its offered slots is picked
  const [confirmingTourId, setConfirmingTourId] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string } | null>(null)
  useEscapeToClose(onClose, isOpen)


  // Format date from YYYY-MM-DD to MM/DD/YYYY
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const year = date.getFullYear()
    return `${month}/${day}/${year}`
  }

  // Convert military time (HH:MM) to AM/PM format
  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':')
    const hour = parseInt(hours, 10)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minutes} ${ampm}`
  }

  const handleCompletionToggle = async (tourId: string, currentStatus: boolean) => {
    setUpdatingTourId(tourId)
    try {
      await onUpdateCompletion(tourId, !currentStatus)
    } finally {
      setUpdatingTourId(null)
    }
  }

  const startConfirming = (tour: PropertyTour) => {
    setConfirmingTourId(tour.id)
    setSelectedSlot({ date: tour.preferred_date, time: tour.preferred_time })
  }

  const cancelConfirming = () => {
    setConfirmingTourId(null)
    setSelectedSlot(null)
  }

  const submitConfirm = async (tourId: string) => {
    if (!selectedSlot) return
    setUpdatingTourId(tourId)
    try {
      await onConfirmTour(tourId, selectedSlot.date, selectedSlot.time)
      setConfirmingTourId(null)
      setSelectedSlot(null)
    } finally {
      setUpdatingTourId(null)
    }
  }

  const handleUnconfirm = async (tourId: string) => {
    setUpdatingTourId(tourId)
    try {
      await onUnconfirmTour(tourId)
    } finally {
      setUpdatingTourId(null)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <MotionModal open={isOpen} onBackdropClick={handleBackdropClick} className="bg-black/60">
      <div className="bg-white dark:bg-[#151517] rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#151517] flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="bg-[#111827] dark:bg-white p-2 rounded-lg shadow-sm">
              <Calendar className="text-white dark:text-[#111827]" size={16} />
            </div>
            <div>
              <h2 className="text-base font-black text-[#111827] dark:text-white tracking-tight">Tour Requests</h2>
              <p className="text-[#6B7280] dark:text-gray-400 font-medium text-[11px]">
                {subtitle || `${tours.filter(t => !t.confirmed_date && !t.is_completed).length} waiting on you`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-[#111827] dark:hover:text-white transition-all p-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-full"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 bg-[#FAFAF7] dark:bg-[#0B0B0B]">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <OhpSpinner size={28} />
            </div>
          ) : tours.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-12 h-12 bg-white dark:bg-[#151517] rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm border border-gray-100 dark:border-gray-800">
                <Calendar className="h-6 w-6 text-gray-300 dark:text-gray-600" />
              </div>
              <h3 className="text-sm font-bold text-[#111827] dark:text-white mb-1">No tour requests yet</h3>
              <p className="text-xs text-[#6B7280] dark:text-gray-400">Tour requests from visitors will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tours.map((tour) => {
                const times = [
                  [tour.preferred_date, tour.preferred_time],
                  [tour.preferred_date_2, tour.preferred_time_2],
                  [tour.preferred_date_3, tour.preferred_time_3],
                ].filter(([d, t]) => d && t) as [string, string][]
                const isConfirmed = !!tour.confirmed_date && !!tour.confirmed_time
                const isConfirming = confirmingTourId === tour.id
                const isUpdating = updatingTourId === tour.id

                return (
                  <div
                    key={tour.id}
                    className={`bg-white dark:bg-[#151517] rounded-xl p-3 border border-gray-100 dark:border-gray-800 hover:border-[#C9A24D]/30 transition-all ${tour.is_completed ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      {tour.property?.imageUrl && (
                        <div className="relative w-12 h-12 flex-shrink-0">
                          <Image
                            src={tour.property.imageUrl}
                            alt={tour.property.street_address || 'Property'}
                            fill
                            sizes="48px"
                            className="object-cover rounded-lg"
                          />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-[#111827] dark:text-white text-sm truncate">
                            {tour.property?.street_address || 'Property'}
                          </h3>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {tour.is_completed && (
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[9px] font-bold uppercase tracking-wide">
                                {isConfirmed ? 'Completed' : 'Handled'}
                              </span>
                            )}
                            <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap">
                              {new Date(tour.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        {tour.showcase_name && (
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[#C9A24D] mt-0.5 truncate">
                            {tour.showcase_name}&apos;s Showcase
                          </p>
                        )}
                        {tour.property?.city && tour.property?.state && (
                          <p className="text-[11px] text-[#6B7280] dark:text-gray-400 flex items-center gap-1 mt-0.5">
                            <MapPin size={10} className="text-[#C9A24D] flex-shrink-0" />
                            {tour.property.city}, {tour.property.state}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-[#6B7280] dark:text-gray-400">
                          <span className="flex items-center gap-1 font-medium text-[#111827] dark:text-white">
                            <User size={11} className="text-gray-400 flex-shrink-0" />
                            {tour.visitor_name}
                          </span>
                          <a href={`mailto:${tour.visitor_email}`} className="flex items-center gap-1 hover:text-[#C9A24D] transition-colors truncate">
                            <Mail size={11} className="text-gray-400 flex-shrink-0" />
                            {tour.visitor_email}
                          </a>
                          <a href={`tel:${tour.visitor_phone}`} className="flex items-center gap-1 hover:text-[#C9A24D] transition-colors">
                            <Phone size={11} className="text-gray-400 flex-shrink-0" />
                            {tour.visitor_phone}
                          </a>
                        </div>

                        {isConfirmed ? (
                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40 rounded-md text-[10px] font-bold">
                              <Check size={10} className="flex-shrink-0" />
                              Confirmed: {formatDate(tour.confirmed_date!)} at {formatTime(tour.confirmed_time!)}
                            </span>
                            {!tour.is_completed && (
                              <button
                                onClick={() => handleUnconfirm(tour.id)}
                                disabled={isUpdating}
                                className="text-[10px] font-semibold text-gray-400 hover:text-red-500 underline transition-colors"
                              >
                                Unconfirm
                              </button>
                            )}
                          </div>
                        ) : times.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {times.map(([date, time], i) => (
                              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 dark:bg-gray-800 rounded-md text-[10px] font-semibold text-[#111827] dark:text-gray-200 border border-gray-100 dark:border-gray-700">
                                <span className="text-[#C9A24D]">{i + 1}.</span>
                                {formatDate(date)} at {formatTime(time)}
                              </span>
                            ))}
                          </div>
                        )}

                        {tour.message && (
                          <p className="mt-1.5 text-[11px] text-[#6B7280] dark:text-gray-400 italic leading-snug">
                            "{tour.message}"
                          </p>
                        )}

                        {/* Inline confirm warning panel */}
                        {isConfirming && (
                          <div className="mt-2.5 p-2.5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-lg">
                            <div className="flex items-start gap-2">
                              <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                              <p className="text-[11px] text-amber-800 dark:text-amber-400 font-medium leading-snug">
                                Have you scheduled this in ShowingTime and has the listing agent accepted the showing? Only confirm once both are done - this lets the visitor know their tour is happening.
                              </p>
                            </div>
                            {times.length > 1 && (
                              <div className="flex flex-wrap gap-1.5 mt-2 ml-5">
                                {times.map(([date, time], i) => (
                                  <button
                                    key={i}
                                    onClick={() => setSelectedSlot({ date, time })}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors ${
                                      selectedSlot?.date === date && selectedSlot?.time === time
                                        ? 'bg-[#111827] dark:bg-white text-white dark:text-[#111827] border-[#111827] dark:border-white'
                                        : 'bg-white dark:bg-[#151517] text-[#111827] dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:border-[#C9A24D]/50'
                                    }`}
                                  >
                                    {formatDate(date)} at {formatTime(time)}
                                  </button>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-2.5 ml-5">
                              <button
                                onClick={() => submitConfirm(tour.id)}
                                disabled={isUpdating}
                                className="px-3 py-1.5 bg-[#111827] dark:bg-white text-white dark:text-[#111827] rounded-lg text-[10px] font-bold hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] dark:hover:text-white transition-all"
                              >
                                {isUpdating ? 'Confirming...' : 'Yes, Confirm Tour'}
                              </button>
                              <button
                                onClick={cancelConfirming}
                                disabled={isUpdating}
                                className="px-3 py-1.5 text-[10px] font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {!isConfirming && (
                        <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                          {!isConfirmed && tour.is_completed ? (
                            <button
                              onClick={() => handleCompletionToggle(tour.id, true)}
                              disabled={isUpdating}
                              className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                            >
                              Reopen
                            </button>
                          ) : !isConfirmed ? (
                            <>
                              <button
                                onClick={() => startConfirming(tour)}
                                disabled={isUpdating}
                                className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap bg-[#111827] dark:bg-white text-white dark:text-[#111827] hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] dark:hover:text-white shadow-sm transition-all"
                              >
                                Confirm
                              </button>
                              {/* Answered another way (a call, a different home, not happening) -
                                  stops it counting as waiting on you without telling the client it's booked. */}
                              <button
                                onClick={() => handleCompletionToggle(tour.id, false)}
                                disabled={isUpdating}
                                title="You've answered this another way - stop flagging it"
                                className="text-[10px] font-semibold text-gray-400 hover:text-[#111827] dark:hover:text-white underline transition-colors"
                              >
                                Handled
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleCompletionToggle(tour.id, tour.is_completed)}
                              disabled={isUpdating}
                              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${
                                tour.is_completed
                                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                  : 'bg-[#111827] dark:bg-white text-white dark:text-[#111827] hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] dark:hover:text-white shadow-sm'
                              }`}
                            >
                              {isUpdating ? (
                                <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto"></div>
                              ) : tour.is_completed ? (
                                'Reopen'
                              ) : (
                                'Mark Done'
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-[#151517] flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-6 py-2.5 bg-[#111827] dark:bg-white text-white dark:text-[#111827] rounded-xl text-sm font-bold hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] hover:shadow-lg transition-all duration-300"
          >
            Close
          </button>
        </div>
      </div>
    </MotionModal>
  )
}
