'use client'

import React, { useState, memo, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { 
  Search, Filter, ChevronDown, Home, Bed, Bath, 
  MapPin, Eye, Calendar, 
  CheckCircle2, ArrowLeft, MessageSquare, 
  Clock, User, Layers, SortDesc, Check,
  Copy, X, Mail
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import AuthGuard from '@/components/AuthGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import BrokerAuthorizationGuard from '@/components/BrokerAuthorizationGuard'
import Footer from '@/components/Footer'
import api from "@/lib/api-service";
import { normalizeImageUrl } from '@/lib/utils'
import GooglePlacesAutocomplete, { GooglePlacesAutocompleteRef } from '@/components/GooglePlacesAutocomplete'

const US_STATES = [
  'PA', 'NJ', 'DE', 'MD', 'DC', 'VA', 'NY'
]

// --- Email Template Modal ---
const EmailModal = ({ property, user, onClose, showToast }: { property: any, user: any, onClose: () => void, showToast: any }) => {
  const emailSubject = `Inquiry: Hosting an Open House for ${property.Street}`;
  const emailBody = `Hi ${property.ListAgentFullName || 'there'},\n\nMy name is ${user?.first_name} ${user?.last_name} from ${user?.brokerage}. I saw your listing at ${property.Street} in ${property.City} and would love to help you host an open house this upcoming weekend.\n\nI have all the tools to manage the sign-ins and follow-ups professionally. Please let me know if you are open to this and if there are any specific dates or times that work best for you.\n\nBest regards,\n\n${user?.first_name} ${user?.last_name}\n${user?.phone || ''}`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard!`, 'success');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1A1A1C] w-full max-w-2xl rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-gray-50 dark:border-gray-800/50 flex items-center justify-between bg-gray-50/50 dark:bg-[#0B0B0B]/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#C9A24D]/10 rounded-2xl text-[#C9A24D]">
              <Mail size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-[#111827] dark:text-white uppercase tracking-tight">Request to Host</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Example Outreach Email</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors text-gray-400">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
           <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center justify-between">
              Recipient
              <span className="text-[#C9A24D]">{property.ListingAgentEmail}</span>
            </label>
            <div className="p-4 bg-gray-50 dark:bg-[#0B0B0B] rounded-2xl border border-gray-100 dark:border-gray-800 text-sm font-bold text-[#111827] dark:text-white">
              {property.ListAgentFullName} &lt;{property.ListingAgentEmail}&gt;
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Subject</label>
              <button 
                onClick={() => copyToClipboard(emailSubject, 'Subject')}
                className="flex items-center gap-1 text-[9px] font-black text-[#C9A24D] uppercase hover:underline"
              >
                <Copy size={10} />
                Copy
              </button>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-[#0B0B0B] rounded-2xl border border-gray-100 dark:border-gray-800 text-sm font-bold text-[#111827] dark:text-white">
              {emailSubject}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Message Body</label>
              <button 
                onClick={() => copyToClipboard(emailBody, 'Email body')}
                className="flex items-center gap-1 text-[9px] font-black text-[#C9A24D] uppercase hover:underline"
              >
                <Copy size={10} />
                Copy Body
              </button>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-[#0B0B0B] rounded-2xl border border-gray-100 dark:border-gray-800 text-sm leading-relaxed text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-medium">
              {emailBody}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50/50 dark:bg-[#0B0B0B]/50 border-t border-gray-50 dark:border-gray-800/50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-700 dark:hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

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
const DiscoveryPropertyRow = memo(function DiscoveryPropertyRow({ property, onRequestToHost }: { property: any, onRequestToHost: (p: any) => void }) {
  return (
    <div className="bg-white dark:bg-[#1A1A1C] border border-gray-100 dark:border-gray-800 rounded-3xl p-4 flex flex-col md:flex-row gap-6 hover:shadow-md dark:hover:shadow-xl dark:hover:shadow-black/20 transition-all group">
      {/* Image Section */}
      <div className="relative w-full md:w-[207px] h-36 shrink-0 overflow-hidden rounded-2xl bg-gray-100 dark:bg-[#0B0B0B]">
        <Image
          src={normalizeImageUrl(property.Image || '/placeholder.jpg')}
          alt={property.Street}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 207px"
        />
        {property.New && (
          <div className="absolute top-3 left-3">
            <span className="bg-[#C9A24D] text-white text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest shadow-lg">
              New
            </span>
          </div>
        )}
        {property.DistanceFromLandmark && (
          <div className="absolute bottom-3 right-3">
            <div className="bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-lg border border-white/10">
              {property.DistanceFromLandmark.toFixed(1)} mi
            </div>
          </div>
        )}
      </div>

      {/* Middle Content */}
      <div className="flex-grow min-w-0 py-1">
        <div className="mb-3">
          <h3 className="text-xl font-bold text-[#111827] dark:text-white leading-tight mb-1">{property.Street}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{property.City}, {property.State} {property.Zipcode}</p>
        </div>

        <div className="flex items-center gap-5 mb-4 text-gray-400 dark:text-gray-500">
          <div className="flex items-center gap-1.5">
            <Bed size={14} />
            <span className="text-sm font-bold text-gray-600 dark:text-gray-300">{property.Beds}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Beds</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Bath size={14} />
            <span className="text-sm font-bold text-gray-600 dark:text-gray-300">{property.Baths}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Baths</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Layers size={14} />
            <span className="text-sm font-bold text-gray-600 dark:text-gray-300">{property.SquareFeet?.toLocaleString()}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Sqft</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <User size={10} className="text-gray-400 dark:text-gray-500" />
            </div>
            <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{property.ListAgentFullName}</span>
          </div>
          <span className="text-gray-300 dark:text-gray-700">•</span>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{property.ListOfficeName}</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-nowrap">
            <Clock size={12} />
            {property.DaysOnMarket === 0 ? 'Just Listed' : `${property.DaysOnMarket} Days on Market`}
          </div>
        </div>
      </div>

      {/* Right Content / Actions */}
      <div className="flex flex-col justify-between items-end md:w-48 shrink-0">
        <span className="text-2xl font-black text-[#111827] dark:text-white tracking-tight">
          {property.Price}
        </span>
        
        <div className="flex flex-col gap-2 w-full">
          <a 
            href={property.Url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 py-3 rounded-xl border border-gray-100 dark:border-gray-800 text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
          >
            <Eye size={12} />
            View Detail
          </a>
          <button 
            onClick={() => onRequestToHost(property)}
            className="w-full bg-[#172536] dark:bg-white text-white dark:text-[#172536] py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] dark:hover:text-white transition-all shadow-md"
          >
            Request to Host
          </button>
        </div>
      </div>
    </div>
  )
})

export default function OpenHouseDiscovery() {
  const { showToast } = useToast()
  const { user } = useAuth()
  const [address, setAddress] = useState('')
  const [miles, setMiles] = useState<string>('10')
  const [listings, setListings] = useState<any[]>([])
  const [preferences, setPreferences] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Modal State
  const [selectedPropertyForRequest, setSelectedPropertyForRequest] = useState<any>(null)

  // Dropdown States
  const [showBrokerageDropdown, setShowBrokerageDropdown] = useState(false)
  const [brokerageSearch, setBrokerageSearch] = useState('')
  const [searchedBrokerages, setSearchedBrokerages] = useState<string[]>([])
  const [isSearchingBrokerages, setIsSearchingBrokerages] = useState(false)

  const [showCityDropdown, setShowCityDropdown] = useState(false)
  const [citySearch, setCitySearch] = useState('')
  const [searchedCities, setSearchedCities] = useState<string[]>([])
  const [isSearchingCities, setIsSearchingCities] = useState(false)

  const [showDistrictDropdown, setShowDistrictDropdown] = useState(false)
  const [districtSearch, setDistrictSearch] = useState('')
  const [searchedDistricts, setSearchedDistricts] = useState<string[]>([])
  const [isSearchingDistricts, setIsSearchingDistricts] = useState(false)

  // Client-side UI Filters
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [minBeds, setMinBeds] = useState<number | ''>('')
  const [minBaths, setMinBaths] = useState<number | ''>('')
  const [minSqft, setMinSqft] = useState<number | ''>('')
  const [minPrice, setMinPrice] = useState<number | ''>('')

  // Sort State
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'dom_asc' | 'dom_desc'>('dom_asc')
  const [showSortDropdown, setShowSortDropdown] = useState(false)

  const [showStateDropdown, setShowStateDropdown] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const cityDropdownRef = useRef<HTMLDivElement>(null)
  const districtDropdownRef = useRef<HTMLDivElement>(null)
  const filterDropdownRef = useRef<HTMLDivElement>(null)
  const sortDropdownRef = useRef<HTMLDivElement>(null)
  const stateDropdownRef = useRef<HTMLDivElement>(null)
  const addressRef = useRef<GooglePlacesAutocompleteRef>(null)

  const handleDiscoveryResponse = (data: any) => {
    if (!data) return;
    setListings(data.data || []);
    setPreferences(data.preferences);
    
    // Sync address and miles if they exist
    if (data.preferences?.landmark_address) {
      setAddress(data.preferences.landmark_address);
    }
    if (data.preferences?.miles) {
      setMiles(data.preferences.miles.toString());
    }

    // Sync local numeric filters if present in preferences
    if (data.preferences?.min_bedrooms !== undefined) {
      const val = data.preferences.min_bedrooms;
      setMinBeds(val === null || val === undefined ? '' : val);
    }
    if (data.preferences?.min_bathrooms !== undefined) {
      const val = data.preferences.min_bathrooms;
      setMinBaths(val === null || val === undefined ? '' : val);
    }
    if (data.preferences?.min_square_feet !== undefined) {
      const val = data.preferences.min_square_feet;
      setMinSqft(val === null || val === undefined ? '' : val);
    }
    if (data.preferences?.min_price !== undefined) {
      const val = data.preferences.min_price;
      setMinPrice(val === null || val === undefined ? '' : val);
    }
  };

  const updateCriteria = async (updates: any) => {
    if (!preferences) return;
    
    // Optimistic Update
    setPreferences({ ...preferences, ...updates });
    
    try {
      const { success, data, error } = await api.discovery.patchPreferences(updates);
      if (success && data) {
        handleDiscoveryResponse(data);
      } else if (error) {
        showToast(error, 'error');
      }
    } catch (err) {
      console.error('Failed to update discovery preferences:', err);
    }
  };

  const toggleBrokerage = async (brokerage: string) => {
    if (!preferences) return;
    const current = preferences.brokerages || [];
    const isSelected = current.includes(brokerage);
    const updated = isSelected ? current.filter((b: string) => b !== brokerage) : [...current, brokerage];
    
    setPreferences({ ...preferences, brokerages: updated });
    try {
      const { success, data, error } = await api.discovery.patchPreferences({ brokerages: updated });
      if (success && data) {
        handleDiscoveryResponse(data);
      } else if (error) {
        showToast(error, 'error');
        setPreferences(preferences);
      }
    } catch (err) {
      console.error('Failed to update brokerage preference:', err);
      setPreferences(preferences);
    }
  };

  const toggleCity = async (city: string) => {
    if (!preferences) return;
    const current = preferences.cities || [];
    const isSelected = current.includes(city);
    const updated = isSelected ? current.filter((c: string) => c !== city) : [...current, city];
    
    setPreferences({ ...preferences, cities: updated });
    try {
      const { success, data, error } = await api.discovery.patchPreferences({ cities: updated });
      if (success && data) {
        handleDiscoveryResponse(data);
      } else if (error) {
        showToast(error, 'error');
        setPreferences(preferences);
      }
    } catch (err) {
      console.error('Failed to update city preference:', err);
      setPreferences(preferences);
    }
  };

  const toggleDistrict = async (district: string) => {
    if (!preferences) return;
    const current = preferences.school_districts || [];
    const isSelected = current.includes(district);
    const updated = isSelected ? current.filter((d: string) => d !== district) : [...current, district];
    
    setPreferences({ ...preferences, school_districts: updated });
    try {
      const { success, data, error } = await api.discovery.patchPreferences({ school_districts: updated });
      if (success && data) {
        handleDiscoveryResponse(data);
      } else if (error) {
        showToast(error, 'error');
        setPreferences(preferences);
      }
    } catch (err) {
      console.error('Failed to update district preference:', err);
      setPreferences(preferences);
    }
  };

  const handleStateSelect = async (state: string) => {
    if (!preferences) return;
    
    setPreferences({ ...preferences, state });
    setShowStateDropdown(false);
    
    try {
      const { success, data, error } = await api.discovery.patchPreferences({ state });
      if (success && data) {
        handleDiscoveryResponse(data);
      } else if (error) {
        showToast(error, 'error');
        setPreferences(preferences);
      }
    } catch (err) {
      console.error('Failed to update state preference:', err);
      setPreferences(preferences);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setShowBrokerageDropdown(false);
      }
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(target)) {
        setShowCityDropdown(false);
      }
      if (districtDropdownRef.current && !districtDropdownRef.current.contains(target)) {
        setShowDistrictDropdown(false);
      }
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(target)) {
        setShowFilterDropdown(false);
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(target)) {
        setShowSortDropdown(false);
      }
      if (stateDropdownRef.current && !stateDropdownRef.current.contains(target)) {
        setShowStateDropdown(false);
      }
    }

    document.addEventListener("mouseup", handleClickOutside);
    return () => document.removeEventListener("mouseup", handleClickOutside);
  }, []);

  // Filter and Sort properties based on UI controls
  const filteredListings = [...listings]
    .filter(property => {
      if (minBeds && property.Beds < minBeds) return false;
      if (minBaths && property.Baths < minBaths) return false;
      if (minSqft && property.SquareFeet < minSqft) return false;
      if (minPrice) {
        const priceNum = parseInt(property.Price.replace(/[$,]/g, ''));
        if (priceNum < minPrice) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const priceA = parseInt(a.Price.replace(/[$,]/g, ''));
      const priceB = parseInt(b.Price.replace(/[$,]/g, ''));

      switch (sortBy) {
        case 'price_asc': return priceA - priceB;
        case 'price_desc': return priceB - priceA;
        case 'dom_asc': return a.DaysOnMarket - b.DaysOnMarket;
        case 'dom_desc': return b.DaysOnMarket - a.DaysOnMarket;
        default: return 0;
      }
    });

  const activeFilterCount = (minBeds ? 1 : 0) + (minBaths ? 1 : 0) + (minSqft ? 1 : 0) + (minPrice ? 1 : 0);

  // Debounced Searches
  useEffect(() => {
    const searchTimer = setTimeout(async () => {
      if (!brokerageSearch) { setSearchedBrokerages([]); return; }
      setIsSearchingBrokerages(true)
      try {
        const { success, data } = await api.properties.brokerages(brokerageSearch);
        if (success && data?.results) setSearchedBrokerages(data.results)
      } catch (err) { console.error('Failed to search brokerages:', err) } finally { setIsSearchingBrokerages(false) }
    }, 300)
    return () => clearTimeout(searchTimer)
  }, [brokerageSearch])

  useEffect(() => {
    const searchTimer = setTimeout(async () => {
      if (!citySearch) { setSearchedCities([]); return; }
      setIsSearchingCities(true)
      try {
        const { success, data } = await api.properties.cities(citySearch);
        if (success && data?.results) setSearchedCities(data.results)
      } catch (err) { console.error('Failed to search cities:', err) } finally { setIsSearchingCities(false) }
    }, 300)
    return () => clearTimeout(searchTimer)
  }, [citySearch])

  useEffect(() => {
    const searchTimer = setTimeout(async () => {
      if (!districtSearch) { setSearchedDistricts([]); return; }
      setIsSearchingDistricts(true)
      try {
        const { success, data } = await api.properties.searchSchoolDistricts(districtSearch);
        if (success && data?.results) setSearchedDistricts(data.results)
      } catch (err) { console.error('Failed to search districts:', err) } finally { setIsSearchingDistricts(false) }
    }, 300)
    return () => clearTimeout(searchTimer)
  }, [districtSearch])

  useEffect(() => {
    async function getDiscoveryProperties() {
      setIsLoading(true)
      const { success, data, error } = await api.discovery.get();
      if (success && data) {
        handleDiscoveryResponse(data);
      } else if (error) {
        showToast(error, 'error')
      }
      setIsLoading(false)
    }
    getDiscoveryProperties()
  }, [showToast])

  return (
    <AuthGuard>
      <SubscriptionGuard>
        <BrokerAuthorizationGuard>
          <div className="min-h-screen bg-[#fafafb] dark:bg-[#0B0B0B] flex flex-col">
            <main className="flex-grow container mx-auto px-4 py-10 max-w-7xl text-[#111827] dark:text-[#F3F4F6]">
              
              {/* Back Link */}
              <Link href="/open-houses" className="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-[#111827] dark:hover:text-white transition-colors mb-8 group">
                <div className="p-1.5 rounded-full bg-white dark:bg-[#151517] border border-gray-100 dark:border-gray-800 group-hover:border-gray-200 dark:group-hover:border-gray-700 shadow-sm transition-all">
                  <ArrowLeft size={14} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">Back to Open Houses</span>
              </Link>

              {/* Header Section */}
              <div className="mb-10">
                <h1 className="text-4xl font-black text-[#111827] dark:text-white mb-2 tracking-tight">Open House Discovery</h1>
                <p className="text-gray-500 dark:text-gray-400 font-medium">Find brokerage listings you may be able to host and request approval in one place.</p>
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
                    <div className="relative flex items-center">
                      <input 
                        type="text"
                        inputMode="decimal"
                        className="w-16 bg-white/10 dark:bg-gray-800 hover:bg-white/20 dark:hover:bg-gray-700 transition-all px-3 py-2 rounded-xl text-xs font-bold border border-white/10 dark:border-gray-700 outline-none focus:ring-1 focus:ring-[#C9A24D]/50"
                        value={miles}
                        onChange={(e) => setMiles(e.target.value)}
                        onBlur={() => {
                          const val = parseFloat(miles);
                          if (!isNaN(val)) updateCriteria({ miles: val });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = parseFloat(miles);
                            if (!isNaN(val)) updateCriteria({ miles: val });
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                      />
                      <span className="ml-2 text-xs font-bold text-white/80 uppercase tracking-widest pointer-events-none">miles</span>
                    </div>
                    <span className="text-sm font-medium text-white/60">of</span>
                    <div className="relative flex-grow">
                      <GooglePlacesAutocomplete 
                        ref={addressRef}
                        value={address}
                        onChange={setAddress}
                        onCoordinatesChange={(lat, lng, addr) => {
                          updateCriteria({ landmark_address: addr, latitude: lat, longitude: lng });
                        }}
                        placeholder="Enter address or landmark"
                        className="w-full bg-transparent border-none outline-none text-sm placeholder:text-white/60 font-medium py-2 text-white shadow-none focus:ring-0"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4 w-full lg:w-auto px-4">
                    <div className="w-px h-8 bg-white/10 dark:bg-gray-800 hidden lg:block"></div>
                    <button 
                      onClick={() => addressRef.current?.resolveAddress()}
                      className="flex items-center justify-center gap-2 bg-[#C9A24D] text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-[#C9A24D]/20 hover:scale-[1.02] transition-all whitespace-nowrap"
                    >
                      <Search size={14} />
                      Find Properties
                    </button>
                  </div>
                </div>

                {/* Filter Row */}
                <div className="p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-6 border-b border-gray-50 dark:border-gray-800/50">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative" ref={dropdownRef}>
                      <button 
                        onClick={() => setShowBrokerageDropdown(!showBrokerageDropdown)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all ${
                          showBrokerageDropdown 
                            ? 'border-[#C9A24D] bg-[#FCF9F1] dark:bg-[#C9A24D]/10 text-[#C9A24D]' 
                            : 'border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400 bg-white dark:bg-[#1A1A1C] hover:border-[#C9A24D]/50'
                        }`}
                      >
                        Brokerages
                        <span className="bg-[#C9A24D] text-white text-[8px] px-1.5 py-0.5 rounded-md leading-none">
                          {preferences?.brokerages?.length || 0}
                        </span>
                        <ChevronDown size={12} className={`transition-transform duration-200 ${showBrokerageDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showBrokerageDropdown && (
                        <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-[#1A1A1C] border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="p-3 border-b border-gray-50 dark:border-gray-800/50">
                            <div className="relative">
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input 
                                type="text"
                                placeholder="Search brokerages..."
                                className="w-full bg-gray-50 dark:bg-[#0B0B0B] border-none rounded-xl py-2 pl-9 pr-4 text-xs font-bold placeholder:text-gray-400 focus:ring-1 focus:ring-[#C9A24D]/30 transition-all outline-none"
                                value={brokerageSearch}
                                onChange={(e) => setBrokerageSearch(e.target.value)}
                                autoFocus
                              />
                            </div>
                          </div>
                          <div className="max-h-60 overflow-y-auto p-2">
                            {isSearchingBrokerages ? (
                              <div className="flex flex-col items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#C9A24D] mb-2"></div>
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Searching...</p>
                              </div>
                            ) : (!brokerageSearch && preferences?.brokerages?.length > 0) ? (
                              preferences.brokerages.map((brokerage: string, idx: number) => (
                                <button 
                                  key={idx}
                                  onClick={() => toggleBrokerage(brokerage)}
                                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center transition-colors bg-[#FCF9F1] dark:bg-[#C9A24D]/10 text-[#C9A24D]"
                                >
                                  <div className="w-4 h-4 rounded border mr-3 flex items-center justify-center transition-all bg-[#C9A24D] border-[#C9A24D]">
                                    <Check size={10} className="text-white" strokeWidth={4} />
                                  </div>
                                  <span className="truncate">{brokerage}</span>
                                </button>
                              ))
                            ) : searchedBrokerages.length > 0 ? (
                              searchedBrokerages.map((brokerage, idx) => {
                                const isSelected = preferences?.brokerages?.includes(brokerage);
                                return (
                                  <button 
                                    key={idx}
                                    onClick={() => toggleBrokerage(brokerage)}
                                    className={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center transition-colors ${
                                      isSelected 
                                        ? 'bg-[#FCF9F1] dark:bg-[#C9A24D]/10 text-[#C9A24D]' 
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                                    }`}
                                  >
                                    <div className={`w-4 h-4 rounded border mr-3 flex items-center justify-center transition-all ${
                                      isSelected 
                                        ? 'bg-[#C9A24D] border-[#C9A24D]' 
                                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0B0B0B]'
                                    }`}>
                                      {isSelected && <Check size={10} className="text-white" strokeWidth={4} />}
                                    </div>
                                    <span className="truncate">{brokerage}</span>
                                  </button>
                                )
                              })
                            ) : (
                              <div className="px-3 py-6 text-center">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                  {brokerageSearch ? 'No matches found' : 'Start typing to search'}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="relative" ref={cityDropdownRef}>
                      <button 
                        onClick={() => setShowCityDropdown(!showCityDropdown)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all ${
                          showCityDropdown 
                            ? 'border-[#C9A24D] bg-[#FCF9F1] dark:bg-[#C9A24D]/10 text-[#C9A24D]' 
                            : 'border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400 bg-white dark:bg-[#1A1A1C] hover:border-[#C9A24D]/50'
                        }`}
                      >
                        Cities
                        <span className="bg-[#C9A24D] text-white text-[8px] px-1.5 py-0.5 rounded-md leading-none">
                          {preferences?.cities?.length || 0}
                        </span>
                        <ChevronDown size={12} className={`transition-transform duration-200 ${showCityDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showCityDropdown && (
                        <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-[#1A1A1C] border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="p-3 border-b border-gray-50 dark:border-gray-800/50">
                            <div className="relative">
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input 
                                type="text"
                                placeholder="Search cities..."
                                className="w-full bg-gray-50 dark:bg-[#0B0B0B] border-none rounded-xl py-2 pl-9 pr-4 text-xs font-bold placeholder:text-gray-400 focus:ring-1 focus:ring-[#C9A24D]/30 transition-all outline-none"
                                value={citySearch}
                                onChange={(e) => setCitySearch(e.target.value)}
                                autoFocus
                              />
                            </div>
                          </div>
                          <div className="max-h-60 overflow-y-auto p-2">
                            {isSearchingCities ? (
                              <div className="flex flex-col items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#C9A24D] mb-2"></div>
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Searching...</p>
                              </div>
                            ) : (!citySearch && preferences?.cities?.length > 0) ? (
                              preferences.cities.map((city: string, idx: number) => (
                                <button 
                                  key={idx}
                                  onClick={() => toggleCity(city)}
                                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center transition-colors bg-[#FCF9F1] dark:bg-[#C9A24D]/10 text-[#C9A24D]"
                                >
                                  <div className="w-4 h-4 rounded border mr-3 flex items-center justify-center transition-all bg-[#C9A24D] border-[#C9A24D]">
                                    <Check size={10} className="text-white" strokeWidth={4} />
                                  </div>
                                  <span className="truncate">{city}</span>
                                </button>
                              ))
                            ) : searchedCities.length > 0 ? (
                              searchedCities.map((city, idx) => {
                                const isSelected = preferences?.cities?.includes(city);
                                return (
                                  <button 
                                    key={idx}
                                    onClick={() => toggleCity(city)}
                                    className={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center transition-colors ${
                                      isSelected 
                                        ? 'bg-[#FCF9F1] dark:bg-[#C9A24D]/10 text-[#C9A24D]' 
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                                    }`}
                                  >
                                    <div className={`w-4 h-4 rounded border mr-3 flex items-center justify-center transition-all ${
                                      isSelected 
                                        ? 'bg-[#C9A24D] border-[#C9A24D]' 
                                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0B0B0B]'
                                    }`}>
                                      {isSelected && <Check size={10} className="text-white" strokeWidth={4} />}
                                    </div>
                                    <span className="truncate">{city}</span>
                                  </button>
                                )
                              })
                            ) : (
                              <div className="px-3 py-6 text-center">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                  {citySearch ? 'No matches found' : 'Start typing to search'}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="relative" ref={districtDropdownRef}>
                      <button 
                        onClick={() => setShowDistrictDropdown(!showDistrictDropdown)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all ${
                          showDistrictDropdown 
                            ? 'border-[#C9A24D] bg-[#FCF9F1] dark:bg-[#C9A24D]/10 text-[#C9A24D]' 
                            : 'border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400 bg-white dark:bg-[#1A1A1C] hover:border-[#C9A24D]/50'
                        }`}
                      >
                        Districts
                        <span className="bg-[#C9A24D] text-white text-[8px] px-1.5 py-0.5 rounded-md leading-none">
                          {preferences?.school_districts?.length || 0}
                        </span>
                        <ChevronDown size={12} className={`transition-transform duration-200 ${showDistrictDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showDistrictDropdown && (
                        <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-[#1A1A1C] border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="p-3 border-b border-gray-50 dark:border-gray-800/50">
                            <div className="relative">
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input 
                                type="text"
                                placeholder="Search districts..."
                                className="w-full bg-gray-50 dark:bg-[#0B0B0B] border-none rounded-xl py-2 pl-9 pr-4 text-xs font-bold placeholder:text-gray-400 focus:ring-1 focus:ring-[#C9A24D]/30 transition-all outline-none"
                                value={districtSearch}
                                onChange={(e) => setDistrictSearch(e.target.value)}
                                autoFocus
                              />
                            </div>
                          </div>
                          <div className="max-h-60 overflow-y-auto p-2">
                            {isSearchingDistricts ? (
                              <div className="flex flex-col items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#C9A24D] mb-2"></div>
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Searching...</p>
                              </div>
                            ) : (!districtSearch && preferences?.school_districts?.length > 0) ? (
                              preferences.school_districts.map((district: string, idx: number) => (
                                <button 
                                  key={idx}
                                  onClick={() => toggleDistrict(district)}
                                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center transition-colors bg-[#FCF9F1] dark:bg-[#C9A24D]/10 text-[#C9A24D]"
                                >
                                  <div className="w-4 h-4 rounded border mr-3 flex items-center justify-center transition-all bg-[#C9A24D] border-[#C9A24D]">
                                    <Check size={10} className="text-white" strokeWidth={4} />
                                  </div>
                                  <span className="truncate">{district}</span>
                                </button>
                              ))
                            ) : searchedDistricts.length > 0 ? (
                              searchedDistricts.map((district, idx) => {
                                const isSelected = preferences?.school_districts?.includes(district);
                                return (
                                  <button 
                                    key={idx}
                                    onClick={() => toggleDistrict(district)}
                                    className={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center transition-colors ${
                                      isSelected 
                                        ? 'bg-[#FCF9F1] dark:bg-[#C9A24D]/10 text-[#C9A24D]' 
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                                    }`}
                                  >
                                    <div className={`w-4 h-4 rounded border mr-3 flex items-center justify-center transition-all ${
                                      isSelected 
                                        ? 'bg-[#C9A24D] border-[#C9A24D]' 
                                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0B0B0B]'
                                    }`}>
                                      {isSelected && <Check size={10} className="text-white" strokeWidth={4} />}
                                    </div>
                                    <span className="truncate">{district}</span>
                                  </button>
                                )
                              })
                            ) : (
                              <div className="px-3 py-6 text-center">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                  {districtSearch ? 'No matches found' : 'Start typing to search'}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="relative" ref={stateDropdownRef}>
                      <button 
                        onClick={() => setShowStateDropdown(!showStateDropdown)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all ${
                          showStateDropdown 
                            ? 'border-[#C9A24D] bg-[#FCF9F1] dark:bg-[#C9A24D]/10 text-[#C9A24D]' 
                            : 'border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400 bg-white dark:bg-[#1A1A1C] hover:border-[#C9A24D]/50'
                        }`}
                      >
                        State: {preferences?.state || 'Any'}
                        <ChevronDown size={12} className={`transition-transform duration-200 ${showStateDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showStateDropdown && (
                        <div className="absolute top-full left-0 mt-2 w-32 bg-white dark:bg-[#1A1A1C] border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="p-2">
                            {US_STATES.map((state) => (
                              <button
                                key={state}
                                onClick={() => handleStateSelect(state)}
                                className={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-between transition-colors ${
                                  preferences?.state === state 
                                    ? 'bg-[#FCF9F1] dark:bg-[#C9A24D]/10 text-[#C9A24D]' 
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                                }`}
                              >
                                {state}
                                {preferences?.state === state && <Check size={10} strokeWidth={4} />}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="w-px h-6 bg-gray-100 dark:bg-gray-800 mx-1 hidden sm:block"></div>
                    
                    <div className="relative" ref={filterDropdownRef}>
                      <button 
                        onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all ${
                          showFilterDropdown || activeFilterCount > 0
                            ? 'border-[#C9A24D] bg-[#FCF9F1] dark:bg-[#C9A24D]/10 text-[#C9A24D]' 
                            : 'border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400 bg-white dark:bg-[#1A1A1C] hover:border-[#C9A24D]/50'
                        }`}
                      >
                        <Filter size={12} />
                        Filter
                        {activeFilterCount > 0 && (
                          <span className="bg-[#C9A24D] text-white text-[8px] px-1.5 py-0.5 rounded-md leading-none ml-1">
                            {activeFilterCount}
                          </span>
                        )}
                      </button>

                      {showFilterDropdown && (
                        <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-[#1A1A1C] border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="p-4 space-y-4">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Min Bedrooms</label>
                                {minBeds && (
                                  <button 
                                    onClick={() => {
                                      setMinBeds('');
                                      updateCriteria({ min_bedrooms: null });
                                    }}
                                    className="text-[9px] font-black text-[#C9A24D] uppercase hover:underline"
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>
                              <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map(num => (
                                  <button 
                                    key={num}
                                    onClick={() => {
                                      const newVal = minBeds === num ? '' : num;
                                      setMinBeds(newVal);
                                      updateCriteria({ min_bedrooms: newVal || null });
                                    }}
                                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                                      minBeds === num 
                                        ? 'bg-[#C9A24D] border-[#C9A24D] text-white shadow-lg shadow-[#C9A24D]/20' 
                                        : 'border-gray-100 dark:border-gray-800 text-gray-500 hover:border-[#C9A24D]/30'
                                    }`}
                                  >
                                    {num}+
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Min Bathrooms</label>
                                {minBaths && (
                                  <button 
                                    onClick={() => {
                                      setMinBaths('');
                                      updateCriteria({ min_bathrooms: null });
                                    }}
                                    className="text-[9px] font-black text-[#C9A24D] uppercase hover:underline"
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>
                              <div className="flex gap-2">
                                {[1, 2, 3, 4].map(num => (
                                  <button 
                                    key={num}
                                    onClick={() => {
                                      const newVal = minBaths === num ? '' : num;
                                      setMinBaths(newVal);
                                      updateCriteria({ min_bathrooms: newVal || null });
                                    }}
                                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                                      minBaths === num 
                                        ? 'bg-[#C9A24D] border-[#C9A24D] text-white shadow-lg shadow-[#C9A24D]/20' 
                                        : 'border-gray-100 dark:border-gray-800 text-gray-500 hover:border-[#C9A24D]/30'
                                    }`}
                                  >
                                    {num}+
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Min Sqft</label>
                                  {minSqft && (
                                    <button 
                                      onClick={() => {
                                        setMinSqft('');
                                        updateCriteria({ min_square_feet: null });
                                      }}
                                      className="text-[9px] font-black text-[#C9A24D] uppercase hover:underline"
                                    >
                                      Clear
                                    </button>
                                  )}
                                </div>
                                <div className="relative">
                                  <input 
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="2,000"
                                    className="w-full bg-gray-50 dark:bg-[#0B0B0B] border-none rounded-xl py-2.5 px-3 text-xs font-bold placeholder:text-gray-400 focus:ring-1 focus:ring-[#C9A24D]/30 transition-all outline-none"
                                    value={minSqft ? minSqft.toLocaleString() : ''}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/[^0-9]/g, '');
                                      setMinSqft(val ? parseInt(val) : '');
                                    }}
                                    onBlur={() => updateCriteria({ min_square_feet: minSqft || null })}
                                  />
                                </div>
                              </div>

                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Min Price</label>
                                  {minPrice && (
                                    <button 
                                      onClick={() => {
                                        setMinPrice('');
                                        updateCriteria({ min_price: null });
                                      }}
                                      className="text-[9px] font-black text-[#C9A24D] uppercase hover:underline"
                                    >
                                      Clear
                                    </button>
                                  )}
                                </div>
                                <div className="relative">
                                  <input 
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="500,000"
                                    className="w-full bg-gray-50 dark:bg-[#0B0B0B] border-none rounded-xl py-2.5 px-3 text-xs font-bold placeholder:text-gray-400 focus:ring-1 focus:ring-[#C9A24D]/30 transition-all outline-none"
                                    value={minPrice ? minPrice.toLocaleString() : ''}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/[^0-9]/g, '');
                                      setMinPrice(val ? parseInt(val) : '');
                                    }}
                                    onBlur={() => updateCriteria({ min_price: minPrice || null })}
                                  />
                                </div>
                              </div>
                            </div>

                            <button 
                              onClick={() => {
                                setMinBeds('');
                                setMinBaths('');
                                setMinSqft('');
                                setMinPrice('');
                                updateCriteria({
                                  min_bedrooms: null,
                                  min_bathrooms: null,
                                  min_square_feet: null,
                                  min_price: null
                                });
                              }}
                              className="w-full py-2.5 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-[#C9A24D] hover:border-[#C9A24D]/50 transition-all"
                            >
                              Reset All Filters
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="relative" ref={sortDropdownRef}>
                      <button 
                        onClick={() => setShowSortDropdown(!showSortDropdown)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all ${
                          showSortDropdown 
                            ? 'border-[#C9A24D] bg-[#FCF9F1] dark:bg-[#C9A24D]/10 text-[#C9A24D]' 
                            : 'border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400 bg-white dark:bg-[#1A1A1C] hover:border-[#C9A24D]/50'
                        }`}
                      >
                        <SortDesc size={12} />
                        Sort: {[
                          { label: 'Newest', value: 'dom_asc' },
                          { label: 'Oldest', value: 'dom_desc' },
                          { label: 'Price: Low', value: 'price_asc' },
                          { label: 'Price: High', value: 'price_desc' },
                        ].find(opt => opt.value === sortBy)?.label}
                      </button>

                      {showSortDropdown && (
                        <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-[#1A1A1C] border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="p-2">
                            {[
                              { label: 'Newest Listed', value: 'dom_asc' },
                              { label: 'Oldest Listed', value: 'dom_desc' },
                              { label: 'Price: Low to High', value: 'price_asc' },
                              { label: 'Price: High to Low', value: 'price_desc' },
                            ].map((option) => (
                              <button
                                key={option.value}
                                onClick={() => {
                                  setSortBy(option.value as any);
                                  setShowSortDropdown(false);
                                }}
                                className={`w-full text-left px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-between transition-colors ${
                                  sortBy === option.value 
                                    ? 'bg-[#FCF9F1] dark:bg-[#C9A24D]/10 text-[#C9A24D]' 
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                                }`}
                              >
                                {option.label}
                                {sortBy === option.value && <Check size={10} strokeWidth={4} />}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* Listings Section */}
                <div className="p-4 md:p-8 space-y-6">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#C9A24D] mb-4"></div>
                      <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Searching for listings...</p>
                    </div>
                  ) : (Array.isArray(filteredListings) && filteredListings.length > 0) ? (
                    <>
                      {filteredListings.map((property, idx) => (
                        <DiscoveryPropertyRow 
                          key={idx} 
                          property={property} 
                          onRequestToHost={(p) => setSelectedPropertyForRequest(p)}
                        />
                      ))}
                    </>
                  ) : (
                    <div className="text-center py-20">
                      <Home size={40} className="mx-auto text-gray-300 mb-4 opacity-50" />
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No listings found</h3>
                      <p className="text-gray-500 max-w-xs mx-auto">Try adjusting your search criteria or broadening your location.</p>
                    </div>
                  )}
                </div>
              </div>
            </main>
            
            <Footer />
          </div>

          {selectedPropertyForRequest && (
            <EmailModal 
              property={selectedPropertyForRequest} 
              user={user} 
              onClose={() => setSelectedPropertyForRequest(null)}
              showToast={showToast}
            />
          )}
        </BrokerAuthorizationGuard>
      </SubscriptionGuard>
    </AuthGuard>
  )
}
