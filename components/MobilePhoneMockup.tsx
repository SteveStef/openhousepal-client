'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Check, ArrowRight } from 'lucide-react'
import TypingAnimation from './TypingAnimation'
import { REAL_OPEN_HOUSE as OH } from './home/demos/realData'
import { OhpWordmark } from '@/components/brand/OhpBrand'

// A small gold arrow that sits just off the left edge of whatever field is currently being
// auto-filled, pointing at it - so a first-time viewer can see exactly which part of the form
// (name, email, phone, "do you have an agent?") the animation is populating at each step.
function FieldArrow() {
  return (
    <span className="pointer-events-none absolute -left-4 top-1/2 z-10 -translate-y-1/2 text-[#C9A24D]">
      <svg className="h-4 w-4 animate-arrow-nudge drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
    </span>
  )
}

export default function MobilePhoneMockup({ onSlideChange }: { onSlideChange?: (slide: number) => void } = {}) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [step1Complete, setStep1Complete] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [pressingContinue, setPressingContinue] = useState(false)

  // Lets the parent (SignInDemo) know which of the 4 slides is showing, so its own top-level
  // progress bar can give the agent-question and thank-you screens their own pages instead of
  // lumping the whole phone into one.
  useEffect(() => {
    onSlideChange?.(currentSlide)
  }, [currentSlide, onSlideChange])

  // Reset step 1 state when slide changes
  useEffect(() => {
    if (currentSlide !== 1) {
      setStep1Complete(false)
    }
  }, [currentSlide])

  // The visitor's info is fully captured by the time they reach the final Thank You screen
  // (Slide 4) - that's when a real showcase would already be generated, so the success badge
  // appears here rather than being shown the whole time.
  useEffect(() => {
    if (currentSlide === 3) {
      const t = setTimeout(() => setShowSuccess(true), 400)
      return () => clearTimeout(t)
    }
    setShowSuccess(false)
  }, [currentSlide])

  // Handle slide transitions - the Continue button visibly presses right before each advance, so
  // it reads as "the visitor tapped Continue" rather than the form just auto-jumping forward.
  const handleNextSlide = () => {
    setTimeout(() => {
      setPressingContinue(true)
      setTimeout(() => {
        setPressingContinue(false)
        setCurrentSlide((prev) => (prev + 1) % 4)
      }, 350)
    }, 900)
  }

  // Effect for Slide 3 (Your Visit) to auto-advance to the Thank You screen
  useEffect(() => {
    if (currentSlide === 2) {
      const timer = setTimeout(() => {
        setCurrentSlide(3)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [currentSlide])

  // Effect for Slide 4 (Thank You) to loop back to the start - held 3x longer than the other
  // slides so there's time to actually read the showcase invitation.
  useEffect(() => {
    if (currentSlide === 3) {
      const timer = setTimeout(() => {
        setCurrentSlide(0)
      }, 11400)
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

          {/* Phone Screen - sized to comfortably fit the content instead of a rigid phone aspect
              ratio, so the Continue button never gets clipped by the rounded bottom edge on the
              denser steps (e.g. Contact Info's two fields). */}
          <div className="relative bg-white rounded-[2.5rem] overflow-hidden min-h-[600px]">
            {/* Status Bar - pt-4 (not pt-2) keeps "9:41" clear of the top rounded corner's curve,
                which was clipping the top of the digits a little. */}
            <div className="flex justify-between items-center px-8 pt-4 pb-1 text-xs">
              <span className="font-semibold text-[#111827]">9:41</span>
              <div className="flex space-x-1 items-center text-[#111827]">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
              </div>
            </div>

            {/* App Content */}
            <div className="px-6 pt-12 pb-8 bg-[#FAFAF7] min-h-full flex flex-col">
              {/* Header - Logo and Title */}
              <div className="text-center mb-6">
                <OhpWordmark className="text-xl text-[#0B0B0B]" />
              </div>

              {/* Property Card */}
              <div className="bg-white rounded-xl border border-gray-100 mb-6 overflow-hidden shadow-sm">
                <div className="flex gap-3 p-2">
                  {/* Property Image - the same real 365 Arbor Cir listing used throughout the
                      homepage demos, not a generic placeholder. */}
                  <div className="w-20 h-20 flex-shrink-0 relative overflow-hidden rounded-lg">
                    <Image
                      src={OH.photo}
                      alt={OH.address}
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                      loading="eager"
                      priority
                      unoptimized
                    />
                  </div>
                  {/* Property Details */}
                  <div className="flex-1 py-1 min-w-0">
                    <h4 className="text-xs font-bold text-[#0B0B0B] mb-1 leading-tight truncate">{OH.address}</h4>
                    <div className="inline-block bg-[#111827] text-white px-2 py-0.5 rounded text-[10px] font-bold mb-2">
                      ${OH.price.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-medium text-[#6B7280]">
                      <div className="flex items-center whitespace-nowrap">
                        <span className="text-[#111827] font-bold mr-1">{OH.beds}</span> beds
                      </div>
                      <div className="flex items-center whitespace-nowrap">
                        <span className="text-[#111827] font-bold mr-1">{OH.baths}</span> baths
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Header with Progress - hidden on the final Thank You screen, which isn't
                  part of the step flow anymore. */}
              {currentSlide !== 3 && (
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
              )}

              {/* Sign-in Form - Slide 1: Full Name */}
              {currentSlide === 0 && (
                <div className="space-y-4 mb-4 animate-fadeIn">
                  <div>
                    <label className="block text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-1.5">Full Name*</label>
                    <div className="relative bg-white rounded-xl px-4 py-3 border border-gray-200 text-sm font-medium text-[#111827] h-[46px] flex items-center shadow-sm">
                      <FieldArrow />
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
                    <div className="relative bg-white rounded-xl px-4 py-3 border border-gray-200 text-sm font-medium text-[#111827] h-[46px] flex items-center shadow-sm">
                      {!step1Complete && <FieldArrow />}
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
                    <div className="relative bg-white rounded-xl px-4 py-3 border border-gray-200 text-sm font-medium text-[#111827] h-[46px] flex items-center shadow-sm">
                      {step1Complete && <FieldArrow />}
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

              {/* Sign-in Form - Slide 4: Thank You + Showcase invitation. The real value prop
                  ("unrepresented guests get auto-invited to their own showcase") is said once,
                  stunningly, as external text to the left of the phone (SignInDemo.tsx) once it
                  shifts over on this slide - not repeated again inside the phone's own screen. */}
              {currentSlide === 3 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center animate-fadeIn">
                  <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-5">
                    <Check className="w-8 h-8 text-white" strokeWidth={3} />
                  </div>
                  <h4 className="text-lg font-black text-[#0B0B0B] mb-6">You're All Set!</h4>
                  <div className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-[#111827] text-white py-3.5 text-xs font-black uppercase tracking-widest shadow-lg">
                    View My Showcase <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              )}

              {/* Navigation Buttons - Continue visibly presses each time the form advances, so it
                  reads as a real tap rather than the slide just auto-jumping forward. Hidden on
                  the Thank You screen, which has its own call-to-action instead. */}
              {currentSlide !== 3 && (
                <div className="grid grid-cols-2 gap-3 mt-auto pt-4">
                  <button className="flex items-center justify-center px-4 py-3 bg-white border border-gray-200 text-[#6B7280] rounded-xl font-bold text-xs uppercase tracking-wider opacity-50">
                    Back
                  </button>
                  <button className={`flex items-center justify-center px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 ${pressingContinue ? 'bg-[#C9A24D] text-[#111827] scale-95' : 'bg-[#111827] text-white scale-100 opacity-70'}`}>
                    Continue
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Success Badge - only appears once the visitor's sign-in is complete */}
      {showSuccess && (
        <div className="absolute -top-2 sm:-top-4 right-0 sm:-right-4 bg-white rounded-2xl p-3 sm:p-4 shadow-xl border border-emerald-100 scale-90 sm:scale-100 z-20 animate-success-pop">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="text-[10px] sm:text-xs">
              <div className="text-emerald-600 font-black uppercase tracking-wide">Showcase</div>
              <div className="text-[#6B7280] font-medium">Created!</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
