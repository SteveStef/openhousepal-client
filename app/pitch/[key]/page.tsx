import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PitchDeck from '@/components/pitch/PitchDeck'

// The brokerage pitch deck. Not linked from anywhere, not in the sitemap and never listed by Google:
// it only opens at /pitch/<PITCH_KEY>. Any other ending is a plain "page not found". No sign-in
// needed, so it opens the same from any account or none (proxy.ts keeps the app header off it).
// To change the link, change PITCH_KEY (or set PITCH_DECK_KEY on the server).
const PITCH_KEY = process.env.PITCH_DECK_KEY || 'office-k7x2m9qd4v'

export const metadata: Metadata = {
  title: 'OpenHousePal',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
}

export default async function PitchPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  if (key !== PITCH_KEY) notFound()
  return <PitchDeck />
}
