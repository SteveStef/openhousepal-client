// A decorative, non-photographic hero backdrop for pages where showing one specific real listing
// as "the wallpaper" would misrepresent it as more significant than the rest of the collection
// (the Featured page's hero sits above ALL featured listings, not just one) - a subtle animated
// gold-on-charcoal grid + soft glow, same restrained luxury-real-estate language as the rest of
// the site (gold accent, serif/shimmer type), pure CSS/SVG so it never depends on any one photo.
export default function LuxuryAbstractBackground({ accentColor }: { accentColor: string }) {
  const gridSvg = `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><path d="M120 0H0V120" fill="none" stroke="${accentColor}" stroke-width="0.75" opacity="0.18"/></svg>`
  )}`

  return (
    <>
      <div className="ohp-hero-pan absolute inset-0 scale-105" style={{ backgroundImage: `url("${gridSvg}")`, backgroundSize: '120px 120px' }} />
      <div className="pointer-events-none absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full blur-[100px]" style={{ backgroundColor: `${accentColor}22` }} />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-96 w-96 rounded-full blur-[100px]" style={{ backgroundColor: `${accentColor}18` }} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_15%,rgba(0,0,0,0.55)_100%)]" />
    </>
  )
}
