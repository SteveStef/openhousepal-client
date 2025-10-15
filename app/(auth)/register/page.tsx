'use client'

import Link from 'next/link'
import { register as registerUser } from '../../../lib/auth'
import { useState } from 'react'
import PayPalSubscriptionButton from '../../../components/PayPalSubscriptionButton'

// Plan definitions
const PLANS = {
  BASIC: {
    id: process.env.NEXT_PUBLIC_BASIC_PLAN_ID || '',
    name: 'Basic Plan',
    price: '$49.99',
    priceValue: 49.99,
    tier: 'BASIC',
    features: [
      'Generated PDFs for properties',
      'Signup forms for open houses',
      'Catalog of all visitors'
    ]
  },
  PREMIUM: {
    id: process.env.NEXT_PUBLIC_PREMIUM_PLAN_ID || '',
    name: 'Premium Plan',
    price: '$99.99',
    priceValue: 99.99,
    tier: 'PREMIUM',
    features: [
      'Everything in Basic',
      'Showcases feature',
      'Personalized property collections for visitors'
    ]
  }
}

export default function RegisterPage() {
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
  const [registrationStep, setRegistrationStep] = useState<'pricing' | 'form' | 'payment'>('form')
  const [selectedPlan, setSelectedPlan] = useState<typeof PLANS.BASIC | typeof PLANS.PREMIUM | null>(null)

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

    // Validate with backend before proceeding to pricing
    const url = `${process.env.NEXT_PUBLIC_API_URL}/auth/validate-signup-form`
    setIsLoading(true)

    try {
      // Transform formData from camelCase to snake_case for backend
      const validationData = {
        email: formData.email,
        password: formData.password,
        first_name: formData.firstName,
        last_name: formData.lastName,
        state: formData.state,
        brokerage: formData.brokerage
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validationData)
      })

      const data = await response.json()

      if (response.status === 400) {
        // Email already registered
        setFieldErrors({ email: data.detail || 'Email already registered' })
        showNotification('error', data.detail || 'Email already registered')
        setIsLoading(false)
        return
      }

      if (!response.ok) {
        // Other errors
        showNotification('error', 'Validation failed. Please try again.')
        setIsLoading(false)
        return
      }

      // Validation successful - move to pricing step
      setIsLoading(false)
      setRegistrationStep('pricing')
      showNotification('success', 'Now choose your plan to continue.')
    } catch (err) {
      console.error('Validation error:', err)
      showNotification('error', 'Connection error. Please check your internet and try again.')
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
    <div className="min-h-screen bg-gradient-to-br from-[#faf9f7] via-white to-[#f5f4f2] flex items-center justify-center px-6 py-12">
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

      {registrationStep === 'pricing' ? (
        // Step 1: Pricing Selection
        <div className="max-w-5xl w-full space-y-8">
          <div className="text-center">
            <Link href="/" className="inline-flex items-center space-x-3 mb-8">
              <div className="w-10 h-10 bg-gradient-to-r from-[#8b7355] to-[#7a6549] rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold">OH</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">Open House Pal</span>
            </Link>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Choose Your Plan</h2>
            <p className="text-gray-600">Start with a 14-day free trial - no charge today</p>
            <button
              onClick={() => setRegistrationStep('form')}
              className="text-sm text-[#8b7355] hover:text-[#7a6549] mt-2"
            >
              ← Back to account details
            </button>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Basic Plan */}
            <div className="bg-white rounded-2xl p-8 border-2 border-gray-200 hover:border-[#8b7355] transition-all duration-300 shadow-lg">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{PLANS.BASIC.name}</h3>
                <div className="flex items-baseline justify-center">
                  <span className="text-5xl font-bold text-[#8b7355]">{PLANS.BASIC.price}</span>
                  <span className="text-gray-600 ml-2">/month</span>
                </div>
                <p className="text-sm text-gray-500 mt-2">after 14-day free trial</p>
              </div>

              <ul className="space-y-4 mb-8">
                {PLANS.BASIC.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start">
                    <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => {
                  setSelectedPlan(PLANS.BASIC)
                  setRegistrationStep('payment')
                }}
                className="w-full px-6 py-3 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-[#8b7355]/25 transition-all duration-300 hover:scale-105"
              >
                Select Basic Plan
              </button>
            </div>

            {/* Premium Plan */}
            <div className="bg-gradient-to-br from-[#8b7355] to-[#7a6549] rounded-2xl p-8 border-2 border-[#8b7355] shadow-xl transform hover:scale-105 transition-all duration-300 relative">
              <div className="absolute top-4 right-4 bg-yellow-400 text-gray-900 text-xs font-bold px-3 py-1 rounded-full">
                POPULAR
              </div>
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">{PLANS.PREMIUM.name}</h3>
                <div className="flex items-baseline justify-center">
                  <span className="text-5xl font-bold text-white">{PLANS.PREMIUM.price}</span>
                  <span className="text-white/80 ml-2">/month</span>
                </div>
                <p className="text-sm text-white/70 mt-2">after 14-day free trial</p>
              </div>

              <ul className="space-y-4 mb-8">
                {PLANS.PREMIUM.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start">
                    <svg className="w-5 h-5 text-yellow-400 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-white font-medium">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => {
                  setSelectedPlan(PLANS.PREMIUM)
                  setRegistrationStep('payment')
                }}
                className="w-full px-6 py-3 bg-white text-[#8b7355] rounded-xl font-semibold hover:bg-gray-50 transition-all duration-300 hover:scale-105 shadow-lg"
              >
                Select Premium Plan
              </button>
            </div>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500">
              All plans include a 14-day free trial • No credit card charged today • Cancel anytime
            </p>
          </div>
        </div>
      ) : registrationStep === 'form' ? (
        // Step 2: Registration Form
        <div className="max-w-lg w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center space-x-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-r from-[#8b7355] to-[#7a6549] rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold">OH</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">Open House Pal</span>
          </Link>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Create Your Account</h2>
          <p className="text-gray-600">Start your 14-day free trial today</p>
        </div>

        {/* Registration Form */}
        <div className="bg-[#f5f4f2]/90 rounded-2xl p-8 border border-gray-200/60 backdrop-blur-sm shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                  First name
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 bg-white border rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-300 ${
                    fieldErrors.firstName ? 'border-red-500 ring-2 ring-red-200 focus:ring-red-300' : 'border-gray-300 focus:ring-[#8b7355] focus:border-[#8b7355]'
                  }`}
                  placeholder="John"
                />
                {fieldErrors.firstName && <p className="text-red-500 text-xs mt-1 flex items-center"><svg className="w-3 h-3 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>{fieldErrors.firstName}</p>}
              </div>
              
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                  Last name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 bg-white border rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-300 ${
                    fieldErrors.lastName ? 'border-red-500 ring-2 ring-red-200 focus:ring-red-300' : 'border-gray-300 focus:ring-[#8b7355] focus:border-[#8b7355]'
                  }`}
                  placeholder="Smith"
                />
                {fieldErrors.lastName && <p className="text-red-500 text-xs mt-1 flex items-center"><svg className="w-3 h-3 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>{fieldErrors.lastName}</p>}
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className={`w-full px-4 py-3 bg-white border rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-300 ${
                  fieldErrors.email ? 'border-red-500 ring-2 ring-red-200 focus:ring-red-300' : 'border-gray-300 focus:ring-[#8b7355] focus:border-[#8b7355]'
                }`}
                placeholder="john.smith@example.com"
              />
              {fieldErrors.email && <p className="text-red-500 text-xs mt-1 flex items-center"><svg className="w-3 h-3 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>{fieldErrors.email}</p>}
            </div>

            {/* State and Brokerage Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-2">
                  State
                </label>
                <input
                  id="state"
                  name="state"
                  type="text"
                  required
                  value={formData.state}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 bg-white border rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-300 ${
                    fieldErrors.state ? 'border-red-500 ring-2 ring-red-200 focus:ring-red-300' : 'border-gray-300 focus:ring-[#8b7355] focus:border-[#8b7355]'
                  }`}
                  placeholder="CA, TX, NY..."
                />
                {fieldErrors.state && <p className="text-red-500 text-xs mt-1 flex items-center"><svg className="w-3 h-3 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>{fieldErrors.state}</p>}
              </div>
              
              <div>
                <label htmlFor="brokerage" className="block text-sm font-medium text-gray-700 mb-2">
                  Brokerage
                </label>
                <input
                  id="brokerage"
                  name="brokerage"
                  type="text"
                  required
                  value={formData.brokerage}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 bg-white border rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-300 ${
                    fieldErrors.brokerage ? 'border-red-500 ring-2 ring-red-200 focus:ring-red-300' : 'border-gray-300 focus:ring-[#8b7355] focus:border-[#8b7355]'
                  }`}
                  placeholder="Re/Max, Century 21..."
                />
                {fieldErrors.brokerage && <p className="text-red-500 text-xs mt-1 flex items-center"><svg className="w-3 h-3 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>{fieldErrors.brokerage}</p>}
              </div>
            </div>


            {/* Password Fields */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 bg-white border rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-300 ${
                    fieldErrors.password ? 'border-red-500 ring-2 ring-red-200 focus:ring-red-300' : 'border-gray-300 focus:ring-[#8b7355] focus:border-[#8b7355]'
                  }`}
                  placeholder="Create a strong password"
                />
                {fieldErrors.password && <p className="text-red-500 text-xs mt-1 flex items-center"><svg className="w-3 h-3 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>{fieldErrors.password}</p>}
              </div>
              
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 bg-white border rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-300 ${
                    fieldErrors.confirmPassword ? 'border-red-500 ring-2 ring-red-200 focus:ring-red-300' : 'border-gray-300 focus:ring-[#8b7355] focus:border-[#8b7355]'
                  }`}
                  placeholder="Confirm your password"
                />
                {fieldErrors.confirmPassword && <p className="text-red-500 text-xs mt-1 flex items-center"><svg className="w-3 h-3 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>{fieldErrors.confirmPassword}</p>}
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
              <label className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  name="agreeToTerms"
                  checked={formData.agreeToTerms}
                  onChange={handleChange}
                  className="w-4 h-4 text-[#8b7355] bg-white border-zinc-600 rounded focus:ring-[#8b7355] focus:ring-2 mt-1"
                />
                <span className="text-sm text-gray-700 leading-relaxed">
                  I agree to the{' '}
                  <Link href="/terms" className="text-[#8b7355] hover:text-[#7a6549] transition-colors">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="text-[#8b7355] hover:text-[#7a6549] transition-colors">
                    Privacy Policy
                  </Link>
                </span>
              </label>
              {fieldErrors.agreeToTerms && <p className="text-red-500 text-xs mt-1 flex items-center"><svg className="w-3 h-3 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>{fieldErrors.agreeToTerms}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-6 py-3 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-[#8b7355]/25 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Creating account...
                </div>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Already have an account?{' '}
              <Link href="/login" className="text-[#8b7355] hover:text-[#7a6549] font-medium transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Security Notice */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            Your information is secured with 256-bit SSL encryption
          </p>
        </div>
      </div>
      ) : (
        // Step 3: Payment Step
        <div className="max-w-lg w-full space-y-8">
          <div className="text-center">
            <Link href="/" className="inline-flex items-center space-x-3 mb-8">
              <div className="w-10 h-10 bg-gradient-to-r from-[#8b7355] to-[#7a6549] rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold">OH</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">Open House Pal</span>
            </Link>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Complete Payment Setup</h2>
            <p className="text-gray-600">You selected: <span className="font-semibold text-[#8b7355]">{selectedPlan?.name} - {selectedPlan?.price}/month</span></p>
            <div className="flex gap-4 justify-center mt-2">
              <button
                onClick={() => setRegistrationStep('pricing')}
                className="text-sm text-[#8b7355] hover:text-[#7a6549]"
              >
                ← Back to plans
              </button>
              <span className="text-gray-400">|</span>
              <button
                onClick={() => setRegistrationStep('form')}
                className="text-sm text-[#8b7355] hover:text-[#7a6549]"
              >
                ← Back to signup
              </button>
            </div>
          </div>

          <div className="bg-[#f5f4f2]/90 rounded-2xl p-8 border border-gray-200/60 backdrop-blur-sm shadow-xl">
            <div className="mb-6 bg-white rounded-xl p-6 border border-gray-200">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">{selectedPlan?.name} Features</h3>
              <ul className="space-y-3 text-gray-700 mb-4">
                {selectedPlan?.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center">
                    <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-gray-200 pt-4 mt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">14-day free trial</span>
                  <span className="font-semibold text-green-600">$0.00</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">After trial</span>
                  <span className="font-semibold text-gray-900">{selectedPlan?.price}/month</span>
                </div>
              </div>
            </div>

            <PayPalSubscriptionButton
              planId={selectedPlan?.id || ''}
              registrationData={{
                email: formData.email,
                password: formData.password,
                first_name: formData.firstName,
                last_name: formData.lastName,
                state: formData.state,
                brokerage: formData.brokerage
              }}
              onSuccess={() => {
                showNotification('success', 'Account created successfully! Redirecting...')
                setTimeout(() => window.location.href = '/open-houses', 2000)
              }}
              onError={(error) => {
                showNotification('error', error)
              }}
            />

            <p className="text-xs text-gray-500 text-center mt-6">
              You will not be charged until your 14-day trial ends
            </p>
            <p className="text-xs text-gray-500 text-center mt-2">
              Secured with PayPal's buyer protection • Cancel anytime
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
