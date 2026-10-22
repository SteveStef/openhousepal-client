'use client'

// Dev proof sheet: Dash's Open House Manager + Discovery cards with sample data covering every
// state (needs a host, hosted by others, you're hosting, requested, counter-offer, declined,
// incoming asks, empty). /dev/dash-cards  (?empty=1 shows the empty states)
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import DashManagerCard from '@/components/dash/DashManagerCard'
import DashDiscoveryCard from '@/components/dash/DashDiscoveryCard'
import { getUpcomingWeekendCells } from '@/components/open-house-manager/WeekendCalendarCards'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { ToastProvider } from '@/contexts/ToastContext'
import type { HostRequest, MyListingItem, MyListingsResponse, ScheduledOpen } from '@/types'

const IMG = ['018cb01a82ce', '082318e16259', '08bb2df67633', '0f3855c99ed8', '10714c16504c', '12c70ddbd9b7'].map(id => `/demos/media/${id}.jpg`)

function Sheet() {
  const q = useSearchParams()
  const { user } = useAuth()
  const me = user?.id || 'me'
  const days = getUpcomingWeekendCells().map(c => c.date)
  const open = (date: string, who: string, name: string, s = '13:00', e = '15:00'): ScheduledOpen => ({
    id: `${date}-${who}`, scheduled_date: date, scheduled_start_time: s, scheduled_end_time: e,
    hosting_agent_id: who, hosting_agent_name: name, kit_built: true,
  })
  const listing = (i: number, address: string, extra: Partial<MyListingItem>): MyListingItem => ({
    listing_key: `L${i}`, image: IMG[i], address, city: 'Wayne', state: 'PA', price: [1295000, 749900, 2150000][i] ?? 899000,
    bedrooms: 4, bathrooms: 3, living_area: 3120, days_on_market: [6, 21, 2][i] ?? 9,
    open_house_status: 'needs_host', avg_guests_per_open: 11.4, opens_hosted_count: 3, scheduled_opens_count: 0,
    scheduled_opens: [], confirmed_pending_kit: [], needs_host_this_weekend: true, is_high_priority: false,
    pending_request_count: 0, is_manual: false, ...extra,
  })
  const empty = q.get('empty') === '1'
  const myListings: MyListingsResponse = {
    summary: { open_scheduled: 2, needs_host: 1, avg_guests_per_open: 11.4, high_priority: 0 },
    listings: empty ? [] : [
      listing(0, '22 BIRCH LN', { open_house_status: 'scheduled', scheduled_opens: [open(days[0], 'a1', 'Jenna Morales', '12:00', '14:00'), open(days[1], 'a2', 'Marcus Lee')], confirmed_pending_kit: [open(days[1], 'a2', 'Marcus Lee')] }),
      listing(1, '9 Oak Ct', { pending_request_count: 1, scheduled_opens: [open(days[2], 'a3', 'Priya Shah', '11:30', '13:30')] }),
      listing(2, '140 Pine Street', { opens_hosted_count: 0, avg_guests_per_open: 0 }),
    ],
  }
  const hostReq = (id: string, key: string, addr: string, img: string, date: string, status: HostRequest['status'], extra: Partial<HostRequest> = {}): HostRequest => ({
    id, listing_key: key, property_address: addr, property_image: img, listing_owner_agent_id: 'x', requesting_agent_id: me,
    requesting_agent_name: 'Dana Fox', requested_date: date, requested_start_time: '13:00:00', requested_end_time: '16:00:00',
    status, created_at: new Date().toISOString(), ...extra,
  })
  const incoming = empty ? [] : [hostReq('r0', 'L1', '9 Oak Ct', IMG[1], days[1], 'pending', { requesting_agent_name: 'Tom Becker' })]
  const discovery = empty ? [] : [
    { ListingKey: 'D1', Street: '7 Elm Dr', City: 'Radnor', Image: IMG[3], Price: '$1,150,000', Beds: 5, Baths: 4, SquareFeet: 4210, DaysOnMarket: 4, DistanceFromLandmark: 1.2 },
    { ListingKey: 'D2', Street: '311 Lancaster Ave', City: 'Berwyn', Image: IMG[4], Price: '$689,000', Beds: 3, Baths: 2, SquareFeet: 1980, DaysOnMarket: 12, DistanceFromLandmark: 2.8 },
    { ListingKey: 'D3', Street: '54 Grove Rd', City: 'Devon', Image: IMG[5], Price: '$975,000', Beds: 4, Baths: 3, SquareFeet: 2860, DaysOnMarket: 30, DistanceFromLandmark: 4.1 },
  ]
  const statuses = {
    D1: { status: 'scheduled', scheduled_opens: [open(days[0], me, 'You'), open(days[1], 'b1', 'Kara Price')] },
    D2: { status: 'needs_host', scheduled_opens: [] },
    D3: { status: 'scheduled', scheduled_opens: days.map((d, i) => open(d, `c${i}`, 'Someone Else')) },
  }
  const mine = empty ? [] : [
    hostReq('m1', 'D1', '7 Elm Dr', IMG[3], days[0], 'approved'),
    hostReq('m2', 'D2', '311 Lancaster Ave', IMG[4], days[2], 'pending'),
    hostReq('m3', 'X9', '18 Conestoga Rd', IMG[2], days[1], 'countered', { counter_date: days[3], counter_start_time: '11:00:00', counter_end_time: '13:00:00' }),
    hostReq('m4', 'X8', '402 Valley Forge Rd', IMG[0], days[2], 'declined', { responded_at: new Date().toISOString() }),
  ]
  return (
    <div className="min-h-screen bg-[#f7f5f0] p-6 dark:bg-[#0b0b0c]">
      <div className="mx-auto grid max-w-[1180px] items-start gap-6 lg:grid-cols-2">
        <DashManagerCard myListings={myListings} hostRequests={incoming} discoveryListings={[]} actionCount={incoming.length} hasSearchPreferences />
        <DashDiscoveryCard listings={discovery} statuses={statuses} actionCount={3} hasSearchPreferences={!empty}
          myRequests={mine} counteredAsHost={empty ? 0 : 1} incomingAsks={empty ? 0 : 2} />
      </div>
    </div>
  )
}

export default function DashCardsProof() {
  return <AuthProvider><ToastProvider><Suspense><Sheet /></Suspense></ToastProvider></AuthProvider>
}
