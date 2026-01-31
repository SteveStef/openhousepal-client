'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { login } from '../../../lib/auth'
import { useAuth } from '@/contexts/AuthContext'
import { Suspense } from 'react'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refreshUser } = useAuth()
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
  const [showPassword, setShowPassword] = useState(false)

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
        // Success - update global auth state
        await refreshUser()
        
        showNotification('success', 'Login successful! Redirecting...')
        
        // Get redirect path from URL params or default to /open-houses
        const redirectPath = searchParams.get('redirect') || '/open-houses'
        router.push(redirectPath)
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
      <div className="w-full lg:w-[55%] bg-[#FAFAF7] dark:bg-[#0B0B0B] relative flex items-center justify-center px-6 py-12 overflow-hidden transition-colors duration-300">
        {/* Refined Background Gradient Orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-[#C9A24D]/5 rounded-full blur-[120px] pointer-events-none mix-blend-multiply dark:mix-blend-screen"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#111827]/5 dark:bg-[#C9A24D]/5 rounded-full blur-[100px] pointer-events-none mix-blend-multiply dark:mix-blend-screen"></div>
        
        <div className="max-w-[480px] w-full relative z-10">
          {/* Header */}
          <div className="mb-10 text-center">
            <h2 className="text-4xl font-black text-[#0B0B0B] dark:text-white tracking-tight mb-3">Welcome back</h2>
            <p className="text-[#6B7280] dark:text-gray-400 text-base font-medium">Please enter your details to sign in.</p>
          </div>

          {/* Login Card */}
          <div className="bg-white dark:bg-[#151517] rounded-3xl p-8 md:p-12 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-gray-100 dark:border-gray-800 transition-colors duration-300">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  Email address
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-[#C9A24D]">
                    <svg className="w-5 h-5 text-gray-400 group-focus-within:text-[#C9A24D] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className={`block w-full pl-11 pr-4 py-3.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border focus:bg-white dark:focus:bg-[#111827] rounded-xl text-[#0B0B0B] dark:text-white placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium ${
                      fieldErrors.email 
                        ? 'border-red-300 focus:ring-red-200 focus:border-red-400 bg-red-50/30' 
                        : 'border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-[#111827] hover:border-[#C9A24D]/30 dark:hover:border-[#C9A24D]/30'
                    }`}
                    placeholder="name@company.com"
                  />
                </div>
                {fieldErrors.email && (
                  <p className="mt-2 text-xs text-red-500 font-medium flex items-center animate-fadeIn pl-1">
                    <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-[#C9A24D]">
                    <svg className="w-5 h-5 text-gray-400 group-focus-within:text-[#C9A24D] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className={`block w-full pl-11 pr-12 py-3.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border focus:bg-white dark:focus:bg-[#111827] rounded-xl text-[#0B0B0B] dark:text-white placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium ${
                      fieldErrors.password 
                        ? 'border-red-300 focus:ring-red-200 focus:border-red-400 bg-red-50/30' 
                        : 'border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-[#111827] hover:border-[#C9A24D]/30 dark:hover:border-[#C9A24D]/30'
                    }`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-[#111827] dark:hover:text-white focus:outline-none transition-colors"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="mt-2 text-xs text-red-500 font-medium flex items-center animate-fadeIn pl-1">
                    <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center cursor-pointer group select-none">
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                    />
                    <div className="w-5 h-5 border-2 border-gray-200 dark:border-gray-700 rounded peer-checked:bg-[#111827] dark:peer-checked:bg-[#C9A24D] peer-checked:border-[#111827] dark:peer-checked:border-[#C9A24D] transition-all duration-200"></div>
                    <svg className="absolute top-1 left-1 w-3 h-3 text-white dark:text-[#111827] opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="ml-2.5 text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider group-hover:text-[#111827] dark:group-hover:text-white transition-colors">Remember me</span>
                </label>
                <Link href="/forgot-password" className="text-xs font-bold text-[#C9A24D] hover:text-[#111827] dark:hover:text-white transition-colors uppercase tracking-widest hover:underline underline-offset-4">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-4 px-4 rounded-xl shadow-xl text-sm font-black uppercase tracking-widest text-white bg-[#111827] dark:bg-white dark:text-[#111827] hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#111827] transform transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2.5 h-4 w-4 text-white dark:text-[#111827]" fill="none" viewBox="0 0 24 24">
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

            <div className="mt-8 pt-6 border-t border-gray-50 dark:border-gray-800">
              <div className="text-center">
                <span className="text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider">Don't have an account?</span>
                <Link href="/register" className="ml-2 text-xs font-black text-[#111827] dark:text-white hover:text-[#C9A24D] transition-colors uppercase tracking-widest hover:underline underline-offset-4">
                  Start free trial
                </Link>
              </div>
            </div>
          </div>
          
          <div className="mt-8 text-center">
            <p className="text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-widest flex items-center justify-center gap-1.5 opacity-60">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Enterprise-grade encryption
            </p>
          </div>
        </div>
      </div>

      {/* Right Section - Explanation (45%) */}
      <div className="w-full lg:w-[45%] relative bg-[#151517] text-white overflow-hidden flex flex-col justify-center">
        {/* Rich Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#151517] via-[#3a2f25] to-[#8b7355] opacity-90"></div>
        
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
                  <div className="bg-white/5 rounded-xl p-5 border border-white/10 shadow-lg">
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

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#FAFAF7]"><div className="animate-spin rounded-full h-8 w-8 border-2 border-[#C9A24D] border-t-transparent"></div></div>}>
      <LoginContent />
    </Suspense>
  )
}
