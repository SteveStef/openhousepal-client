'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api-service'

// One star per person (owner, 11/06: "you cant tell they stared on dash or in activity"). The list of
// who's starred is read once and shared by every screen, so a star set anywhere shows everywhere.

export type Starred = { leads: Set<string>; emails: Set<string>; showcases: Set<string>; names: Set<string> }
export type Who = { leadId?: string | null; email?: string | null; showcaseId?: string | null; link?: string | null; name?: string | null; text?: string | null }

const EMPTY: Starred = { leads: new Set(), emails: new Set(), showcases: new Set(), names: new Set() }
const low = (v?: string | null) => (v || '').trim().toLowerCase()
let current = EMPTY
let job: Promise<void> | null = null
let readAt = 0
const listeners = new Set<(s: Starred) => void>()

function read(force = false) {
  if (job) return job
  if (!force && Date.now() - readAt < 30000) return Promise.resolve()
  job = api.leads.starred().then(r => {
    if (r.success && r.data) {
      current = { leads: new Set(r.data.lead_ids), emails: new Set(r.data.emails.map(low)), showcases: new Set(r.data.showcase_ids), names: new Set(r.data.names.map(low)) }
      readAt = Date.now()
      listeners.forEach(l => l(current))
    }
  }).finally(() => { job = null })
  return job
}

/** Call after any star changes, so every screen catches up. */
export function starChanged() { void read(true) }

export function useStarredPeople(): Starred {
  const [s, set] = useState(current)
  useEffect(() => {
    listeners.add(set)
    set(current)
    void read()
    return () => { listeners.delete(set) }
  }, [])
  return s
}

const ID = '[0-9a-f]{8}-[0-9a-f-]{27}'
const LEAD_LINK = new RegExp(`(?:/leads/|[?&]lead=)(${ID})`, 'i')
const SHOWCASE_LINK = new RegExp(`[?&]showcase=(${ID})`, 'i')

export function isStarred(s: Starred, w: Who) {
  if (w.leadId && s.leads.has(w.leadId)) return true
  if (w.email && s.emails.has(low(w.email))) return true
  if (w.showcaseId && s.showcases.has(w.showcaseId)) return true
  const link = w.link || ''
  const lead = LEAD_LINK.exec(link)?.[1], showcase = SHOWCASE_LINK.exec(link)?.[1]
  if (lead) return s.leads.has(lead)
  if (showcase && s.showcases.has(showcase)) return true
  if (w.name && s.names.has(low(w.name))) return true
  // A notification often only has the person in its words: "Text Jane Doe about 12 Oak Ln".
  const words = low(w.text)
  if (words) for (const n of Array.from(s.names)) if (n.includes(' ') && words.includes(n)) return true
  return false
}
