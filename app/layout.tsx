'use client'

import './globals.css'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/contexts/AuthContext'
import { Providers } from './providers'
import AppHeader from '@/components/AppHeader'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-[#faf9f7] dark:bg-[#0B0B0B] min-h-screen text-[#111827] dark:text-[#F3F4F6]`}>
        <Providers>
          <AuthProvider>
            <main className="min-h-screen flex flex-col">
              <div className="print:hidden">
                <AppHeader />
              </div>
              {children}
            </main>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  )
}
