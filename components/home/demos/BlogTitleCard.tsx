import { Clock, Newspaper } from 'lucide-react'

// The Blogs page's own article card (app/studio/blogs/page.tsx) at demo scale: the cover drawn in
// the article's theme - "<Theme> article", who it's for in serif italic, a gold rule - then the
// category kicker, the serif title, and the date / theme line. Used wherever a demo shows blogs,
// so they look like the real cards instead of stock photos. Kept dependency-free (no BlogThemes
// import) so the homepage bundle stays light.
export default function BlogTitleCard({ title, audience, theme = 'Luxe', dark = false, status, date, scale = 1 }: {
  title: string
  audience: string
  theme?: string
  dark?: boolean
  status?: string
  date?: string
  scale?: number
}) {
  const px = (n: number) => `${n * scale}px`
  return (
    <div className="flex h-full flex-col overflow-hidden border border-[#C9A24D]/25 bg-white shadow-[0_14px_30px_-24px_rgba(139,115,85,.8)] dark:border-white/[0.08] dark:bg-[#151517]" style={{ borderRadius: px(18) }}>
      <div className="relative aspect-[16/9] overflow-hidden" style={{ background: dark ? 'linear-gradient(135deg,#0b0f0e,#111827 60%,#2a2218)' : 'linear-gradient(135deg,#fffdf8,#fbf6ec 55%,#f1e3c2)' }}>
        <div className="pointer-events-none absolute rounded-full bg-[#C9A24D]/30 blur-2xl" style={{ right: px(-24), top: px(-28), width: px(96), height: px(96) }} />
        <Newspaper className={`absolute ${dark ? 'text-[#e8c97a]/50' : 'text-[#C9A24D]/50'}`} style={{ right: px(10), top: px(10), width: px(15), height: px(15) }} />
        {status && <span className="absolute rounded-full bg-black/60 font-black uppercase tracking-wide text-white" style={{ left: px(8), top: px(8), padding: `${px(1.5)} ${px(5)}`, fontSize: px(6) }}>{status}</span>}
        <div className="absolute inset-x-0 bottom-0" style={{ padding: px(10) }}>
          <p className={`font-black uppercase ${dark ? 'text-[#e8c97a]' : 'text-[#8b7355]'}`} style={{ fontSize: px(6.5), letterSpacing: '0.3em' }}>{theme} article</p>
          <p className={`font-serif font-black italic leading-tight ${dark ? 'text-white' : 'text-[#111827]'}`} style={{ fontSize: px(16) }}>{audience}</p>
          <div className="rounded-full bg-gradient-to-r from-[#C9A24D] to-[#e8c97a]" style={{ marginTop: px(5), height: px(2), width: px(26) }} />
        </div>
      </div>
      <div className="flex flex-1 flex-col" style={{ padding: px(10) }}>
        <p className="font-black uppercase text-[#8b7355] dark:text-[#d7b974]" style={{ fontSize: px(6.5), letterSpacing: '0.2em' }}>{audience}</p>
        <p className="line-clamp-2 font-serif font-black leading-snug text-[#111827] dark:text-white" style={{ fontSize: px(11), marginTop: px(2) }}>{title}</p>
        <div className="mt-auto" style={{ paddingTop: px(7) }}>
          <div className="h-px bg-gradient-to-r from-[#C9A24D]/45 via-gray-200 to-transparent dark:from-[#C9A24D]/35 dark:via-white/10" />
          <div className="flex items-center font-bold text-gray-400" style={{ marginTop: px(5), gap: px(6), fontSize: px(6.5) }}>
            {date && <span className="inline-flex items-center" style={{ gap: px(2) }}><Clock style={{ width: px(7), height: px(7) }} /> {date}</span>}
            <span className="ml-auto uppercase tracking-wide">{theme}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
