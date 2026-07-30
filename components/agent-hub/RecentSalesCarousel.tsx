'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type CarouselSale = {
  id: string
  address: string
  city: string
  state: string
  price?: number
  status?: string
  image?: string
}

const formatSaleStatus = (status?: string) => {
  const clean = String(status || 'Sold').replace(/-BRIGHT/gi, '').replace(/_/g, ' ').trim()
  const lower = clean.toLowerCase()
  if (lower.includes('under contract')) return 'Under Contract'
  if (lower.includes('active')) return 'Active'
  if (lower.includes('pending')) return 'Pending'
  if (lower.includes('closed') || lower.includes('sold')) return 'Sold'
  if (lower.includes('off market') || lower.includes('off-market')) return 'Off Market'
  if (lower.includes('coming soon')) return 'Coming Soon'
  return clean || 'Sold'
}

const getSaleStatusClass = (status?: string) => {
  const clean = formatSaleStatus(status).toLowerCase()
  if (clean === 'active') return 'bg-emerald-100 text-emerald-700'
  if (clean === 'pending' || clean === 'coming soon') return 'bg-amber-500 text-white'
  if (clean === 'off market') return 'bg-gray-500 text-white'
  if (clean === 'sold') return 'bg-rose-500 text-white'
  return 'bg-[#8b7355] text-white'
}

const getStreetOnly = (address?: string) => {
  const firstLine = String(address || '').split(',')[0]?.trim() || 'Address unavailable'
  return firstLine.replace(/\s+(#|apt\.?|unit|suite|ste\.?|fl\.?|floor)\s*[\w-]+.*$/i, '').trim() || firstLine
}

const getSaleLocation = (sale: CarouselSale) => [sale.city, sale.state].filter(Boolean).join(', ') || getStreetOnly(sale.address)

// Auto-advancing "1 property at a time" alternative to the default horizontal-scroll shelf.
export default function RecentSalesCarousel({
  sales,
  linkHref,
  compact = false,
  intervalMs = 4000,
}: {
  sales: CarouselSale[]
  linkHref?: string
  compact?: boolean
  intervalMs?: number
}) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (sales.length <= 1 || paused) return
    const timer = setInterval(() => setIndex(current => (current + 1) % sales.length), intervalMs)
    return () => clearInterval(timer)
  }, [sales.length, paused, intervalMs])

  useEffect(() => {
    if (index >= sales.length) setIndex(0)
  }, [sales.length, index])

  if (!sales.length) return null

  const height = compact ? 160 : 240

  return (
    <div
      className="relative w-full overflow-hidden rounded-[18px] shadow-sm"
      style={{ height }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex h-full transition-transform duration-700 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
        {sales.map(sale => {
          const slide = (
            <div className="relative h-full w-full shrink-0 bg-cover bg-center" style={{ backgroundImage: `url(${sale.image || '/placeholder.jpg'})` }}>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${getSaleStatusClass(sale.status)}`}>
                {formatSaleStatus(sale.status)}
              </span>
              <div className="absolute bottom-3 left-3 right-3 text-white">
                <p className={`font-black leading-none ${compact ? 'text-lg' : 'text-2xl'}`}>{sale.price ? `$${sale.price.toLocaleString()}` : 'Price upon request'}</p>
                <p className="mt-1 truncate text-sm font-bold">{getSaleLocation(sale)}</p>
              </div>
            </div>
          )

          return linkHref ? (
            <Link key={sale.id} href={linkHref} className="h-full w-full shrink-0">{slide}</Link>
          ) : (
            <div key={sale.id} className="h-full w-full shrink-0">{slide}</div>
          )
        })}
      </div>

      {sales.length > 1 && (
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
          {sales.map((sale, slideIndex) => (
            <button
              key={sale.id}
              type="button"
              onClick={(event) => { event.preventDefault(); setIndex(slideIndex) }}
              className={`h-1.5 rounded-full transition-all ${slideIndex === index ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`}
              aria-label={`Go to slide ${slideIndex + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
