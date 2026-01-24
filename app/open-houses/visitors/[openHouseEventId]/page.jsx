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
    <div className="min-h-screen bg-[#faf9f7] flex flex-col">
      <Header />

      <div className="flex-1 p-6 sm:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="mb-8">
            <button
              onClick={() => router.push('/open-houses')}
              className="group inline-flex items-center text-gray-500 hover:text-gray-900 font-medium mb-6 transition-colors duration-200"
            >
              <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center mr-3 group-hover:border-gray-300 group-hover:shadow-sm transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </div>
              Back to Portfolio
            </button>

            <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:justify-between">
                <div className="flex items-center">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#1a1614] rounded-2xl flex items-center justify-center mr-4 sm:mr-6 shadow-lg flex-shrink-0">
                    <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">Visitor Insights</h1>
                    <p className="text-sm sm:text-base text-gray-500 mt-1 font-light">Track and manage sign-ins from your open house event</p>
                  </div>
                </div>
                {!isLoading && !error && (
                  <div className="bg-gray-900 text-white border border-gray-800 rounded-full px-5 py-2 self-start sm:self-auto shadow-lg shadow-gray-900/10">
                    <span className="font-bold text-sm">
                      {visitors.length} <span className="font-normal text-gray-300 ml-1">Total Visitors</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="bg-transparent">
            {isLoading ? (
              <div className="flex items-center justify-center py-24 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900 mx-auto mb-4"></div>
                  <p className="text-gray-500 font-medium">Loading visitor data...</p>
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-24 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Error Loading Visitors</h3>
                <p className="text-gray-500 mb-8 max-w-sm mx-auto">{error}</p>
                <button
                  onClick={loadVisitors}
                  className="px-8 py-3 bg-gradient-to-br from-[#1a1614] via-[#3a2f25] to-[#8b7355] text-white rounded-xl font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
                >
                  Try Again
                </button>
              </div>
            ) : visitors.length === 0 ? (
              <div className="text-center py-24 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">No Visitors Yet</h3>
                <p className="text-gray-500 mb-6 max-w-sm mx-auto">When visitors sign in at your open house, they'll appear here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {visitors.map((visitor, index) => (
                  <div key={visitor.id} className="bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition-all duration-300 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)] p-6 group">
                    <div className="flex items-start justify-between">
                      {/* Visitor Info */}
                      <div className="flex-1">
                        <div className="flex items-start space-x-5">
                          {/* Avatar */}
                          <div className="relative flex-shrink-0">
                            <div className="w-14 h-14 bg-[#1a1614] rounded-2xl flex items-center justify-center shadow-md group-hover:scale-[1.02] transition-transform duration-300">
                              <span className="text-white text-lg font-bold">
                                {visitor.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                              </span>
                            </div>
                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md border border-gray-100">
                              <span className="text-gray-900 text-xs font-bold">{index + 1}</span>
                            </div>
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-[#8b7355] transition-colors">{visitor.full_name}</h3>
                                <div className="flex flex-col space-y-1.5 text-sm text-gray-500">
                                  <div className="flex items-center hover:text-gray-700 transition-colors">
                                    <svg className="w-4 h-4 mr-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    {visitor.email}
                                  </div>
                                  <div className="flex items-center hover:text-gray-700 transition-colors">
                                    <svg className="w-4 h-4 mr-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                    {visitor.phone}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Checked In</p>
                                <p className="text-sm font-bold text-gray-900">{formatDate(visitor.created_at)}</p>
                              </div>
                            </div>

                            {/* Tags and Status */}
                            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-50">
                              <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${getAgentStatusColor(visitor.has_agent)}`}>
                                {getAgentStatusLabel(visitor.has_agent)}
                              </div>

                              {visitor.interested_in_similar && (
                                <div className="inline-flex items-center px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-100">
                                  <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Interested in Similar
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
