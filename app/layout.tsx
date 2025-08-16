import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'EntryPoint™ - Open House Sign-in',
  description: 'Digital sign-in experience for open house visitors',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-zinc-900 min-h-screen`}>
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  )
}