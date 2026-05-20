'use client'

import { useState, memo, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { 
  Search, Filter, ChevronDown, Home, Bed, Bath, 
  MapPin, Eye, Calendar, 
  CheckCircle2, ArrowLeft, MessageSquare, 
  Info, Clock, User, Layers, SortDesc,
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import AuthGuard from '@/components/AuthGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import BrokerAuthorizationGuard from '@/components/BrokerAuthorizationGuard'
import Footer from '@/components/Footer'
import api from "@/lib/api-service";
import { cleanAddress, formatMlsStatus, formatPropertyFeature, normalizeImageUrl } from '@/lib/utils'

// --- Dashboard Stat Card ---
const StatCard = ({ title, value, icon: Icon, isHighlighted = false }: { title: string, value: string | number, icon: any, isHighlighted?: boolean }) => (
  <div className={`flex flex-col p-5 rounded-2xl border transition-all ${
    isHighlighted 
      ? 'bg-[#FCF9F1] dark:bg-[#C9A24D]/5 border-[#C9A24D]/30 dark:border-[#C9A24D]/20 shadow-sm' 
      : 'bg-white dark:bg-[#151517] border-gray-100 dark:border-gray-800 shadow-sm'
  }`}>
    <div className="flex items-center gap-2 mb-3">
      <div className={`p-1.5 rounded-lg ${isHighlighted ? 'bg-[#C9A24D]/10 dark:bg-[#C9A24D]/20' : 'bg-gray-50 dark:bg-gray-800'}`}>
        <Icon size={14} className={isHighlighted ? 'text-[#C9A24D]' : 'text-gray-400 dark:text-gray-500'} />
      </div>
    </div>
    <span className="text-3xl font-bold text-[#111827] dark:text-white mb-1">{value}</span>
    <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</span>
  </div>
)

// --- Dashboard Property Row ---
const DiscoveryPropertyRow = memo(function DiscoveryPropertyRow({ property }: { property: any }) {
  return (
    <div className="bg-white dark:bg-[#1A1A1C] border border-gray-100 dark:border-gray-800 rounded-3xl p-4 flex flex-col md:flex-row gap-6 hover:shadow-md dark:hover:shadow-xl dark:hover:shadow-black/20 transition-all group">
      {/* Image Section */}
      <div className="relative w-full md:w-[207px] h-36 shrink-0 overflow-hidden rounded-2xl bg-gray-100 dark:bg-[#0B0B0B]">
        <Image
          src={property.image}
          alt={property.address}
          fill
          className="object-cover"
        />
        {property.isNew && (
          <div className="absolute top-3 left-3">
            <span className="bg-[#C9A24D] text-white text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest shadow-lg">
              New
            </span>
          </div>
        )}
        <div className="absolute bottom-3 right-3">
          <div className="bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-lg border border-white/10">
            {property.distance}
          </div>
        </div>
      </div>

      {/* Middle Content */}
      <div className="flex-grow min-w-0 py-1">
        <div className="mb-3">
          <h3 className="text-xl font-bold text-[#111827] dark:text-white leading-tight mb-1">{property.address}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{property.cityStateZip}</p>
        </div>

        <div className="flex items-center gap-5 mb-4 text-gray-400 dark:text-gray-500">
          <div className="flex items-center gap-1.5">
            <Bed size={14} />
            <span className="text-sm font-bold text-gray-600 dark:text-gray-300">{property.beds}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Beds</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Bath size={14} />
            <span className="text-sm font-bold text-gray-600 dark:text-gray-300">{property.baths}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Baths</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Layers size={14} />
            <span className="text-sm font-bold text-gray-600 dark:text-gray-300">{property.sqft.toLocaleString()}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Sqft</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <User size={10} className="text-gray-400 dark:text-gray-500" />
            </div>
            <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{property.agent}</span>
          </div>
          <span className="text-gray-300 dark:text-gray-700">•</span>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{property.brokerage}</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            <Clock size={12} />
            {property.listedAt}
          </div>
          {property.badges?.map((badge: string, i: number) => (
            <span key={i} className={`text-[9px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded ${
              badge === 'No Open House' ? 'bg-red-50 dark:bg-red-500/10 text-red-500' : 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400'
            }`}>
              {badge}
            </span>
          ))}
        </div>
      </div>

      {/* Right Content / Actions */}
      <div className="flex flex-col justify-between items-end md:w-48 shrink-0">
        <span className="text-2xl font-black text-[#111827] dark:text-white tracking-tight">
          ${property.price.toLocaleString()}
        </span>
        
        <div className="flex flex-col gap-2 w-full">
          <div className="grid grid-cols-2 gap-2">
            <button className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-gray-100 dark:border-gray-800 text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-all">
              <Eye size={12} />
              View
            </button>
            <button className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-gray-100 dark:border-gray-800 text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-all">
              <MessageSquare size={12} />
              Message
            </button>
          </div>
          <button className="w-full bg-[#172536] dark:bg-white text-white dark:text-[#172536] py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] dark:hover:text-white transition-all shadow-md">
            Request to Host
          </button>
        </div>
      </div>
    </div>
  )
})

export default function OpenHouseDiscovery() {
  const { showToast } = useToast()
  const [address, setAddress] = useState('')

  useEffect(() => {
    async function getDiscoveryProperties() {
      const response = await api.discovery.get();
      console.log(response);
    }
    getDiscoveryProperties()
  },[])

  const dummyListings = [
    {
      id: 1,
      address: '789 Palm Avenue',
      cityStateZip: 'Malibu, CA 90265',
      price: 4200000,
      beds: 5,
      baths: 4,
      sqft: 4500,
      agent: 'Jennifer Lee',
      brokerage: 'Premier Realty Group',
      listedAt: 'Listed yesterday',
      distance: '12.3 mi',
      isNew: true,
      image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=800'
    },
    {
      id: 2,
      address: '123 Maple Drive',
      cityStateZip: 'Beverly Hills, CA 90210',
      price: 2450000,
      beds: 4,
      baths: 3,
      sqft: 3200,
      agent: 'Sarah Johnson',
      brokerage: 'Premier Realty Group',
      listedAt: 'Listed 2 days ago',
      distance: '2.4 mi',
      isNew: false,
      badges: ['No Open House', 'Accepting Requests'],
      image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=800'
    },
    {
      id: 3,
      address: '555 Wilshire Place',
      cityStateZip: 'Los Angeles, CA 90024',
      price: 2100000,
      beds: 4,
      baths: 3,
      sqft: 2800,
      agent: 'Michael Chen',
      brokerage: 'Premier Realty Group',
      listedAt: 'Listed 3 days ago',
      distance: '5.1 mi',
      isNew: false,
      image: 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&q=80&w=800'
    },
    {
      id: 4,
      address: '420 Ocean Drive',
      cityStateZip: 'Santa Monica, CA 90401',
      price: 3850000,
      beds: 3,
      baths: 3,
      sqft: 2500,
      agent: 'Robert Wilson',
      brokerage: 'Premier Realty Group',
      listedAt: 'Listed yesterday',
      distance: '15.2 mi',
      isNew: true,
      image: 'https://images.unsplash.com/photo-1600566753190-17f0bb2a6c3e?auto=format&fit=crop&q=80&w=800'
    },
    {
      id: 5,
      address: '101 Sunset Blvd',
      cityStateZip: 'West Hollywood, CA 90069',
      price: 1750000,
      beds: 2,
      baths: 2,
      sqft: 1800,
      agent: 'Amanda West',
      brokerage: 'Premier Realty Group',
      listedAt: 'Listed 1 week ago',
      distance: '8.4 mi',
      isNew: false,
      badges: ['No Open House'],
      image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=800'
    },
    {
      id: 6,
      address: '22 Canyon Road',
      cityStateZip: 'Pacific Palisades, CA 90272',
      price: 5900000,
      beds: 6,
      baths: 5.5,
      sqft: 5800,
      agent: 'David Miller',
      brokerage: 'Premier Realty Group',
      listedAt: 'Listed 2 days ago',
      distance: '18.9 mi',
      isNew: false,
      image: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&q=80&w=800'
    }
  ]

  return (
    <AuthGuard>
      <SubscriptionGuard>
        <BrokerAuthorizationGuard>
          <div className="min-h-screen bg-[#fafafb] dark:bg-[#0B0B0B] flex flex-col">
            <main className="flex-grow container mx-auto px-4 py-10 max-w-7xl text-[#111827] dark:text-[#F3F4F6]">
              
              {/* Back Link */}
              <Link href="/showcases" className="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-[#111827] dark:hover:text-white transition-colors mb-8 group">
                <div className="p-1.5 rounded-full bg-white dark:bg-[#151517] border border-gray-100 dark:border-gray-800 group-hover:border-gray-200 dark:group-hover:border-gray-700 shadow-sm transition-all">
                  <ArrowLeft size={14} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">Back to Showcases</span>
              </Link>

              {/* Header Section */}
              <div className="mb-10">
                <h1 className="text-4xl font-black text-[#111827] dark:text-white mb-2 tracking-tight">Open House Discovery</h1>
                <p className="text-gray-500 dark:text-gray-400 font-medium">Find brokerage listings you may be able to host and request approval in one place.</p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                <StatCard title="Listings Available" value={6} icon={Home} />
                <StatCard title="No Open House" value={5} icon={Calendar} />
                <StatCard title="Pending Requests" value={1} icon={Clock} />
                <StatCard title="Approved to Host" value={1} icon={CheckCircle2} isHighlighted={true} />
              </div>

              {/* Main Search/Listing Panel */}
              <div className="bg-white dark:bg-[#151517] rounded-[2.5rem] border border-gray-100 dark:border-gray-800 p-2 shadow-sm overflow-hidden">
                
                {/* Navy Search Bar */}
                <div className="bg-[#172536] dark:bg-[#1A1A1C] rounded-[2rem] p-4 flex flex-col lg:flex-row items-center gap-4 text-white border border-white/5 dark:border-gray-800">
                  <div className="flex items-center gap-3 w-full lg:w-auto px-4 border-r border-white/10 dark:border-gray-800">
                    <MapPin size={18} className="text-[#C9A24D]" />
                    <span className="text-sm font-bold uppercase tracking-widest">Listings</span>
                  </div>
                  
                  <div className="flex items-center gap-3 flex-grow w-full px-4">
                    <button className="flex items-center gap-2 bg-white/10 dark:bg-gray-800 hover:bg-white/20 dark:hover:bg-gray-700 transition-all px-4 py-2 rounded-xl text-xs font-bold border border-white/10 dark:border-gray-700">
                      10 miles
                      <ChevronDown size={14} />
                    </button>
                    <span className="text-sm font-medium text-white/60">of</span>
                    <div className="relative flex-grow">
                      <input 
                        type="text"
                        placeholder="Enter address or landmark"
                        className="w-full bg-transparent border-none outline-none text-sm placeholder:text-white/30 font-medium py-2"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                      />
                      <Info size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-white/30 cursor-pointer" />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full lg:w-auto px-4">
                    <div className="w-px h-8 bg-white/10 dark:bg-gray-800 hidden lg:block"></div>
                    <button className="flex items-center justify-center gap-2 bg-[#C9A24D] text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-[#C9A24D]/20 hover:scale-[1.02] transition-all whitespace-nowrap">
                      <Search size={14} />
                      Find Properties
                    </button>
                  </div>
                </div>

                {/* Filter Row */}
                <div className="p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-6 border-b border-gray-50 dark:border-gray-800/50">
                  <div className="flex flex-wrap items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-gray-100 dark:border-gray-800 text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-400 hover:border-[#C9A24D]/50 transition-all bg-white dark:bg-[#1A1A1C]">
                      Brokerages
                      <span className="bg-[#C9A24D] text-white text-[8px] px-1.5 py-0.5 rounded-md leading-none">1</span>
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-gray-100 dark:border-gray-800 text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-400 hover:border-[#C9A24D]/50 transition-all bg-white dark:bg-[#1A1A1C]">
                      Cities
                      <ChevronDown size={12} />
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-gray-100 dark:border-gray-800 text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-400 hover:border-[#C9A24D]/50 transition-all bg-white dark:bg-[#1A1A1C]">
                      Districts
                      <ChevronDown size={12} />
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-red-100 dark:border-red-900/30 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all bg-white dark:bg-[#1A1A1C]">
                      Exclude
                    </button>
                    <div className="w-px h-6 bg-gray-100 dark:bg-gray-800 mx-1 hidden sm:block"></div>
                    <button className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-gray-100 dark:border-gray-800 text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-400 hover:border-[#C9A24D]/50 transition-all bg-white dark:bg-[#1A1A1C]">
                      <Filter size={12} />
                      Filter
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-gray-100 dark:border-gray-800 text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-400 hover:border-[#C9A24D]/50 transition-all bg-white dark:bg-[#1A1A1C]">
                      <SortDesc size={12} />
                      Sort
                    </button>
                  </div>

                  <button className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#FCF9F1] dark:bg-[#C9A24D]/10 border border-[#C9A24D]/30 dark:border-[#C9A24D]/20 text-[10px] font-black uppercase tracking-widest text-[#C9A24D] hover:bg-[#C9A24D] hover:text-white transition-all group">
                    My Requests
                    <span className="bg-[#111827] dark:bg-[#FDFCFB] text-white dark:text-[#111827] text-[9px] px-2 py-0.5 rounded-lg group-hover:bg-white dark:group-hover:bg-[#111827] group-hover:text-[#C9A24D] dark:group-hover:text-white transition-colors">2</span>
                  </button>
                </div>

                {/* Listings Section */}
                <div className="p-4 md:p-8 space-y-6">
                  {dummyListings.map((property) => (
                    <DiscoveryPropertyRow key={property.id} property={property} />
                  ))}
                  
                  {/* Load More Area */}
                  <div className="flex justify-center pt-8 pb-4">
                    <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 dark:text-gray-500 hover:text-[#C9A24D] transition-all">
                      Load More Listings
                      <ChevronDown size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </main>
            
            <Footer />
          </div>
        </BrokerAuthorizationGuard>
      </SubscriptionGuard>
    </AuthGuard>
  )
}
