'use client'

// Agent links that follow the one rule (see websitePublicHostname): openhousepal.com for everyone,
// the agent's own connected domain when they have one. On openhousepal.com Agent Hub pages sit
// under the hub's slug (/jane-doe/selling); on an own domain they're short (/forms/selling).
// Mirrors backend site_service.OwnerLinks.
import { useEffect, useState } from 'react'
import api from '@/lib/api-service'
import { ohpHostUrl, openHousePalPublicUrl } from '@/lib/publicResourceLinks'

let cached: Promise<string | null> | null = null

/** The agent's own-domain base URL (local-dev aware), or null when links use openhousepal.com. */
export function fetchOwnDomainBase(): Promise<string | null> {
  if (!cached) {
    cached = api.sites.getPublicBaseUrl()
      .then(({ success, data }) => {
        if (!success || !data?.base_url || !data.is_idx_site) return null
        const host = new URL(data.base_url).hostname
        return ohpHostUrl(host)
      })
      .catch(() => null)
  }
  return cached
}

export function useOwnDomainBase(): string | null {
  const [base, setBase] = useState<string | null>(null)
  useEffect(() => { let live = true; fetchOwnDomainBase().then(b => { if (live) setBase(b) }); return () => { live = false } }, [])
  return base
}

export function agentFormUrl(ownBase: string | null, hubSlug: string, formSlug: string): string {
  return ownBase ? `${ownBase}/forms/${encodeURIComponent(formSlug)}` : openHousePalPublicUrl(`/${hubSlug}/${formSlug}`)
}

export function agentHubUrl(ownBase: string | null, hubSlug: string): string {
  return ownBase ? `${ownBase}/hub` : openHousePalPublicUrl(`/${hubSlug}`)
}
