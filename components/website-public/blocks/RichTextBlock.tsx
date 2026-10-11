import { SiteTheme } from '../types'
import { fontClass } from './fontClass'

export default function RichTextBlock({ data, theme }: { data: Record<string, any>; theme: SiteTheme }) {
  const text = (data.text as string) || ''
  if (!text.trim()) return null
  const paragraphs = text.split(/\n{2,}/)

  return (
    <section className={`mx-auto max-w-3xl space-y-4 px-6 py-12 text-base leading-[1.8] text-gray-600 ${fontClass(theme.body_font)}`}>
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </section>
  )
}
