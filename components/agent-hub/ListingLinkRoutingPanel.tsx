'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ExternalLink, MapPinned, Sparkles } from 'lucide-react'
import api from '@/lib/api-service'
import { getStreetOnly } from '@/lib/agentSales'
import { SettingToggleRow } from './RecentSalesPanel'
import { HubCollapse } from './HubPanelChrome'

type RoutingRow = {
  id: string
  address: string
  city?: string
  state?: string
  status?: string
  overrideKey: string | null
  spotlightAvailable: boolean
  spotlightSlug?: string | null
  overridden: boolean
  routing: { source: 'spotlight' | 'property_page' | 'none'; url: string | null }
}

// Both the Agent Hub's "My Listings" cards and the Email Signature's featured-listing banner
// resolve the same click destination off the same AgentHub.config['myListings'] pool (see
// resolve_listing_link/describe_listing_link in property_website_service.py) - the agent's own
// published Listing Spotlight for that exact property when one exists, else the generic one-page
// property view. That resolution happens silently server-side; this panel is the one place an
// agent can see which way each listing is currently routed and, when a Spotlight match exists,
// switch it back to the plain property page.
export default function ListingLinkRoutingPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<RoutingRow[]>([])
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const response = await api.agentHub.getListingRouting()
    if (response.success && response.data) setRows(response.data.listings)
    setLoading(false)
    setLoaded(true)
  }

  useEffect(() => {
    if (isOpen && !loaded) load()
  }, [isOpen, loaded])

  const toggleOverride = async (row: RoutingRow) => {
    if (!row.overrideKey) return
    const nextOverride = row.overridden ? 'auto' : 'property_page'
    setPendingKey(row.overrideKey)
    const response = await api.agentHub.updateListingRoutingOverride(row.overrideKey, nextOverride)
    if (response.success) await load()
    setPendingKey(null)
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-colors duration-300 dark:border-gray-800 dark:bg-[#151517]">
      <button type="button" onClick={() => setIsOpen(!isOpen)} className="flex w-full items-center justify-between gap-4 p-5 text-left sm:p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-xl font-black text-[#111827] dark:text-white">Where Your Listings Link To</h2>
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:bg-gray-800 dark:text-gray-400">Public page + email signature</span>
          </div>
          {/* Rewritten in plain language (was "Listing Link Routing" / "Where visitors land when
              they tap a listing...") - explains what actually happens (per the real logic below:
              a listing either opens the agent's own Listing Spotlight page, or a plain standard
              listing page) without assuming the reader already knows what "Agent Hub" or
              "Signature" mean structurally. */}
          <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">
            When someone clicks a listing photo - on your public page or in your email signature - this is what decides which page opens for them: either your own special page for that exact home (a &quot;Listing Spotlight&quot;), or a plain, standard listing page. When you have a Spotlight for a home, it&apos;s used automatically - you can switch any listing back to the plain page below.
          </p>
        </div>
        <ChevronDown className={`h-5 w-5 shrink-0 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <HubCollapse open={isOpen}>
        <div className="border-t border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-[#151517] sm:p-6">
          {loading && !loaded && (
            <div className="rounded-2xl border border-gray-200 bg-[#fbfaf7] p-5 text-sm font-bold text-gray-500 dark:border-gray-700 dark:bg-gray-900">Checking your listings...</div>
          )}

          {loaded && rows.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-[#fbfaf7] p-5 text-sm font-bold text-gray-500 dark:border-gray-700 dark:bg-gray-900">
              Nothing to route yet - add an active listing under My Listings and it'll show up here.
            </div>
          )}

          {loaded && rows.length > 0 && (
            <div className="space-y-3">
              {rows.map(row => (
                <div key={row.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-gray-800 dark:text-gray-100">{getStreetOnly(row.address)}</p>
                      <p className="text-xs font-semibold text-gray-400">{[row.city, row.state].filter(Boolean).join(', ')}</p>
                    </div>
                    {row.routing.source === 'spotlight' && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#C9A24D]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">
                        <Sparkles className="h-3 w-3" /> Listing Spotlight
                      </span>
                    )}
                    {row.routing.source === 'property_page' && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        <MapPinned className="h-3 w-3" /> Property Page
                      </span>
                    )}
                    {row.routing.source === 'none' && (
                      <span className="inline-flex shrink-0 items-center rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:bg-gray-800">Not linked yet</span>
                    )}
                  </div>

                  {row.routing.url && (
                    <a
                      href={row.routing.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#C9A24D] hover:underline"
                    >
                      See what this looks like <ExternalLink className="ohp-icon-draw h-3 w-3" />
                    </a>
                  )}

                  {row.spotlightAvailable && (
                    <div className="mt-3">
                      <SettingToggleRow
                        label="Use my Listing Spotlight"
                        hint={row.overridden
                          ? (row.routing.source === 'property_page'
                            ? "Off - clicking this listing opens the plain standard page instead, even though you have a fancier Spotlight page for it."
                            : "Off - you typed this listing in by hand, so there's no other page to fall back to. Turn this back on to make it clickable again.")
                          : "On - clicking this listing opens your own special page for this home."}
                        checked={!row.overridden}
                        onChange={() => toggleOverride(row)}
                      />
                      {pendingKey === row.overrideKey && <p className="mt-1 text-[11px] font-bold text-gray-400">Saving...</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </HubCollapse>
    </section>
  )
}
