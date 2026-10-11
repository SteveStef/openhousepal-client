import { Fragment, ReactNode } from 'react'

// Deliberately narrow, dependency-free markdown rendering for assistant replies - handles
// only what the system prompt's tone and Claude's replies actually produce (**bold**,
// "- "/"1. " lists, paragraph breaks). Not a CommonMark parser; no HTML is ever parsed or
// injected, so this can't become an XSS vector the way a raw-HTML markdown renderer could.

// Only http(s)/tel/mailto are ever turned into a real link - the model isn't supposed to
// emit [text](url) at all per the system prompt (the app attaches accurate links itself),
// but if it does anyway, this is a defensive backstop, not a trust boundary: it stops an
// unexpected scheme (e.g. "javascript:") from ever reaching an href.
const SAFE_LINK_SCHEME = /^(https?:|tel:|mailto:)/i

function renderInline(line: string): ReactNode[] {
  const parts = line.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (linkMatch && SAFE_LINK_SCHEME.test(linkMatch[2])) {
      const isExternal = linkMatch[2].startsWith('http')
      return (
        <a
          key={i}
          href={linkMatch[2]}
          {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className="underline font-semibold"
        >
          {linkMatch[1]}
        </a>
      )
    }
    return <Fragment key={i}>{part}</Fragment>
  })
}

function isListLine(line: string): boolean {
  return /^\s*([-*]|\d+\.)\s+/.test(line)
}

function isHeaderLine(line: string): boolean {
  return /^\s*#{1,6}\s+/.test(line)
}

function stripHeaderMarker(line: string): string {
  return line.replace(/^\s*#{1,6}\s+/, '')
}

function stripListMarker(line: string): { ordered: boolean; text: string } {
  const orderedMatch = line.match(/^\s*\d+\.\s+(.*)$/)
  if (orderedMatch) return { ordered: true, text: orderedMatch[1] }
  const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/)
  return { ordered: false, text: bulletMatch ? bulletMatch[1] : line }
}

// Plain-text version for speech synthesis - strips bold markers, link syntax, headers, and
// list bullets so the assistant doesn't read "asterisk asterisk" or "dash" aloud.
export function stripMarkdown(content: string): string {
  return content
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
}

export default function AssistantMarkdown({ content }: { content: string }) {
  const lines = content.split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    if (isListLine(line)) {
      const { ordered } = stripListMarker(line)
      const items: string[] = []
      while (i < lines.length && isListLine(lines[i])) {
        items.push(stripListMarker(lines[i]).text)
        i++
      }
      const ListTag = ordered ? 'ol' : 'ul'
      blocks.push(
        <ListTag key={key++} className={`pl-5 my-1.5 space-y-1 ${ordered ? 'list-decimal' : 'list-disc'}`}>
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ListTag>
      )
      continue
    }

    if (line.trim() === '') {
      i++
      continue
    }

    if (isHeaderLine(line)) {
      blocks.push(
        <p key={key++} className="font-bold my-1.5 first:mt-0">
          {renderInline(stripHeaderMarker(line))}
        </p>
      )
      i++
      continue
    }

    const paragraphLines: string[] = []
    while (i < lines.length && lines[i].trim() !== '' && !isListLine(lines[i]) && !isHeaderLine(lines[i])) {
      paragraphLines.push(lines[i])
      i++
    }
    blocks.push(
      <p key={key++} className="my-1.5 first:mt-0 last:mb-0">
        {paragraphLines.map((l, idx) => (
          <Fragment key={idx}>
            {idx > 0 && <br />}
            {renderInline(l)}
          </Fragment>
        ))}
      </p>
    )
  }

  return <>{blocks}</>
}
