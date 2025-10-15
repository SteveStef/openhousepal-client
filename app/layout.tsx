'use client'

import './globals.css'
import { Inter } from 'next/font/google'
import { PayPalScriptProvider } from "@paypal/react-paypal-js"

const inter = Inter({ subsets: ['latin'] })

const paypalOptions = {
  clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '',
  vault: true,
  intent: "subscription"
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#faf9f7] min-h-screen`}>
        <PayPalScriptProvider options={paypalOptions}>
          <main className="min-h-screen">
            {children}
          </main>
        </PayPalScriptProvider>
      </body>
    </html>
  )
}