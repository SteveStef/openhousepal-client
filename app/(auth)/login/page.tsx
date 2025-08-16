'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function LoginPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false)
      // Redirect to dashboard on success
      window.location.href = '/dashboard'
    }, 1500)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-zinc-900 flex items-center justify-center px-6">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center space-x-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold">EP</span>
            </div>
            <span className="text-2xl font-bold text-white">EntryPoint™</span>
          </Link>
          <h2 className="text-3xl font-bold text-white mb-2">Welcome back</h2>
          <p className="text-zinc-400">Sign in to your agent account</p>
        </div>

        {/* Login Form */}
        <div className="bg-zinc-900/40 rounded-2xl p-8 border border-zinc-800/60 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
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
                className="w-full px-4 py-3 bg-zinc-800/60 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400/60 transition-all duration-300"
                placeholder="Enter your email"
              />
            </div>

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
                className="w-full px-4 py-3 bg-zinc-800/60 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400/60 transition-all duration-300"
                placeholder="Enter your password"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 bg-zinc-800 border-zinc-600 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="ml-2 text-sm text-zinc-300">Remember me</span>
              </label>
              <Link href="/forgot-password" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Signing in...
                </div>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-zinc-400">
              Don't have an account?{' '}
              <Link href="/register" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                Start your free trial
              </Link>
            </p>
          </div>
        </div>

        {/* Security Notice */}
        <div className="text-center">
          <p className="text-xs text-zinc-500">
            Protected by industry-standard encryption
          </p>
        </div>
      </div>
    </div>
  )
}