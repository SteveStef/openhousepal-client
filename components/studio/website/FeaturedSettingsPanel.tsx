'use client'

import { Star } from 'lucide-react'
import { FeaturedSettings } from '@/types'
import FeaturedPagePicker from '@/components/setup/FeaturedPagePicker'

// Drives the public "Featured" nav tab (/properties) - a full page, not a page-builder block,
// so its settings live at the site level (see schemas.site.FeaturedSettings) rather than in
// any one page's blocks. What it shows is a set of tick boxes - the agent's own listings, homes
// for sale in their towns, and a hand-picked full-MLS search - plus the order ("my listings
// first" or "mix them together"), the price of the other homes and the sort (built by
// content_adapters.get_featured_page_listings). The setup flow shows the very same control on
// the same saved settings, so a change in either place shows in the other.
export default function FeaturedSettingsPanel({
  value, onChange,
}: {
  value: FeaturedSettings
  onChange: (next: FeaturedSettings) => void
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-[#151517]">
        <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-[#8b7355]">
          <Star className="h-3.5 w-3.5" /> Featured Page
        </p>
        <p className="mb-3 mt-1 text-[10px] font-semibold text-gray-400">
          Controls what shows on your site&apos;s public &quot;Featured&quot; tab (yoursite.com/properties).
        </p>
        <FeaturedPagePicker compact value={value} onChange={onChange} />
      </div>
    </div>
  )
}
