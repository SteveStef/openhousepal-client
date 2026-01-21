'use client'

import Footer from './components/Footer'

export default function TestFooter() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 p-10">
        <h1 className="text-2xl font-bold">Footer Test Page</h1>
        <p>The footer should be at the bottom of this page.</p>
      </div>
      <Footer />
    </div>
  )
}
