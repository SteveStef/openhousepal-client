'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { resetPassword } from '../../../lib/auth'

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const [token, setToken] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info' | null
    message: string
  }>({ type: null, message: '' })
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({})
  const [passwordStrength, setPasswordStrength] = useState<{
    score: number
    label: string
    color: string
  }>({ score: 0, label: '', color: '' })
  const [resetSuccess, setResetSuccess] = useState(false)

  // Get token from URL
  useEffect(() => {
    const tokenParam = searchParams.get('token')
    if (tokenParam) {
      setToken(tokenParam)
    } else {
      showNotification('error', 'Invalid or missing reset token')
    }
  }, [searchParams])

  // Clear notifications after 5 seconds
  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message })
    setTimeout(() => {
      setNotification({ type: null, message: '' })
    }, 5000)
  }

  // Calculate password strength
  const calculatePasswordStrength = (password: string) => {
    let score = 0
    if (password.length >= 8) score++
    if (password.length >= 12) score++
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
    if (/\d/.test(password)) score++
    if (/[^a-zA-Z\d]/.test(password)) score++

    let label = ''
    let color = ''
    if (score === 0) {
      label = ''
      color = ''
    } else if (score <= 2) {
      label = 'Weak'
      color = 'bg-red-500'
    } else if (score === 3) {
      label = 'Fair'
      color = 'bg-yellow-500'
    } else if (score === 4) {
      label = 'Good'
      color = 'bg-blue-500'
    } else {
      label = 'Strong'
      color = 'bg-green-500'
    }

    return { score, label, color }
  }

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {}

    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long'
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    return newErrors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldErrors({})
    setNotification({ type: null, message: '' })

    if (!token) {
      showNotification('error', 'Invalid or missing reset token')
      return
    }

    // Validate form
    const validationErrors = validateForm()
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)
      showNotification('error', 'Please correct the errors below')
      return
    }

    setIsLoading(true)
    showNotification('info', 'Resetting your password...')

    try {
      const result = await resetPassword(token, formData.password)

      if (result.status === 200) {
        // Success
        setResetSuccess(true)
        showNotification('success', 'Password reset successful! Redirecting to login...')
        setTimeout(() => {
          window.location.href = '/login'
        }, 3000)
      } else {
        // Handle specific API errors
        if (result.status === 400) {
          showNotification('error', result.error || 'Invalid or expired reset token')
        } else if (result.status === 404) {
          showNotification('error', 'Reset token not found or has expired')
        } else {
          showNotification('error', result.error || 'Password reset failed. Please try again.')
        }
      }
    } catch (error) {
      console.error('Password reset error:', error)
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

    // Update password strength for password field
    if (name === 'password') {
      setPasswordStrength(calculatePasswordStrength(value))
    }

    // Clear field error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors({
        ...fieldErrors,
        [name]: ''
      })
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#faf9f7] via-white to-[#f5f4f2] flex items-center justify-center px-6">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <Link href="/" className="inline-flex items-center space-x-3 mb-8">
              <div className="w-10 h-10 bg-gradient-to-r from-[#8b7355] to-[#7a6549] rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold">OH</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">Open House Pal</span>
            </Link>
          </div>
          <div className="bg-[#f5f4f2]/90 rounded-2xl p-8 border border-gray-200/60 backdrop-blur-sm shadow-xl">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900">Invalid Reset Link</h3>
              <p className="text-gray-600">
                This password reset link is invalid or has expired.
              </p>
              <div className="pt-4">
                <Link
                  href="/forgot-password"
                  className="inline-block px-6 py-3 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-[#8b7355]/25 transition-all duration-300 hover:scale-105"
                >
                  Request new reset link
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf9f7] via-white to-[#f5f4f2] flex items-center justify-center px-6">
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

      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center space-x-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-r from-[#8b7355] to-[#7a6549] rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold">OH</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">Open House Pal</span>
          </Link>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Create new password</h2>
          <p className="text-gray-600">Enter a strong password for your account</p>
        </div>

        {/* Reset Password Form */}
        <div className="bg-[#f5f4f2]/90 rounded-2xl p-8 border border-gray-200/60 backdrop-blur-sm shadow-xl">
          {resetSuccess ? (
            // Success State
            <div className="space-y-6">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-gray-900">Password Reset Successful!</h3>
                <p className="text-gray-700">
                  Your password has been successfully reset. You will be redirected to the login page shortly.
                </p>
              </div>
              <Link
                href="/login"
                className="block w-full text-center px-6 py-3 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-[#8b7355]/25 transition-all duration-300 hover:scale-105"
              >
                Go to login
              </Link>
            </div>
          ) : (
            // Form State
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  New password
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
                  placeholder="Enter new password"
                />
                {fieldErrors.password && (
                  <p className="text-red-500 text-xs mt-1 flex items-center">
                    <svg className="w-3 h-3 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {fieldErrors.password}
                  </p>
                )}
                {/* Password Strength Indicator */}
                {formData.password && passwordStrength.label && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-600">Password strength:</span>
                      <span className={`text-xs font-medium ${
                        passwordStrength.label === 'Weak' ? 'text-red-500' :
                        passwordStrength.label === 'Fair' ? 'text-yellow-500' :
                        passwordStrength.label === 'Good' ? 'text-blue-500' :
                        'text-green-500'
                      }`}>{passwordStrength.label}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                        style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Use 8+ characters with a mix of letters, numbers & symbols
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm new password
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
                {fieldErrors.confirmPassword && (
                  <p className="text-red-500 text-xs mt-1 flex items-center">
                    <svg className="w-3 h-3 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {fieldErrors.confirmPassword}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || resetSuccess}
                className="w-full px-6 py-3 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-[#8b7355]/25 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Resetting password...
                  </div>
                ) : (
                  'Reset password'
                )}
              </button>

              <div className="text-center">
                <Link href="/login" className="text-sm text-[#8b7355] hover:text-[#7a6549] transition-colors">
                  Back to login
                </Link>
              </div>
            </form>
          )}
        </div>

        {/* Security Notice */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            Your password is encrypted and stored securely
          </p>
        </div>
      </div>
    </div>
  )
}
