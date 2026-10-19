'use client'

import dynamic from 'next/dynamic'

// The app chrome as its own chunk: next/dynamic only code-splits from a client file (from the
// server root layout it was bundled into the layout and shipped to every IDX site anyway).
const AppShellLazy = dynamic(() => import('@/components/AppShell'))
export default AppShellLazy
