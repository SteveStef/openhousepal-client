'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import MobilePhoneMockup from '@/components/MobilePhoneMockup'

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
      {/* Navigation */}
      <div className={`relative z-50 transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'}`}>
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
                  <span className="text-sm text-gray-700">Trusted by Top Real Estate Agents</span>
                </div>
                
                <h2 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                  Transform Open Houses Into{' '}
                  <span className="bg-gradient-to-r from-[#8b7355] via-[#8b7355] to-[#7a6549] bg-clip-text text-transparent">
                    Lead Machines
                  </span>
                </h2>
                
                <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                  Capture every visitor, instantly generate personalized property showcases, and follow up automatically—turning guests into signed clients.
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
                  {/* <Link
                    href="/open-house/demo-qr"
                    className="group px-8 py-4 bg-[#f5f4f2]/80 text-gray-900 rounded-xl font-semibold border border-gray-300 hover:bg-[#f5f4f2] hover:border-gray-400 transition-all duration-300 hover:scale-105 backdrop-blur-sm shadow-sm"
                  >
                    <span className="flex items-center justify-center">
                      Watch Demo
                    </span>
                  </Link> */}
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
                <MobilePhoneMockup />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Video Showcase */}
      <div className="relative z-10 py-10 lg:py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className={`text-center mb-12 transform transition-all duration-1000 delay-400 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <h3 className="text-4xl font-bold text-gray-900 mb-6 font-light">Experience the Future of Open Houses</h3>
            <p className="text-xl text-gray-600 font-light max-w-3xl mx-auto">
              See how OpenHousePal seamlessly connects physical visits with digital follow-ups.
            </p>
          </div>
          <div className={`relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white transform transition-all duration-1000 delay-500 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <div className="absolute inset-0 bg-black/5 z-10 pointer-events-none"></div>
            <video 
              className="w-full h-auto object-cover"
              autoPlay 
              loop 
              muted 
              playsInline
              controls
            >
              <source src="/Comp_1_R2.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="relative z-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="py-20">
            <div className={`text-center mb-16 transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
              <h3 className="text-5xl font-bold text-gray-900 mb-6 font-light">How OpenHousePal Works</h3>
              <p className="text-xl text-gray-600 font-light max-w-3xl mx-auto">
                The most effective open house sign-in, auto-follow-up, and lead-magnet system the industry has ever seen—powered in four simple steps.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
              
              {[
                {
                  step: 1,
                  title: "Create Your Open House",
                  description: "Enter the property address and OpenHousePal instantly pulls in key property details. Select your favorite photo for marketing materials, generate a custom QR code, and download professional PDF flyers to display at the open house—all in under 10 seconds.",
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
                  title: "Showcase AI-Generated",
                  description: "When visitors opt in, OpenHousePal instantly creates a personalized property collection based on the home they visited. Matching properties are automatically added using price range, beds, baths, and location filters. An invite to their showcase is automatically sent to the guest one hour after the open house.",
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
                  description: "Visitors can view their personalized showcase created specifically from that open house and will receive emails with similar properties—marketed by you as their agent. Inside each showcase, guests can leave comments, request showings, comment under specific properties, or remove properties from their collection. You can see and monitor all interactions through your dashboard and follow up instantly via real-time notifications.",
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
            <div className={`text-center mb-8 transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
              <h3 className="text-4xl font-bold text-gray-900 mb-6 font-light">Choose the Plan That Fits Your Ambition</h3>

              {/* Trial Banner */}
              <div className="bg-[#f5f4f2]/60 border border-gray-200 rounded-xl p-3 max-w-3xl mx-auto mb-12 backdrop-blur-sm">
                <p className="text-gray-700 mb-2 font-medium text-center">
                  Start with a <span className="font-bold text-[#8b7355]">30-day free trial</span>
                </p>
                <div className="flex flex-wrap justify-center gap-4 text-xs text-gray-600">
                  <div className="flex items-center">
                    <svg className="w-3.5 h-3.5 text-[#8b7355] mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    No commitment
                  </div>
                  <div className="flex items-center">
                    <svg className="w-3.5 h-3.5 text-[#8b7355] mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Cancel anytime
                  </div>
                  <div className="flex items-center">
                    <svg className="w-3.5 h-3.5 text-[#8b7355] mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Switch plans anytime
                  </div>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto items-stretch">
              {/* Basic Plan */}
              <div className={`bg-white rounded-3xl p-8 border-2 border-gray-200 shadow-lg transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'} relative flex flex-col`}>
                {/* LIMITED Badge */}
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <div className="bg-gray-400 text-white px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide">
                    Limited
                  </div>
                </div>

                <div className="text-center mb-8 mt-4">
                  <h4 className="text-2xl font-bold text-gray-900 mb-4">Basic Plan</h4>
                  <div className="flex items-baseline justify-center mb-2">
                    <span className="text-5xl font-bold text-gray-900">$49.95</span>
                    <span className="text-gray-600 ml-2 text-lg">/month</span>
                  </div>
                  <p className="text-sm text-gray-500">after 30-day free trial</p>
                </div>

                {/* Included Features */}
                <div className="space-y-3 mb-6">
                  {[
                    'Generated PDFs for Open Houses',
                    'Custom open house sign-in forms',
                    'Catalog of all visitors'
                  ].map((feature, index) => (
                    <div key={index} className="flex items-start">
                      <svg className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Divider */}
                <div className="border-t border-dashed border-gray-300 my-6"></div>

                {/* Missing Features */}
                <div className="mb-8">
                  <div className="flex items-start mb-3">
                    <svg className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="text-red-600 font-bold text-sm">Missing Critical Features:</span>
                  </div>
                  <div className="space-y-2 ml-7">
                    {[
                      'Showcases feature',
                      'Automated follow-up emails',
                      'Real-time property alerts',
                      'Advanced analytics & insights',
                      'Personalized property Showcases'
                    ].map((feature, index) => (
                      <div key={index} className="flex items-start">
                        <svg className="w-4 h-4 text-red-400 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span className="text-gray-400 line-through text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-auto">
                  <Link
                    href="/register"
                    className="block w-full text-center px-6 py-4 bg-gray-400 text-white rounded-xl font-semibold transition-all duration-300 hover:bg-gray-500 mb-3"
                  >
                    Select Basic Plan
                  </Link>

                  <div className="flex items-center justify-center text-amber-600 text-xs">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Limited functionality
                  </div>
                </div>
              </div>

              {/* Premium Plan */}
              <div className={`bg-gradient-to-br from-[#8b7355] via-[#7a6549] to-[#6b5a43] rounded-3xl p-8 shadow-2xl transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'} relative border-4 border-[#9d8567] flex flex-col`}>
                {/* MOST POPULAR Badge */}
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-[#ffd700] text-[#3d3226] px-6 py-2 rounded-full text-sm font-bold uppercase tracking-wide shadow-lg flex items-center">
                    <svg className="w-4 h-4 mr-1 fill-current" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    MOST POPULAR
                    <svg className="w-4 h-4 ml-1 fill-current" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </div>
                </div>

                <div className="text-center mb-6 mt-6">
                  <div className="flex items-center justify-center mb-2">
                    <h4 className="text-2xl font-bold text-white mr-2">Premium Plan</h4>
                    <svg className="w-6 h-6 text-[#ffd700] fill-current" viewBox="0 0 24 24">
                      <path d="M13 2.05v2.02c3.95.49 7 3.85 7 7.93 0 4.08-3.05 7.44-7 7.93v2.02c5.05-.5 9-4.76 9-9.95 0-5.19-3.95-9.45-9-9.95zM11 2.05c-5.05.5-9 4.76-9 9.95 0 5.19 3.95 9.45 9 9.95v-2.02c-3.95-.49-7-3.85-7-7.93 0-4.08 3.05-7.44 7-7.93V2.05zm1 5.3c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5z" />
                    </svg>
                  </div>
                  <div className="flex items-baseline justify-center mb-2">
                    <span className="text-5xl font-bold text-white">$99.95</span>
                    <span className="text-[#f5f4f2] ml-2 text-lg">/month</span>
                  </div>
                  <p className="text-sm text-[#f5f4f2] mb-3">after 30-day free trial</p>

                </div>

                {/* Everything in Basic */}
                <div className="bg-[#6b5a43]/60 rounded-xl p-4 mb-4 border border-[#9d8567]">
                  <div className="flex items-start text-white">
                    <svg className="w-5 h-5 text-[#ffd700] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <span className="font-bold block">Everything in Basic</span>
                      <span className="text-sm text-[#f5f4f2]">- All core features included</span>
                    </div>
                  </div>
                </div>

                {/* Premium Features */}
                <div className="space-y-3 mb-6">
                  <div className="bg-[#6b5a43]/60 rounded-xl p-4 border border-[#8b7355]">
                    <div className="flex items-start text-white">
                      <svg className="w-5 h-5 text-[#ffd700] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <span className="font-bold block">Showcases Feature</span>
                        <span className="text-sm text-[#f5f4f2]">- Create personalized property showcases</span>
                      </div>
                    </div>
                  </div>

                  {[
                    'Automated follow-up emails',
                    'Real-time property alerts',
                    'Advanced analytics & insights',
                    'Personalized property Showcases',
                  ].map((feature, index) => (
                    <div key={index} className="flex items-start">
                      <svg className="w-5 h-5 text-[#ffd700] mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-white">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-auto">
                  <Link
                    href="/register"
                    className="block w-full text-center px-6 py-4 bg-gradient-to-r from-[#ffd700] to-[#ffed4e] text-[#3d3226] rounded-xl font-bold text-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl mb-3 shadow-lg"
                  >
                    Select Premium Plan
                  </Link>

                  <div className="flex items-center justify-center text-[#f5f4f2] text-xs">
                    <svg className="w-4 h-4 mr-2 fill-current" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    Most agents choose Premium
                    <svg className="w-4 h-4 ml-2 fill-current" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* FAQ Section */}
          <div className="py-20">
            <div className={`text-center mb-16 transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
              <h3 className="text-5xl font-bold text-gray-900 mb-6 font-light">Frequently Asked Questions</h3>
              <p className="text-xl text-gray-600 font-light max-w-3xl mx-auto">
                Everything you need to know about OpenHousePal
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
          <p>OpenHousePal - Built for real estate agents</p>
        </div>
      </div>
    </div>
  )
}
