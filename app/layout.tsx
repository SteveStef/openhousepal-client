'use client'

import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#faf9f7] min-h-screen`}>
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  )
}
