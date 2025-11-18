'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

export default function MobilePhoneMockup() {
  const [currentSlide, setCurrentSlide] = useState(0)

  // Auto-rotate slideshow every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % 3)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative">
      {/* Mobile Phone Mockup */}
      <div className="relative max-w-xs mx-auto">
        {/* Phone Frame */}
        <div className="relative bg-gray-900 rounded-[3rem] p-3 shadow-2xl">
          {/* Phone Notch */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-40 h-7 bg-gray-900 rounded-b-3xl z-10"></div>

          {/* Phone Screen */}
          <div className="relative bg-white rounded-[2.5rem] overflow-hidden" style={{ aspectRatio: '9/19.5' }}>
            {/* Status Bar */}
            <div className="flex justify-between items-center px-8 pt-2 pb-1 text-xs">
              <span className="font-semibold">9:41</span>
              <div className="flex space-x-1 items-center">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
              </div>
            </div>

            {/* App Content */}
            <div className="px-6 pt-12 pb-4 bg-gradient-to-br from-[#faf9f7] to-white min-h-full">
              {/* Header - House Icon and Title */}
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-[#8b7355] to-[#7a6549] rounded-xl mb-2">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-gray-900">Open House Sign-in</h3>
              </div>

              {/* Property Card */}
              <div className="bg-white rounded-xl border border-gray-200 mb-4 overflow-hidden">
                <div className="flex gap-2">
                  {/* Property Image */}
                  <div className="w-20 h-20 flex-shrink-0 relative overflow-hidden">
                    <Image
                      src="/home.jpg"
                      alt="Property"
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {/* Property Details */}
                  <div className="flex-1 py-2 pr-2 min-w-0">
                    <h4 className="text-xs font-bold text-gray-900 mb-1 leading-tight">123 Main Street</h4>
                    <div className="inline-block bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white px-1.5 py-0.5 rounded text-xs font-semibold mb-1.5">
                      $941,900
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <div className="flex items-center whitespace-nowrap">
                        <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        <span>4 beds</span>
                      </div>
                      <div className="flex items-center whitespace-nowrap">
                        <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                        </svg>
                        <span>2.5 baths</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Header with Progress */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-base font-bold text-gray-900 transition-opacity duration-300">
                    {currentSlide === 0 && 'Your Info'}
                    {currentSlide === 1 && 'Contact Info'}
                    {currentSlide === 2 && 'Your Visit'}
                  </h4>
                  <span className="text-xs text-gray-600">
                    {currentSlide + 1} of 4
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-1.5 mb-4">
                  <div
                    className="bg-gradient-to-r from-[#8b7355] to-[#7a6549] h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${((currentSlide + 1) / 4) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Sign-in Form - Slide 1: Full Name */}
              {currentSlide === 0 && (
                <div className="space-y-3 mb-4 animate-fadeIn">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Full Name*</label>
                    <div className="bg-white rounded-lg px-3 py-2 border border-gray-200 text-sm text-gray-400">
                      John Smith
                    </div>
                  </div>
                </div>
              )}

              {/* Sign-in Form - Slide 2: Contact Info */}
              {currentSlide === 1 && (
                <div className="space-y-3 mb-4 animate-fadeIn">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Email*</label>
                    <div className="bg-white rounded-lg px-3 py-2 border border-gray-200 text-sm text-gray-400">
                      your.email@example.com
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Phone*</label>
                    <div className="bg-white rounded-lg px-3 py-2 border border-gray-200 text-sm text-gray-400">
                      (555) 123-4567
                    </div>
                  </div>
                </div>
              )}

              {/* Sign-in Form - Slide 3: Your Visit */}
              {currentSlide === 2 && (
                <div className="space-y-3 mb-4 animate-fadeIn">
                  <div className="bg-gray-50 rounded-lg p-3 text-center mb-2">
                    <p className="text-gray-900 text-sm">Do you have an agent?</p>
                  </div>

                  <div className="space-y-2">
                    <button className="w-full py-3 px-4 rounded-lg font-semibold text-sm bg-[#8b7355] text-white shadow-md">
                      No
                    </button>

                    <button className="w-full py-3 px-4 rounded-lg font-semibold text-sm bg-white border-2 border-gray-300 text-gray-700">
                      Yes
                    </button>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button className="flex items-center justify-center px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <button className="flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-lg font-medium text-sm">
                  Continue
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Success Badge */}
      <div className="absolute -top-4 -right-4 bg-white rounded-2xl p-3 shadow-xl border border-gray-200 animate-bounce">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-r from-[#8b7355] to-[#7a6549] rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="text-xs">
            <div className="text-gray-900 font-bold">Showcase</div>
            <div className="text-gray-600">Created!</div>
          </div>
        </div>
      </div>
    </div>
  )
}
