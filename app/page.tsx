'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import MobilePhoneMockup from '@/components/MobilePhoneMockup'

function FAQItem({ faq, index, isVisible }: { faq: { question: string; answer: string }; index: number; isVisible: boolean }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div
      className={`bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm transition-all duration-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'} overflow-hidden`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-8 py-6 text-left flex items-center justify-between hover:bg-[#FAFAF7] transition-colors duration-200"
      >
        <h5 className="text-lg font-bold text-[#0B0B0B] pr-8">{faq.question}</h5>
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${isOpen ? 'rotate-180 bg-[#C9A24D]/10 text-[#C9A24D]' : 'bg-gray-100 text-gray-400'}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      <div 
        className={`px-8 transition-all duration-300 ease-in-out ${isOpen ? 'max-h-48 pb-8 opacity-100' : 'max-h-0 pb-0 opacity-0'}`}
      >
        <p className="text-[#6B7280] leading-relaxed font-medium">{faq.answer}</p>
      </div>
    </div>
  )
}

export default function HomePage() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col overflow-hidden relative">
      {/* Sophisticated Background Architecture */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Subtle Deep Layer Gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-[1000px] h-[1000px] bg-[#C9A24D]/5 rounded-full blur-[120px] mix-blend-multiply animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute top-[20%] right-[-10%] w-[800px] h-[800px] bg-[#111827]/5 rounded-full blur-[100px] mix-blend-multiply animate-pulse" style={{ animationDuration: '12s' }} />
        <div className="absolute bottom-[-10%] left-[20%] w-[600px] h-[600px] bg-[#C9A24D]/5 rounded-full blur-[120px] mix-blend-multiply" />
        
        {/* Refined Texture & Grid */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/pinstripe-light.png')] opacity-[0.03] mix-blend-overlay"></div>
        <div className="absolute inset-0" style={{ 
          backgroundImage: 'radial-gradient(circle at 2px 2px, #C9A24D 1px, transparent 0)', 
          backgroundSize: '48px 48px',
          opacity: '0.05'
        }}></div>
      </div>

      {/* Navigation */}
      <div className={`relative z-50 transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'}`}>
        <Header mode="landing" />
      </div>

      {/* Hero Section */}
      <div className="flex-1 relative z-10 flex items-center">
        <div className="max-w-7xl mx-auto px-6 w-full">
          <div className={`py-12 lg:py-24 transform transition-all duration-1000 delay-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Left Content */}
              <div className="text-left relative">
                {/* Accent glow behind text */}
                <div className="absolute -top-24 -left-24 w-64 h-64 bg-[#C9A24D]/10 rounded-full blur-3xl -z-10"></div>
                
                <div className="inline-flex items-center px-4 py-2 bg-white/80 backdrop-blur-md rounded-full border border-gray-200/80 mb-8 shadow-[0_4px_20px_rgba(0,0,0,0.04)] ring-1 ring-black/5">
                  <div className="w-2 h-2 bg-[#C9A24D] rounded-full animate-pulse mr-3"></div>
                  <span className="text-xs font-bold text-[#111827] tracking-widest uppercase">Trusted by Top Agents</span>
                </div>
                
                <h2 className="text-[3.5rem] lg:text-[5.5rem] font-black text-[#0B0B0B] mb-8 leading-[0.95] tracking-tight">
                  Turn Open Houses Into{' '}
                  <span className="relative inline-block">
                    <span className="text-transparent bg-clip-text bg-gradient-to-br from-[#111827] via-[#3a2f25] to-[#C9A24D] drop-shadow-sm">
                      Closings
                    </span>
                    <div className="absolute -bottom-2 left-0 w-full h-1.5 bg-gradient-to-r from-[#C9A24D] to-transparent rounded-full opacity-40"></div>
                  </span>
                </h2>
                
                <p className="text-xl text-[#6B7280] mb-10 leading-relaxed font-light max-w-xl">
                  The all-in-one toolkit to capture visitors, generate instant AI showcases, and automate follow-ups that convert.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-5 mb-14">
                  <Link
                    href="/register"
                    className="group relative px-8 py-4 bg-[#111827] text-white rounded-xl font-bold text-lg overflow-hidden shadow-[0_10px_30px_-5px_rgba(17,24,39,0.3)] transform transition-all duration-300 hover:scale-105 hover:shadow-[0_20px_40px_-5px_rgba(201,162,77,0.3)] active:scale-95 hover:bg-[#C9A24D]"
                  >
                    <span className="relative z-10 flex items-center justify-center">
                      Start Free Trial
                      <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </span>
                  </Link>
                  <Link
                    href="#how-it-works"
                    className="group px-8 py-4 bg-white/80 backdrop-blur-md text-[#111827] rounded-xl font-bold text-lg border border-gray-200 hover:border-[#C9A24D]/50 hover:bg-white transition-all duration-300 hover:scale-105 shadow-[0_4px_15px_rgba(0,0,0,0.03)]"
                  >
                    <span className="flex items-center justify-center">
                      How It Works
                    </span>
                  </Link>
                </div>
                
                {/* Key Benefits */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 border-t border-gray-200">
                  {[
                    { icon: "M13 10V3L4 14h7v7l9-11h-7z", label: "Instant Setup" },
                    { icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10", label: "AI Powered" },
                    { icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", label: "Analytics" }
                  ].map((benefit, i) => (
                    <div key={i} className="flex items-center space-x-3 group/benefit">
                      <div className="w-10 h-10 bg-[#C9A24D]/10 rounded-lg flex items-center justify-center group-hover/benefit:bg-[#C9A24D]/20 transition-colors">
                        <svg className="w-5 h-5 text-[#C9A24D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={benefit.icon} />
                        </svg>
                      </div>
                      <span className="text-[#111827] font-bold text-sm">{benefit.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Right Visual */}
              <div className="relative lg:pl-12">
                <div className="relative z-10 transition-all duration-700">
                  <MobilePhoneMockup />
                </div>
                
                {/* Visual Glow Backdrop */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] -z-10">
                  <div className="absolute inset-0 bg-gradient-to-tr from-[#C9A24D]/20 via-transparent to-[#111827]/10 rounded-full blur-[100px]"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Video Showcase */}
      <div className="relative z-10 py-20 lg:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <div className={`text-center mb-16 transform transition-all duration-1000 delay-400 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <h3 className="text-4xl font-extrabold text-[#0B0B0B] mb-6 tracking-tight">Experience the Future</h3>
            <p className="text-xl text-[#6B7280] font-light max-w-2xl mx-auto">
              See how OpenHousePal seamlessly bridges the gap between physical visits and digital conversion.
            </p>
          </div>
          <div className={`relative rounded-3xl overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] ring-1 ring-[#111827]/10 transform transition-all duration-1000 delay-500 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <div className="aspect-video bg-gray-100 relative">
               {/* Overlay gradient for video controls contrast */}
               <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
               <video 
                className="w-full h-full object-cover"
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
      </div>

      {/* How It Works - Redesigned Vertical Timeline */}
      <div id="how-it-works" className="relative z-10 py-24 bg-white/50 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <div className={`text-center mb-24 transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <span className="text-[#C9A24D] font-bold tracking-widest uppercase text-sm mb-4 block">Simple Workflow</span>
            <h3 className="text-5xl font-extrabold text-[#0B0B0B] mb-6 tracking-tight">How It Works</h3>
            <p className="text-xl text-[#6B7280] font-light max-w-2xl mx-auto">
              From open house visitor to signed client in four automated steps.
            </p>
          </div>

          <div className="relative">
            {/* Central Line (Desktop) */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-[#C9A24D]/20 via-[#C9A24D]/50 to-[#C9A24D]/20 hidden md:block -translate-x-1/2"></div>
            
            {/* Mobile Line (Left) */}
            <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-[#C9A24D]/20 via-[#C9A24D]/50 to-[#C9A24D]/20 md:hidden"></div>

            <div className="space-y-24">
              {[
                {
                  step: 1,
                  title: "Create Open House",
                  description: "Enter the property address and we instantly pull details, photos, and specs. Generate a unique QR code and professional PDF flyers in seconds—ready for print.",
                  icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
                  image: "/CreateOpenHouse.png"
                },
                {
                  step: 2,
                  title: "Visitors Sign In",
                  description: "Guests scan your QR code to sign in on their own phones. Our frictionless 4-step form captures high-quality data: name, contact info, agent status, and buying timeframe.",
                  icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
                  image: "/SignIn.png"
                },
                {
                  step: 3,
                  title: "AI Follow-Up",
                  description: "While you greet guests, OpenHousePal works in the background. We instantly generate a personalized property showcase website for each visitor and email it to them automatically.",
                  icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
                  image: "/showcase.png"
                },
                {
                  step: 4,
                  title: "Convert Leads",
                  description: "Track real-time engagement in your dashboard. See which properties they view, receive tour requests directly, and follow up with hot leads who are actively browsing.",
                  icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
                  image: "/feedback.png"
                }
              ].map((item, index) => (
                <div key={index} className={`relative flex flex-col md:flex-row items-center justify-between group ${index % 2 === 0 ? '' : 'md:flex-row-reverse'}`}>
                  
                  {/* Center Marker (Desktop) */}
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center justify-center w-12 h-12 rounded-full bg-white border-4 border-[#faf9f7] shadow-lg z-10 group-hover:scale-110 transition-transform duration-300">
                    <div className="w-4 h-4 bg-[#C9A24D] rounded-full"></div>
                  </div>

                  {/* Visual Side */}
                  <div className="w-full md:w-[45%] pl-20 md:pl-0 mb-8 md:mb-0 flex justify-center">
                    <div className={`relative w-full ${item.image ? 'max-w-lg' : 'max-w-sm'} aspect-[4/3] ${item.image ? '' : 'bg-gradient-to-br from-[#111827] to-[#3a2f25] rounded-3xl shadow-2xl'} flex items-center justify-center transform transition-all duration-500 hover:scale-105 hover:rotate-1 ${item.image ? '' : 'group-hover:shadow-[#C9A24D]/30'} ${index % 2 === 0 ? 'md:mr-auto' : 'md:ml-auto'}`}>
                      {/* Decorative Circles - only show if no image */}
                      {!item.image && (
                        <>
                          <div className="absolute top-4 right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
                          <div className="absolute bottom-4 left-4 w-32 h-32 bg-black/10 rounded-full blur-2xl"></div>
                        </>
                      )}
                      
                      {/* Big Icon or Image */}
                      {item.image ? (
                        <div className="relative w-full h-full">
                          <Image 
                            src={item.image} 
                            alt={item.title} 
                            fill
                            className="object-contain drop-shadow-xl"
                            quality={100}
                            unoptimized
                          />
                        </div>
                      ) : (
                        <svg className="w-24 h-24 text-white/90 drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d={item.icon} />
                        </svg>
                      )}

                      {/* Floating Badge */}
                      <div className="absolute -bottom-6 inline-flex items-center px-6 py-3 bg-white rounded-xl shadow-xl">
                        <span className="text-4xl font-black text-[#C9A24D] mr-3">{item.step}</span>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Step</span>
                      </div>
                    </div>
                  </div>

                  {/* Text Side */}
                  <div className={`w-full md:w-[45%] pl-20 md:pl-0 ${index % 2 === 0 ? 'md:text-right md:pr-12' : 'md:text-left md:pl-12'}`}>
                    {/* Mobile Step Number (Left Line) */}
                    <div className="absolute left-8 top-0 -translate-x-1/2 flex md:hidden items-center justify-center w-10 h-10 rounded-full bg-[#C9A24D] text-white font-bold shadow-lg border-4 border-[#faf9f7] z-10">
                      {item.step}
                    </div>

                    <h4 className="text-3xl font-bold text-[#0B0B0B] mb-4">{item.title}</h4>
                    <p className="text-lg text-[#6B7280] font-light leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Tiers */}
      <div id="pricing" className="py-24 relative overflow-hidden">
        {/* Background Accent */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-[#C9A24D]/3 rounded-full blur-[120px] -z-10" />

        <div className={`text-center mb-16 transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <span className="text-[#C9A24D] font-bold tracking-wider uppercase text-sm mb-4 block">Simple Pricing</span>
          <h3 className="text-5xl font-extrabold text-[#0B0B0B] mb-6 tracking-tight">Invest in Your Growth</h3>
          
          {/* Trial Banner */}
          <div className="inline-flex items-center gap-6 px-6 py-3 bg-white rounded-full border border-gray-200 shadow-sm text-sm text-[#6B7280] mt-4">
            <span className="flex items-center"><svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>30-day free trial</span>
            <span className="flex items-center"><svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>Cancel anytime</span>
            <span className="flex items-center"><svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>No commitment</span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-10 max-w-5xl mx-auto px-6 items-start">
          {/* Basic Plan */}
          <div className={`bg-white rounded-[2rem] p-10 border border-gray-100 shadow-[0_20px_50px_rgba(0,0,0,0.05)] transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'} relative transition-all hover:shadow-[0_30px_60px_rgba(0,0,0,0.08)]`}>
            <div className="text-center mb-10">
              <h4 className="text-xl font-bold text-[#0B0B0B] mb-4 uppercase tracking-wide">Basic Plan</h4>
              <div className="flex items-baseline justify-center mb-2">
                <span className="text-5xl font-black text-[#0B0B0B] tracking-tight">$49.95</span>
                <span className="text-[#6B7280] ml-2 font-medium">/mo</span>
              </div>
              <p className="text-sm text-gray-400">after 30-day free trial</p>
            </div>

            <ul className="space-y-4 mb-10">
              {[
                'Generated PDFs for Open Houses',
                'Custom open house sign-in forms',
                'Catalog of all visitors'
              ].map((feature, index) => (
                <li key={index} className="flex items-start text-gray-700 font-medium">
                  <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>

            <div className="border-t border-gray-100 pt-8 mt-8 mb-8">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Missing Key Features</p>
              <ul className="space-y-3">
                {[
                  'Automated follow-up emails',
                  'Personalized Property Showcases',
                  'Real-time alerts & analytics'
                ].map((feature, index) => (
                  <li key={index} className="flex items-center text-gray-400 text-sm">
                    <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <Link
              href="/register"
              className="block w-full text-center px-6 py-4 bg-gray-100 text-[#111827] rounded-xl font-bold hover:bg-gray-200 transition-colors"
            >
              Select Basic
            </Link>
          </div>

          {/* Premium Plan */}
          <div className={`bg-[#111827] rounded-[2rem] p-10 shadow-[0_30px_80px_-20px_rgba(201,162,77,0.3)] transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'} relative border border-gray-800 flex flex-col overflow-hidden`}>
            {/* Gradient Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#111827] via-[#2c241b] to-[#3d3226] z-0"></div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A24D]/20 rounded-full blur-[80px] z-0"></div>
            
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-10">
                <div>
                  <h4 className="text-xl font-bold text-white mb-2 uppercase tracking-wide">Premium Plan</h4>
                  <div className="inline-block bg-[#C9A24D] text-[#111827] text-xs font-bold px-3 py-1 rounded-md">
                    MOST POPULAR
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-baseline justify-end">
                    <span className="text-5xl font-black text-white tracking-tight">$99.95</span>
                    <span className="text-gray-400 ml-2 font-medium">/mo</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">after 30-day free trial</p>
                </div>
              </div>

              <div className="space-y-6 mb-12">
                <div className="bg-white/10 rounded-xl p-5 border border-white/10 backdrop-blur-sm">
                  <div className="flex items-center text-white font-bold mb-2">
                    <svg className="w-5 h-5 text-[#C9A24D] mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Everything in Basic, plus:
                  </div>
                </div>

                <ul className="space-y-4">
                  {[
                    'Automated follow-up emails',
                    'Real-time property alerts',
                    'Advanced analytics & insights',
                    'Personalized property Showcases',
                    'Visitor interaction tracking'
                  ].map((feature, index) => (
                    <li key={index} className="flex items-start text-gray-200 font-medium">
                      <div className="w-5 h-5 bg-[#C9A24D]/30 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                        <svg className="w-3 h-3 text-[#C9A24D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href="/register"
                className="block w-full text-center px-6 py-4 bg-gradient-to-r from-[#C9A24D] to-[#b38e3e] text-[#111827] rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-[#C9A24D]/30 transition-all duration-300 hover:-translate-y-1"
              >
                Start Premium Trial
              </Link>
              <p className="text-center text-gray-500 text-xs mt-4">Secure billing powered by PayPal</p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div id="faq" className="py-24">
        <div className="max-w-4xl mx-auto px-6">
          <div className={`text-center mb-16 transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <h3 className="text-4xl font-extrabold text-[#0B0B0B] mb-6 tracking-tight">Questions?</h3>
            <p className="text-xl text-[#6B7280] font-light">
              We're here to help you succeed.
            </p>
          </div>

          <div className="space-y-4">
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
      </div>
      
      {/* Footer */}
      <footer className="bg-[#111827] text-white py-20 border-t border-[#C9A24D]/20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16">
            {/* Brand Column */}
            <div className="md:col-span-1">
              <div className="flex items-center space-x-2 mb-6">
                <Image
                  src="/logo.png"
                  alt="OpenHousePal Logo"
                  width={48}
                  height={27}
                  className="h-10 w-auto"
                />
                <span className="text-xl font-bold tracking-tight">OpenHousePal</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
                Empowering real estate agents with next-generation lead capture and automated follow-up tools.
              </p>
            </div>

            {/* Product Links */}
            <div>
              <h5 className="font-bold text-lg mb-6 text-[#C9A24D]">Platform</h5>
              <ul className="space-y-4 text-sm text-gray-400">
                <li><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
              </ul>
            </div>

            {/* Legal Links */}
            <div>
              <h5 className="font-bold text-lg mb-6 text-[#C9A24D]">Legal</h5>
              <ul className="space-y-4 text-sm text-gray-400">
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-sm">
              © {new Date().getFullYear()} OpenHousePal. All rights reserved.
            </p>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Platform Active</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
