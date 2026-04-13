'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Home, Moon, Sun, Menu, X, LogOut, Settings, Layout, ShieldCheck } from 'lucide-react'
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
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
      setIsMobileMenuOpen(false)
    }
  }

  // Close menu on navigation
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  return (
    <header className="relative z-40 bg-white dark:bg-[#0B0B0B] border-b border-gray-100 dark:border-gray-800 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-colors duration-300 print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 sm:py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" prefetch={true} className="flex items-center space-x-1.5 sm:space-x-2 hover:opacity-90 transition-all duration-300 group flex-shrink-0">
            <div className="relative overflow-hidden rounded-lg bg-white dark:bg-transparent p-0.5">
              <Image
                src="/logo.png"
                alt="OpenHousePal Logo"
                width={100}
                height={56}
                className="h-8 sm:h-12 w-auto group-hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="block">
              <h1 className="text-base sm:text-xl font-black text-[#111827] dark:text-white tracking-tight leading-none">
                <span className="inline min-[400px]:hidden">OHP</span>
                <span className="hidden min-[400px]:inline">OpenHousePal</span>
              </h1>
              <p className="text-[10px] text-[#6B7280] dark:text-gray-400 font-bold uppercase tracking-widest mt-0.5 hidden sm:block">Lead Engine</p>
            </div>
          </Link>
          
          {/* Landing Page Navigation (Desktop Only) */}
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
          <div className="flex items-center space-x-1 sm:space-x-3">
            {/* Logged In View */}
            {!isCheckingAuth && isAuthenticated && (
              <div className="flex items-center space-x-1 sm:space-x-3">
                {/* Mobile Only: Priority icons before hamburger */}
                <div className="flex items-center space-x-1 sm:hidden">
                  <NotificationBell />
                  <ThemeToggle />
                </div>
                
                {/* Desktop Menu */}
                <div className="hidden md:flex items-center space-x-1 sm:space-x-3">
                  {/* Admin Tab */}
                  {user?.is_admin && (
                    <Link
                      href="/admin"
                      className={`relative px-3 py-2 rounded-lg text-sm font-bold transition-all duration-300 flex items-center group ${
                        isActive('/admin') 
                          ? 'text-[#C9A24D] bg-[#C9A24D]/5' 
                          : 'text-[#6B7280] dark:text-gray-400 hover:text-[#C9A24D] hover:bg-[#C9A24D]/5'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      <span>Admin</span>
                    </Link>
                  )}

                  <Link
                    href={
                      !user?.is_admin && !user?.broker_authorized ? "/broker-authorization" :
                      !user?.is_admin && !hasValidSubscription(user) ? "/checkout" :
                      "/open-houses"
                    }
                    className={`relative px-3 py-2 rounded-lg text-sm font-bold transition-all duration-300 flex items-center group ${
                      isActive('/open-houses') 
                        ? 'text-[#111827] dark:text-white bg-gray-50 dark:bg-gray-800' 
                        : 'text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Home className={`w-4 h-4 mr-2 ${isActive('/open-houses') ? 'text-[#C9A24D]' : 'text-gray-400 group-hover:text-[#111827] dark:group-hover:text-white'}`} />
                    <span>Open Houses</span>
                    {isActive('/open-houses') && <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#C9A24D] rounded-full"></div>}
                  </Link>
                  
                  <Link 
                    href={
                      !user?.is_admin && !user?.broker_authorized ? "/broker-authorization" :
                      !user?.is_admin && !hasValidSubscription(user) ? "/checkout" :
                      !user?.is_admin && hasPremiumAccess === false ? "/upgrade-required" :
                      "/showcases"
                    }
                    className={`relative px-3 py-2 rounded-lg text-sm font-bold transition-all duration-300 flex items-center group ${
                      isActive('/showcases') 
                        ? 'text-[#111827] dark:text-white bg-gray-50 dark:bg-gray-800' 
                        : 'text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Layout className={`w-4 h-4 mr-2 ${isActive('/showcases') ? 'text-[#C9A24D]' : 'text-gray-400 group-hover:text-[#111827] dark:group-hover:text-white'}`} />
                    <span>Showcases</span>
                    {isActive('/showcases') && <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#C9A24D] rounded-full"></div>}
                  </Link>

                  <Link 
                    href="/settings/subscription" 
                    title="Settings"
                    className={`relative px-3 py-2 rounded-lg text-sm font-bold transition-all duration-300 flex items-center group ${
                      isActive('/settings/subscription') 
                        ? 'text-[#111827] dark:text-white bg-gray-50 dark:bg-gray-800' 
                        : 'text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Settings className={`w-4 h-4 ${isActive('/settings/subscription') ? 'text-[#C9A24D]' : 'text-gray-400 group-hover:text-[#111827] dark:group-hover:text-white'}`} />
                  </Link>

                  {/* Desktop Only: Icons after Settings */}
                  <div className="flex items-center space-x-1 px-2 border-l border-gray-100 dark:border-gray-800 ml-2">
                    <NotificationBell />
                    <ThemeToggle />
                  </div>

                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="px-3 py-2 text-[#6B7280] dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 font-bold text-xs uppercase tracking-widest transition-all duration-200 flex items-center disabled:opacity-50"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    <span>{isLoggingOut ? '...' : 'Logout'}</span>
                  </button>
                </div>

                {/* Mobile Hamburger */}
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="p-2 rounded-lg text-gray-500 hover:text-[#111827] dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all focus:outline-none md:hidden"
                  aria-label="Toggle Menu"
                >
                  {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
              </div>
            )}

            {/* Landing/Public Actions */}
            {!isCheckingAuth && !isAuthenticated && (
              <div className="flex items-center space-x-1 sm:space-x-2">
                <ThemeToggle />
                <Link
                  href="/login"
                  className="text-[#111827] dark:text-white font-black text-sm px-2 sm:px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-all"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="px-3 sm:px-5 py-2.5 bg-[#111827] dark:bg-white text-white dark:text-[#111827] rounded-xl font-black text-sm hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] hover:shadow-xl transition-all duration-300 whitespace-nowrap"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          {/* Menu Card */}
          <div className="absolute right-4 top-20 left-4 bg-white dark:bg-[#151517] rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden transform transition-all">
            <div className="p-2 space-y-1">
              {user?.is_admin && (
                <Link
                  href="/admin"
                  className={`flex items-center space-x-4 p-4 rounded-2xl font-bold transition-all ${
                    isActive('/admin') 
                      ? 'bg-[#C9A24D]/10 text-[#C9A24D]' 
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <ShieldCheck className="w-5 h-5" />
                  <span>Admin Panel</span>
                </Link>
              )}

              <Link
                href={
                  !user?.is_admin && !user?.broker_authorized ? "/broker-authorization" :
                  !user?.is_admin && !hasValidSubscription(user) ? "/checkout" :
                  "/open-houses"
                }
                className={`flex items-center space-x-4 p-4 rounded-2xl font-bold transition-all ${
                  isActive('/open-houses') 
                    ? 'bg-[#C9A24D]/10 text-[#C9A24D]' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Home className="w-5 h-5" />
                <span>Open Houses</span>
              </Link>

              <Link
                href={
                  !user?.is_admin && !user?.broker_authorized ? "/broker-authorization" :
                  !user?.is_admin && !hasValidSubscription(user) ? "/checkout" :
                  !user?.is_admin && hasPremiumAccess === false ? "/upgrade-required" :
                  "/showcases"
                }
                className={`flex items-center space-x-4 p-4 rounded-2xl font-bold transition-all ${
                  isActive('/showcases') 
                    ? 'bg-[#C9A24D]/10 text-[#C9A24D]' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Layout className="w-5 h-5" />
                <span>Showcases</span>
              </Link>

              <Link
                href="/settings/subscription"
                className={`flex items-center space-x-4 p-4 rounded-2xl font-bold transition-all ${
                  isActive('/settings/subscription') 
                    ? 'bg-[#C9A24D]/10 text-[#C9A24D]' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Settings className="w-5 h-5" />
                <span>Settings</span>
              </Link>

              <div className="border-t border-gray-100 dark:border-gray-800 my-2"></div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center space-x-4 p-4 rounded-2xl font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all"
              >
                <LogOut className="w-5 h-5" />
                <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
