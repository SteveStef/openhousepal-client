import './globals.css'
import { headers } from 'next/headers'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/contexts/AuthContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { Providers } from './providers'
import AppHeader from '@/components/AppHeader'
import AssistantWidget from '@/components/assistant/AssistantWidget'
import { Metadata } from 'next'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'OpenHousePal',
  description: 'Open House Lead Generation',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Set by proxy.ts whenever this request was rewritten to a visitor-facing public site (see
  // app/(sitepublic)) - that route group intentionally ships none of the dashboard's own JS, so
  // the mandatory root layout must not mount AppHeader/AuthProvider/AssistantWidget there either.
  const isPublicSite = (await headers()).get('x-ohp-public-site') === '1'

  return (
    <html lang="en" suppressHydrationWarning className="overflow-x-hidden overflow-y-visible">
      <body className={`${inter.className} bg-[#faf9f7] dark:bg-[#0B0B0B] min-h-screen text-[#111827] dark:text-[#F3F4F6] overflow-x-hidden overflow-y-visible`}>
        {isPublicSite ? (
          <Providers>{children}</Providers>
        ) : (
          <Providers>
            <ToastProvider>
              <AuthProvider>
                <main className="min-h-screen flex flex-col overflow-x-hidden overflow-y-visible">
                  <div className="print:hidden">
                    <AppHeader />
                  </div>
                  {children}
                </main>
                <AssistantWidget />
              </AuthProvider>
            </ToastProvider>
          </Providers>
        )}
      </body>
    </html>
  )
}
