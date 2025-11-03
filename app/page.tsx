'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import Header from '@/components/Header'

function FAQItem({ faq, index, isVisible }: { faq: { question: string; answer: string }; index: number; isVisible: boolean }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 shadow-sm transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-gray-50 transition-colors duration-200 rounded-xl"
      >
        <h5 className="text-base font-semibold text-gray-900 pr-4">{faq.question}</h5>
        <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
          {isOpen ? (
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          )}
        </div>
      </button>
      {isOpen && (
        <div className="px-6 pb-5 pt-0">
          <p className="text-gray-600 leading-relaxed text-sm">{faq.answer}</p>
        </div>
      )}
    </div>
  )
}

export default function HomePage() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf9f7] via-white to-[#f5f4f2] flex flex-col overflow-hidden">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Static Floating Orbs */}
        <div className="absolute w-96 h-96 bg-gradient-to-r from-[#8b7355]/20 to-[#8b7355]/10 rounded-full blur-3xl animate-pulse" style={{ top: '10%', left: '10%' }} />
        <div className="absolute w-72 h-72 bg-gradient-to-r from-[#8b7355]/15 to-[#8b7355]/25 rounded-full blur-3xl animate-pulse" style={{ top: '60%', right: '10%', animationDelay: '2s' }} />
        <div className="absolute w-80 h-80 bg-gradient-to-r from-[#8b7355]/10 to-[#8b7355]/20 rounded-full blur-3xl animate-pulse" style={{ top: '40%', left: '50%', animationDelay: '4s' }} />
        
        {/* Floating Particles - Client-side only to avoid hydration mismatch */}
        {isVisible && (
          <div className="absolute inset-0">
            {[...Array(15)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-[#8b7355]/60 rounded-full animate-float"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 10}s`,
                  animationDuration: `${8 + Math.random() * 4}s`
                }}
              />
            ))}
            {[...Array(8)].map((_, i) => (
              <div
                key={`large-${i}`}
                className="absolute w-3 h-3 bg-[#8b7355]/50 rounded-full animate-float"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 15}s`,
                  animationDuration: `${12 + Math.random() * 6}s`
                }}
              />
            ))}
            {[...Array(5)].map((_, i) => (
              <div
                key={`accent-${i}`}
                className="absolute w-2 h-2 bg-[#8b7355]/55 rounded-full animate-float"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 20}s`,
                  animationDuration: `${10 + Math.random() * 5}s`
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className={`relative z-10 transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'}`}>
        <Header mode="landing" />
      </div>

      {/* Hero Section */}
      <div className="flex-1 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className={`py-20 lg:py-32 transform transition-all duration-1000 delay-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left Content */}
              <div className="text-left">
                <div className="inline-flex items-center px-4 py-2 bg-[#f5f4f2]/80 rounded-full border border-gray-200/60 mb-8 shadow-sm">
                  <div className="w-2 h-2 bg-[#8b7355] rounded-full animate-pulse mr-3"></div>
                  <span className="text-sm text-gray-700">Trusted by 500+ Real Estate Agents</span>
                </div>
                
                <h2 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                  Transform Open Houses Into{' '}
                  <span className="bg-gradient-to-r from-[#8b7355] via-[#8b7355] to-[#7a6549] bg-clip-text text-transparent">
                    Lead Machines
                  </span>
                </h2>
                
                <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                  Help agents capture visitor information at open houses and organize property recommendations. 
                  Keep track of leads and follow up with interested buyers efficiently.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 mb-12">
                  <Link
                    href="/register"
                    className="group relative px-8 py-4 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-xl font-semibold overflow-hidden transform transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-[#8b7355]/25"
                  >
                    <span className="relative z-10 flex items-center justify-center">
                      Start Free Trial
                      <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-[#7a6549] to-[#6b5a43] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
                  </Link>
                  <Link
                    href="/open-house/demo-qr"
                    className="group px-8 py-4 bg-[#f5f4f2]/80 text-gray-900 rounded-xl font-semibold border border-gray-300 hover:bg-[#f5f4f2] hover:border-gray-400 transition-all duration-300 hover:scale-105 backdrop-blur-sm shadow-sm"
                  >
                    <span className="flex items-center justify-center">
                      Watch Demo
                    </span>
                  </Link>
                </div>
                
                {/* Key Benefits */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-[#8b7355]/20 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#8b7355]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-gray-700 font-medium">Instant Setup</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-[#8b7355]/20 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#8b7355]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <span className="text-gray-700 font-medium">AI Powered</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-[#8b7355]/20 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#8b7355]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <span className="text-gray-700 font-medium">Real-time Analytics</span>
                  </div>
                </div>
              </div>
              
              {/* Right Visual */}
              <div className="relative lg:pl-8">
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
                        <div className="px-6 py-4 bg-gradient-to-br from-[#faf9f7] to-white min-h-full">
                          {/* Header */}
                          <div className="text-center mb-6">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-[#8b7355] to-[#7a6549] rounded-2xl mb-3">
                              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                              </svg>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">Welcome to Open House</h3>
                            <p className="text-xs text-gray-600">123 Main St, West Chester PA</p>
                          </div>

                          {/* Sign-in Form */}
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
                              <div className="bg-white rounded-lg px-3 py-2 border border-gray-200 text-sm text-gray-400">
                                John Smith
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                              <div className="bg-white rounded-lg px-3 py-2 border border-gray-200 text-sm text-gray-400">
                                john@example.com
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number</label>
                              <div className="bg-white rounded-lg px-3 py-2 border border-gray-200 text-sm text-gray-400">
                                (555) 123-4567
                              </div>
                            </div>

                            <div className="pt-2">
                              <label className="block text-xs font-medium text-gray-900 mb-2">What are you looking for?</label>
                              <div className="grid grid-cols-3 gap-2 mb-2">
                                <div className="bg-[#8b7355] text-white rounded-lg px-2 py-1.5 text-xs text-center font-medium">
                                  3 Beds
                                </div>
                                <div className="bg-[#8b7355] text-white rounded-lg px-2 py-1.5 text-xs text-center font-medium">
                                  2 Baths
                                </div>
                                <div className="bg-white rounded-lg px-2 py-1.5 text-xs text-center border border-gray-200 text-gray-400">
                                  2 Cars
                                </div>
                              </div>
                              <div className="bg-white rounded-lg px-3 py-2 border border-gray-200 text-sm text-gray-400 mb-3">
                                $300k - $400k
                              </div>
                            </div>

                            <button className="w-full bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-lg py-3 font-semibold text-sm shadow-lg">
                              Get My Property Matches
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
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="relative z-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="py-20">
            <div className={`text-center mb-16 transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
              <h3 className="text-5xl font-bold text-gray-900 mb-6 font-light">How Open House Pal Works</h3>
              <p className="text-xl text-gray-600 font-light max-w-3xl mx-auto">
                From QR code creation to tour bookings - a complete lead generation workflow in four simple steps
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
              
              {[
                {
                  step: 1,
                  title: "Create Your Open House",
                  description: "Enter the property address and our system instantly fetches data from Zillow. Select your favorite photo for marketing materials, generate a custom QR code, and download professional PDF flyers to display at the open house.",
                  icon: (
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  ),
                  color: "from-[#8b7355] to-[#7a6549]",
                  delay: "delay-200"
                },
                {
                  step: 2,
                  title: "Visitors Sign In",
                  description: "Open house visitors scan your QR code and complete a simple 4-step form. They provide their name, contact info, purchase timeframe, agent status, and whether they're interested in seeing similar properties.",
                  icon: (
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                  ),
                  color: "from-[#8b7355] to-[#7a6549]",
                  delay: "delay-300"
                },
                {
                  step: 3,
                  title: "Showcase Auto-Generated",
                  description: "When visitors opt in, the system instantly creates a personalized property collection based on the home they visited. Matching properties from Zillow are automatically populated using price, beds, baths, and location filters.",
                  icon: (
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                    </svg>
                  ),
                  color: "from-[#8b7355] to-[#7a6549]",
                  delay: "delay-400"
                },
                {
                  step: 4,
                  title: "Engage & Book Tours",
                  description: "Visitors view their personalized showcase, like or dislike properties, leave comments, and request tours with preferred dates and times. You monitor all interactions through your dashboard and follow up instantly on hot leads.",
                  icon: (
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                  ),
                  color: "from-[#8b7355] to-[#7a6549]",
                  delay: "delay-500"
                }
              ].map((item, index) => (
                <div key={index} className={`group transform transition-all duration-1000 ${item.delay} ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                  <div className="relative bg-white/90 rounded-3xl p-8 border border-gray-200/60 backdrop-blur-lg hover:bg-white hover:border-gray-300 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-[#8b7355]/10 h-full shadow-lg">
                    {/* Step Number */}
                    <div className="absolute -top-4 left-8">
                      <div className={`w-8 h-8 bg-gradient-to-r ${item.color} rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg`}>
                        {item.step}
                      </div>
                    </div>
                    
                    {/* Icon */}
                    <div className={`w-20 h-20 bg-gradient-to-r ${item.color} rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl group-hover:scale-110 transition-transform duration-300`}>
                      {item.icon}
                    </div>
                    
                    <h4 className="text-2xl font-bold text-gray-900 mb-4 font-light group-hover:text-[#8b7355] transition-colors duration-300">
                      {item.title}
                    </h4>
                    
                    <p className="text-gray-600 font-light leading-relaxed group-hover:text-gray-700 transition-colors duration-300">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Subscription Tiers */}
          <div className="py-20">
            <div className={`text-center mb-16 transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
              <h3 className="text-5xl font-bold text-gray-900 mb-6 font-light">Choose Your Plan</h3>
              <p className="text-xl text-gray-600 font-light max-w-3xl mx-auto">
                Simple pricing that grows with your business
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {/* Basic Plan */}
              <div className={`bg-white/90 rounded-3xl p-8 border border-gray-200/60 backdrop-blur-lg hover:bg-white hover:border-gray-300 transition-all duration-500 hover:scale-105 hover:shadow-2xl shadow-lg transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'}`}>
                <div className="text-center mb-6">
                  <h4 className="text-3xl font-bold text-gray-900 mb-2 font-light">Basic</h4>
                  <div className="mb-4">
                    <div className="flex items-baseline justify-center mb-2">
                      <span className="text-5xl font-bold text-gray-900">$49</span>
                      <span className="text-gray-600 ml-2">/month</span>
                    </div>
                    <div className="text-sm text-[#8b7355] font-semibold">Free First Month Trial</div>
                  </div>
                  <p className="text-gray-600 text-sm">Perfect for individual agents just starting out</p>
                </div>

                <div className="space-y-4 mb-8">
                  {[
                    'Unlimited open house QR codes',
                    'Visitor sign-in forms',
                    'Lead capture & contact info',
                    'Email notifications',
                    'Open house management',
                    'Dashboard analytics'
                  ].map((feature, index) => (
                    <div key={index} className="flex items-start">
                      <svg className="w-5 h-5 text-[#8b7355] mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>

                <Link
                  href="/register"
                  className="block w-full text-center px-6 py-4 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-xl font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#8b7355]/25"
                >
                  Start Free Trial
                </Link>
              </div>

              {/* Premium Plan */}
              <div className={`bg-white/90 rounded-3xl p-8 border-2 border-[#8b7355] backdrop-blur-lg hover:bg-white transition-all duration-500 hover:scale-105 hover:shadow-2xl shadow-xl transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'} relative`}>
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </div>
                </div>

                <div className="text-center mb-6">
                  <h4 className="text-3xl font-bold text-gray-900 mb-2 font-light">Premium</h4>
                  <div className="mb-4">
                    <div className="flex items-baseline justify-center mb-2">
                      <span className="text-5xl font-bold text-gray-900">$99</span>
                      <span className="text-gray-600 ml-2">/month</span>
                    </div>
                    <div className="text-sm text-[#8b7355] font-semibold">Free First Month Trial</div>
                  </div>
                  <p className="text-gray-600 text-sm">Perfect for teams and high-volume agents</p>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-[#8b7355] mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-700 font-semibold">Everything in Basic, plus:</span>
                  </div>
                  {[
                    'Personalized property showcases',
                    'Auto-populated property matches',
                    'Visitor interaction tracking',
                    'Tour request management',
                    'Up to 10 active collections',
                    'Advanced analytics & insights'
                  ].map((feature, index) => (
                    <div key={index} className="flex items-start">
                      <svg className="w-5 h-5 text-[#8b7355] mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>

                <Link
                  href="/register"
                  className="block w-full text-center px-6 py-4 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-xl font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#8b7355]/25"
                >
                  Start Free Trial
                </Link>
              </div>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="py-20">
            <div className={`text-center mb-16 transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
              <h3 className="text-5xl font-bold text-gray-900 mb-6 font-light">Frequently Asked Questions</h3>
              <p className="text-xl text-gray-600 font-light max-w-3xl mx-auto">
                Everything you need to know about Open House Pal
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-6xl mx-auto items-start">
              {[
                {
                  question: "How does the QR code work?",
                  answer: "Simply enter your property address, and we'll generate a unique QR code. Print it and display it at your open house. When visitors scan it with their phone, they're directed to the sign-in page."
                },
                {
                  question: "What's the difference between Basic and Premium?",
                  answer: "Basic ($49/month) includes lead capture with unlimited QR codes and visitor forms. Premium ($99/month) adds personalized property showcases, tour booking, and interaction tracking."
                },
                {
                  question: "Does this work on all phones?",
                  answer: "Yes! Our platform is mobile-first and works on any smartphone. Visitors can scan QR codes with their camera app on iPhone or Android - no special app needed."
                },
                {
                  question: "Can I cancel anytime?",
                  answer: "Yes! There are no contracts or commitments. Cancel your subscription anytime from your account settings. Your data and existing QR codes continue to work."
                }
              ].map((faq, index) => (
                <FAQItem key={index} faq={faq} index={index} isVisible={isVisible} />
              ))}
            </div>
          </div>

          {/* Premium Spotlight Section */}
          <div className="py-16">
            <div className={`text-center mb-12 transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
              <h3 className="text-4xl font-bold text-gray-900 mb-4 font-light">Unlock Premium Features</h3>
              <p className="text-lg text-gray-600 font-light">
                Take your lead generation to the next level with Premium
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
              {/* Left Side - Premium Features */}
              <div className={`transform transition-all duration-1000 delay-200 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'}`}>
                <h4 className="text-2xl font-bold text-gray-900 mb-6 font-light">Premium includes everything in Basic, plus:</h4>
                <p className="text-gray-600 mb-8 font-light leading-relaxed">
                  Transform visitor interest into qualified leads with personalized property showcases and advanced engagement tools.
                </p>

                <div className="space-y-4">
                  {[
                    {
                      icon: (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      ),
                      title: "Personalized Property Showcases",
                      description: "Automatically create custom property collections for each interested visitor"
                    },
                    {
                      icon: (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                      ),
                      title: "Visitor Interaction Tracking",
                      description: "See which properties visitors like, dislike, or favorite in real-time"
                    },
                    {
                      icon: (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      ),
                      title: "Tour Request Management",
                      description: "Receive and manage tour bookings directly from interested visitors"
                    },
                    {
                      icon: (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      ),
                      title: "Advanced Analytics",
                      description: "Detailed insights on engagement, views, and conversion metrics"
                    }
                  ].map((feature, index) => (
                    <div key={index} className="flex space-x-4">
                      <div className="w-12 h-12 bg-[#8b7355]/20 rounded-xl flex items-center justify-center text-[#8b7355] flex-shrink-0">
                        {feature.icon}
                      </div>
                      <div>
                        <h5 className="text-gray-900 font-semibold mb-1">{feature.title}</h5>
                        <p className="text-gray-600 text-sm font-light leading-relaxed">{feature.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Side - Premium Pricing Card */}
              <div className={`transform transition-all duration-1000 delay-400 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'}`}>
                <div className="relative group bg-white/90 rounded-2xl p-8 border-2 border-[#8b7355] backdrop-blur-lg hover:bg-white transition-all duration-500 shadow-xl">
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white px-4 py-1 rounded-full text-sm font-semibold">
                      Most Popular
                    </div>
                  </div>

                  <div className="text-center mb-6">
                    <h4 className="text-2xl font-bold text-gray-900 mb-4 font-light">Premium Plan</h4>
                    <div className="mb-4">
                      <div className="flex items-baseline justify-center mb-2">
                        <span className="text-5xl font-bold text-gray-900">$99</span>
                        <span className="text-gray-600 ml-2">/month</span>
                      </div>
                      <div className="text-sm text-[#8b7355] font-semibold mb-2">
                        Free First Month Trial
                      </div>
                      <div className="text-gray-600 text-sm">
                        Or start with <Link href="/register" className="text-[#8b7355] hover:underline font-semibold">Basic at $49/month</Link>
                      </div>
                    </div>
                  </div>

                  <Link
                    href="/register"
                    className="block w-full text-center px-6 py-4 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-xl font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#8b7355]/25 text-lg mb-4"
                  >
                    Start Premium Trial
                  </Link>

                  <div className="space-y-3 text-center">
                    <p className="text-xs text-gray-500">
                      Cancel anytime. No contracts. No commitments.
                    </p>
                    <div className="flex items-center justify-center text-gray-500 text-xs">
                      <svg className="w-3 h-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Secure billing powered by PayPal
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="p-6 border-t border-gray-200/60">
        <div className="max-w-7xl mx-auto text-center text-gray-600 text-sm">
          <p>Open House Pal - Built for real estate agents</p>
        </div>
      </div>
    </div>
  )
}