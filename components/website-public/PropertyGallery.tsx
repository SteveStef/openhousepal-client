'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Images, X } from 'lucide-react'
import { sizedBg, sizedImage } from '@/lib/siteImage'

function Lightbox({ photos, address, index, onClose, onIndex }: { photos: string[]; address: string; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95">
      <div className="flex items-center justify-between px-6 py-4 text-white/80">
        <span className="text-xs font-semibold uppercase tracking-wide">{index + 1} / {photos.length}</span>
        <button onClick={onClose} aria-label="Close" className="rounded-full p-2 transition hover:bg-white/10 hover:text-white">
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="relative flex flex-1 items-center justify-center px-4">
        <button
          onClick={() => onIndex((index - 1 + photos.length) % photos.length)}
          aria-label="Previous photo"
          className="absolute left-2 rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white sm:left-6"
        >
          <ChevronLeft className="h-8 w-8" />
        </button>
        <img src={sizedImage(photos[index], 1920)} loading="lazy" decoding="async" alt={address} className="max-h-[75vh] max-w-full object-contain" />
        <button
          onClick={() => onIndex((index + 1) % photos.length)}
          aria-label="Next photo"
          className="absolute right-2 rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white sm:right-6"
        >
          <ChevronRight className="h-8 w-8" />
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto px-6 pb-6">
        {photos.map((url, i) => (
          <button
            key={i}
            onClick={() => onIndex(i)}
            className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-cover bg-center transition ${i === index ? 'ring-2 ring-[#C9A24D]' : 'opacity-50 hover:opacity-80'}`}
            style={{ backgroundImage: sizedBg(url, 256) }}
          />
        ))}
      </div>
    </div>
  )
}

// Real property photos (get_property_detail's `photos: list[str]`) weren't previously used as a
// gallery - PropertyDetail only ever showed a single cover photo. This renders either an
// Airbnb-style grid preview (`variant="grid"`, used by the Featured page's quick-view modal,
// where space is tight) or a Zillow-style single main photo + arrows + thumbnail strip
// (`variant="strip"`, the full property detail page, where there's room to browse without
// leaving the main photo) - both open the same full lightbox for a real closer look, using only
// real listing photos (no stock/placeholder imagery).
export default function PropertyGallery({ photos, address, variant = 'grid' }: { photos: string[]; address: string; variant?: 'grid' | 'strip' }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (lightboxIndex === null) return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null)
      if (e.key === 'ArrowRight') setLightboxIndex(i => (i === null ? i : (i + 1) % photos.length))
      if (e.key === 'ArrowLeft') setLightboxIndex(i => (i === null ? i : (i - 1 + photos.length) % photos.length))
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [lightboxIndex, photos.length])

  if (!photos.length) return null

  if (variant === 'strip') {
    return (
      <>
        <div className="mb-8">
          <div className="group relative aspect-[16/10] w-full overflow-hidden rounded-3xl bg-gray-100 sm:aspect-[16/9]">
            <button onClick={() => setLightboxIndex(activeIndex)} className="absolute inset-0" aria-label="View full photo">
              <div className="h-full w-full bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-105" style={{ backgroundImage: sizedBg(photos[activeIndex], 1200) }} />
            </button>
            {photos.length > 1 && (
              <>
                <button
                  onClick={() => setActiveIndex(i => (i - 1 + photos.length) % photos.length)}
                  aria-label="Previous photo"
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2.5 text-gray-700 shadow-lg transition hover:bg-white sm:left-4"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setActiveIndex(i => (i + 1) % photos.length)}
                  aria-label="Next photo"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2.5 text-gray-700 shadow-lg transition hover:bg-white sm:right-4"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
            <button
              onClick={() => setLightboxIndex(activeIndex)}
              className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-xs font-black uppercase tracking-wide text-[#111827] shadow-lg transition hover:-translate-y-0.5"
            >
              <Images className="h-3.5 w-3.5" /> {activeIndex + 1} / {photos.length}
            </button>
          </div>

          {photos.length > 1 && (
            <div className="scrollbar-hide mt-3 flex gap-2 overflow-x-auto">
              {photos.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIndex(i)}
                  className={`aspect-[4/3] h-20 shrink-0 overflow-hidden rounded-xl bg-cover bg-center transition ${i === activeIndex ? 'ring-2 ring-[#C9A24D] ring-offset-2' : 'opacity-60 hover:opacity-100'}`}
                  style={{ backgroundImage: sizedBg(url, 256) }}
                />
              ))}
            </div>
          )}
        </div>

        {lightboxIndex !== null && (
          <Lightbox photos={photos} address={address} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onIndex={setLightboxIndex} />
        )}
      </>
    )
  }

  const secondary = photos.slice(1, 5)

  return (
    <>
      <div className="relative mb-8 grid gap-2 overflow-hidden rounded-3xl sm:grid-cols-2" style={{ gridTemplateRows: secondary.length ? undefined : '1fr' }}>
        <button
          onClick={() => setLightboxIndex(0)}
          className="group relative aspect-[4/3] overflow-hidden bg-gray-100 sm:aspect-auto sm:h-[420px]"
        >
          <div className="h-full w-full bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-105" style={{ backgroundImage: sizedBg(photos[0], 1200) }} />
        </button>
        {secondary.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {secondary.map((url, i) => (
              <button
                key={i}
                onClick={() => setLightboxIndex(i + 1)}
                className="group relative aspect-[4/3] overflow-hidden bg-gray-100"
              >
                <div className="h-full w-full bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-105" style={{ backgroundImage: sizedBg(url, 640) }} />
              </button>
            ))}
          </div>
        )}
        {photos.length > 1 && (
          <button
            onClick={() => setLightboxIndex(0)}
            className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-xs font-black uppercase tracking-wide text-[#111827] shadow-lg transition hover:-translate-y-0.5"
          >
            <Images className="h-3.5 w-3.5" /> View All {photos.length} Photos
          </button>
        )}
      </div>

      {lightboxIndex !== null && (
        <Lightbox photos={photos} address={address} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onIndex={setLightboxIndex} />
      )}
    </>
  )
}
