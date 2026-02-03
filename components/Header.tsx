'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Home, Moon, Sun } from 'lucide-react'
import { logout, hasValidSubscription } from '@/lib/auth'
import { useAuth } from '@/contexts/AuthContext'
import NotificationBell from './NotificationBell'

interface HeaderProps {
  mode?: 'landing' | 'app' | 'shared'
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"></div>
    )
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="p-2 rounded-lg text-gray-500 hover:text-[#111827] dark:text-gray-400 dark:hover:text-[#F3F4F6] hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 focus:outline-none"
      aria-label="Toggle Dark Mode"
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  )
}

export default function Header({ mode = 'app' }: HeaderProps) {
  const { user, isAuthenticated, isLoading: isCheckingAuth } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false)
  const pathname = usePathname()

  const hasPremiumAccess = user?.plan_tier === 'PREMIUM'

  const isActive = (path: string) => pathname === path

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
    <header className="relative z-40 bg-white dark:bg-[#0B0B0B] border-b border-gray-100 dark:border-gray-800 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-colors duration-300 print:hidden">
      <div className="max-w-7xl mx-auto px-4 py-2 sm:px-6 sm:py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" prefetch={true} className="flex items-center space-x-2 hover:opacity-90 transition-all duration-300 group">
            <div className="relative overflow-hidden rounded-lg bg-white dark:bg-transparent p-0.5">
              <Image
                src="/logo.png"
                alt="OpenHousePal Logo"
                width={100}
                height={56}
                className="h-10 sm:h-12 w-auto group-hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-[#111827] dark:text-white tracking-tight leading-none">OpenHousePal</h1>
              <p className="text-[10px] text-[#6B7280] dark:text-gray-400 font-bold uppercase tracking-widest mt-0.5 hidden sm:block">Lead Engine</p>
            </div>
          </Link>
          
          {/* Landing Page Navigation */}
          {mode === 'landing' && !isAuthenticated && (
            <nav className="hidden md:flex items-center space-x-10 absolute left-1/2 transform -translate-x-1/2">
              <button 
                onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white font-bold text-sm transition-all duration-200 uppercase tracking-wide"
              >
                Workflow
              </button>
              <button 
                onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white font-bold text-sm transition-all duration-200 uppercase tracking-wide"
              >
                Pricing
              </button>
              <button 
                onClick={() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white font-bold text-sm transition-all duration-200 uppercase tracking-wide"
              >
                FAQ
              </button>
            </nav>
          )}

          {/* Right Side Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {mode === 'landing' ? (
              // Landing page buttons
              <>
                {!isCheckingAuth && isAuthenticated && (
                  <>
                    <Link
                      href={hasValidSubscription(user) ? "/open-houses" : "/upgrade-required"}
                      prefetch={true}
                      className={`relative px-3 py-2 rounded-lg text-sm font-bold transition-all duration-300 flex items-center group ${
                        isActive('/open-houses') 
                          ? 'text-[#111827] dark:text-white bg-gray-50 dark:bg-gray-800' 
                          : 'text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <Home className={`w-4 h-4 mr-2 ${isActive('/open-houses') ? 'text-[#C9A24D]' : 'text-gray-400 group-hover:text-[#111827] dark:group-hover:text-white'}`} />
                      <span className="hidden sm:inline">Open Houses</span>
                      {isActive('/open-houses') && <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#C9A24D] rounded-full"></div>}
                    </Link>
                    {hasPremiumAccess && hasValidSubscription(user) ? (
                      <Link 
                        href="/showcases" 
                        prefetch={true} 
                        className={`relative px-3 py-2 rounded-lg text-sm font-bold transition-all duration-300 flex items-center group ${
                          isActive('/showcases') 
                            ? 'text-[#111827] dark:text-white bg-gray-50 dark:bg-gray-800' 
                            : 'text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        <svg className={`w-4 h-4 mr-2 ${isActive('/showcases') ? 'text-[#C9A24D]' : 'text-gray-400 group-hover:text-[#111827] dark:group-hover:text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <span className="hidden sm:inline">Showcases</span>
                        {isActive('/showcases') && <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#C9A24D] rounded-full"></div>}
                      </Link>
                    ) : (
                      <Link href="/upgrade-required" prefetch={true} className="text-gray-400 hover:text-[#111827] dark:hover:text-white font-bold text-sm px-3 py-2 flex items-center" title="Showcases (Premium Only)">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span className="hidden sm:inline">Showcases</span>
                      </Link>
                    )}
                    <Link 
                      href="/settings/subscription" 
                      prefetch={true} 
                      className={`relative px-3 py-2 rounded-lg text-sm font-bold transition-all duration-300 flex items-center group ${
                        isActive('/settings/subscription') 
                          ? 'text-[#111827] dark:text-white bg-gray-50 dark:bg-gray-800' 
                          : 'text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <svg className={`w-4 h-4 mr-2 ${isActive('/settings/subscription') ? 'text-[#C9A24D]' : 'text-gray-400 group-hover:text-[#111827] dark:group-hover:text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="hidden sm:inline text-xs uppercase tracking-widest">Settings</span>
                      {isActive('/settings/subscription') && <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#C9A24D] rounded-full"></div>}
                    </Link>
                    <NotificationBell />
                    <button
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="px-3 py-2 text-[#6B7280] dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 font-bold text-xs uppercase tracking-widest transition-all duration-200 flex items-center disabled:opacity-50"
                    >
                      {isLoggingOut ? '...' : 'Logout'}
                    </button>
                  </>
                )}
                {!isCheckingAuth && !isAuthenticated && (
                  <>
                    <Link
                      href="/login"
                      className="text-[#111827] dark:text-white font-black text-sm px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-all"
                    >
                      Login
                    </Link>
                    <Link
                      href="/register"
                      className="px-5 py-2.5 bg-[#111827] dark:bg-white text-white dark:text-[#111827] rounded-xl font-black text-sm hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] hover:shadow-xl transition-all duration-300"
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
                  className="bg-[#111827] dark:bg-white text-white dark:text-[#111827] px-4 py-2 rounded-xl font-black text-xs sm:text-sm hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] transition-all"
                >
                  Agent Login
                </Link>
              </>
            ) : (
              // App mode navigation (authenticated users)
              <>
                <Link
                  href={hasValidSubscription(user) ? "/open-houses" : "/upgrade-required"}
                  className={`relative px-3 py-2 rounded-lg text-sm font-bold transition-all duration-300 flex items-center group ${
                    isActive('/open-houses') 
                      ? 'text-[#111827] dark:text-white bg-gray-50 dark:bg-gray-800' 
                      : 'text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <Home className={`w-4 h-4 mr-2 ${isActive('/open-houses') ? 'text-[#C9A24D]' : 'text-gray-400 group-hover:text-[#111827] dark:group-hover:text-white'}`} />
                  <span className="hidden sm:inline">Open Houses</span>
                  {isActive('/open-houses') && <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#C9A24D] rounded-full"></div>}
                </Link>
                {hasPremiumAccess && hasValidSubscription(user) ? (
                  <Link 
                    href="/showcases" 
                    prefetch={true} 
                    className={`relative px-3 py-2 rounded-lg text-sm font-bold transition-all duration-300 flex items-center group ${
                      isActive('/showcases') 
                        ? 'text-[#111827] dark:text-white bg-gray-50 dark:bg-gray-800' 
                        : 'text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <svg className={`w-4 h-4 mr-2 ${isActive('/showcases') ? 'text-[#C9A24D]' : 'text-gray-400 group-hover:text-[#111827] dark:group-hover:text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span className="hidden sm:inline">Showcases</span>
                    {isActive('/showcases') && <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#C9A24D] rounded-full"></div>}
                  </Link>
                ) : (
                  <Link href="/upgrade-required" prefetch={true} className="text-gray-400 hover:text-[#111827] dark:hover:text-white font-bold text-sm px-3 py-2 flex items-center" title="Showcases (Premium Only)">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="hidden sm:inline">Showcases</span>
                  </Link>
                )}
                {!isCheckingAuth && isAuthenticated && (
                  <>
                    <Link 
                      href="/settings/subscription" 
                      prefetch={true} 
                      className={`relative px-3 py-2 rounded-lg text-sm font-bold transition-all duration-300 flex items-center group ${
                        isActive('/settings/subscription') 
                          ? 'text-[#111827] dark:text-white bg-gray-50 dark:bg-gray-800' 
                          : 'text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <svg className={`w-4 h-4 mr-2 ${isActive('/settings/subscription') ? 'text-[#C9A24D]' : 'text-gray-400 group-hover:text-[#111827] dark:group-hover:text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="hidden sm:inline text-xs uppercase tracking-widest">Settings</span>
                      {isActive('/settings/subscription') && <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#C9A24D] rounded-full"></div>}
                    </Link>
                    <NotificationBell />
                    <button
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="px-3 py-2 text-[#6B7280] dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 font-bold text-xs uppercase tracking-widest transition-all duration-200 flex items-center disabled:opacity-50"
                    >
                      {isLoggingOut ? '...' : 'Logout'}
                    </button>
                  </>
                )}
              </>
            )}
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}
