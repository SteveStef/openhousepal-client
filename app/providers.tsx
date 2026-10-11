'use client'

import { ThemeProvider } from 'next-themes'

// next-themes puts a tiny <script> on the page so the right light/dark class is set before the
// first paint. React 19 logs "Encountered a script tag while rendering React component" whenever
// that tag is rendered in the browser (it's only needed from the server HTML anyway). In the
// browser we mark it as inert JSON so React stays quiet; the server copy still runs as before.
// The script carries suppressHydrationWarning, so the differing type attribute is fine.
const scriptProps = typeof window === 'undefined' ? undefined : ({ type: 'application/json' } as const)

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} scriptProps={scriptProps}>
      {children}
    </ThemeProvider>
  )
}
