'use client'

// Dev proof: the Studio photo card's "From your homes" row on its own (real data, logged-in agent).
import { useState } from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import YourHomesPhotos from '@/components/studio/design/editor/YourHomesPhotos'

function Inner() {
  const [main, setMain] = useState<string | null>(null)
  const [more, setMore] = useState<string[]>([])
  return (
    <div className="mx-auto max-w-sm space-y-4 p-5">
      <YourHomesPhotos current={main} onPick={(m, rest) => { setMain(m); setMore(rest) }} />
      <p className="text-xs font-bold text-gray-500">Picked: {main ? main.slice(0, 60) : 'nothing'} ({more.length} photos)</p>
    </div>
  )
}

export default function YourHomesProof() {
  return <AuthProvider><Inner /></AuthProvider>
}
