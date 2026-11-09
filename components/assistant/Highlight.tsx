// The AI reader's quote: just the key words, highlighted, with a few words either side (owner, 11/08 -
// listing sentences can be very long). The backend wraps the key words in these two marks.
const OPEN = '⟦'
const CLOSE = '⟧'

export const plainQuote = (s: string) => s.split(OPEN).join('').split(CLOSE).join('')

export default function Highlight({ text, dim }: { text: string; dim?: boolean }) {
  const parts: { t: string; on: boolean }[] = []
  let rest = text
  while (rest) {
    const a = rest.indexOf(OPEN)
    const b = a < 0 ? -1 : rest.indexOf(CLOSE, a)
    if (a < 0 || b < 0) { parts.push({ t: plainQuote(rest), on: false }); break }
    if (a) parts.push({ t: rest.slice(0, a), on: false })
    parts.push({ t: rest.slice(a + 1, b), on: true })
    rest = rest.slice(b + 1)
  }
  return (
    <>
      {parts.map((p, i) => p.on
        ? <mark key={i} data-testid="ai-quote-hl" className={`rounded-[4px] px-0.5 font-bold not-italic ${dim
          ? 'bg-gray-200/80 text-gray-600 dark:bg-zinc-700 dark:text-zinc-300'
          : 'bg-[#C9A24D]/25 text-[#111827] dark:bg-[#C9A24D]/30 dark:text-white'}`}>{p.t}</mark>
        : <span key={i}>{p.t}</span>)}
    </>
  )
}
