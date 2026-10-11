import { SiteTheme } from '../types'
import { fontClass } from './fontClass'

export default function HeadingTextBlock({ data, theme }: { data: Record<string, any>; theme: SiteTheme }) {
  const text = data.text || ''
  const level = (data.level as string) || 'h2'
  const sizeClass = level === 'h1' ? 'text-4xl sm:text-5xl' : level === 'h3' ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'

  if (!text) return null

  return (
    <section className="mx-auto max-w-4xl px-6 py-12 text-center">
      <p
        className={`font-black ${sizeClass} ${fontClass(theme.heading_font, 'font-serif')}`}
        style={{ color: 'var(--site-heading)' }}
      >
        {text}
      </p>
    </section>
  )
}
