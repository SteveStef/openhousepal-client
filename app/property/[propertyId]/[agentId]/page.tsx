'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { PropertyDetailResponse, TourRequest } from '@/types'
import { api } from '@/lib/api'
import { 
  X, Send, 
  ChevronLeft, ChevronRight, Maximize2, Home, Info, User,
  Bed, Bath, Ruler, Calendar, MapPin, Clock, ShieldCheck
} from 'lucide-react'
import Link from 'next/link'
import PropertyReport from '@/components/PropertyReport'
import DescriptionSection from '@/components/DescriptionSection'
import ScheduleTourModal from '@/components/ScheduleTourModal'
import MLSComplianceFooter from '@/components/MLSComplianceFooter'
import { useToast } from '@/contexts/ToastContext'
import { cleanAddress, formatMlsStatus } from '@/lib/utils'

export default function PropertyPage() {
  const { propertyId, agentId } = useParams()
  const [property, setProperty] = useState<PropertyDetailResponse | null>(null)
  const [agentName, setAgentName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [isTourModalOpen, setIsTourModalOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [visitorName, setVisitorName] = useState('')
  const [visitorContact, setVisitorContact] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { showToast } = useToast()

  async function handleTourSubmit(data: TourRequest) {
    try {
      const response = await api.scheduleTour({
        ...data,
        agentId: agentId as string
      })

      if (response.success) {
        showToast('Tour request sent successfully!', 'success')
      } else {
        showToast('Failed to send tour request: ' + response.error, 'error')
      }
    } catch (err) {
      console.error('Error scheduling tour:', err)
      showToast('An unexpected error occurred while scheduling your tour.', 'error')
    }
  }

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        setLoading(true)
        console.log("propertyId", propertyId);
        const response = await api.getPropertyForAgent(propertyId as string, agentId as string)
        
        if (response.success && response.data) {
          setProperty(response.data.property)
          setAgentName(response.data.agentName)
        } else {
          setError(response.error || "Property not found")
        }
      } catch (err) {
        setError("An unexpected error occurred")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    if (propertyId && agentId) fetchProperty()
  }, [propertyId, agentId])

  const nextImage = useCallback(() => {
    if (property?.photos?.length) {
      setCurrentImageIndex((prev) => (prev + 1) % property.photos!.length)
    }
  }, [property?.photos])

  const prevImage = useCallback(() => {
    if (property?.photos?.length) {
      setCurrentImageIndex((prev) => (prev - 1 + property.photos!.length) % property.photos!.length)
    }
  }, [property?.photos])

  const formatPrice = (price?: number) => {
    return price ? price.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }) : 'Price Available Upon Request'
  }

  const handleSubmitMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!visitorName.trim()) {
      showToast('Please enter your name.', 'error')
      return
    }
    if (!visitorContact.trim()) {
      showToast('Please enter your email or phone number.', 'error')
      return
    }
    if (!message.trim()) {
      showToast('Please enter a message.', 'error')
      return
    }
    if (!property) return
    
    setIsSubmitting(true)
    try {
      const response = await api.sendMessageToAgent({
        agentId: agentId as string,
        propertyId: propertyId as string,
        propertyAddress: property.FullStreetAddress,
        visitorName,
        visitorContact,
        message
      })

      if (response.success) {
        setMessage('')
        setVisitorName('')
        setVisitorContact('')
        showToast('Message sent to agent!', 'success')
      } else {
        showToast('Failed to send message: ' + response.error, 'error')
      }
    } catch (err) {
      console.error('Error sending message:', err)
      showToast('An unexpected error occurred while sending your message.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh] bg-[#FAFAF7] dark:bg-[#0B0B0B]">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#C9A24D] border-t-transparent"></div>
          <p className="text-gray-600 dark:text-gray-400 font-bold uppercase tracking-widest text-xs">Loading property...</p>
        </div>
      </div>
    )
  }

  if (error || !property) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh] p-4 bg-[#FAFAF7] dark:bg-[#0B0B0B]">
        <div className="text-center bg-white dark:bg-[#151517] p-12 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-800 max-w-md w-full">
          <div className="text-red-500 mb-6 flex justify-center"><Info size={64} /></div>
          <h2 className="text-2xl font-black mb-2 tracking-tight">Listing Not Found</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 font-medium">{error || "This property is no longer available or the link is invalid."}</p>
          <Link href="/" className="inline-block px-8 py-4 bg-[#111827] dark:bg-white text-white dark:text-[#111827] rounded-2xl font-black uppercase tracking-widest text-xs transition-all hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] dark:hover:text-white">Return Home</Link>
        </div>
      </div>
    )
  }

  const images = property.photos || [property.ListPictureURL || '/placeholder.jpg']

  return (
    <div className="flex-1 bg-[#FAFAF7] dark:bg-[#0B0B0B] transition-colors duration-300 min-h-screen">
      {/* Lightbox */}
      {isLightboxOpen && images.length > 0 && (
        <div className="fixed inset-0 bg-black z-[100] flex items-center justify-center overflow-hidden" onClick={() => setIsLightboxOpen(false)}>
          {/* Blurred Background Layer to fill empty space */}
          <div className="absolute inset-0 z-0 opacity-40 scale-110 blur-2xl">
            {images[currentImageIndex] && (
              <Image
                src={images[currentImageIndex]}
                alt="Blurred background"
                fill
                className="object-cover"
                unoptimized
              />
            )}
          </div>

          <button 
            className="absolute top-6 right-6 text-white/70 hover:text-white p-3 rounded-full bg-black/20 hover:bg-black/40 z-[110] backdrop-blur-md transition-all" 
            onClick={() => setIsLightboxOpen(false)}
          >
            <X size={32} />
          </button>
          
          <div className="relative w-full h-full flex items-center justify-center z-10 p-4 sm:p-12">
            <div className="relative w-full h-full max-w-6xl flex items-center justify-center" onClick={e => e.stopPropagation()}>
              <Image 
                src={images[currentImageIndex]} 
                alt={property.FullStreetAddress} 
                fill 
                className="object-contain drop-shadow-2xl" 
                priority 
                unoptimized
              />
            </div>
            {images.length > 1 && (
              <>
                <button onClick={(e) => { e.stopPropagation(); prevImage(); }} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-4 transition-all bg-black/10 hover:bg-black/20 rounded-full"><ChevronLeft size={48} /></button>
                <button onClick={(e) => { e.stopPropagation(); nextImage(); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-4 transition-all bg-black/10 hover:bg-black/20 rounded-full"><ChevronRight size={48} /></button>
              </>
            )}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full text-white/80 text-sm font-black tracking-widest uppercase">
              {currentImageIndex + 1} / {images.length}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 md:px-6 lg:px-8 space-y-6 sm:space-y-8">
        
        {/* Modern Image Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 p-2 sm:p-4 bg-white dark:bg-[#151517] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm">
          {/* Main Large Image */}
          <div 
            className="relative aspect-[3/2] sm:aspect-video lg:aspect-auto lg:h-full min-h-[200px] max-h-[50vh] sm:max-h-none sm:min-h-[350px] lg:min-h-[500px] rounded-2xl overflow-hidden group cursor-pointer shadow-sm"
            onClick={() => {
              setCurrentImageIndex(0);
              setIsLightboxOpen(true);
            }}
          >
            <Image
              src={images[0] || '/placeholder.jpg'}
              alt="Main property view"
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              priority
              quality={90}
            />
            <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute top-4 right-4 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full text-[10px] font-black text-white uppercase tracking-widest border border-white/10">
              1 / {images.length}
            </div>
            <button className="absolute bottom-6 right-6 bg-white/90 dark:bg-black/60 backdrop-blur px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center space-x-2 group-hover:bg-[#C9A24D] group-hover:text-white transition-all">
              <Maximize2 size={12} />
              <span>View all photos</span>
            </button>
          </div>

          {/* Grid of 4 Smaller Images */}
          <div className="hidden lg:grid grid-cols-2 grid-rows-2 gap-2 h-full min-h-[500px]">
            {[1, 2, 3, 4].map((i) => (
              <div 
                key={i} 
                className="relative overflow-hidden cursor-pointer group shadow-sm rounded-2xl"
                onClick={() => {
                  if (images[i]) {
                    setCurrentImageIndex(i);
                    setIsLightboxOpen(true);
                  }
                }}
              >
                {images[i] ? (
                  <>
                    <Image
                      src={images[i]}
                      alt={`View ${i + 1}`}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                      quality={70}
                    />
                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </>
                ) : (
                  <div className="w-full h-full bg-gray-50 dark:bg-[#0B0B0B] flex items-center justify-center">
                    <Home className="text-gray-200 dark:text-gray-800" size={24} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Primary Info Row */}
        <div className="bg-white dark:bg-[#151517] rounded-3xl p-6 sm:p-8 lg:p-10 border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-4 order-2 lg:order-1">
              <div className="flex items-center space-x-3">
                <span className={`px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.15em] rounded-full shadow-sm ${
                  property.MlsStatus?.includes('ACTIVE') 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-800 text-white'
                }`}>
                  {formatMlsStatus(property.MlsStatus)}
                </span>
                <div className="h-1 w-1 bg-gray-300 dark:bg-gray-700 rounded-full" />
                <span className="text-[8px] font-black text-gray-400 uppercase tracking-[0.15em]">
                  {property.PropertyType} • Built in {property.YearBuilt || 'N/A'}
                </span>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 dark:text-white tracking-tight leading-tight mb-2">
                  {cleanAddress(property.FullStreetAddress)}
                </h1>
                <div className="flex items-center text-sm sm:text-base font-bold text-gray-500 dark:text-gray-400">
                  <MapPin size={16} className="mr-2 text-[#C9A24D] shrink-0" />
                  <span className="truncate">{property.City}, {property.StateOrProvince} {property.PostalCode}</span>
                </div>
              </div>
            </div>
            
            <div className="lg:text-right order-1 lg:order-2 pt-2 lg:pt-0">
              <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#111827] dark:text-white tracking-tighter leading-none">
                {formatPrice(property.ListPrice)}
              </div>
              <div className="text-[10px] font-black text-[#C9A24D] uppercase tracking-[0.2em] mt-2 ml-0.5 lg:ml-0">Current Market Price</div>
            </div>
          </div>
        </div>

        {/* Facts Bar with Integrated Tour Action */}
        <div className="bg-white dark:bg-[#151517] p-6 sm:p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-center gap-x-8 gap-y-6 lg:gap-x-12 lg:gap-y-4">
            <div className="flex items-center space-x-3">
              <Bed className="text-[#C9A24D]" size={20} />
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:space-x-2">
                <span className="text-xl font-black text-gray-900 dark:text-white tracking-tight">{property.BedroomsTotal || '-'}</span>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Beds</span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Bath className="text-[#C9A24D]" size={20} />
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:space-x-2">
                <span className="text-xl font-black text-gray-900 dark:text-white tracking-tight">{property.BathroomsTotal || '-'}</span>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Baths</span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Ruler className="text-[#C9A24D]" size={20} />
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:space-x-2">
                <span className="text-xl font-black text-gray-900 dark:text-white tracking-tight">{property.LivingArea?.toLocaleString() || '-'}</span>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sq Ft</span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <span className="text-[#C9A24D] font-bold text-lg">$</span>
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:space-x-2">
                <span className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                  {property.PricePerSquareFoot 
                    ? property.PricePerSquareFoot.toFixed(0) 
                    : (property.ListPrice && property.LivingArea ? (property.ListPrice / property.LivingArea).toFixed(0) : '-')}
                </span>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">/ Sq Ft</span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Calendar className="text-[#C9A24D]" size={20} />
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:space-x-2">
                <span className="text-xl font-black text-gray-900 dark:text-white tracking-tight">{property.YearBuilt || '-'}</span>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Built</span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <ShieldCheck className="text-[#C9A24D]" size={20} />
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:space-x-2">
                <span className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                  {property.AssociationYN || (property.AssociationFee && property.AssociationFee > 0) ? 'Yes' : 'No'}
                </span>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">HOA</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center sm:justify-start pt-6 lg:pt-0 border-t lg:border-t-0 lg:border-l border-gray-100 dark:border-gray-800 lg:pl-8">
            <button 
              onClick={() => setIsTourModalOpen(true)}
              className="w-full sm:w-auto px-10 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all hover:bg-blue-700 shadow-lg transform hover:-translate-y-0.5 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Calendar size={16} />
              <span>Schedule Showing</span>
            </button>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column (Description) */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white dark:bg-[#151517] border border-gray-200 dark:border-gray-800 rounded-3xl p-8 sm:p-10 shadow-sm h-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <h3 className="text-xs font-black text-[#C9A24D] uppercase tracking-[0.3em]">Property Description</h3>
                <div className="flex flex-wrap gap-4 text-[10px] font-black uppercase tracking-wider text-gray-400">
                  {property.MLSAreaMajor && (
                    <div className="flex items-center px-3 py-1.5 bg-gray-50 dark:bg-[#0B0B0B] rounded-lg border border-gray-100 dark:border-gray-800">
                      <span className="text-[#C9A24D] mr-2">Township:</span>
                      <span className="text-gray-900 dark:text-gray-200">{property.MLSAreaMajor}</span>
                    </div>
                  )}
                  {property.SchoolDistrictName && (
                    <div className="flex items-center px-3 py-1.5 bg-gray-50 dark:bg-[#0B0B0B] rounded-lg border border-gray-100 dark:border-gray-800">
                      <span className="text-[#C9A24D] mr-2">District:</span>
                      <span className="text-gray-900 dark:text-gray-200">{property.SchoolDistrictName}</span>
                    </div>
                  )}
                </div>
              </div>
              <DescriptionSection description={property.PublicRemarks || ""} details={property} />
            </div>
          </div>

          {/* Right Column (Actions) */}
          <div className="space-y-8 lg:col-span-1">
            {/* Message Form */}
            <div className="bg-white dark:bg-[#151517] rounded-3xl p-8 border border-gray-200 dark:border-gray-800 shadow-sm h-full flex flex-col">
              <div className="flex items-center mb-8">
                <div className="w-12 h-12 rounded-2xl bg-[#C9A24D]/10 flex items-center justify-center mr-4">
                  <User className="text-[#C9A24D]" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight uppercase"> Message Agent</h2>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Contact {agentName || 'Agent'}</p>
                </div>
              </div>

              <form onSubmit={handleSubmitMessage} className="space-y-4 flex-1 flex flex-col">
                <input 
                  type="text"
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  placeholder="Your Full Name"
                  className="w-full bg-gray-50 dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-800 focus:border-[#C9A24D] rounded-2xl p-4 text-sm focus:outline-none transition-all dark:text-white font-medium"
                  required
                />
                <input 
                  type="text"
                  value={visitorContact}
                  onChange={(e) => setVisitorContact(e.target.value)}
                  placeholder="Email or Phone Number"
                  className="w-full bg-gray-50 dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-800 focus:border-[#C9A24D] rounded-2xl p-4 text-sm focus:outline-none transition-all dark:text-white font-medium"
                  required
                />
                <textarea 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message here..."
                  className="w-full bg-gray-50 dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-800 focus:border-[#C9A24D] rounded-2xl p-4 text-sm min-h-[150px] flex-1 resize-none focus:outline-none transition-all dark:text-white font-medium"
                  required
                />
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black py-4 rounded-2xl transition-all hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] hover:text-white uppercase tracking-widest text-xs disabled:opacity-50 shadow-md transform hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Full Width Property Report */}
        <div className="pt-4">
          <PropertyReport property={property} />
        </div>
      </div>
      
      <MLSComplianceFooter />
      
      <ScheduleTourModal 
        isOpen={isTourModalOpen}
        onClose={() => setIsTourModalOpen(false)}
        property={property}
        onSubmit={handleTourSubmit}
        showContactFields={true}
      />
    </div>
  )
}
