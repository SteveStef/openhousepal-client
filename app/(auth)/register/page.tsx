'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false
  })
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<{[key: string]: string}>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    
    // Basic validation
    const newErrors: {[key: string]: string} = {}
    
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required'
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required'
    if (!formData.email.trim()) newErrors.email = 'Email is required'
    if (!formData.phone.trim()) newErrors.phone = 'Phone is required'
    if (!formData.password) newErrors.password = 'Password is required'
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }
    if (!formData.agreeToTerms) newErrors.agreeToTerms = 'You must agree to the terms'
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    
    setIsLoading(true)
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false)
      // Redirect to payment page to complete registration
      window.location.href = '/payment/setup'
    }, 2000)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    })
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: ''
      })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-zinc-900 flex items-center justify-center px-6 py-12">
      <div className="max-w-lg w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center space-x-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold">EP</span>
            </div>
            <span className="text-2xl font-bold text-white">EntryPoint™</span>
          </Link>
          <h2 className="text-3xl font-bold text-white mb-2">Start your free trial</h2>
          <p className="text-zinc-400">Create your agent account and begin transforming your open houses</p>
        </div>

        {/* Registration Form */}
        <div className="bg-zinc-900/40 rounded-2xl p-8 border border-zinc-800/60 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-zinc-300 mb-2">
                  First name
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 bg-zinc-800/60 border rounded-xl text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400/60 transition-all duration-300 ${
                    errors.firstName ? 'border-red-500/50' : 'border-zinc-700/50'
                  }`}
                  placeholder="John"
                />
                {errors.firstName && <p className="text-red-400 text-xs mt-1">{errors.firstName}</p>}
              </div>
              
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-zinc-300 mb-2">
                  Last name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 bg-zinc-800/60 border rounded-xl text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400/60 transition-all duration-300 ${
                    errors.lastName ? 'border-red-500/50' : 'border-zinc-700/50'
                  }`}
                  placeholder="Smith"
                />
                {errors.lastName && <p className="text-red-400 text-xs mt-1">{errors.lastName}</p>}
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-2">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className={`w-full px-4 py-3 bg-zinc-800/60 border rounded-xl text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400/60 transition-all duration-300 ${
                  errors.email ? 'border-red-500/50' : 'border-zinc-700/50'
                }`}
                placeholder="john.smith@example.com"
              />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-zinc-300 mb-2">
                Phone number
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                value={formData.phone}
                onChange={handleChange}
                className={`w-full px-4 py-3 bg-zinc-800/60 border rounded-xl text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400/60 transition-all duration-300 ${
                  errors.phone ? 'border-red-500/50' : 'border-zinc-700/50'
                }`}
                placeholder="(555) 123-4567"
              />
              {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
            </div>


            {/* Password Fields */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 bg-zinc-800/60 border rounded-xl text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400/60 transition-all duration-300 ${
                    errors.password ? 'border-red-500/50' : 'border-zinc-700/50'
                  }`}
                  placeholder="Create a strong password"
                />
                {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
              </div>
              
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-300 mb-2">
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 bg-zinc-800/60 border rounded-xl text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400/60 transition-all duration-300 ${
                    errors.confirmPassword ? 'border-red-500/50' : 'border-zinc-700/50'
                  }`}
                  placeholder="Confirm your password"
                />
                {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>}
              </div>
            </div>

            {/* Terms Agreement */}
            <div>
              <label className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  name="agreeToTerms"
                  checked={formData.agreeToTerms}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600 bg-zinc-800 border-zinc-600 rounded focus:ring-blue-500 focus:ring-2 mt-1"
                />
                <span className="text-sm text-zinc-300 leading-relaxed">
                  I agree to the{' '}
                  <Link href="/terms" className="text-blue-400 hover:text-blue-300 transition-colors">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="text-blue-400 hover:text-blue-300 transition-colors">
                    Privacy Policy
                  </Link>
                </span>
              </label>
              {errors.agreeToTerms && <p className="text-red-400 text-xs mt-1">{errors.agreeToTerms}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Creating account...
                </div>
              ) : (
                'Continue to payment setup'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-zinc-400">
              Already have an account?{' '}
              <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Security Notice */}
        <div className="text-center">
          <p className="text-xs text-zinc-500">
            Your information is secured with 256-bit SSL encryption
          </p>
        </div>
      </div>
    </div>
  )
}