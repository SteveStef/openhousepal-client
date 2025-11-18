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
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200/60 max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200/60 bg-gradient-to-r from-[#8b7355] to-[#7a6549] rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Calendar className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Tour Requests</h2>
              <p className="text-white/90 text-sm mt-1">
                {tours.length} {tours.length === 1 ? 'request' : 'requests'}
              </p>
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
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8b7355]"></div>
            </div>
          ) : tours.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="mx-auto h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No tour requests yet</h3>
              <p className="text-gray-600">Tour requests from visitors will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tours.map((tour) => (
                <div
                  key={tour.id}
                  className="bg-gray-50 rounded-xl p-5 border border-gray-200 hover:border-[#8b7355]/30 transition-colors"
                >
                  {/* Property Info */}
                  {tour.property && (
                    <div className="flex items-start space-x-4 mb-4 pb-4 border-b border-gray-200">
                      {tour.property.imageUrl && (
                        <Image
                          src={tour.property.imageUrl}
                          alt={tour.property.street_address || 'Property'}
                          width={80}
                          height={80}
                          className="w-20 h-20 object-cover rounded-lg"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold text-gray-900">
                              {tour.property.street_address || 'Property'}
                            </h3>
                            {tour.property.city && tour.property.state && (
                              <p className="text-sm text-gray-600 flex items-center mt-1">
                                <MapPin size={14} className="mr-1" />
                                {tour.property.city}, {tour.property.state}
                              </p>
                            )}
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                              tour.status
                            )}`}
                          >
                            {tour.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Visitor Info */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                        Visitor Information
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center text-gray-700">
                          <User size={16} className="mr-2 text-gray-400" />
                          <span>{tour.visitor_name}</span>
                        </div>
                        <div className="flex items-center text-gray-700">
                          <Mail size={16} className="mr-2 text-gray-400" />
                          <a
                            href={`mailto:${tour.visitor_email}`}
                            className="text-[#8b7355] hover:underline"
                          >
                            {tour.visitor_email}
                          </a>
                        </div>
                        <div className="flex items-center text-gray-700">
                          <Phone size={16} className="mr-2 text-gray-400" />
                          <a
                            href={`tel:${tour.visitor_phone}`}
                            className="text-[#8b7355] hover:underline"
                          >
                            {tour.visitor_phone}
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Preferred Times */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                        Preferred Times
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-start">
                          <span className="font-semibold text-gray-900 mr-2">1.</span>
                          <span className="text-gray-700">
                            {formatDate(tour.preferred_date)} at {formatTime(tour.preferred_time)}
                          </span>
                        </div>
                        {tour.preferred_date_2 && tour.preferred_time_2 && (
                          <div className="flex items-start">
                            <span className="font-semibold text-gray-900 mr-2">2.</span>
                            <span className="text-gray-700">
                              {formatDate(tour.preferred_date_2)} at {formatTime(tour.preferred_time_2)}
                            </span>
                          </div>
                        )}
                        {tour.preferred_date_3 && tour.preferred_time_3 && (
                          <div className="flex items-start">
                            <span className="font-semibold text-gray-900 mr-2">3.</span>
                            <span className="text-gray-700">
                              {formatDate(tour.preferred_date_3)} at {formatTime(tour.preferred_time_3)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Message */}
                  {tour.message && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h4 className="font-semibold text-gray-900 text-sm uppercase tracking-wide mb-2">
                        Message
                      </h4>
                      <p className="text-sm text-gray-700 bg-white p-3 rounded-lg border border-gray-200">
                        {tour.message}
                      </p>
                    </div>
                  )}

                  {/* Status Update */}
                  <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <label htmlFor={`status-${tour.id}`} className="text-sm font-medium text-gray-700">
                        Update Status:
                      </label>
                      <select
                        id={`status-${tour.id}`}
                        value={tour.status}
                        onChange={(e) => handleStatusUpdate(tour.id, e.target.value)}
                        disabled={updatingTourId === tour.id}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355] transition-colors text-sm disabled:opacity-50"
                      >
                        <option value="PENDING">Pending</option>
                        <option value="CONFIRMED">Confirmed</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </div>
                    <span className="text-xs text-gray-500">
                      Requested: {new Date(tour.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-lg font-medium hover:shadow-lg hover:shadow-[#8b7355]/25 transition-all duration-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
