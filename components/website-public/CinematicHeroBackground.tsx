'use client'

import { useEffect, useState } from 'react'
import { sizedBg } from '@/lib/siteImage'

// The same cinematic real-photo hero treatment as HeroBlock (Ken Burns pan via the shared
// .ohp-hero-pan CSS animation, heavy layered gradient + radial vignette, fade-to-cream bottom)
// extracted so the Featured and Media reserved pages can open with real rotating photography
// instead of a flat theme-color band - matches the one hero style already established as the
// site's visual identity rather than inventing a second, flatter look for every other page.
export default function CinematicHeroBackground({ photos }: { photos: string[] }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (photos.length < 2) return
    const id = setInterval(() => setIndex(i => (i + 1) % photos.length), 6000)
    return () => clearInterval(id)
  }, [photos.length])

  if (photos.length === 0) return null

  return (
    <>
      {/* Only the photo on screen, the one fading out and the next are in the page (and only the
          one on screen pans) - not every photo stacked and animating at once. */}
      {photos.map((url, i) => (photos.length < 4 || i === index || i === (index + 1) % photos.length || i === (index - 1 + photos.length) % photos.length) && (
        <div
          key={`${url}-${i}`}
          className={`${i === index ? 'ohp-hero-pan' : ''} ohp-mls-crop absolute inset-0 scale-105 bg-cover transition-opacity duration-1000 ${i === index ? 'opacity-100' : 'opacity-0'}`}
          style={{ backgroundImage: sizedBg(url, 1920), backgroundPosition: 'center 30%' }}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/35" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,rgba(0,0,0,0.55)_100%)]" />
      {/* Independent of the gradient above (deliberately light at the top so the photo itself
          reads through there) - guarantees the transparent header's white nav text stays legible
          regardless of which photo happens to be in rotation, since a bright sky/white-siding
          photo up top could otherwise wash it out completely. See HeroBlock's matching fix. */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/70 to-transparent" />
    </>
  )
}
