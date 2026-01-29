'use client'

import Link from 'next/link'
import Image from 'next/image'
import { register as registerUser } from '../../../lib/auth'
import { useState, useEffect } from 'react'
import PayPalSubscriptionButton from '../../../components/PayPalSubscriptionButton'
import { PayPalScriptProvider } from "@paypal/react-paypal-js"
import EmailVerificationInput from '../../../components/EmailVerificationInput'
import { sendVerificationCode } from '../../../lib/api'
import { PRICING_PLANS, TRIAL_PERIOD_DAYS } from '@/lib/pricing'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

// PayPal configuration
const paypalOptions = {
  clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '',
  vault: true,
  intent: "subscription",
  currency: "USD",
}

export default function RegisterPage() {
  const router = useRouter()
  const { refreshUser } = useAuth()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    state: '',
    brokerage: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false
  })
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<{[key: string]: string}>({})
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

  interface SelectedPlan {
    id: string;
    name: string;
    price: string;
    priceValue: number;
    tier: string;
    features: string[] | readonly string[];
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [slides.length])
  
  const [registrationStep, setRegistrationStep] = useState<'form' | 'verify' | 'pricing' | 'payment'>('form')
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan | null>(null)
  const [bundleCode, setBundleCode] = useState('')
  const [isVerifyingCode, setIsVerifyingCode] = useState(false)
  const [appliedBundleCode, setAppliedBundleCode] = useState<string | null>(null)

  const handleVerifyBundleCode = async () => {
    if (!bundleCode.trim()) return
    
    setIsVerifyingCode(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/auth/verify-bundle-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: bundleCode.trim() })
      })

      const data = await response.json()
      if (response.ok) {
        setAppliedBundleCode(bundleCode.trim())
        // Switch to the special plan automatically
        const bundlePlan = {
          id: data.plan_id,
          name: 'Special Bundle Plan',
          price: PRICING_PLANS.PREMIUM.priceString,
          priceValue: PRICING_PLANS.PREMIUM.price,
          tier: 'PREMIUM',
          features: PRICING_PLANS.PREMIUM.features
        }
        setSelectedPlan(bundlePlan)
        setRegistrationStep('payment')
        showNotification('success', 'Bundle code applied! 1-year free trial unlocked.')
      } else {
        showNotification('error', data.detail || 'Invalid bundle code')
      }
    } catch (err) {
      showNotification('error', 'Failed to verify code. Please try again.')
    } finally {
      setIsVerifyingCode(false)
    }
  }

  // Clear notifications after 5 seconds
  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message })
    setTimeout(() => {
      setNotification({ type: null, message: '' })
    }, 5000)
  }

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {}
    
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required'
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required'
    if (!formData.state.trim()) newErrors.state = 'State is required'
    if (!formData.brokerage.trim()) newErrors.brokerage = 'Brokerage is required'
    
    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }
    
    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long'
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }
    
    if (!formData.agreeToTerms) newErrors.agreeToTerms = 'You must agree to the terms'
    
    return newErrors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setFieldErrors({})
    setNotification({ type: null, message: '' })

    // Validate form
    const validationErrors = validateForm()
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)
      showNotification('error', 'Please correct the errors below')
      return
    }

    // Send verification code
    setIsLoading(true)

    try {
      await sendVerificationCode({
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        state: formData.state,
        brokerage: formData.brokerage,
        password: formData.password
      })

      // Code sent successfully - move to verification step
      setIsLoading(false)
      setRegistrationStep('verify')
      showNotification('success', 'Verification code sent to your email!')
    } catch (err: any) {
      console.error('Verification code error:', err)
      const errorMessage = err.message || 'Failed to send verification code. Please try again.'

      // Check if it's an email already registered error
      if (errorMessage.includes('already registered')) {
        setFieldErrors({ email: errorMessage })
      }

      showNotification('error', errorMessage)
      setIsLoading(false)
      return
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    })
    
    // Clear field error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors({
        ...fieldErrors,
        [name]: ''
      })
    }
    
    // Clear general errors and notifications when user interacts
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: ''
      })
    }
  }

  return (
    <div className="h-screen flex flex-col lg:flex-row overflow-hidden">
      {/* Left Section - Form (55%) */}
      <div className="w-full lg:w-[55%] bg-[#FAFAF7] relative h-full flex flex-col">
        {/* Refined Background Gradient Orbs - Clipped */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-[#C9A24D]/5 rounded-full blur-[120px] mix-blend-multiply"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#111827]/5 rounded-full blur-[100px] mix-blend-multiply"></div>
        </div>

        {/* Scrollable Content Container */}
        <div className="relative z-10 w-full h-full overflow-y-auto overflow-x-hidden flex items-center justify-center px-6 py-6">
          {/* Notification Toast */}
          {notification.type && (
            <div className={`fixed bottom-4 right-4 z-50 max-w-md p-4 rounded-lg shadow-lg transform transition-all duration-300 ${
              notification.type === 'success' ? 'bg-green-500 text-white' :
              notification.type === 'error' ? 'bg-red-500 text-white' :
              notification.type === 'info' ? 'bg-blue-500 text-white' : ''
            }`}>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                {notification.type === 'success' && (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
                {notification.type === 'error' && (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
                {notification.type === 'info' && (
                  <svg className="w-5 h-5 animate-spin" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium">{notification.message}</p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => setNotification({ type: null, message: '' })}
                  className="inline-flex text-white hover:text-gray-200 focus:outline-none focus:text-gray-200"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

      {registrationStep === 'verify' ? (
        // Step 2: Email Verification
        <EmailVerificationInput
          email={formData.email}
          onVerified={() => {
            setRegistrationStep('pricing')
            showNotification('success', 'Email verified! Now choose your plan.')
          }}
          onBack={() => {
            setRegistrationStep('form')
            setNotification({ type: null, message: '' })
          }}
        />
      ) : registrationStep === 'pricing' ? (
        // Step 3: Pricing Selection
        <div className="max-w-5xl w-full">
          <div className="text-center mb-6">
            <h2 className="text-4xl font-black text-[#0B0B0B] tracking-tight mb-3">Choose Your Plan</h2>
            <p className="text-[#6B7280] text-base font-medium">Start with a {TRIAL_PERIOD_DAYS}-day free trial — cancel anytime.</p>
            <button
              onClick={() => setRegistrationStep('verify')}
              className="text-xs font-bold text-[#C9A24D] hover:text-[#111827] mt-4 transition-colors uppercase tracking-widest"
            >
              ← Back to verification
            </button>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Basic Plan */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] flex flex-col hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.08)] transition-shadow">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-[#0B0B0B] mb-4">{PRICING_PLANS.BASIC.name}</h3>
                <div className="flex items-baseline justify-center">
                  <span className="text-5xl font-black text-[#0B0B0B] tracking-tight">{PRICING_PLANS.BASIC.priceString}</span>
                  <span className="text-[#6B7280] ml-2 font-bold">/mo</span>
                </div>
                <p className="text-xs font-bold text-[#6B7280] mt-2 uppercase tracking-wide">after {TRIAL_PERIOD_DAYS}-day free trial</p>
              </div>

              <ul className="space-y-3 mb-8 flex-grow">
                {PRICING_PLANS.BASIC.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start text-gray-600 font-medium text-sm">
                    <div className="w-5 h-5 bg-green-50 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                      <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => {
                  setSelectedPlan({
                    id: PRICING_PLANS.BASIC.paypalPlanId,
                    name: PRICING_PLANS.BASIC.name,
                    price: PRICING_PLANS.BASIC.priceString,
                    priceValue: PRICING_PLANS.BASIC.price,
                    tier: 'BASIC',
                    features: [...PRICING_PLANS.BASIC.features]
                  })
                  setAppliedBundleCode(null)
                  setRegistrationStep('payment')
                }}
                className="w-full py-4 px-4 bg-[#111827] text-white rounded-xl font-bold hover:bg-[#C9A24D] transition-all duration-200 hover:-translate-y-0.5 shadow-lg"
              >
                Select Basic Plan
              </button>
            </div>

            {/* Premium Plan */}
            <div className="bg-gradient-to-br from-[#111827] via-[#3a2f25] to-[#6b5840] rounded-3xl p-6 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)] flex flex-col transform hover:scale-[1.02] transition-all relative overflow-hidden">
              <div className="absolute top-6 right-6 bg-[#C9A24D] text-[#111827] text-[10px] font-black px-3 py-1 rounded-full shadow-sm uppercase tracking-wider">
                POPULAR
              </div>
              
              <div className="text-center mb-6 relative z-10">
                <h3 className="text-2xl font-bold text-white mb-4">{PRICING_PLANS.PREMIUM.name}</h3>
                <div className="flex items-baseline justify-center">
                  <span className="text-5xl font-black text-white tracking-tight">{PRICING_PLANS.PREMIUM.priceString}</span>
                  <span className="text-[#C9A24D] ml-2 font-bold">/mo</span>
                </div>
                <p className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-wide">after {TRIAL_PERIOD_DAYS}-day free trial</p>
              </div>

              <ul className="space-y-3 mb-8 flex-grow relative z-10">
                {PRICING_PLANS.PREMIUM.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start text-gray-200 font-medium text-sm">
                    <div className="w-5 h-5 bg-white/10 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                      <svg className="w-3 h-3 text-[#C9A24D]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => {
                  setSelectedPlan({
                    id: PRICING_PLANS.PREMIUM.paypalPlanId,
                    name: PRICING_PLANS.PREMIUM.name,
                    price: PRICING_PLANS.PREMIUM.priceString,
                    priceValue: PRICING_PLANS.PREMIUM.price,
                    tier: 'PREMIUM',
                    features: [...PRICING_PLANS.PREMIUM.features]
                  })
                  setAppliedBundleCode(null)
                  setRegistrationStep('payment')
                }}
                className="w-full py-4 px-4 bg-white text-[#111827] rounded-xl font-bold hover:bg-[#C9A24D] transition-all duration-200 hover:-translate-y-0.5 shadow-lg shadow-white/10 relative z-10"
              >
                Select Premium Plan
              </button>
            </div>
          </div>

          {/* Promo Code Section */}
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] text-center">
              <h4 className="text-xs font-bold text-[#6B7280] mb-3 tracking-widest uppercase">Have a bundle code?</h4>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={bundleCode}
                  onChange={(e) => setBundleCode(e.target.value.toUpperCase())}
                  placeholder="ENTER CODE"
                  className="flex-1 px-3 py-2 bg-[#FAFAF7] border border-gray-200 rounded-xl text-center font-mono font-bold focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all uppercase text-sm placeholder-gray-400 text-[#111827]"
                />
                <button
                  onClick={handleVerifyBundleCode}
                  disabled={isVerifyingCode || !bundleCode.trim()}
                  className="px-6 py-2 bg-[#111827] text-white rounded-xl font-bold hover:bg-[#C9A24D] transition-all disabled:opacity-50 text-sm uppercase tracking-wide"
                >
                  {isVerifyingCode ? '...' : 'Apply'}
                </button>
              </div>
            </div>
          </div>

          <div className="text-center mt-6">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              All plans include a {TRIAL_PERIOD_DAYS}-day free trial • No credit card charged today • Cancel anytime
            </p>
          </div>
        </div>
      ) : registrationStep === 'form' ? (
        // Step 1: Registration Form
        <div className="max-w-[640px] w-full">
          {/* Header */}
          <div className="mb-4 text-center">
            <h2 className="text-3xl font-black text-[#0B0B0B] tracking-tight mb-2">Create Account</h2>
            <p className="text-[#6B7280] text-sm font-medium">Start your {TRIAL_PERIOD_DAYS}-day free trial today.</p>
          </div>

          {/* Registration Form */}
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-gray-100">
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="firstName" className="block text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-1 ml-1">
                    First name
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={handleChange}
                    className={`block w-full px-3 py-2.5 bg-[#FAFAF7] border focus:bg-white rounded-xl text-[#0B0B0B] placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium text-sm ${
                      fieldErrors.firstName 
                        ? 'border-red-300 focus:ring-red-200 focus:border-red-400 bg-red-50/30' 
                        : 'border-gray-200 hover:bg-white hover:border-[#C9A24D]/30'
                    }`}
                    placeholder="John"
                  />
                  {fieldErrors.firstName && <p className="mt-1 text-xs text-red-500 font-medium pl-1">{fieldErrors.firstName}</p>}
                </div>
                
                <div>
                  <label htmlFor="lastName" className="block text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-1 ml-1">
                    Last name
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={handleChange}
                    className={`block w-full px-3 py-2.5 bg-[#FAFAF7] border focus:bg-white rounded-xl text-[#0B0B0B] placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium text-sm ${
                      fieldErrors.lastName 
                        ? 'border-red-300 focus:ring-red-200 focus:border-red-400 bg-red-50/30' 
                        : 'border-gray-200 hover:bg-white hover:border-[#C9A24D]/30'
                    }`}
                    placeholder="Smith"
                  />
                  {fieldErrors.lastName && <p className="mt-1 text-xs text-red-500 font-medium pl-1">{fieldErrors.lastName}</p>}
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-1 ml-1">
                  Email address
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#C9A24D] transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    className={`block w-full pl-9 pr-4 py-2.5 bg-[#FAFAF7] border focus:bg-white rounded-xl text-[#0B0B0B] placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium text-sm ${
                      fieldErrors.email 
                        ? 'border-red-300 focus:ring-red-200 focus:border-red-400 bg-red-50/30' 
                        : 'border-gray-200 hover:bg-white hover:border-[#C9A24D]/30'
                    }`}
                    placeholder="john.smith@example.com"
                  />
                </div>
                {fieldErrors.email && <p className="mt-1 text-xs text-red-500 font-medium pl-1">{fieldErrors.email}</p>}
              </div>

              {/* State and Brokerage Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="state" className="block text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-1 ml-1">
                    State
                  </label>
                  <input
                    id="state"
                    name="state"
                    type="text"
                    required
                    value={formData.state}
                    onChange={handleChange}
                    className={`block w-full px-3 py-2.5 bg-[#FAFAF7] border focus:bg-white rounded-xl text-[#0B0B0B] placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium text-sm ${
                      fieldErrors.state 
                        ? 'border-red-300 focus:ring-red-200 focus:border-red-400 bg-red-50/30' 
                        : 'border-gray-200 hover:bg-white hover:border-[#C9A24D]/30'
                    }`}
                    placeholder="CA"
                  />
                  {fieldErrors.state && <p className="mt-1 text-xs text-red-500 font-medium pl-1">{fieldErrors.state}</p>}
                </div>
                
                <div>
                  <label htmlFor="brokerage" className="block text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-1 ml-1">
                    Brokerage
                  </label>
                  <input
                    id="brokerage"
                    name="brokerage"
                    type="text"
                    required
                    value={formData.brokerage}
                    onChange={handleChange}
                    className={`block w-full px-3 py-2.5 bg-[#FAFAF7] border focus:bg-white rounded-xl text-[#0B0B0B] placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium text-sm ${
                      fieldErrors.brokerage 
                        ? 'border-red-300 focus:ring-red-200 focus:border-red-400 bg-red-50/30' 
                        : 'border-gray-200 hover:bg-white hover:border-[#C9A24D]/30'
                    }`}
                    placeholder="Re/Max..."
                  />
                  {fieldErrors.brokerage && <p className="mt-1 text-xs text-red-500 font-medium pl-1">{fieldErrors.brokerage}</p>}
                </div>
              </div>


              {/* Password Fields */}
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label htmlFor="password" className="block text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-1 ml-1">
                    Password
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#C9A24D] transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      className={`block w-full pl-9 pr-10 py-2.5 bg-[#FAFAF7] border focus:bg-white rounded-xl text-[#0B0B0B] placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium text-sm ${
                        fieldErrors.password 
                          ? 'border-red-300 focus:ring-red-200 focus:border-red-400 bg-red-50/30' 
                          : 'border-gray-200 hover:bg-white hover:border-[#C9A24D]/30'
                      }`}
                      placeholder="Strong password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-[#111827] focus:outline-none transition-colors"
                    >
                      {showPassword ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {fieldErrors.password && <p className="mt-1 text-xs text-red-500 font-medium pl-1">{fieldErrors.password}</p>}
                </div>
                
                <div>
                  <label htmlFor="confirmPassword" className="block text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-1 ml-1">
                    Confirm password
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#C9A24D] transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className={`block w-full pl-9 pr-4 py-2.5 bg-[#FAFAF7] border focus:bg-white rounded-xl text-[#0B0B0B] placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium text-sm ${
                        fieldErrors.confirmPassword 
                          ? 'border-red-300 focus:ring-red-200 focus:border-red-400 bg-red-50/30' 
                          : 'border-gray-200 hover:bg-white hover:border-[#C9A24D]/30'
                      }`}
                      placeholder="Confirm password"
                    />
                  </div>
                  {fieldErrors.confirmPassword && <p className="mt-1 text-xs text-red-500 font-medium pl-1">{fieldErrors.confirmPassword}</p>}
                </div>
              </div>

              {/* General Error */}
              {errors.general && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm">{errors.general}</p>
                </div>
              )}

              {/* Terms Agreement */}
              <div>
                <label className="flex items-start space-x-3 cursor-pointer group">
                  <div className="relative mt-0.5">
                    <input
                      type="checkbox"
                      name="agreeToTerms"
                      checked={formData.agreeToTerms}
                      onChange={handleChange}
                      className="sr-only peer"
                    />
                    <div className="w-5 h-5 border-2 border-gray-300 rounded peer-checked:bg-[#111827] peer-checked:border-[#111827] transition-all duration-200"></div>
                    <svg className="absolute top-1 left-1 w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-xs text-[#6B7280] leading-relaxed group-hover:text-[#111827] transition-colors font-medium">
                    I agree to the{' '}
                    <Link 
                      href="/terms" 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#C9A24D] font-bold hover:text-[#111827] transition-colors hover:underline underline-offset-4"
                    >
                      Terms
                    </Link>{' '}
                    and{' '}
                    <Link 
                      href="/privacy" 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#C9A24D] font-bold hover:text-[#111827] transition-colors hover:underline underline-offset-4"
                    >
                      Privacy Policy
                    </Link>
                  </span>
                </label>
                {fieldErrors.agreeToTerms && <p className="mt-1 text-xs text-red-500 font-medium pl-8">{fieldErrors.agreeToTerms}</p>}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-xl text-sm font-black uppercase tracking-widest text-white bg-[#111827] hover:bg-[#C9A24D] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#111827] transform transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2.5 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating account...
                  </div>
                ) : (
                  'Create account'
                )}
              </button>
            </form>

            <div className="mt-4 pt-4 border-t border-gray-50">
              <div className="text-center">
                <span className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Already have an account?</span>
                <Link href="/login" className="ml-2 text-xs font-black text-[#111827] hover:text-[#C9A24D] transition-colors uppercase tracking-widest hover:underline underline-offset-4">
                  Sign in
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-4 text-center">
            <p className="text-[10px] font-black text-[#6B7280] uppercase tracking-widest flex items-center justify-center gap-1.5 opacity-60">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Protected by industry-standard encryption
            </p>
          </div>
        </div>
      ) : (
        // Step 4: Payment Step - Wrapped with PayPal provider
        <PayPalScriptProvider options={paypalOptions}>
          <div className="max-w-[640px] w-full space-y-4">
            <div className="text-center">
              <h2 className="text-2xl font-black text-[#0B0B0B] mb-2 tracking-tight">Complete Payment Setup</h2>
              <p className="text-[#6B7280] text-sm font-medium">You selected: <span className="font-bold text-[#C9A24D]">{selectedPlan?.name} - {appliedBundleCode ? PRICING_PLANS.PREMIUM.priceString : selectedPlan?.price}/month after trial</span></p>
              <div className="flex gap-4 justify-center mt-4">
                <button
                  onClick={() => setRegistrationStep('pricing')}
                  className="text-[10px] font-bold text-[#C9A24D] hover:text-[#111827] uppercase tracking-wider"
                >
                  ← Back to plans
                </button>
                <span className="text-gray-300 text-xs">|</span>
                <button
                  onClick={() => setRegistrationStep('form')}
                  className="text-[10px] font-bold text-[#C9A24D] hover:text-[#111827] uppercase tracking-wider"
                >
                  ← Back to signup
                </button>
              </div>
            </div>

            <div className="bg-[#FAFAF7] rounded-2xl p-6 border border-gray-200/60 shadow-xl">
              <div className="mb-4 bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <h3 className="text-base font-black mb-3 text-[#0B0B0B]">{selectedPlan?.name} Features</h3>
                <ul className="space-y-2 text-[#6B7280] mb-3 text-sm font-medium">
                  {selectedPlan?.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center">
                      <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-gray-100 pt-3 mt-3">
                  <div className="flex justify-between items-center mb-1 text-sm font-medium">
                    <span className="text-[#6B7280]">{appliedBundleCode ? '1-year free trial' : `${TRIAL_PERIOD_DAYS}-day free trial`}</span>
                    <span className="font-bold text-green-600">$0.00</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span className="text-[#6B7280]">After trial</span>
                    <span className="font-black text-[#0B0B0B]">{appliedBundleCode ? PRICING_PLANS.PREMIUM.priceString : selectedPlan?.price}/month</span>
                  </div>
                </div>
              </div>

              <PayPalSubscriptionButton
                planId={selectedPlan?.id || ''}
                bundleCode={appliedBundleCode || undefined}
                registrationData={{
                  email: formData.email,
                  password: formData.password,
                  first_name: formData.firstName,
                  last_name: formData.lastName,
                  state: formData.state,
                  brokerage: formData.brokerage
                }}
                onSuccess={async () => {
                  showNotification('success', 'Account created successfully! Redirecting...')
                  await refreshUser()
                  setTimeout(() => router.push('/open-houses'), 2000)
                }}
                onError={(error) => {
                  showNotification('error', error)
                }}
              />

              <p className="text-[10px] font-bold text-gray-400 text-center mt-4 uppercase tracking-wider">
                You will not be charged until your {appliedBundleCode ? '1-year' : `${TRIAL_PERIOD_DAYS}-day`} trial ends
              </p>
              <p className="text-[10px] font-bold text-gray-400 text-center mt-1 uppercase tracking-wider">
                Secured with PayPal's buyer protection • Cancel anytime
              </p>
            </div>
          </div>
        </PayPalScriptProvider>
      )}
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
