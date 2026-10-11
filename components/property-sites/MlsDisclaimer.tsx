// Minimal single-listing attribution for a Spotlight page - deliberately much shorter than
// MLSComplianceFooter.tsx's full IDX-cooperative-exchange language, which is written for a page
// displaying OTHER brokers' search inventory. A Spotlight site shows exactly one listing, so it
// gets the standard "single listing display" note, plus the listing brokerage's courtesy line
// when the MLS record names one. Only render this when the listing is real Bright MLS data (see
// the `isMls` check at each call site) - never on a manually-entered, non-MLS property.
export default function MlsDisclaimer({ light = false, listOffice, mlsNumber }: { light?: boolean; listOffice?: string | null; mlsNumber?: string | null }) {
  const tone = light ? 'text-[#172522]/50' : 'text-white/35'
  return (
    <div className={`space-y-1 text-center text-[10px] font-medium leading-relaxed ${tone}`}>
      {listOffice && <p>Listing courtesy of {listOffice}{mlsNumber ? ` · MLS# ${mlsNumber}` : ''}</p>}
      <p>
        Information deemed reliable but not guaranteed and should be independently verified. © {new Date().getFullYear()} Bright MLS, Inc.
        All rights reserved.
      </p>
    </div>
  )
}
