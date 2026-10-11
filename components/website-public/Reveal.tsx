'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

// Rises into place the first time it scrolls into view - the site's one scroll-reveal, used by
// cards and sections everywhere. Respects reduced motion (site-theme.css .ohp-reveal).
export default function Reveal({ children, delay = 0, className = '', style, as = 'div' }: {
  children: ReactNode; delay?: number; className?: string; style?: CSSProperties; as?: 'div' | 'li' | 'section'
}) {
  const ref = useRef<HTMLElement | null>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setShown(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect() } }, { rootMargin: '0px 0px -6% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const Tag = as as any
  return (
    <Tag ref={ref} className={`ohp-reveal ${shown ? 'is-in' : ''} ${className}`} style={{ ...style, transitionDelay: `${delay}ms` }}>
      {children}
    </Tag>
  )
}
