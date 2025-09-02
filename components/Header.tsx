'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { checkAuth } from '@/lib/auth'

interface HeaderProps {
  mode?: 'landing' | 'app' | 'shared'
}

export default function Header({ mode = 'app' }: HeaderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true)

  useEffect(() => {
    const verifyAuth = async () => {
      if (mode === 'landing') {
        const isAuth = await checkAuth()
        setIsAuthenticated(isAuth)
      }
      setIsCheckingAuth(false)
    }

    verifyAuth()
  }, [mode])

  return (
    <header className="bg-white/95 backdrop-blur-xl border-b border-gray-200/80 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* House Logo */}
          <Link href="/" className="flex items-center space-x-3 hover:opacity-80 transition-all duration-200">
            <svg className="w-8 h-8 text-[#8b7355]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="9,22 9,12 15,12 15,22" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Open House Pal</h1>
              <p className="text-xs text-gray-500 font-medium">Real Estate Lead Engine</p>
            </div>
          </Link>
          

          {/* Right Side Actions */}
          <div className="flex items-center space-x-4">
            {mode === 'landing' ? (
              // Landing page buttons
              <>
                {!isCheckingAuth && isAuthenticated && (
                  <>
                    <Link href="/open-houses" className="text-gray-700 hover:text-[#8b7355] font-medium text-sm transition-colors duration-200 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1" />
                      </svg>
                      Open Houses
                    </Link>
                    <Link href="/showcases" className="text-gray-700 hover:text-[#8b7355] font-medium text-sm transition-colors duration-200 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      Showcases
                    </Link>
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
                      className="px-4 py-2 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-xl font-medium hover:shadow-lg hover:shadow-[#8b7355]/25 transition-all duration-300 text-sm"
                    >
                      Get Started
                    </Link>
                  </>
                )}
              </>
            ) : mode === 'shared' ? (
              // Shared collection view - minimal navigation
              <>
                <Link
                  href="/login"
                  className="text-gray-700 hover:text-[#8b7355] font-medium text-sm transition-colors duration-200"
                >
                  Agent Login
                </Link>
              </>
            ) : (
              // App mode navigation (authenticated users)
              <>
                <Link href="/open-houses" className="text-gray-700 hover:text-[#8b7355] font-medium text-sm transition-colors duration-200 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1" />
                  </svg>
                  Open Houses
                </Link>
                <Link href="/showcases" className="text-gray-700 hover:text-[#8b7355] font-medium text-sm transition-colors duration-200 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Showcases
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}