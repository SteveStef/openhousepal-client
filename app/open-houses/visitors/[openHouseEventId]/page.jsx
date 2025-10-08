'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { openHouseApi } from '@/lib/api'

export default function OpenHouseVisitorsPage() {
  const router = useRouter()
  const params = useParams()
  const openHouseEventId = params.openHouseEventId

  const [visitors, setVisitors] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadVisitors()
  }, [openHouseEventId])

  const loadVisitors = async () => {
    try {
      setIsLoading(true)
      setError('')
      const response = await openHouseApi.getVisitors(openHouseEventId)

      if (response.success && response.data) {
        setVisitors(response.data)
      } else {
        setError(response.error || 'Failed to load visitors')
      }
    } catch (err) {
      console.error('Error loading visitors:', err)
      setError('Failed to load visitors')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getTimeframeLabel = (timeframe) => {
    const labels = {
      'IMMEDIATELY': 'Immediately',
      '1_3_MONTHS': '1-3 Months',
      '3_6_MONTHS': '3-6 Months',
      '6_12_MONTHS': '6-12 Months',
      'OVER_YEAR': 'Over a Year',
      'NOT_SURE': 'Not Sure'
    }
    return labels[timeframe] || timeframe
  }

  const getAgentStatusLabel = (status) => {
    const labels = {
      'YES': 'Has Agent',
      'NO': 'No Agent',
      'LOOKING': 'Looking for Agent'
    }
    return labels[status] || status
  }

  const getAgentStatusColor = (status) => {
    const colors = {
      'YES': 'bg-blue-100 text-blue-800 border-blue-200',
      'NO': 'bg-green-100 text-green-800 border-green-200',
      'LOOKING': 'bg-purple-100 text-purple-800 border-purple-200'
    }
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf9f7] via-white to-[#f5f4f2] flex flex-col">
      <Header />

      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="mb-6">
            <button
              onClick={() => router.push('/open-houses')}
              className="inline-flex items-center text-[#8b7355] hover:text-[#7a6549] font-medium mb-4 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Open Houses
            </button>

            <div className="bg-white/95 rounded-2xl shadow-xl border border-gray-200/60 backdrop-blur-lg p-4 md:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:justify-between">
                <div className="flex items-center">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-[#8b7355] to-[#7a6549] rounded-2xl flex items-center justify-center mr-3 sm:mr-4 shadow-lg flex-shrink-0">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Open House Visitors</h1>
                    <p className="text-sm sm:text-base text-gray-600 mt-1">View all visitors who signed in at this open house</p>
                  </div>
                </div>
                {!isLoading && !error && (
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/50 rounded-xl px-4 py-2 self-start sm:self-auto">
                    <span className="text-emerald-700 font-semibold text-sm">
                      {visitors.length} Visitor{visitors.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="bg-white/95 rounded-2xl shadow-xl border border-gray-200/60 backdrop-blur-lg p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8b7355] mx-auto mb-4"></div>
                  <p className="text-gray-600 font-medium">Loading visitors...</p>
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Error Loading Visitors</h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <button
                  onClick={loadVisitors}
                  className="px-6 py-2 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-lg font-medium hover:shadow-lg hover:shadow-[#8b7355]/25 transition-all duration-300"
                >
                  Try Again
                </button>
              </div>
            ) : visitors.length === 0 ? (
              <div className="text-center py-16 bg-gradient-to-br from-gray-50/50 to-gray-100/30 rounded-2xl border-2 border-dashed border-gray-200">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">No Visitors Yet</h3>
                <p className="text-gray-600 mb-4 max-w-sm mx-auto">When visitors sign in at your open house, they'll appear here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {visitors.map((visitor, index) => (
                  <div key={visitor.id} className="bg-gradient-to-r from-white to-gray-50/50 rounded-xl border border-gray-200/60 hover:border-gray-300/80 transition-all duration-300 hover:shadow-md p-5">
                    <div className="flex items-start justify-between">
                      {/* Visitor Info */}
                      <div className="flex-1">
                        <div className="flex items-start space-x-4">
                          {/* Avatar */}
                          <div className="relative flex-shrink-0">
                            <div className="w-12 h-12 bg-gradient-to-r from-[#8b7355] to-[#7a6549] rounded-xl flex items-center justify-center shadow-sm">
                              <span className="text-white text-lg font-bold">
                                {visitor.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                              </span>
                            </div>
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-200">
                              <span className="text-[#8b7355] text-xs font-bold">{index + 1}</span>
                            </div>
                          </div>

                          {/* Details */}
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h3 className="text-lg font-bold text-gray-900 mb-1">{visitor.full_name}</h3>
                                <div className="flex flex-col space-y-1 text-sm text-gray-600">
                                  <div className="flex items-center">
                                    <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    {visitor.email}
                                  </div>
                                  <div className="flex items-center">
                                    <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                    {visitor.phone}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Visited</p>
                                <p className="text-sm font-semibold text-gray-700">{formatDate(visitor.created_at)}</p>
                              </div>
                            </div>

                            {/* Tags and Status */}
                            <div className="flex flex-wrap gap-2">
                              <div className="inline-flex items-center px-3 py-1 bg-gradient-to-r from-purple-50 to-purple-100/50 text-purple-700 rounded-lg text-xs font-medium border border-purple-200/50">
                                <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {getTimeframeLabel(visitor.timeframe)}
                              </div>

                              <div className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium border ${getAgentStatusColor(visitor.has_agent)}`}>
                                <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                {getAgentStatusLabel(visitor.has_agent)}
                              </div>

                              {visitor.interested_in_similar && (
                                <div className="inline-flex items-center px-3 py-1 bg-gradient-to-r from-emerald-50 to-emerald-100/50 text-emerald-700 rounded-lg text-xs font-medium border border-emerald-200/50">
                                  <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Interested in Similar Properties
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
