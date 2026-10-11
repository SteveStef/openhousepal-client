'use client'

// Shared bits for the Guest Pass (the page a guest's phone opens right after signing in at an open
// house - backend services/guest_pass_service.py builds its data).
import { Check, Loader2 } from 'lucide-react'
import { normalizeImageUrl } from '@/lib/utils'

export type RequestKind = 'disclosure' | 'second_visit'

export interface GuestPassData {
  guest: { first_name: string; full_name: string; email: string; phone: string; has_agent: boolean }
  home: {
    id: string; listing_key?: string | null; address?: string | null; city?: string | null; state?: string | null
    zipcode?: string | null; price?: number | null; beds?: number | null; baths?: number | null; sqft?: number | null
    lot_size?: number | null; latitude?: number | null; longitude?: number | null; property_type?: string | null
    photos: string[]; cover_position?: { x: number; y: number } | null
  }
  agent: {
    id: string; name: string; first_name: string; title?: string | null; brokerage?: string | null
    photo_url?: string | null; photo_position?: { x: number; y: number } | null
    phone?: string | null; text_phone?: string | null; email?: string | null; hub_url?: string | null; website_url?: string | null
  }
  // Set when the host's Email Signature card should close the pass instead of the plain agent card.
  signature_hub_slug?: string | null
  theme: { accentColor?: string; darkMode: boolean }
  similar: any[]
  cheat_sheet: { property: any; amenities: any } | null
  spotlight_url: string | null
  // null = no Showcase button (they have an agent, or the plan has no Showcases). url null = not
  // built yet - the button builds it.
  showcase: { url: string | null } | null
  requested: { disclosure: boolean; second_visit: boolean }
  // When the server built this (the similar homes are refreshed from the MLS on every load).
  live_at?: string
}

export const img = (url?: string | null) => (url ? normalizeImageUrl(url) : '')

export const money = (v?: number | string | null) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? `$${Math.round(n).toLocaleString()}` : ''
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b([a-z])/g, m => m.toUpperCase())

// "847 LESLEY RD, VILLANOVA, PA 19085" -> "847 Lesley Rd"
export const streetOf = (address?: string | null) => {
  const first = String(address || '').split(',')[0].trim()
  return first ? (first === first.toUpperCase() ? titleCase(first) : first) : 'This home'
}

export const cityLine = (city?: string | null, state?: string | null) =>
  [city ? (city === city.toUpperCase() ? titleCase(city) : city) : '', state || ''].filter(Boolean).join(', ')

export const formatPhone = (raw?: string | null) => {
  const d = String(raw || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : (raw || '')
}

// "Sarah" -> "Sarah's", "James" -> "James'", nothing -> "Your".
export const possessive = (name?: string | null) => {
  const n = String(name || '').trim()
  if (!n) return 'Your'
  const pretty = n === n.toUpperCase() || n === n.toLowerCase() ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : n
  return /s$/i.test(pretty) ? `${pretty}'` : `${pretty}'s`
}

export const initials =(name?: string) => (name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')

// A one-tap request (seller disclosure / second tour): idle -> sending -> sent, never twice.
export function RequestState({ sending, sent, idle, sentText }: { sending: boolean; sent: boolean; idle: React.ReactNode; sentText: string }) {
  if (sent) {
    return (
      <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="h-2.5 w-2.5" strokeWidth={4} /></span>
        {sentText}
      </span>
    )
  }
  if (sending) return <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending...</span>
  return <>{idle}</>
}

export const ComplianceFooter = () => (
  <div className="mx-auto max-w-3xl px-4 pb-8 pt-10 text-center">
    <p className="text-[10px] font-medium uppercase leading-relaxed tracking-wider text-gray-400 dark:text-gray-500">
      © BRIGHT, All Rights Reserved | Information Deemed Reliable But Not Guaranteed. Some properties which appear for sale may no longer be available.
    </p>
  </div>
)
