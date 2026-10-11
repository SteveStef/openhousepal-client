'use client'

import { useEffect, useState } from 'react'
import { API_BASE_URL } from '@/lib/api-service'

/** When our MLS data really last changed - from the API, cached there for 5 minutes. */
export function useMlsUpdatedAt(given?: string | null): string | null {
  const [stamp, setStamp] = useState<string | null>(given ?? null)
  useEffect(() => {
    if (given) return
    let live = true
    fetch(`${API_BASE_URL}/public/sites/mls-updated`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (live && d?.updated_at) setStamp(d.updated_at) })
      .catch(() => {})
    return () => { live = false }
  }, [given])
  return stamp
}

function formatStamp(stamp: string | null): string | null {
  return stamp && !Number.isNaN(new Date(stamp).getTime())
    ? new Date(stamp).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null
}

/** "Listing data last updated Oct 1, 2026, 10:25 AM" - the Bright-required line, real time. */
export function MlsUpdatedText({ updatedAt }: { updatedAt?: string | null }) {
  const when = formatStamp(useMlsUpdatedAt(updatedAt))
  return <>{when ? `Listing data last updated ${when}` : 'Listing data is updated throughout the day.'}</>
}

/** Bright MLS IDX notice for any page showing MLS listings. `brokerage` is the site owner's firm -
 *  Bright's wording names it ("...firms in which <brokerage> participates"); without one the clause
 *  is left out rather than printed with a hole in it. "Data last updated" is when our MLS data
 *  really last changed (it used to print the visitor's own today's date). */
export default function MLSComplianceFooter({ brokerage, updatedAt }: { brokerage?: string | null; updatedAt?: string | null }) {
  const firm = (brokerage || '').trim()

  return (
    <footer className="bg-[#0B0B0B] text-white py-12 border-t border-white/5 mt-auto">
      <div className="max-w-7xl mx-auto px-6">
        {/* Bright MLS Compliance Section */}
        <div className="grid grid-cols-1 gap-6 text-[10px] uppercase tracking-widest leading-loose text-gray-400 font-medium">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-gray-300 mb-2">
            <span className="bg-white/5 px-2 py-1 rounded border border-white/10">
              © {new Date().getFullYear()} Bright MLS • All Rights Reserved
            </span>
            <span className="text-[#C9A24D] font-black">Information Deemed Reliable But Not Guaranteed</span>
          </div>

          <p className="normal-case tracking-normal leading-relaxed text-xs">
            The data relating to real estate for sale on this website appears in part through the BRIGHT Internet Data Exchange program, a voluntary cooperative exchange of property listing data between licensed real estate brokerage firms{firm ? <> in which {firm} participates</> : null}, and is provided by BRIGHT through a licensing agreement.
          </p>

          <p className="normal-case tracking-normal leading-relaxed text-xs">
            The information provided by this website is for the personal, non-commercial use of consumers and may not be used for any purpose other than to identify prospective properties consumers may be interested in purchasing. Some properties which appear for sale on this website may no longer be available because they are under contract, have closed or are no longer being offered for sale.
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 text-gray-400">
            <p className="normal-case italic">
              <MlsUpdatedText updatedAt={updatedAt} />
            </p>
            <p className="normal-case max-w-sm sm:text-right">
              Some real estate firms do not participate in IDX and their listings do not appear on this website.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}

/** The same Bright notice, compact, for the bottom of every IDX website page (search results,
 *  featured homes, neighborhoods - any page with MLS listings needs it). Inherits the footer's colors. */
export function IdxNotice({ brokerage, className = '' }: { brokerage?: string | null; className?: string }) {
  const firm = (brokerage || '').trim()
  return (
    <div className={`space-y-2 text-[11px] leading-relaxed ${className}`}>
      <p>
        © {new Date().getFullYear()} Bright MLS. The data relating to real estate for sale on this website appears in part through the BRIGHT Internet Data Exchange program, a voluntary cooperative exchange of property listing data between licensed real estate brokerage firms{firm ? <> in which {firm} participates</> : null}, and is provided by BRIGHT through a licensing agreement. Information is deemed reliable but not guaranteed, is for consumers&apos; personal, non-commercial use to identify properties they may be interested in purchasing, and some homes shown may no longer be available. Some real estate firms do not participate in IDX and their listings do not appear on this website.
      </p>
      <p className="italic"><MlsUpdatedText /></p>
    </div>
  )
}
