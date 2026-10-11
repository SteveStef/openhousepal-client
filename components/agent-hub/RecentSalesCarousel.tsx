'use client'

import HubCinema, { HomeOverlay } from '@/components/agent-hub/HubCinema'
import { formatSaleStatus, getSaleStatusClass, getStreetOnly } from '@/lib/agentSales'

type CarouselSale = {
  id: string
  address: string
  city: string
  state: string
  price?: number
  status?: string
  image?: string
}

const getSaleLocation = (sale: CarouselSale) => [sale.city, sale.state].filter(Boolean).join(', ') || getStreetOnly(sale.address)

// Auto-advancing "1 sale at a time" alternative to the horizontal shelf (phones, and the editor's
// phone preview) - the shared HubCinema cut (seam of light, slow drift, rising words).
export default function RecentSalesCarousel({
  sales,
  linkHref,
  compact = false,
  intervalMs = 4500,
  autoScroll = true,
  luxe = false,
}: {
  sales: CarouselSale[]
  /** OpenHousePal Luxe: metal frame, metal-tinted seam and segments. */
  luxe?: boolean
  linkHref?: string
  compact?: boolean
  intervalMs?: number
  // Defaults to true so existing callers that don't pass it keep advancing, but callers with a
  // real "Auto Scroll" toggle should pass it through.
  autoScroll?: boolean
}) {
  if (!sales.length) return null
  return (
    <HubCinema
      height={compact ? 160 : 240}
      intervalMs={intervalMs}
      autoScroll={autoScroll}
      luxe={luxe}
      slides={sales.map(sale => ({
        id: sale.id,
        image: sale.image,
        href: linkHref,
        overlay: (
          <HomeOverlay
            luxe={luxe}
            compact={compact}
            status={formatSaleStatus(sale.status)}
            statusClass={getSaleStatusClass(sale.status)}
            price={sale.price ? `$${sale.price.toLocaleString()}` : 'Price upon request'}
            title={getSaleLocation(sale)}
          />
        ),
      }))}
    />
  )
}
