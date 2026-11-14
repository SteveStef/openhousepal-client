'use client'

import { useLayoutEffect, useState, type RefObject } from 'react'

// The chat lays itself out by its OWN width, not the screen's (owner, 11/13: "in this view chat sucks").
// The small chat window on a computer is phone-wide, but every `sm:` class saw a computer screen and
// gave it the roomy layout - avatars beside full-width cards, three-across grids, label columns - so
// titles cut to one letter and notes wrapped a word per line. ChatThread (and the empty-chat home)
// measure themselves and set data-chat-wide="yes" from 600px; cards use `chatwide:` (tailwind.config.js)
// where they used `sm:`. The big window and the /assistant page are wide; the corner panel and the
// phone sheet are not.
export const CHAT_WIDE_PX = 600

export function useChatWide(ref: RefObject<HTMLElement | null>): boolean {
  const [wide, setWide] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => setWide(el.clientWidth >= CHAT_WIDE_PX)
    check()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return wide
}
