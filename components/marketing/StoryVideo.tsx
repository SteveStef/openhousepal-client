'use client'

import { useEffect, useRef } from 'react'

// The story video from the homepage: plays only while it's on screen, muted until they turn it up.
export default function StoryVideo() {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const v = ref.current
    if (!v || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause() }, { threshold: 0.35 })
    io.observe(v)
    return () => io.disconnect()
  }, [])
  return (
    <div className="rounded-[28px] bg-gradient-to-br from-[#f1d58b]/70 via-white/60 to-[#C9A24D]/50 p-1.5 dark:from-[#C9A24D]/40 dark:via-white/10 dark:to-[#C9A24D]/30">
      <div className="overflow-hidden rounded-[22px] ring-1 ring-black/5 dark:ring-white/10">
        <video ref={ref} className="aspect-video w-full bg-gray-900 object-cover" loop muted playsInline controls preload="metadata" poster="/openhousepal-story-poster.jpg" data-testid="about-video">
          <source src="/openhousepal-story.mp4" type="video/mp4" />
        </video>
      </div>
    </div>
  )
}
