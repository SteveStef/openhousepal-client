'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import Header from '@/components/Header'

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
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8m-3-9h.01M12 3C8.686 3 6 5.686 6 9c0 1.829.8 3.482 2.077 4.625.239.214.439.531.439.875 0 .621-.504 1.125-1.125 1.125S6.266 15.121 6.266 14.5c0-.621.504-1.125 1.125-1.125.621 0 1.125.504 1.125 1.125" />
                      </svg>
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
                  {/* Main Device Mockup */}
                  <div className="relative bg-white/80 rounded-3xl p-8 border border-gray-200/60 backdrop-blur-sm shadow-xl">
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 border border-gray-200">
                      <div className="flex items-center justify-between mb-6">
                        <div className="w-3 h-3 bg-[#8b7355] rounded-full"></div>
                        <div className="flex space-x-2">
                          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                        </div>
                      </div>
                      
                      <div className="text-center mb-6">
                        <div className="w-20 h-20 bg-gradient-to-r from-[#8b7355] to-[#7a6549] rounded-2xl mx-auto mb-4 flex items-center justify-center animate-pulse">
                          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                          </svg>
                        </div>
                        <h3 className="text-gray-900 font-bold mb-2">QR Code Generated</h3>
                        <p className="text-gray-600 text-sm">123 Main St, West Chester PA</p>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="bg-gray-100 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600 text-sm">Visitors Today</span>
                            <span className="text-gray-900 font-bold">12</span>
                          </div>
                        </div>
                        <div className="bg-gray-100 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600 text-sm">Showcases Created</span>
                            <span className="text-[#8b7355] font-bold">8</span>
                          </div>
                        </div>
                        <div className="bg-gray-100 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600 text-sm">Tour Requests</span>
                            <span className="text-[#8b7355] font-bold">3</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Floating Elements */}
                  <div className="absolute -top-4 -right-4 w-16 h-16 bg-gradient-to-r from-[#8b7355] to-[#7a6549] rounded-2xl flex items-center justify-center animate-bounce shadow-lg shadow-[#8b7355]/25">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  
                  <div className="absolute -bottom-6 -left-6 w-12 h-12 bg-gradient-to-r from-[#8b7355] to-[#7a6549] rounded-xl flex items-center justify-center animate-pulse shadow-lg shadow-[#8b7355]/25">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
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
                Our intelligent platform transforms traditional open houses into automated lead generation systems
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 relative">
              {/* Connection Lines */}
              <div className="hidden md:block absolute top-1/2 left-1/3 w-1/3 h-0.5 bg-gradient-to-r from-[#8b7355]/50 to-[#7a6549]/50 transform -translate-y-1/2 animate-pulse" />
              <div className="hidden md:block absolute top-1/2 right-1/3 w-1/3 h-0.5 bg-gradient-to-r from-[#8b7355]/50 to-[#7a6549]/50 transform -translate-y-1/2 animate-pulse" style={{ animationDelay: '1s' }} />
              
              {[
                {
                  step: 1,
                  title: "Generate QR Codes",
                  description: "Create property-specific QR codes that automatically populate with MLS listing details, pricing, and property features. Print and place at open houses for instant visitor engagement.",
                  icon: (
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V6a1 1 0 00-1-1H5a1 1 0 00-1 1v1a1 1 0 001 1z"></path>
                    </svg>
                  ),
                  color: "from-[#8b7355] to-[#7a6549]",
                  delay: "delay-200"
                },
                {
                  step: 2,
                  title: "Auto-Build Showcases",
                  description: "Advanced AI algorithms analyze visitor preferences and automatically create personalized property showcases using intelligent filtering based on price range, location proximity, and feature matching.",
                  icon: (
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                    </svg>
                  ),
                  color: "from-[#8b7355] to-[#7a6549]",
                  delay: "delay-400"
                },
                {
                  step: 3,
                  title: "Engage & Convert",
                  description: "Monitor real-time visitor engagement through your dashboard. Track property likes, tour requests, and visitor interactions. Receive instant notifications for immediate follow-up opportunities.",
                  icon: (
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                    </svg>
                  ),
                  color: "from-[#8b7355] to-[#7a6549]",
                  delay: "delay-600"
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

          {/* Key Features */}
          <div className="py-20">
            <div className={`text-center mb-16 transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
              <h3 className="text-5xl font-bold text-gray-900 mb-6 font-light">Everything You Need to Convert Leads</h3>
              <p className="text-xl text-gray-600 font-light max-w-3xl mx-auto">
                Comprehensive suite of tools designed specifically for modern real estate professionals
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { 
                  title: 'QR Code Generation', 
                  desc: 'Property-specific codes with auto-populated forms and instant MLS data integration',
                  icon: '📱',
                  color: 'hover:shadow-[#8b7355]/20'
                },
                { 
                  title: 'Smart Matching', 
                  desc: 'AI-powered preference detection and intelligent property filtering algorithms',
                  icon: '🤖',
                  color: 'hover:shadow-[#8b7355]/20'
                },
                { 
                  title: 'Customer Portal', 
                  desc: 'Interactive showcases where visitors engage with properties and request tours',
                  icon: '🏠',
                  color: 'hover:shadow-[#8b7355]/20'
                },
                { 
                  title: 'Agent Dashboard', 
                  desc: 'Complete lead management and real-time analytics platform with insights',
                  icon: '📊',
                  color: 'hover:shadow-[#8b7355]/20'
                },
                { 
                  title: 'Cloud Storage', 
                  desc: 'Secure cloud backup and synchronization of all your property data',
                  icon: '🔄',
                  color: 'hover:shadow-[#8b7355]/20'
                },
                { 
                  title: 'Usage Analytics', 
                  desc: 'Track engagement, views, conversion metrics and ROI performance',
                  icon: '📈',
                  color: 'hover:shadow-[#8b7355]/20'
                },
                { 
                  title: 'Mobile Optimized', 
                  desc: 'Perfect responsive experience on all devices and screen sizes',
                  icon: '📲',
                  color: 'hover:shadow-[#8b7355]/20'
                },
                { 
                  title: 'Automated Follow-up', 
                  desc: 'Email notifications, lead nurturing and automated marketing campaigns',
                  icon: '✉️',
                  color: 'hover:shadow-[#8b7355]/20'
                }
              ].map((feature, index) => (
                <div 
                  key={index} 
                  className={`group bg-white/90 rounded-2xl p-6 border border-gray-200/60 backdrop-blur-lg hover:bg-white hover:border-gray-300 transition-all duration-500 hover:scale-105 hover:shadow-xl ${feature.color} transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'} shadow-lg`}
                  style={{ transitionDelay: `${index * 100 + 1200}ms` }}
                >
                  <div className="text-3xl mb-4 group-hover:scale-110 transition-transform duration-300">
                    {feature.icon}
                  </div>
                  <h5 className="text-xl font-bold text-gray-900 mb-3 font-light group-hover:text-[#8b7355] transition-colors duration-300">
                    {feature.title}
                  </h5>
                  <p className="text-gray-600 text-sm font-light leading-relaxed group-hover:text-gray-700 transition-colors duration-300">
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Testimonials */}
          <div className="py-20">
            <div className={`text-center mb-16 transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
              <h3 className="text-5xl font-bold text-gray-900 mb-6 font-light">Trusted by Top Agents</h3>
              <p className="text-xl text-gray-600 font-light max-w-3xl mx-auto">
                Real estate professionals are already transforming their open houses with Open House Pal
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  name: "Sarah Mitchell",
                  title: "Top Producer, Coldwell Banker",
                  quote: "Open House Pal has revolutionized my open houses. I'm generating 3x more qualified leads and my follow-up process is completely automated.",
                  image: "SM"
                },
                {
                  name: "Michael Rodriguez",
                  title: "Team Leader, RE/MAX",
                  quote: "The AI-powered matching is incredible. Visitors are engaging with properties they actually want to see, not just random listings.",
                  image: "MR"
                },
                {
                  name: "Jennifer Chen",
                  title: "Luxury Specialist, Sotheby's",
                  quote: "My clients love the personalized showcases. It shows I understand their preferences and saves everyone time.",
                  image: "JC"
                }
              ].map((testimonial, index) => (
                <div 
                  key={index} 
                  className={`group bg-white/90 rounded-2xl p-8 border border-gray-200/60 backdrop-blur-lg hover:bg-white hover:border-gray-300 transition-all duration-500 hover:scale-105 hover:shadow-xl hover:shadow-[#8b7355]/10 transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'} shadow-lg`}
                  style={{ transitionDelay: `${index * 200 + 1400}ms` }}
                >
                  <div className="flex items-center mb-6">
                    <div className="w-12 h-12 bg-gradient-to-r from-[#8b7355] to-[#7a6549] rounded-full flex items-center justify-center text-white font-bold mr-4">
                      {testimonial.image}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">{testimonial.name}</div>
                      <div className="text-gray-600 text-sm">{testimonial.title}</div>
                    </div>
                  </div>
                  <p className="text-gray-700 font-light leading-relaxed italic group-hover:text-gray-800 transition-colors duration-300">
                    "{testimonial.quote}"
                  </p>
                  <div className="flex text-yellow-400 mt-4">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Section */}
          <div className="py-16">
            <div className={`text-center mb-12 transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
              <h3 className="text-4xl font-bold text-gray-900 mb-4 font-light">Simple, Transparent Pricing</h3>
              <p className="text-lg text-gray-600 font-light">
                Start with a free month trial, then continue for just $50/month
              </p>
            </div>
            
            <div className="grid lg:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
              {/* Left Side - Benefits & Features */}
              <div className={`transform transition-all duration-1000 delay-200 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'}`}>
                <h4 className="text-2xl font-bold text-gray-900 mb-6 font-light">Everything you need to convert leads</h4>
                <p className="text-gray-600 mb-8 font-light leading-relaxed">
                  Get unlimited access to all Open House Pal features and transform every open house into a lead generation machine.
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {[
                    {
                      icon: (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V6a1 1 0 00-1-1H5a1 1 0 00-1 1v1a1 1 0 001 1z" />
                        </svg>
                      ),
                      title: "Unlimited QR Codes",
                      description: "Generate as many property-specific QR codes as you need"
                    },
                    {
                      icon: (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      ),
                      title: "Smart Showcases",
                      description: "AI-powered property matching and automated showcases"
                    },
                    {
                      icon: (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      ),
                      title: "Real-time Analytics",
                      description: "Track visitor engagement and conversion metrics"
                    },
                    {
                      icon: (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      ),
                      title: "Data Analytics",
                      description: "Advanced insights and reporting on visitor engagement"
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
              
              {/* Right Side - Pricing Card */}
              <div className={`transform transition-all duration-1000 delay-400 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'}`}>
                <div className="relative group bg-white/90 rounded-2xl p-8 border border-gray-200/60 backdrop-blur-lg hover:bg-white hover:border-gray-300 transition-all duration-500 ring-2 ring-[#8b7355]/50 shadow-xl">
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white px-3 py-1 rounded-full text-sm font-medium">
                      Free First Month
                    </div>
                  </div>
                  
                  <div className="text-center mb-6">
                    <h4 className="text-2xl font-bold text-gray-900 mb-4 font-light">Open House Pal</h4>
                    <div className="mb-4">
                      <div className="flex items-baseline justify-center mb-2">
                        <span className="text-5xl font-bold text-gray-900">$0</span>
                        <span className="text-gray-600 ml-2">first month</span>
                      </div>
                      <div className="text-gray-600">
                        Then <span className="text-gray-900 font-semibold">$50/month</span>
                      </div>
                    </div>
                  </div>
                  
                  <Link
                    href="/register"
                    className="block w-full text-center px-6 py-4 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-xl font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#8b7355]/25 text-lg mb-4"
                  >
                    Start Free Month Trial
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