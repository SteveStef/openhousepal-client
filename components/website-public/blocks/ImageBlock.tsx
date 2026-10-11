export default function ImageBlock({ data }: { data: Record<string, any> }) {
  const url = data.url as string | undefined
  if (!url) return null
  const caption = data.caption as string | undefined

  return (
    <section className="mx-auto max-w-4xl px-6 py-8">
      <img src={url} alt={(data.alt as string) || ''} className="w-full rounded-3xl object-cover shadow-[0_2px_24px_rgba(17,24,39,0.08)]" />
      {caption && <p className="mt-3 text-center text-sm text-gray-400">{caption}</p>}
    </section>
  )
}
