'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { login } from '../../../lib/auth'

export default function LoginPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info' | null
    message: string
  }>({ type: null, message: '' })
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({})

  const [redirectPath, setRedirectPath] = useState<string | null>(null)

  const [currentSlide, setCurrentSlide] = useState(0)
  
  const slides = [
    {
      title: "Instant Follow-up",
      description: "Automated, personalized engagement sent within the golden hour of visitation.",
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    },
    {
      title: "Smart Showcases",
      description: "AI-driven property collections tailored dynamically to visitor preferences.",
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    },
    {
      title: "Real-time Analytics",
      description: "Deep insights into lead behavior, viewing patterns, and engagement metrics.",
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    }
  ]

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  // Handle redirect parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const redirect = urlParams.get('redirect')
    setRedirectPath(redirect)
    if (redirect) {
      showNotification('info', 'Please log in to continue')
    }
  }, [])

  // Clear notifications after 5 seconds
  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message })
    setTimeout(() => {
      setNotification({ type: null, message: '' })
    }, 5000)
  }

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {}
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required'
    }
    
    return newErrors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldErrors({})
    setNotification({ type: null, message: '' })
    
    // Validate form
    const validationErrors = validateForm()
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)
      showNotification('error', 'Please correct the errors below')
      return
    }
    
    setIsLoading(true)
    showNotification('info', 'Signing you in...')
    
    try {
      // Use auth utility for login
      const result = await login(formData.email, formData.password)

      if (result.status === 200) {
        // Success - cookie is automatically set by backend
        showNotification('success', 'Login successful! Redirecting...')
        window.location.href = redirectPath || '/showcases'
      } else {
        // Handle specific API errors
        if (result.status === 401) {
          setFieldErrors({ 
            email: 'Invalid email or password',
            password: 'Invalid email or password'
          })
          showNotification('error', 'Invalid email or password')
        } else if (result.status === 400 && result.error === 'Inactive user account') {
          showNotification('error', 'Your account has been deactivated. Please contact support.')
        } else {
          showNotification('error', result.error || 'Login failed. Please try again.')
        }
      }
    } catch (error) {
      console.error('Login error:', error)
      showNotification('error', 'Unable to connect to server. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value
    })
    
    // Clear field error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors({
        ...fieldErrors,
        [name]: ''
      })
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Section - Login Form (55%) */}
      <div className="w-full lg:w-[55%] bg-[#faf9f7] relative flex items-center justify-center px-6 py-12 overflow-hidden">
        {/* Subtle Background Gradient Orbs */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#8b7355]/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#8b7355]/5 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none"></div>

        <div className="max-w-[500px] w-full relative z-10">
          {/* Header */}
          <div className="mb-10 text-center">
            {/* Optional: Place Logo Here */}
            {/* <div className="mx-auto w-12 h-12 bg-[#8b7355] rounded-xl mb-6 flex items-center justify-center">
              <span className="text-white font-bold text-xl">O</span>
            </div> */}
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Welcome back</h2>
            <p className="mt-3 text-gray-500 text-sm">Please enter your details to sign in.</p>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-2xl p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                  Email address
                </label>
                <div className="relative">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className={`block w-full px-4 py-3 rounded-lg border bg-gray-50/50 text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#8b7355]/20 focus:border-[#8b7355] transition-all duration-200 ${
                      fieldErrors.email 
                        ? 'border-red-300 focus:ring-red-200 focus:border-red-400' 
                        : 'border-gray-200'
                    }`}
                    placeholder="name@company.com"
                  />
                  {/* Icon could go here */}
                </div>
                {fieldErrors.email && (
                  <p className="mt-1.5 text-xs text-red-500 font-medium flex items-center animate-fadeIn">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className={`block w-full px-4 py-3 rounded-lg border bg-gray-50/50 text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#8b7355]/20 focus:border-[#8b7355] transition-all duration-200 ${
                      fieldErrors.password 
                        ? 'border-red-300 focus:ring-red-200 focus:border-red-400' 
                        : 'border-gray-200'
                    }`}
                    placeholder="••••••••"
                  />
                </div>
                {fieldErrors.password && (
                  <p className="mt-1.5 text-xs text-red-500 font-medium flex items-center animate-fadeIn">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-[#8b7355] border-gray-300 rounded focus:ring-[#8b7355] transition duration-150 ease-in-out cursor-pointer"
                  />
                  <span className="ml-2 text-sm text-gray-600 group-hover:text-gray-900 transition-colors">Remember me</span>
                </label>
                <Link href="/forgot-password" className="text-sm font-medium text-[#8b7355] hover:text-[#6b5840] transition-colors">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-4 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-gradient-to-r from-[#8b7355] to-[#6b5840] hover:from-[#7a6549] hover:to-[#5a4835] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8b7355] transform transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </div>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            <div className="mt-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Don't have an account?</span>
                </div>
              </div>

              <div className="mt-6 text-center">
                <Link href="/register" className="font-semibold text-[#8b7355] hover:text-[#6b5840] transition-colors hover:underline">
                  Start your free trial
                </Link>
              </div>
            </div>
          </div>
          
          <div className="mt-8 text-center">
            <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Protected by industry-standard encryption
            </p>
          </div>
        </div>
      </div>

      {/* Right Section - Explanation (45%) */}
      <div className="w-full lg:w-[45%] relative bg-[#1a1614] text-white overflow-hidden flex flex-col justify-center">
        {/* Rich Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1614] via-[#3a2f25] to-[#8b7355] opacity-90"></div>
        
        {/* Decorative Patterns */}
        <div className="absolute top-0 right-0 w-full h-full opacity-10" 
             style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}>
        </div>
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#8b7355] rounded-full mix-blend-overlay filter blur-[100px] opacity-40"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-[#8b7355] rounded-full mix-blend-overlay filter blur-[100px] opacity-40"></div>

        <div className="relative z-10 p-12 lg:p-16 flex flex-col justify-center h-full">
          <div className="max-w-xl mx-auto lg:mx-0">
            <h3 className="text-4xl font-bold mb-2 tracking-tight">OpenHousePal</h3>
            <p className="text-gray-300 text-lg mb-6 font-light">The ultimate lead generation toolkit for modern real estate agents.</p>
            <div className="h-1 w-20 bg-gradient-to-r from-[#ffd700] to-[#8b7355] rounded-full mb-12"></div>
            
            <div className="relative h-48">
              {slides.map((slide, index) => (
                <div
                  key={index}
                  className={`absolute top-0 left-0 w-full transition-all duration-700 transform ${
                    index === currentSlide 
                      ? 'opacity-100 translate-x-0' 
                      : index < currentSlide 
                        ? 'opacity-0 -translate-x-full' 
                        : 'opacity-0 translate-x-full'
                  }`}
                >
                  <div className="bg-white/5 backdrop-blur-md rounded-xl p-5 border border-white/10 shadow-lg">
                    <div className="flex items-center space-x-4 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#8b7355] to-[#6b5840] rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
                        {slide.icon}
                      </div>
                      <h4 className="font-bold text-xl text-white">{slide.title}</h4>
                    </div>
                    <p className="text-gray-300 text-base leading-relaxed font-light">{slide.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Slide Indicators */}
            <div className="flex space-x-3 mt-8 justify-center lg:justify-start">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    index === currentSlide 
                      ? 'bg-[#ffd700] w-8' 
                      : 'bg-white/30 hover:bg-white/50'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>

            <div className="mt-16 pt-8 border-t border-white/10">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-2 h-2 rounded-full bg-[#ffd700] animate-pulse"></div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Now in early access</p>
              </div>
              <p className="text-sm text-gray-300/80 font-light leading-relaxed">
                "We're on a mission to simplify real estate lead management. Join us in shaping the future of open houses."
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
