'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import TypingAnimation from './TypingAnimation'

export default function MobilePhoneMockup() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [step1Complete, setStep1Complete] = useState(false)

  // Reset step 1 state when slide changes
  useEffect(() => {
    if (currentSlide !== 1) {
      setStep1Complete(false)
    }
  }, [currentSlide])

  // Handle slide transitions
  const handleNextSlide = () => {
    setTimeout(() => {
      setCurrentSlide((prev) => (prev + 1) % 3)
    }, 1500)
  }

  // Effect for Slide 2 (Selection) to auto-advance
  useEffect(() => {
    if (currentSlide === 2) {
      const timer = setTimeout(() => {
        setCurrentSlide(0)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [currentSlide])

  return (
    <div className="relative">
      {/* Mobile Phone Mockup */}
      <div className="relative max-w-xs mx-auto">
        {/* Phone Frame */}
        <div className="relative bg-[#111827] rounded-[3rem] p-3 shadow-2xl">
          {/* Phone Notch */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-40 h-7 bg-[#111827] rounded-b-3xl z-10"></div>

          {/* Phone Screen */}
          <div className="relative bg-white rounded-[2.5rem] overflow-hidden" style={{ aspectRatio: '9/19.5' }}>
            {/* Status Bar */}
            <div className="flex justify-between items-center px-8 pt-2 pb-1 text-xs">
              <span className="font-semibold text-[#111827]">9:41</span>
              <div className="flex space-x-1 items-center text-[#111827]">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
              </div>
            </div>

            {/* App Content */}
            <div className="px-6 pt-12 pb-4 bg-[#FAFAF7] min-h-full">
              {/* Header - Logo and Title */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center mb-2">
                  <Image
                    src="/logo.png"
                    alt="Logo"
                    width={40}
                    height={22}
                    className="h-8 w-auto"
                  />
                </div>
                <h3 className="text-base font-black text-[#0B0B0B] tracking-tight">OpenHousePal</h3>
              </div>

              {/* Property Card */}
              <div className="bg-white rounded-xl border border-gray-100 mb-6 overflow-hidden shadow-sm">
                <div className="flex gap-3 p-2">
                  {/* Property Image */}
                  <div className="w-20 h-20 flex-shrink-0 relative overflow-hidden rounded-lg">
                    <Image
                      src="/home.jpg"
                      alt="Property"
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {/* Property Details */}
                  <div className="flex-1 py-1 min-w-0">
                    <h4 className="text-xs font-bold text-[#0B0B0B] mb-1 leading-tight">123 Main Street</h4>
                    <div className="inline-block bg-[#111827] text-white px-2 py-0.5 rounded text-[10px] font-bold mb-2">
                      $941,900
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-medium text-[#6B7280]">
                      <div className="flex items-center whitespace-nowrap">
                        <span className="text-[#111827] font-bold mr-1">4</span> beds
                      </div>
                      <div className="flex items-center whitespace-nowrap">
                        <span className="text-[#111827] font-bold mr-1">2.5</span> baths
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Header with Progress */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-[#0B0B0B] transition-opacity duration-300">
                    {currentSlide === 0 && 'Your Info'}
                    {currentSlide === 1 && 'Contact Info'}
                    {currentSlide === 2 && 'Your Visit'}
                  </h4>
                  <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">
                    {currentSlide + 1} of 4
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-1 mb-6">
                  <div
                    className="bg-[#C9A24D] h-1 rounded-full transition-all duration-500"
                    style={{ width: `${((currentSlide + 1) / 4) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Sign-in Form - Slide 1: Full Name */}
              {currentSlide === 0 && (
                <div className="space-y-4 mb-4 animate-fadeIn">
                  <div>
                    <label className="block text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-1.5">Full Name*</label>
                    <div className="bg-white rounded-xl px-4 py-3 border border-gray-200 text-sm font-medium text-[#111827] h-[46px] flex items-center shadow-sm">
                      <TypingAnimation 
                        text="John Smith" 
                        onComplete={handleNextSlide}
                        startDelay={500}
                        speed={80}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Sign-in Form - Slide 2: Contact Info */}
              {currentSlide === 1 && (
                <div className="space-y-4 mb-4 animate-fadeIn">
                  <div>
                    <label className="block text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-1.5">Email*</label>
                    <div className="bg-white rounded-xl px-4 py-3 border border-gray-200 text-sm font-medium text-[#111827] h-[46px] flex items-center shadow-sm">
                      <TypingAnimation 
                        text="john@example.com" 
                        onComplete={() => setStep1Complete(true)}
                        startDelay={500}
                        speed={50}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-1.5">Phone*</label>
                    <div className="bg-white rounded-xl px-4 py-3 border border-gray-200 text-sm font-medium text-[#111827] h-[46px] flex items-center shadow-sm">
                      {step1Complete && (
                        <TypingAnimation 
                          text="(555) 123-4567" 
                          onComplete={handleNextSlide}
                          startDelay={200}
                          speed={60}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Sign-in Form - Slide 3: Your Visit */}
              {currentSlide === 2 && (
                <div className="space-y-4 mb-4 animate-fadeIn">
                  <div className="bg-white rounded-xl p-4 text-center mb-2 border border-gray-100 shadow-sm">
                    <p className="text-[#111827] text-sm font-medium">Do you have an agent?</p>
                  </div>

                  <div className="space-y-3">
                    <button className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-[#111827] text-white shadow-lg transform active:scale-95 transition-all animate-pulse">
                      No
                    </button>

                    <button className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-white border-2 border-gray-200 text-[#6B7280] opacity-50">
                      Yes
                    </button>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="grid grid-cols-2 gap-3 opacity-50 mt-auto pt-4">
                <button className="flex items-center justify-center px-4 py-3 bg-white border border-gray-200 text-[#6B7280] rounded-xl font-bold text-xs uppercase tracking-wider">
                  Back
                </button>
                <button className="flex items-center justify-center px-4 py-3 bg-[#111827] text-white rounded-xl font-bold text-xs uppercase tracking-wider">
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Success Badge */}
      <div className="absolute -top-4 -right-4 bg-white rounded-2xl p-4 shadow-xl border border-gray-100 animate-bounce">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-[#111827] rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-[#C9A24D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="text-xs">
            <div className="text-[#0B0B0B] font-black uppercase tracking-wide">Showcase</div>
            <div className="text-[#6B7280] font-medium">Created!</div>
          </div>
        </div>
      </div>
    </div>
  )
}
