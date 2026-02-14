'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { Property } from '@/types'
import { api } from '@/lib/api'
import { 
  X, Send, 
  ChevronLeft, ChevronRight, Maximize2, Home, Info, User
} from 'lucide-react'
import Link from 'next/link'
import PropertyReport from '@/components/PropertyReport'
import DescriptionSection from '@/components/DescriptionSection'
import ScheduleTourModal, { TourRequest } from '@/components/ScheduleTourModal'

export default function PropertyPage() {
  const { propertyId, agentId } = useParams()
  const [property, setProperty] = useState<Property | null>(null)
  const [agentName, setAgentName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [isTourModalOpen, setIsTourModalOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleTourSubmit(data: TourRequest) {
    console.log('Tour requested:', data)
    // I will customize this later to send to backend
    await new Promise(resolve => setTimeout(resolve, 1000))
    alert('Tour request sent successfully!')
  }

  function cleanAddress(address: string): string {
    if (!address) return "";
    const tmp = address.toLowerCase().split(",")[0];
    return tmp
      .split(" ")
      .filter(word => word.length > 0)
      .map(word => word[0].toUpperCase() + word.substring(1))
      .join(" ");
  }

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        setLoading(true)
        const response = await api.getPropertyForAgent(agentId as string, propertyId as string)
        
        if (response.success && response.data) {
          console.log(response.data)
          const propertyData = response.data.property
          setAgentName(response.data.agentName)
          
          // Map backend property data to frontend Property type
          const mappedProperty: Property = {
            id: propertyData.listingKey,
            mlsId: propertyData.mlsId,
            address: cleanAddress(propertyData.address.streetAddress),
            city: propertyData.address.city,
            state: propertyData.address.state,
            zipCode: propertyData.address.zipcode,
            price: propertyData.price,
            beds: propertyData.bedrooms,
            baths: propertyData.bathrooms,
            squareFeet: propertyData.livingArea,
            yearBuilt: propertyData.yearBuilt,
            propertyType: propertyData.homeType,
            description: propertyData.description,
            images: propertyData.originalPhotos?.map((p: any) => p.mixedSources?.jpeg?.[0]?.url).filter(Boolean) || [],
            status: propertyData.homeStatus,
            listOfficeName: propertyData.listOfficeName,
            details: propertyData.resoFacts
          }
          
          setProperty(mappedProperty)
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
    if (property?.images?.length) {
      setCurrentImageIndex((prev) => (prev + 1) % property.images!.length)
    }
  }, [property?.images])

  const prevImage = useCallback(() => {
    if (property?.images?.length) {
      setCurrentImageIndex((prev) => (prev - 1 + property.images!.length) % property.images!.length)
    }
  }, [property?.images])

  const formatPrice = (price?: number) => {
    return price ? price.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }) : 'Price Available Upon Request'
  }

  const handleSubmitMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    setIsSubmitting(true)
    setTimeout(() => {
      setMessage('')
      setIsSubmitting(false)
      alert('Message sent to agent!')
    }, 800)
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading property details...</p>
        </div>
      </div>
    )
  }

  if (error || !property) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh] p-4">
        <div className="text-center bg-white dark:bg-[#151517] p-8 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 max-w-md w-full">
          <div className="text-red-500 mb-4 flex justify-center"><Info size={48} /></div>
          <h2 className="text-2xl font-bold mb-2">Error</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error || "Property not found"}</p>
          <Link href="/showcases" className="text-blue-600 hover:text-blue-700 font-medium">Back to Showcases</Link>
        </div>
      </div>
    )
  }

  const images = property.images || []
  const resoFacts = property.details as any

  return (
    <div className="flex-1 bg-[#faf9f7] dark:bg-[#0B0B0B] transition-colors duration-300">
      {/* Lightbox */}
      {isLightboxOpen && images.length > 0 && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center" onClick={() => setIsLightboxOpen(false)}>
          <button className="absolute top-4 right-4 text-white p-3 rounded-full bg-black/40 hover:bg-black/60 z-[110]" onClick={() => setIsLightboxOpen(false)}><X size={24} /></button>
          <div className="relative w-full h-full flex items-center justify-center p-8" onClick={e => e.stopPropagation()}>
            <Image src={images[currentImageIndex]} alt="Property Image" fill className="object-contain" priority />
            {images.length > 1 && (
              <>
                <button onClick={prevImage} className="absolute left-8 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-4 rounded-full bg-black/20 hover:bg-black/40"><ChevronLeft size={32} /></button>
                <button onClick={nextImage} className="absolute right-8 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-4 rounded-full bg-black/20 hover:bg-black/40"><ChevronRight size={32} /></button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-8 md:px-6 lg:px-8">
        {/* Header Section */}
        <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                {property.status === 'forSale' ? 'For Sale' :
                 property.status === 'forRent' ? 'For Rent' :
                 property.status === 'recentlySold' ? 'Recently Sold' :
                 property.status?.replace("_", " ") || "FOR SALE"}
              </span>
              <span className="text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-widest">MLS: {property.mlsId || '12345678'}</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tight">{property.address}</h1>
            <div className="flex items-center mt-1 text-gray-500 dark:text-gray-400 font-medium">
              <span>{property.city}, {property.state} {property.zipCode}</span>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            {/* Gallery */}
            <div className="relative h-[400px] md:h-[550px] bg-gray-100 dark:bg-[#151517] rounded-3xl overflow-hidden group shadow-2xl border border-gray-200 dark:border-gray-800">
              {images.length > 0 ? (
                <>
                  <Image src={images[currentImageIndex]} alt={property.address} fill className="object-cover cursor-pointer" onClick={() => setIsLightboxOpen(true)} priority />
                  <button onClick={() => setIsLightboxOpen(true)} className="absolute top-6 left-6 bg-black/50 hover:bg-black/70 text-white p-3 rounded-2xl transition-all opacity-0 group-hover:opacity-100 backdrop-blur-md"><Maximize2 size={20} /></button>
                  <div className="absolute top-6 right-6 bg-black/60 backdrop-blur-md text-white text-sm px-4 py-2 rounded-2xl font-bold border border-white/10">{currentImageIndex + 1} / {images.length}</div>
                  {images.length > 1 && (
                    <>
                      <button onClick={prevImage} className="absolute left-6 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 p-4 rounded-full shadow-xl transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"><ChevronLeft size={24} /></button>
                      <button onClick={nextImage} className="absolute right-6 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 p-4 rounded-full shadow-xl transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"><ChevronRight size={24} /></button>
                    </>
                  )}
                </>
              ) : <div className="w-full h-full flex items-center justify-center"><Home size={64} className="text-gray-300" /></div>}
            </div>
            
            {images.length > 1 && (
              <div className="flex space-x-4 overflow-x-auto pb-2 scrollbar-hide">
                {images.map((imageUrl, index) => (
                  <button key={index} onClick={() => setCurrentImageIndex(index)} className={`relative flex-shrink-0 w-24 h-24 rounded-2xl overflow-hidden border-4 transition-all ${index === currentImageIndex ? 'border-blue-500 shadow-lg scale-105' : 'border-transparent hover:border-gray-300 dark:hover:border-gray-700'}`}><Image src={imageUrl} alt={`Thumbnail ${index + 1}`} fill className="object-cover" /></button>
                ))}
              </div>
            )}

            <section className="bg-white dark:bg-[#151517] rounded-3xl p-8 shadow-lg border border-gray-200 dark:border-gray-800">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center"><Info className="mr-3 text-blue-500" /> Property Overview</h2>
              <DescriptionSection description={property.description || ""} details={property.details} />
            </section>

            {resoFacts && <PropertyReport resoFacts={resoFacts} propertyAddress={property.address} />}

            {/* Compliance Footer */}
            <div className="border-t border-gray-200 dark:border-gray-800 mt-12 pt-8 text-center text-xs text-gray-500 dark:text-gray-500 space-y-4 pb-12">
              <p>Data last updated: {resoFacts?.updated_at 
                ? new Date(resoFacts.updated_at).toLocaleString('en-US', {
                    month: 'numeric',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                  }).replace(',', '')
                : `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`}</p>
              <p className="font-bold">Information Deemed Reliable But Not Guaranteed.</p>
              <p className="max-w-4xl mx-auto leading-relaxed">
                The data relating to real estate for sale on this website appears in part through the BRIGHT Internet Data Exchange program, a voluntary cooperative exchange of property listing data between licensed real estate brokerage firms in which participates, and is provided by BRIGHT through a licensing agreement.
              </p>
              <div className="flex items-center justify-center space-x-4 pt-4">
                <div className="px-3 py-1 border border-gray-300 dark:border-gray-700 rounded-md font-bold">MLS</div>
                <p className="font-medium">
                  © {new Date().getFullYear()} Bright MLS • All Rights Reserved
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-8">
            <div className="bg-white dark:bg-[#151517] rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-gray-800">
              <div className="mb-8 pb-8 border-b border-gray-100 dark:border-gray-800">
                <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">List Price</div>
                <div className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter">{formatPrice(property.price)}</div>
                <div className="text-gray-500 dark:text-gray-400 font-medium text-xs mt-1">
                  Est. Payment: ${Math.round((property.price || 0) * 0.006).toLocaleString()}/mo
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-6 mb-8">
                {[
                  { val: property.beds, label: 'Beds' },
                  { val: property.baths, label: 'Baths' },
                  { val: property.squareFeet?.toLocaleString(), label: 'Sq Ft' },
                  { val: property.yearBuilt, label: 'Built' }
                ].map((s, i) => (
                  <div key={i} className="p-4 bg-gray-50 dark:bg-[#0B0B0B] rounded-2xl border border-gray-100 dark:border-gray-800 text-center">
                    <div className="text-2xl font-black text-gray-900 dark:text-white">{s.val || '-'}</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                {[
                  { label: 'Type', val: property.propertyType?.replace("_", " ") },
                  { label: 'Price/Sq Ft', val: property.price && property.squareFeet ? `$${Math.round(property.price / property.squareFeet)}` : '-' },
                  { label: 'Lot Size', val: resoFacts?.lotSizeAcres ? `${resoFacts.lotSizeAcres} Acres` : '-' },
                  { label: 'HOA', val: resoFacts?.hoaFee || 'None' }
                ].map((stat, i) => (
                  <div key={i} className="flex justify-between items-center py-3 border-b last:border-0 border-gray-50 dark:border-gray-800">
                    <span className="text-gray-500 dark:text-gray-400 font-medium">{stat.label}</span>
                    <span className="text-gray-900 dark:text-white font-bold">{stat.val}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-600 rounded-3xl p-8 text-white shadow-xl shadow-blue-500/20">
              <h3 className="text-xl font-bold mb-4">Interested in a Tour?</h3>
              <p className="text-blue-100 mb-6 text-sm leading-relaxed">Schedule a private viewing of this exceptional property with a local expert.</p>
              <button 
                onClick={() => setIsTourModalOpen(true)}
                className="w-full py-4 bg-white text-blue-600 rounded-2xl font-black hover:bg-blue-50 transition-colors shadow-lg"
              >
                Schedule Viewing
              </button>
            </div>

            {/* Contact Form Sidebar */}
            <div className="bg-white dark:bg-[#151517] rounded-3xl p-8 shadow-lg border border-gray-200 dark:border-gray-800 sticky top-8">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mr-4">
                  <User className="text-purple-600 dark:text-purple-400" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">{agentName || 'Agent'}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Get more details about this home</p>
                </div>
              </div>

              <form onSubmit={handleSubmitMessage} className="space-y-4">
                <div>
                  <textarea 
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="I'm interested in this property. Please send me more information..."
                    className="w-full bg-gray-50 dark:bg-[#0B0B0B] border-2 border-gray-100 dark:border-gray-800 focus:border-gray-900 dark:focus:border-white rounded-2xl p-4 text-sm min-h-[150px] resize-none focus:outline-none transition-all dark:text-white"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={!message.trim() || isSubmitting}
                  className="w-full bg-gray-900 hover:bg-black dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 disabled:from-gray-300 disabled:to-gray-300 text-white py-4 rounded-2xl font-black shadow-xl transition-all flex items-center justify-center space-x-2 transform hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  <Send size={18} />
                  <span>{isSubmitting ? 'Sending...' : 'Send Message'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
      <ScheduleTourModal 
        isOpen={isTourModalOpen}
        onClose={() => setIsTourModalOpen(false)}
        property={property}
        onSubmit={handleTourSubmit}
      />
    </div>
  )
}
