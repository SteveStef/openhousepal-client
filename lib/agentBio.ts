// The agent bio prints on page 1 of the Brag Sheet at most 3 lines tall (~100 characters a line at
// its 9pt size) - any longer and it pushed Recent Sales + the Agent Hub footer onto a second page.
// Settings caps typing here; lib/pdfs.tsx also clips at 3 lines for bios saved before the cap.
export const BIO_MAX_CHARS = 280

// Trims an over-long bio (e.g. an AI rewrite) to the cap at the last full sentence, falling back
// to the last whole word - never mid-word.
export function fitBio(text: string): string {
  const t = text.trim()
  if (t.length <= BIO_MAX_CHARS) return t
  const cut = t.slice(0, BIO_MAX_CHARS)
  const sentenceEnd = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
  if (sentenceEnd > BIO_MAX_CHARS * 0.5) return cut.slice(0, sentenceEnd + 1)
  return cut.replace(/\s+\S*$/, '').replace(/[,;:\s]+$/, '') + '.'
}
