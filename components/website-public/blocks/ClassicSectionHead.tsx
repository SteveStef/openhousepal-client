import { ArrowRight } from 'lucide-react'
import { headingClass } from './fontClass'

// Classic's one section opener: a small accent label, a big tight sans headline, one quiet line,
// and (optionally) a "see all" text link on the right. Every Classic section uses it so the page
// reads as one calm system - Luxe keeps its own sparkle-and-hairline eyebrows.
export default function ClassicSectionHead({ eyebrow, title, sub, href, linkLabel = 'View all', center = false, onDark = false, font }: {
  eyebrow?: string
  title: string
  sub?: string
  href?: string
  linkLabel?: string
  center?: boolean
  onDark?: boolean
  /** The site's Heading font (theme.heading_font). */
  font?: string
}) {
  return (
    <div className={`flex flex-wrap items-end gap-x-8 gap-y-4 ${center ? 'flex-col items-center text-center' : 'justify-between'}`}>
      <div className={center ? 'max-w-2xl' : 'max-w-2xl'}>
        {eyebrow && <p className="text-[12px] font-bold uppercase tracking-[0.2em]" style={{ color: onDark ? 'rgba(255,255,255,.7)' : 'var(--site-accent)' }}>{eyebrow}</p>}
        <h2 className={`${headingClass(font)} mt-2 text-[2.1rem] font-extrabold leading-[1.08] tracking-tight sm:text-[2.6rem]`} style={{ color: onDark ? '#fff' : 'var(--site-heading)' }}>{title}</h2>
        {sub && <p className="mt-2.5 text-base leading-relaxed" style={{ color: onDark ? 'rgba(255,255,255,.72)' : 'var(--site-muted)' }}>{sub}</p>}
      </div>
      {href && (
        <a href={href} className="group inline-flex shrink-0 items-center gap-1.5 text-sm font-bold" style={{ color: onDark ? '#fff' : 'var(--site-heading)' }}>
          {linkLabel} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" style={{ color: onDark ? '#fff' : 'var(--site-accent)' }} />
        </a>
      )}
    </div>
  )
}
