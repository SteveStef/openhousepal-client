'use client'

import Link from 'next/link'
import { useState } from 'react'
import { logout, hasValidSubscription } from '@/lib/auth'
import { useAuth } from '@/contexts/AuthContext'

interface HeaderProps {
  mode?: 'landing' | 'app' | 'shared'
}

export default function Header({ mode = 'app' }: HeaderProps) {
  const { user, isAuthenticated, isLoading: isCheckingAuth } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false)

  const hasPremiumAccess = user?.plan_tier === 'PREMIUM'

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <header className="bg-white/95 backdrop-blur-xl border-b border-gray-200/80 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between">
          {/* House Logo */}
          <Link href="/" className="flex items-center space-x-2 sm:space-x-3 hover:opacity-80 transition-all duration-200">
            <svg className="w-7 h-7 sm:w-8 sm:h-8 text-[#8b7355]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="9,22 9,12 15,12 15,22" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Open House Pal</h1>
              <p className="text-xs text-gray-500 font-medium hidden sm:block">Real Estate Lead Engine</p>
            </div>
          </Link>
          

          {/* Right Side Actions */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {mode === 'landing' ? (
              // Landing page buttons
              <>
                {!isCheckingAuth && isAuthenticated && (
                  <>
                    <Link
                      href={hasValidSubscription(user) ? "/open-houses" : "/upgrade-required"}
                      className={`${hasValidSubscription(user) ? 'text-gray-700' : 'text-gray-400'} hover:text-[#8b7355] font-medium text-sm transition-colors duration-200 flex items-center`}
                      title={hasValidSubscription(user) ? "Open Houses" : "Open Houses (Subscription Required)"}
                    >
                      <svg className="w-5 h-5 sm:w-4 sm:h-4 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1" />
                      </svg>
                      <span className="hidden sm:inline">Open Houses</span>
                    </Link>
                    {hasPremiumAccess && hasValidSubscription(user) ? (
                      <Link href="/showcases" className="text-gray-700 hover:text-[#8b7355] font-medium text-sm transition-colors duration-200 flex items-center" title="Showcases">
                        <svg className="w-5 h-5 sm:w-4 sm:h-4 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <span className="hidden sm:inline">Showcases</span>
                      </Link>
                    ) : (
                      <Link href="/upgrade-required" className="text-gray-400 hover:text-[#8b7355] font-medium text-sm transition-colors duration-200 flex items-center" title="Showcases (Premium Only)">
                        <svg className="w-5 h-5 sm:w-4 sm:h-4 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span className="hidden sm:inline">Showcases</span>
                      </Link>
                    )}
                    <Link href="/settings/subscription" className="text-gray-700 hover:text-[#8b7355] font-medium text-sm transition-colors duration-200 flex items-center" title="Manage Subscription">
                      <svg className="w-5 h-5 sm:w-4 sm:h-4 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="hidden sm:inline">Settings</span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="text-gray-700 hover:text-red-600 font-medium text-sm transition-colors duration-200 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Logout"
                    >
                      {isLoggingOut ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 sm:h-4 sm:w-4 sm:mr-1 border-b-2 border-gray-600"></div>
                          <span className="hidden sm:inline">Logging out...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5 sm:w-4 sm:h-4 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          <span className="hidden sm:inline">Logout</span>
                        </>
                      )}
                    </button>
                  </>
                )}
                {!isCheckingAuth && !isAuthenticated && (
                  <>
                    <Link
                      href="/login"
                      className="text-gray-700 hover:text-[#8b7355] font-medium text-sm transition-colors duration-200"
                    >
                      Login
                    </Link>
                    <Link
                      href="/register"
                      className="px-3 py-2 sm:px-4 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-xl font-medium hover:shadow-lg hover:shadow-[#8b7355]/25 transition-all duration-300 text-xs sm:text-sm"
                    >
                      <span className="hidden sm:inline">Get Started</span>
                      <span className="sm:hidden">Start</span>
                    </Link>
                  </>
                )}
              </>
            ) : mode === 'shared' ? (
              // Shared collection view - minimal navigation
              <>
                <Link
                  href="/login"
                  className="text-gray-700 hover:text-[#8b7355] font-medium text-xs sm:text-sm transition-colors duration-200"
                >
                  <span className="hidden sm:inline">Agent Login</span>
                  <span className="sm:hidden">Login</span>
                </Link>
              </>
            ) : (
              // App mode navigation (authenticated users)
              <>
                <Link
                  href={hasValidSubscription(user) ? "/open-houses" : "/upgrade-required"}
                  className={`${hasValidSubscription(user) ? 'text-gray-700' : 'text-gray-400'} hover:text-[#8b7355] font-medium text-sm transition-colors duration-200 flex items-center`}
                  title={hasValidSubscription(user) ? "Open Houses" : "Open Houses (Subscription Required)"}
                >
                  <svg className="w-5 h-5 sm:w-4 sm:h-4 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1" />
                  </svg>
                  <span className="hidden sm:inline">Open Houses</span>
                </Link>
                {hasPremiumAccess && hasValidSubscription(user) ? (
                  <Link href="/showcases" className="text-gray-700 hover:text-[#8b7355] font-medium text-sm transition-colors duration-200 flex items-center" title="Showcases">
                    <svg className="w-5 h-5 sm:w-4 sm:h-4 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span className="hidden sm:inline">Showcases</span>
                  </Link>
                ) : (
                  <Link href="/upgrade-required" className="text-gray-400 hover:text-[#8b7355] font-medium text-sm transition-colors duration-200 flex items-center" title="Showcases (Premium Only)">
                    <svg className="w-5 h-5 sm:w-4 sm:h-4 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="hidden sm:inline">Showcases</span>
                  </Link>
                )}
                {!isCheckingAuth && isAuthenticated && (
                  <>
                    <Link href="/settings/subscription" className="text-gray-700 hover:text-[#8b7355] font-medium text-sm transition-colors duration-200 flex items-center" title="Manage Subscription">
                      <svg className="w-5 h-5 sm:w-4 sm:h-4 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="hidden sm:inline">Settings</span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="text-gray-700 hover:text-red-600 font-medium text-sm transition-colors duration-200 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Logout"
                    >
                      {isLoggingOut ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 sm:h-4 sm:w-4 sm:mr-1 border-b-2 border-gray-600"></div>
                          <span className="hidden sm:inline">Logging out...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5 sm:w-4 sm:h-4 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          <span className="hidden sm:inline">Logout</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}