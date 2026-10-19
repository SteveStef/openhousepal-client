import './globals.css'
import { headers } from 'next/headers'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/contexts/AuthContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { Providers } from './providers'
import AppHeader from '@/components/AppHeader'
import PageGate from '@/components/PageGate'
import NavHistoryTracker from '@/components/NavHistoryTracker'
import AssistantWidget from '@/components/assistant/AssistantWidget'
import IdxDomainMigrationModal from '@/components/IdxDomainMigrationModal'
import ScrollLockWatcher from '@/components/ScrollLockWatcher'
import { Metadata } from 'next'
import ThemeColorSync from '@/components/ThemeColorSync'
import { FRAME_LINK_GUARD_SCRIPT } from '@/lib/frameLinkGuard'

const inter = Inter({ subsets: ['latin'] })

// Base URL every relative metadata URL (the OG image, canonical) is resolved against. Falls back
// to the production domain so a shared link always points somewhere real, not localhost.
const SITE_URL =
  process.env.NEXT_PUBLIC_CLIENT_URL?.startsWith('https')
    ? process.env.NEXT_PUBLIC_CLIENT_URL
    : `https://${process.env.NEXT_PUBLIC_OHP_BASE_DOMAIN || 'openhousepal.com'}`

const SITE_TITLE = 'OpenHousePal — The tools agents actually need'
const SITE_DESCRIPTION =
  'The toolkit real estate agents actually use: open house sign-in kits, client showcases, your own IDX website, forms, blogs, AI listing media, AI CMAs, a lead pipeline, and much more — all in one place.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Plain string, deliberately NOT a title.template: the visitor-facing agent sites under
  // app/(sitepublic) set their own bare titles (a property address, a blog name) and must not
  // get an "OpenHousePal" suffix appended to them.
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: 'OpenHousePal',
  // Declared here (file lives in public/) rather than the app/favicon.ico convention, which Next
  // attaches to every route - agent IDX sites set their own tab icon and must not also get ours.
  icons: {
    icon: [{ url: '/favicon.ico', sizes: 'any' }, { url: '/icon-512.png', type: 'image/png', sizes: '512x512' }],
    apple: '/apple-touch-icon.png',
  },
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'OpenHousePal',
    url: SITE_URL,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'OpenHousePal' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/og-image.png'],
  },
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
    <html lang="en" suppressHydrationWarning className="overflow-x-clip overflow-y-visible">
      {/* overflow-x-clip, not overflow-x-hidden: `hidden` forces the paired overflow-y to compute
          as `auto` (per the CSS overflow spec), which silently turns html/body/main into a
          "scroll container" - and any position:sticky descendant (the homepage header) then
          sticks relative to that non-scrolling container instead of the real page scroll, so it
          never actually stays put. `clip` blocks horizontal overflow the same way without
          triggering that pairing, so overflow-y stays genuinely visible. */}
      <body suppressHydrationWarning className={`${inter.className} bg-[#faf9f7] dark:bg-[#0B0B0B] min-h-screen text-[#111827] dark:text-[#F3F4F6] overflow-x-clip overflow-y-visible`}>
        {/* Framed by an agent's IDX site: links that leave this page open top-level, never a
            second site inside the frame (lib/frameLinkGuard). No-op when not framed. */}
        <script dangerouslySetInnerHTML={{ __html: FRAME_LINK_GUARD_SCRIPT }} />
        {isPublicSite ? (
          <Providers>{children}<ScrollLockWatcher /><ThemeColorSync /></Providers>
        ) : (
          <Providers>
            <ToastProvider>
              <AuthProvider>
                <main className="min-h-screen flex flex-col overflow-x-clip overflow-y-visible">
                  {/* No wrapping div here - Header.tsx's own <header> already carries print:hidden,
                      and a sticky element can never stick past the bottom edge of its own
                      containing block. A wrapper sized to exactly the header's own height gave it
                      zero room to actually stick; as a direct child of this full-page-height
                      <main>, it now has the whole page to stay pinned across. */}
                  <NavHistoryTracker />
                  <AppHeader />
                  {/* App pages wait behind the logo loader until they're fully loaded, then rise in. */}
                  <PageGate>{children}</PageGate>
                </main>
                <AssistantWidget />
                <IdxDomainMigrationModal />
                <ScrollLockWatcher />
                <ThemeColorSync />
              </AuthProvider>
            </ToastProvider>
          </Providers>
        )}
      </body>
    </html>
  )
}
