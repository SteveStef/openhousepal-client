import './globals.css'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/contexts/AuthContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { Providers } from './providers'
import AppHeader from '@/components/AppHeader'
import { Metadata } from 'next'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Open House Pal',
  description: 'Open House Lead Generation',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className="overflow-x-hidden">
      <body className={`${inter.className} bg-[#faf9f7] dark:bg-[#0B0B0B] min-h-screen text-[#111827] dark:text-[#F3F4F6] overflow-x-hidden`}>
        <Providers>
          <ToastProvider>
            <AuthProvider>
              <main className="min-h-screen flex flex-col overflow-x-hidden">
                <div className="print:hidden">
                  <AppHeader />
                </div>
                {children}
              </main>
            </AuthProvider>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  )
}
