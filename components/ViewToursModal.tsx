'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X, Calendar, Phone, Mail, User, MapPin } from 'lucide-react'

export interface PropertyTour {
  id: string
  collection_id: string
  property_id: string
  visitor_name: string
  visitor_email: string
  visitor_phone: string
  preferred_date: string
  preferred_time: string
  preferred_date_2?: string
  preferred_time_2?: string
  preferred_date_3?: string
  preferred_time_3?: string
  message?: string
  is_completed: boolean
  created_at: string
  updated_at: string
  property?: {
    street_address?: string
    city?: string
    state?: string
    imageUrl?: string
  }
}

interface ViewToursModalProps {
  isOpen: boolean
  onClose: () => void
  tours: PropertyTour[]
  onUpdateCompletion: (tourId: string, isCompleted: boolean) => Promise<void>
  isLoading: boolean
}

export default function ViewToursModal({
  isOpen,
  onClose,
  tours,
  onUpdateCompletion,
  isLoading
}: ViewToursModalProps) {
  const [updatingTourId, setUpdatingTourId] = useState<string | null>(null)

  if (!isOpen) return null

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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-[#151517] rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-8 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#151517]">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="bg-[#111827] dark:bg-white p-2.5 sm:p-3 rounded-xl sm:rounded-2xl shadow-md">
              <Calendar className="text-white dark:text-[#111827]" size={20} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-[#111827] dark:text-white tracking-tight">Tour Requests</h2>
              <p className="text-[#6B7280] dark:text-gray-400 font-medium text-xs sm:text-sm mt-0.5">
                {tours.filter(t => !t.is_completed).length} pending review
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-[#111827] dark:hover:text-white transition-all p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-full"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#FAFAF7] dark:bg-[#0B0B0B]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#111827] dark:border-white"></div>
            </div>
          ) : tours.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-white dark:bg-[#151517] rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100 dark:border-gray-800">
                <Calendar className="h-8 w-8 text-gray-300 dark:text-gray-600" />
              </div>
              <h3 className="text-lg font-bold text-[#111827] dark:text-white mb-2">No tour requests yet</h3>
              <p className="text-[#6B7280] dark:text-gray-400">Tour requests from visitors will appear here</p>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {tours.map((tour) => (
                <div
                  key={tour.id}
                  className={`bg-white dark:bg-[#151517] rounded-2xl p-4 sm:p-6 border border-gray-100 dark:border-gray-800 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_30px_-4px_rgba(0,0,0,0.08)] hover:border-[#C9A24D]/30 transition-all duration-300 group relative ${tour.is_completed ? 'opacity-75' : ''}`}
                >
                  {/* Property Info */}
                  {tour.property && (
                    <div className="flex flex-col sm:flex-row items-start sm:space-x-5 mb-6">
                      {tour.property.imageUrl && (
                        <div className="relative w-full sm:w-20 h-40 sm:h-20 mb-4 sm:mb-0 flex-shrink-0">
                          <Image
                            src={tour.property.imageUrl}
                            alt={tour.property.street_address || 'Property'}
                            fill
                            className="object-cover rounded-xl shadow-sm"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 w-full">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-bold text-[#111827] dark:text-white text-base sm:text-lg truncate">
                              {tour.property.street_address || 'Property'}
                            </h3>
                            {tour.property.city && tour.property.state && (
                              <p className="text-sm text-[#6B7280] dark:text-gray-400 flex items-center mt-1 font-medium">
                                <MapPin size={14} className="mr-1.5 text-[#C9A24D]" />
                                {tour.property.city}, {tour.property.state}
                              </p>
                            )}
                          </div>
                          {tour.is_completed && (
                            <div className="flex items-center">
                              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                                Completed
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {!tour.is_completed && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                        {/* Visitor Info */}
                        <div className="space-y-4">
                          <h4 className="font-bold text-[#111827] dark:text-white text-[10px] sm:text-xs uppercase tracking-widest flex items-center">
                            <span className="w-1.5 h-1.5 bg-[#C9A24D] rounded-full mr-2"></span>
                            Visitor Information
                          </h4>
                          <div className="space-y-2 sm:space-y-3 text-sm">
                            <div className="flex items-center text-[#6B7280] dark:text-gray-400 group/item">
                              <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center mr-3 group-hover/item:bg-[#111827] dark:group-hover/item:bg-white transition-colors duration-300">
                                <User size={14} className="text-gray-400 dark:text-gray-500 group-hover/item:text-white dark:group-hover/item:text-[#111827]" />
                              </div>
                              <span className="font-medium text-[#111827] dark:text-white truncate">{tour.visitor_name}</span>
                            </div>
                            <div className="flex items-center text-[#6B7280] dark:text-gray-400 group/item">
                              <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center mr-3 group-hover/item:bg-[#111827] dark:group-hover/item:bg-white transition-colors duration-300">
                                <Mail size={14} className="text-gray-400 dark:text-gray-500 group-hover/item:text-white dark:group-hover/item:text-[#111827]" />
                              </div>
                              <a
                                href={`mailto:${tour.visitor_email}`}
                                className="text-[#6B7280] dark:text-gray-400 hover:text-[#C9A24D] transition-colors font-medium truncate"
                              >
                                {tour.visitor_email}
                              </a>
                            </div>
                            <div className="flex items-center text-[#6B7280] dark:text-gray-400 group/item">
                              <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center mr-3 group-hover/item:bg-[#111827] dark:group-hover/item:bg-white transition-colors duration-300">
                                <Phone size={14} className="text-gray-400 dark:text-gray-500 group-hover/item:text-white dark:group-hover/item:text-[#111827]" />
                              </div>
                              <a
                                href={`tel:${tour.visitor_phone}`}
                                className="text-[#6B7280] dark:text-gray-400 hover:text-[#C9A24D] transition-colors font-medium"
                              >
                                {tour.visitor_phone}
                              </a>
                            </div>
                          </div>
                        </div>

                        {/* Preferred Times */}
                        <div className="space-y-4">
                          <h4 className="font-bold text-[#111827] dark:text-white text-[10px] sm:text-xs uppercase tracking-widest flex items-center">
                            <span className="w-1.5 h-1.5 bg-[#C9A24D] rounded-full mr-2"></span>
                            Preferred Times
                          </h4>
                          <div className="space-y-2 sm:space-y-3 text-sm">
                            <div className="flex items-center bg-gray-50 dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                              <span className="font-bold text-[#111827] dark:text-white mr-3 bg-white dark:bg-[#151517] w-6 h-6 rounded-full flex items-center justify-center shadow-sm text-xs">1</span>
                              <span className="text-[#6B7280] dark:text-gray-300 font-medium">
                                {formatDate(tour.preferred_date)} at {formatTime(tour.preferred_time)}
                              </span>
                            </div>
                            {tour.preferred_date_2 && tour.preferred_time_2 && (
                              <div className="flex items-center bg-gray-50 dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                                <span className="font-bold text-[#111827] dark:text-white mr-3 bg-white dark:bg-[#151517] w-6 h-6 rounded-full flex items-center justify-center shadow-sm text-xs">2</span>
                                <span className="text-[#6B7280] dark:text-gray-300 font-medium">
                                  {formatDate(tour.preferred_date_2)} at {formatTime(tour.preferred_time_2)}
                                </span>
                              </div>
                            )}
                            {tour.preferred_date_3 && tour.preferred_time_3 && (
                              <div className="flex items-center bg-gray-50 dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                                <span className="font-bold text-[#111827] dark:text-white mr-3 bg-white dark:bg-[#151517] w-6 h-6 rounded-full flex items-center justify-center shadow-sm text-xs">3</span>
                                <span className="text-[#6B7280] dark:text-gray-300 font-medium">
                                  {formatDate(tour.preferred_date_3)} at {formatTime(tour.preferred_time_3)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Message */}
                      {tour.message && (
                        <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
                          <h4 className="font-bold text-[#111827] dark:text-white text-[10px] sm:text-xs uppercase tracking-widest mb-3">
                            Message
                          </h4>
                          <p className="text-sm text-[#6B7280] dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-3 sm:p-4 rounded-xl border border-gray-100 dark:border-gray-700 italic leading-relaxed">
                            "{tour.message}"
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Completion Toggle */}
                  <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <button
                      onClick={() => handleCompletionToggle(tour.id, tour.is_completed)}
                      disabled={updatingTourId === tour.id}
                      className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center space-x-2 ${
                        tour.is_completed
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                          : 'bg-[#111827] dark:bg-white text-white dark:text-[#111827] hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] dark:hover:text-white shadow-md'
                      }`}
                    >
                      {updatingTourId === tour.id ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      ) : tour.is_completed ? (
                        <span>Mark Incomplete</span>
                      ) : (
                        <span>Mark Completed</span>
                      )}
                    </button>
                    <span className="text-[10px] sm:text-xs font-medium text-gray-400 dark:text-gray-500">
                      Requested {new Date(tour.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 sm:p-8 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-[#151517] sticky bottom-0 z-10">
          <button
            onClick={onClose}
            className="w-full px-6 py-3.5 sm:py-4 bg-[#111827] dark:bg-white text-white dark:text-[#111827] rounded-xl font-bold hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] hover:shadow-xl hover:scale-[1.01] transition-all duration-300 shadow-lg shadow-[#111827]/10"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
