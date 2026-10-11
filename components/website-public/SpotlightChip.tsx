import { Sparkles } from 'lucide-react'

// A small "Spotlight" pill on any listing card that has a published Listing Spotlight (the
// agent's cinematic single-property site) - tapping it opens that page instead of the standard
// property page. Rendered as a nested <a> only where the card itself is not already a link.
export default function SpotlightChip({ url, className = '', asLink = true }: { url?: string | null; className?: string; asLink?: boolean }) {
  if (!url) return null
  const inner = (
    <>
      <Sparkles className="h-3 w-3" />
      Spotlight
    </>
  )
  const cls = `inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--site-on-accent)] shadow-md transition hover:-translate-y-0.5 ${className}`
  const style = { backgroundColor: 'var(--site-accent)' }
  if (!asLink) return <span className={cls} style={style}>{inner}</span>
  return (
    <a href={url} onClick={e => e.stopPropagation()} className={cls} style={style} title="See this home's Spotlight page">
      {inner}
    </a>
  )
}
