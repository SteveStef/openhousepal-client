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
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED'
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
  onUpdateStatus: (tourId: string, status: string) => Promise<void>
  isLoading: boolean
}

export default function ViewToursModal({
  isOpen,
  onClose,
  tours,
  onUpdateStatus,
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

  const handleStatusUpdate = async (tourId: string, newStatus: string) => {
    setUpdatingTourId(tourId)
    try {
      await onUpdateStatus(tourId, newStatus)
    } finally {
      setUpdatingTourId(null)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'CONFIRMED':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'CANCELLED':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 sm:p-8 border-b border-gray-100 bg-white">
          <div className="flex items-center space-x-4">
            <div className="bg-[#111827] p-3 rounded-2xl shadow-md">
              <Calendar className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-[#111827] tracking-tight">Tour Requests</h2>
              <p className="text-[#6B7280] font-medium text-sm mt-0.5">
                {tours.length} {tours.length === 1 ? 'request' : 'requests'} pending your review
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-[#111827] transition-all p-2 hover:bg-gray-50 rounded-full"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-[#FAFAF7]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#111827]"></div>
            </div>
          ) : tours.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100">
                <Calendar className="h-8 w-8 text-gray-300" />
              </div>
              <h3 className="text-lg font-bold text-[#111827] mb-2">No tour requests yet</h3>
              <p className="text-[#6B7280]">Tour requests from visitors will appear here</p>
            </div>
          ) : (
            <div className="space-y-6">
              {tours.map((tour) => (
                <div
                  key={tour.id}
                  className="bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_30px_-4px_rgba(0,0,0,0.08)] hover:border-[#C9A24D]/30 transition-all duration-300 group"
                >
                  {/* Property Info */}
                  {tour.property && (
                    <div className="flex items-start space-x-5 mb-6 pb-6 border-b border-gray-100">
                      {tour.property.imageUrl && (
                        <div className="relative w-20 h-20 flex-shrink-0">
                          <Image
                            src={tour.property.imageUrl}
                            alt={tour.property.street_address || 'Property'}
                            fill
                            className="object-cover rounded-xl shadow-sm"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold text-[#111827] text-lg truncate">
                              {tour.property.street_address || 'Property'}
                            </h3>
                            {tour.property.city && tour.property.state && (
                              <p className="text-sm text-[#6B7280] flex items-center mt-1 font-medium">
                                <MapPin size={14} className="mr-1.5 text-[#C9A24D]" />
                                {tour.property.city}, {tour.property.state}
                              </p>
                            )}
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${getStatusColor(
                              tour.status
                            )}`}
                          >
                            {tour.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Visitor Info */}
                    <div className="space-y-4">
                      <h4 className="font-bold text-[#111827] text-xs uppercase tracking-widest flex items-center">
                        <span className="w-1.5 h-1.5 bg-[#C9A24D] rounded-full mr-2"></span>
                        Visitor Information
                      </h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center text-[#6B7280] group/item">
                          <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center mr-3 group-hover/item:bg-[#111827] transition-colors duration-300">
                            <User size={14} className="text-gray-400 group-hover/item:text-white" />
                          </div>
                          <span className="font-medium text-[#111827]">{tour.visitor_name}</span>
                        </div>
                        <div className="flex items-center text-[#6B7280] group/item">
                          <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center mr-3 group-hover/item:bg-[#111827] transition-colors duration-300">
                            <Mail size={14} className="text-gray-400 group-hover/item:text-white" />
                          </div>
                          <a
                            href={`mailto:${tour.visitor_email}`}
                            className="text-[#6B7280] hover:text-[#C9A24D] transition-colors font-medium"
                          >
                            {tour.visitor_email}
                          </a>
                        </div>
                        <div className="flex items-center text-[#6B7280] group/item">
                          <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center mr-3 group-hover/item:bg-[#111827] transition-colors duration-300">
                            <Phone size={14} className="text-gray-400 group-hover/item:text-white" />
                          </div>
                          <a
                            href={`tel:${tour.visitor_phone}`}
                            className="text-[#6B7280] hover:text-[#C9A24D] transition-colors font-medium"
                          >
                            {tour.visitor_phone}
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Preferred Times */}
                    <div className="space-y-4">
                      <h4 className="font-bold text-[#111827] text-xs uppercase tracking-widest flex items-center">
                        <span className="w-1.5 h-1.5 bg-[#C9A24D] rounded-full mr-2"></span>
                        Preferred Times
                      </h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center bg-gray-50 rounded-xl p-3 border border-gray-100">
                          <span className="font-bold text-[#111827] mr-3 bg-white w-6 h-6 rounded-full flex items-center justify-center shadow-sm text-xs">1</span>
                          <span className="text-[#6B7280] font-medium">
                            {formatDate(tour.preferred_date)} at {formatTime(tour.preferred_time)}
                          </span>
                        </div>
                        {tour.preferred_date_2 && tour.preferred_time_2 && (
                          <div className="flex items-center bg-gray-50 rounded-xl p-3 border border-gray-100">
                            <span className="font-bold text-[#111827] mr-3 bg-white w-6 h-6 rounded-full flex items-center justify-center shadow-sm text-xs">2</span>
                            <span className="text-[#6B7280] font-medium">
                              {formatDate(tour.preferred_date_2)} at {formatTime(tour.preferred_time_2)}
                            </span>
                          </div>
                        )}
                        {tour.preferred_date_3 && tour.preferred_time_3 && (
                          <div className="flex items-center bg-gray-50 rounded-xl p-3 border border-gray-100">
                            <span className="font-bold text-[#111827] mr-3 bg-white w-6 h-6 rounded-full flex items-center justify-center shadow-sm text-xs">3</span>
                            <span className="text-[#6B7280] font-medium">
                              {formatDate(tour.preferred_date_3)} at {formatTime(tour.preferred_time_3)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Message */}
                  {tour.message && (
                    <div className="mt-6 pt-6 border-t border-gray-100">
                      <h4 className="font-bold text-[#111827] text-xs uppercase tracking-widest mb-3">
                        Message
                      </h4>
                      <p className="text-sm text-[#6B7280] bg-gray-50 p-4 rounded-xl border border-gray-100 italic leading-relaxed">
                        "{tour.message}"
                      </p>
                    </div>
                  )}

                  {/* Status Update */}
                  <div className="mt-6 pt-6 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <label htmlFor={`status-${tour.id}`} className="text-sm font-bold text-[#111827]">
                        Update Status:
                      </label>
                      <div className="relative">
                        <select
                          id={`status-${tour.id}`}
                          value={tour.status}
                          onChange={(e) => handleStatusUpdate(tour.id, e.target.value)}
                          disabled={updatingTourId === tour.id}
                          className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#C9A24D]/20 focus:border-[#C9A24D] transition-all text-sm font-medium text-[#111827] cursor-pointer hover:border-gray-300 disabled:opacity-50 pr-10 appearance-none"
                        >
                          <option value="PENDING">Pending</option>
                          <option value="CONFIRMED">Confirmed</option>
                          <option value="CANCELLED">Cancelled</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-gray-400">
                      Requested {new Date(tour.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 sm:p-8 border-t border-gray-100 bg-white sticky bottom-0 z-10">
          <button
            onClick={onClose}
            className="w-full px-6 py-4 bg-[#111827] text-white rounded-xl font-bold hover:bg-[#C9A24D] hover:shadow-xl hover:scale-[1.01] transition-all duration-300 shadow-lg shadow-[#111827]/10"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
