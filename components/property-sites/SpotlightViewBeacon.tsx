'use client'

import { useEffect } from 'react'

// Fires once per mount to record a public visit for the Listing Spotlight visitor stats.
//
// The site's own agent is never counted: when they open the live site from Studio the link
// carries ?ohp_owner=1, which we persist to localStorage on this origin (each Spotlight site is
// its own subdomain, so the flag is naturally per-site) and then never beacon from this browser
// again. The Studio editor itself renders a form, not this template, so ordinary editing never
// reaches here in the first place.
const OWNER_FLAG_KEY = 'ohp_spotlight_owner'

export default function SpotlightViewBeacon({ siteId }: { siteId: string }) {
  useEffect(() => {
    if (!siteId || siteId === 'preview') return

    let isOwner = false
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('ohp_owner') === '1') {
        isOwner = true
        localStorage.setItem(OWNER_FLAG_KEY, '1')
      } else if (localStorage.getItem(OWNER_FLAG_KEY) === '1') {
        isOwner = true
      }
    } catch {
      // Private mode / storage blocked - fall through and beacon as a normal visitor.
    }

    fetch(`/api/website-property-sites/${encodeURIComponent(siteId)}/view${isOwner ? '?owner_ref=1' : ''}`, {
      method: 'POST',
      keepalive: true,
    }).catch(() => {})
  }, [siteId])

  return null
}
