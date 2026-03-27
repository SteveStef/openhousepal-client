'use client'

import Image from 'next/image'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Property, PropertyDetailResponse } from '@/types'
import { X, MessageCircle, Send, ThumbsUp, ThumbsDown, ChevronLeft, ChevronRight, Maximize2, Home, User, Ruler, Bed, Bath, Calendar, MapPin, Clock, ShieldCheck } from 'lucide-react'
import { cleanAddress, formatMlsStatus, formatPropertyType, formatPropertyFeature } from '@/lib/utils'

const formatDate = (dateString: string) => {
  try {
    if (!dateString) return 'Date unavailable'
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Date unavailable'
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch (error) {
    return 'Date unavailable'
  }
}

interface PropertyDetailsModalProps {
  property: PropertyDetailResponse | null
  isOpen: boolean
  onClose: () => void
  onLike?: (propertyId: string, liked: boolean) => void
  onDislike?: (propertyId: string, disliked: boolean) => void
  onAddComment?: (propertyId: string, comment: string) => void
  isLoadingDetails?: boolean
  detailsError?: string | null
  onRetryDetails?: () => void
  isLoadingComments?: boolean
  commentsError?: string | null
}

// Property Report Table Component
function PropertyReport({ property }: { property: PropertyDetailResponse }) {
  const propertyAddress = property.FullStreetAddress;
  
  const formatList = (items: any): string | null => {
    if (!items) return null;
    if (Array.isArray(items)) {
      if (items.length === 0) return null;
      return items.join(", ");
    }
    return String(items);
  };

  const formatCurrency = (amount: number | null | undefined): string | null => {
    if (!amount) return null;
    return `$${amount.toLocaleString()}`;
  };

  const allReportData = [
    // Listing Information
    { property: "Listing Information", value: "", isHeader: true },
    { property: "Status", value: formatMlsStatus(property.MlsStatus) },
    { property: "Listing Date", value: formatDate(property.MLSListDate || '') },
    { property: "Last Price Change", value: formatDate(property.PriceChangeTimestamp || '') },
    { property: "Days on Market", value: property.DaysOnMarket },
    { property: "Cumulative DOM", value: property.CumulativeDaysOnMarket },
    { property: "Original List Price", value: formatCurrency(property.OriginalListPrice) },
    { property: "Price Per Sq Ft", value: property.PricePerSquareFoot ? `$${property.PricePerSquareFoot.toFixed(2)}` : null },

    // Building & Construction
    { property: "BUILDING & CONSTRUCTION", value: "", isHeader: true },
    { property: "Year Built", value: property.YearBuilt },
    { property: "New Construction", value: property.NewConstructionYN ? "Yes" : (property.NewConstructionYN === false ? "No" : null) },
    { property: "Architectural Style", value: formatList(property.ArchitecturalStyle) },
    { property: "Construction Materials", value: formatList(property.ConstructionMaterials) },
    { property: "Stories", value: property.Stories },
    { property: "Basement", value: formatList(property.Basement) },
    { property: "Square Footage", value: property.LivingArea ? `${property.LivingArea.toLocaleString()} sq ft` : null },
    { property: "Above Grade SQFT", value: property.AboveGradeFinishedArea ? `${property.AboveGradeFinishedArea.toLocaleString()} sq ft` : null },
    { property: "Below Grade SQFT", value: property.BelowGradeFinishedArea ? `${property.BelowGradeFinishedArea.toLocaleString()} sq ft` : null },
    { property: "Lot Size", value: property.LotSizeSquareFeet ? `${property.LotSizeSquareFeet.toLocaleString()} sq ft` : null },
    { property: "Lot Size (Acres)", value: property.LotSizeAcres ? `${property.LotSizeAcres} AC` : null },
    { property: "Zoning", value: property.Zoning },

    // Interior Features
    { property: "INTERIOR FEATURES", value: "", isHeader: true },
    { property: "Appliances", value: formatList(property.Appliances) },
    { property: "Interior Features", value: formatList(property.InteriorFeatures) },
    { property: "Flooring", value: formatList(property.Flooring) },
    { property: "Window Features", value: formatList(property.WindowFeatures) },
    { property: "Fireplace Features", value: formatList(property.FireplaceFeatures) },
    { property: "Fireplaces", value: property.FireplacesTotal },

    // HVAC & Systems
    { property: "HVAC & SYSTEMS", value: "", isHeader: true },
    { property: "Central Air", value: property.CentralAirYN ? "Yes" : (property.CentralAirYN === false ? "No" : null) },
    { property: "Heating", value: formatList(property.Heating) },
    { property: "Heating Fuel", value: formatList(property.HeatingFuel) },
    { property: "Cooling", value: formatList(property.Cooling) },
    { property: "Cooling Fuel", value: formatList(property.CoolingFuel) },
    { property: "Water Source", value: formatList(property.WaterSource) },
    { property: "Sewer", value: formatList(property.Sewer) },
    { property: "Utilities", value: formatList(property.Utilities) },

    // Parking & Access
    { property: "PARKING & ACCESS", value: "", isHeader: true },
    { property: "Garage Spaces", value: property.GarageSpaces ? `${property.GarageSpaces} spaces` : null },
    { property: "Attached Garage", value: property.AttachedGarageYN ? "Yes" : (property.AttachedGarageYN === false ? "No" : null) },
    { property: "Parking Features", value: formatList(property.ParkingFeatures) },
    { property: "Accessibility Features", value: formatList(property.AccessibilityFeatures) },

    // HOA & Fees
    ...(property.AssociationYN || property.AssociationFee ? [
      { property: "HOA & FEES", value: "", isHeader: true },
      { property: "HOA Fee", value: formatCurrency(property.AssociationFee) },
      { property: "Frequency", value: property.AssociationFeeFrequency },
      { property: "HOA Fee 2", value: formatCurrency(property.AssociationFee2) },
      { property: "Frequency 2", value: property.AssociationFee2Frequency },
      { property: "HOA Includes", value: formatList(property.AssociationFeeIncludes) },
      { property: "Amenities", value: formatList(property.AssociationAmenities) },
    ] : []),

    // Schools & District
    { property: "SCHOOLS & DISTRICT", value: "", isHeader: true },
    { property: "School District", value: property.SchoolDistrictName },
    { property: "Elementary School", value: property.ElementarySchool },
    { property: "Middle School", value: property.MiddleOrJuniorSchool },
    { property: "High School", value: property.HighSchool },

    // Location & Neighborhood
    { property: "LOCATION & NEIGHBORHOOD", value: "", isHeader: true },
    { property: "Incorporated City", value: property.IncorporatedCityName },
    { property: "County", value: property.County },
    { property: "Township", value: property.MLSAreaMajor },
    { property: "Subdivision", value: property.SubdivisionName },
    { property: "View", value: formatList(property.View) },
    { property: "Waterfront", value: formatList(property.WaterfrontFeatures) },
    { property: "Possession", value: formatList(property.Possession) },
    { property: "Directions", value: property.Directions },

    // Additional Features
    { property: "ADDITIONAL FEATURES", value: "", isHeader: true },
    { property: "Senior Community", value: property.SeniorCommunityYN ? "Yes" : (property.SeniorCommunityYN === false ? "No" : null) },
    { property: "Pets Allowed", value: formatList(property.PetsAllowed) },
    { property: "Exterior Features", value: formatList(property.ExteriorFeatures) },
    { property: "Lot Features", value: formatList(property.LotFeatures) },

    // Financial Details
    { property: "FINANCIAL DETAILS", value: "", isHeader: true },
    { property: "Annual Property Tax", value: formatCurrency(property.TaxAnnualAmount) },
    { property: "Tax Assessment", value: formatCurrency(property.TaxAssessmentAmount) },
    { property: "Assessment Year", value: property.AssessmentYear },
    { property: "Tax ID", value: property.ListingTaxID },
  ];

  // Filter out rows with null or empty values, but keep headers
  const reportData = allReportData.filter(row => row.isHeader || (row.value !== null && row.value !== undefined && row.value !== ''));

  interface ReportSection {
    header: string;
    items: Array<{ property: string; value: any }>;
  }

  // Group data by sections and filter out empty sections
  const sections: ReportSection[] = [];
  let currentSection: ReportSection | null = null;

  for (const row of reportData) {
    if (row.isHeader) {
      if (currentSection && currentSection.items.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { header: row.property, items: [] };
    } else if (currentSection) {
      currentSection.items.push({ property: row.property, value: row.value });
    }
  }

  if (currentSection && currentSection.items.length > 0) {
    sections.push(currentSection);
  }

  return (
    <div className="bg-white dark:bg-[#0B0B0B] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
      {/* Report Header */}
      <div className="bg-gray-50 dark:bg-[#151517] px-8 py-6 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold uppercase tracking-tight">Property Details Report</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Comprehensive technical overview</p>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Generated</div>
            <div className="font-medium text-sm">{new Date().toLocaleDateString()}</div>
          </div>
        </div>
      </div>

      {/* Report Content - Grouped Sections */}
      <div className="p-4 sm:p-8 space-y-10 bg-white dark:bg-[#0B0B0B]">
        {sections.map((section, sectionIndex) => {
          // Separate items into full-width and regular items based on comma count
          const fullWidthItems = section.items.filter(item => {
            const value = String(item.value);
            const commaCount = (value.match(/,/g) || []).length;
            return commaCount >= 3; // 3+ commas = 4+ items in list
          });
          const regularItems = section.items.filter(item => {
            const value = String(item.value);
            const commaCount = (value.match(/,/g) || []).length;
            return commaCount < 3;
          });

          return (
            <div
              key={sectionIndex}
              className="space-y-4"
            >
              {/* Subtle Section Header */}
              <h3 className="text-xs font-black text-[#C9A24D] uppercase tracking-[0.2em] mb-4 pb-2 border-b border-gray-100 dark:border-gray-800">
                {section.header}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                {section.items.map((item, itemIdx) => (
                    <div key={itemIdx} className={`flex justify-between items-start gap-4 py-1 border-b border-gray-50 dark:border-gray-800/50 last:border-0 ${
                        String(item.value).length > 30 ? 'md:col-span-2' : ''
                    }`}>
                        <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tight flex-shrink-0">
                            {item.property}
                        </span>
                        <span className="text-sm font-semibold text-[#111827] dark:text-gray-200 text-right">
                            {item.value}
                        </span>
                    </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Description component with truncation
function DescriptionSection({ description, details }: { description: string, details?: any }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const maxLength = 700 // Adjusted to balance with comments sidebar

  const shouldTruncate = description.length > maxLength
  const displayText = isExpanded || !shouldTruncate 
    ? description 
    : description.slice(0, maxLength) + '...'

  return (
    <div className="py-2">
      <div className="space-y-4">
        <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-base font-medium">{displayText}</p>
        {shouldTruncate && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[#C9A24D] hover:text-[#B38F3D] text-sm font-bold uppercase tracking-wider transition-colors duration-200"
          >
            {isExpanded ? 'Read Less' : 'Read Full Description'}
          </button>
        )}
      </div>
      
      {/* Listing Agent Info Paragraph */}
      {(details?.ListAgentFullName || details?.ListOfficeName) && (
        <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed italic">
            <span className="font-bold uppercase tracking-widest not-italic mr-2">Listing Source:</span>{' '}
            {details.ListAgentFullName || 'Agent'}
            {details.ListOfficeName && ` of ${details.ListOfficeName}`}
            {details.ListOfficePhone && ` (${details.ListOfficePhone})`}.
            {details.ListAgentEmail && ` Email: ${details.ListAgentEmail}.`}
            {details.ListingId && ` (MLS# ${details.ListingId})`}
          </p>        </div>
      )}
    </div>
  )
}

export default function PropertyDetailsModal({
  property,
  isOpen,
  onClose,
  onLike,
  onDislike,
  onAddComment,
  isLoadingDetails = false,
  detailsError = null,
  onRetryDetails,
  isLoadingComments = false,
  commentsError = null
}: PropertyDetailsModalProps) {
  const [newComment, setNewComment] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const commentsContainerRef = useRef<HTMLDivElement>(null)

  // Enhanced photo handling for property data
  const getPropertyImages = useCallback(() => {
    const photos = (property as PropertyDetailResponse)?.photos;
    if (photos && photos.length > 0) {
      return photos.filter((url: string) => typeof url === 'string' && url.length > 0);
    }
    // Fallback to primary image
    return [property?.ListPictureURL || '/placeholder.jpg'].filter(url => url !== undefined);
  }, [property])
  
  const images = getPropertyImages()

  // Preload adjacent images for smoother navigation
  useEffect(() => {
    if (images.length <= 1) return;

    const nextIndex = (currentImageIndex + 1) % images.length;
    const prevIndex = (currentImageIndex - 1 + images.length) % images.length;

    // Preload next image
    const nextImg = new window.Image();
    nextImg.src = images[nextIndex];

    // Preload previous image
    const prevImg = new window.Image();
    prevImg.src = images[prevIndex];
  }, [currentImageIndex, images]);

  // Scroll to bottom of comments
  const scrollToBottom = useCallback(() => {
    if (commentsContainerRef.current) {
      commentsContainerRef.current.scrollTop = commentsContainerRef.current.scrollHeight
    }
  }, [])

  const nextImage = useCallback(() => {
    if (images.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % images.length)
    }
  }, [images.length])

  const prevImage = useCallback(() => {
    if (images.length > 0) {
      setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
    }
  }, [images.length])
  
  // Reset image index when property changes or images change
  useEffect(() => {
    if (currentImageIndex >= images.length && images.length > 0) {
      setCurrentImageIndex(0)
    }
  }, [property?.id, images.length, currentImageIndex])

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      // Save original styles
      const scrollY = window.scrollY
      const originalBodyOverflow = document.body.style.overflow
      const originalBodyPosition = document.body.style.position
      const originalBodyTop = document.body.style.top
      const originalBodyWidth = document.body.style.width
      const originalHtmlOverflow = document.documentElement.style.overflow
      
      // Apply aggressive lock
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
      document.documentElement.style.overflow = 'hidden'
      
      return () => {
        // Restore original styles on cleanup
        document.body.style.overflow = originalBodyOverflow
        document.body.style.position = originalBodyPosition
        document.body.style.top = originalBodyTop
        document.body.style.width = originalBodyWidth
        document.documentElement.style.overflow = originalHtmlOverflow
        
        // Restore scroll position
        window.scrollTo(0, scrollY)
      }
    }
  }, [isOpen])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!isOpen) return
      
      switch (e.key) {
        case 'Escape':
          if (isLightboxOpen) {
            setIsLightboxOpen(false)
          } else {
            onClose()
          }
          break
        case 'ArrowLeft':
          if (isLightboxOpen) {
            e.preventDefault()
            prevImage()
          }
          break
        case 'ArrowRight':
          if (isLightboxOpen) {
            e.preventDefault()
            nextImage()
          }
          break
      }
    }
    
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isOpen, isLightboxOpen, onClose, prevImage, nextImage])

  if (!isOpen || !property) return null

  const formatPrice = (price?: number) => {
    return price ? price.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }) : 'Price Available Upon Request'
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || !property.id) return

    setIsSubmittingComment(true)
    try {
      if (property.id !== undefined) {
        onAddComment?.(property.id, newComment.trim())
      }
      setNewComment('')
      setTimeout(() => scrollToBottom(), 100)
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const renderLightbox = () => {
    if (!isLightboxOpen || images.length === 0) return null
    return (
      <div 
        className="fixed inset-0 bg-black z-[70] flex items-center justify-center overflow-hidden"
        onClick={() => setIsLightboxOpen(false)}
      >
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
          onClick={() => setIsLightboxOpen(false)}
          className="absolute top-6 right-6 text-white/70 hover:text-white p-3 transition-all z-[80] bg-black/20 rounded-full hover:bg-black/40 backdrop-blur-md"
        >
          <X size={32} />
        </button>
        
        <div className="relative w-full h-full flex items-center justify-center z-10 p-4 sm:p-12">
          <div className="relative w-full h-full max-w-6xl flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {images[currentImageIndex] && (
              <Image
                src={images[currentImageIndex]}
                alt={`${property.FullStreetAddress} - Full Image`}
                fill
                sizes="100vw"
                className="object-contain drop-shadow-2xl"
                priority
                unoptimized
              />
            )}
          </div>
          
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prevImage(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-4 transition-all bg-black/10 hover:bg-black/20 rounded-full"
              >
                <ChevronLeft size={48} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); nextImage(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-4 transition-all bg-black/10 hover:bg-black/20 rounded-full"
              >
                <ChevronRight size={48} />
              </button>
            </>
          )}

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full text-white/80 text-sm font-black tracking-widest uppercase">
            {currentImageIndex + 1} / {images.length}
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <>
      {renderLightbox()}
      <div className="fixed inset-0 bg-[#0B0B0B]/80 z-50 flex items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300 overscroll-none">
        <div 
          className="bg-white dark:bg-[#0B0B0B] w-full max-w-7xl h-full sm:h-[95vh] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300"
          style={{ overscrollBehavior: 'contain' }}
        >
          
          <div className="flex-1 overflow-y-auto scrollbar-hide bg-[#FAFAF7] dark:bg-[#0B0B0B]">
            {/* Minimal Header with Close Button */}
            <div className="sticky top-0 z-40 bg-white/95 dark:bg-[#0B0B0B]/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
              <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-[10px] font-black text-gray-400 uppercase tracking-widest overflow-hidden">
                  <MapPin size={12} className="text-[#C9A24D]" />
                  <span className="truncate">{cleanAddress(property.FullStreetAddress)}</span>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto">
              
              {/* Modern Image Grid Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 p-2 sm:p-4 bg-white dark:bg-[#0B0B0B] border-b border-gray-100 dark:border-gray-900">
                {/* Main Large Image (Half Width) */}
                <div 
                  className="relative aspect-[3/2] sm:aspect-video lg:aspect-auto lg:h-full min-h-[250px] sm:min-h-[350px] lg:min-h-[450px] rounded-2xl sm:rounded-l-3xl overflow-hidden group cursor-pointer shadow-sm"
                  onClick={() => {
                    setCurrentImageIndex(0);
                    setIsLightboxOpen(true);
                  }}
                >
                  <Image
                    src={images[0] || '/placeholder.jpg'}
                    alt="Main property view"
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    priority
                    quality={90}
                  />
                  <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  {/* Photo Counter Badge */}
                  <div className="absolute top-4 right-4 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full text-[10px] font-black text-white uppercase tracking-widest border border-white/10">
                    1 / {images.length}
                  </div>

                  <button className="absolute bottom-6 right-6 bg-white/90 dark:bg-black/60 backdrop-blur px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center space-x-2 group-hover:bg-[#C9A24D] group-hover:text-white transition-all">
                    <Maximize2 size={12} />
                    <span>View all photos</span>
                  </button>
                </div>

                {/* Grid of 4 Smaller Images */}
                <div className="hidden lg:grid grid-cols-2 grid-rows-2 gap-2 h-full min-h-[450px]">
                  {[1, 2, 3, 4].map((i) => (
                    <div 
                      key={i} 
                      className={`relative overflow-hidden cursor-pointer group shadow-sm ${i === 2 ? 'rounded-tr-3xl' : i === 4 ? 'rounded-br-3xl' : ''}`}
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
                            sizes="(max-width: 1024px) 25vw, 15vw"
                            className="object-cover transition-transform duration-700 group-hover:scale-110"
                            quality={75}
                          />
                          <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </>
                      ) : (
                        <div className="w-full h-full bg-gray-50 dark:bg-[#151517] flex items-center justify-center">
                          <Home className="text-gray-300 dark:text-gray-800" size={24} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Primary Property Info (Address, Price, Status) */}
              <div className="px-6 sm:px-12 pt-8 sm:pt-10 pb-4 bg-white dark:bg-[#0B0B0B]">
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
                        {formatPropertyType(property.PropertyType)} • Built in {property.YearBuilt || 'N/A'}
                      </span>
                    </div>
                    
                    <div>
                      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 dark:text-white tracking-tight leading-tight mb-1.5">
                        {cleanAddress(property.FullStreetAddress)}
                      </h1>
                      <div className="flex items-center text-sm sm:text-base lg:text-lg font-bold text-gray-500 dark:text-gray-400">
                        <MapPin size={14} className="mr-2 text-[#C9A24D] shrink-0" />
                        <span className="truncate">{property.City}, {property.StateOrProvince} {property.PostalCode}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="lg:text-right order-1 lg:order-2 pt-2 lg:pt-0">
                    <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#111827] dark:text-white tracking-tighter leading-none">
                      {formatPrice(property.ListPrice)}
                    </div>
                    <div className="text-[9px] font-black text-[#C9A24D] uppercase tracking-[0.2em] mt-2 ml-0.5 lg:ml-0">Current Market Price</div>
                  </div>
                </div>
              </div>

              <div className="px-6 sm:px-12 py-10 space-y-12">
                
                {/* Important Facts / Specs Bar */}
                <section>
                  <div className="bg-white dark:bg-[#151517] p-6 sm:p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-center gap-x-8 gap-y-6 lg:gap-x-10 lg:gap-y-4">
                        <div className="flex items-center space-x-3">
                          <Bed className="text-[#C9A24D]" size={18} />
                          <div className="flex flex-col sm:flex-row sm:items-baseline sm:space-x-2">
                            <span className="text-lg font-black text-gray-900 dark:text-white tracking-tight">{formatPropertyFeature(property.BedroomsTotal)}</span>
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Beds</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <Bath className="text-[#C9A24D]" size={18} />
                          <div className="flex flex-col sm:flex-row sm:items-baseline sm:space-x-2">
                            <span className="text-lg font-black text-gray-900 dark:text-white tracking-tight">{formatPropertyFeature(property.BathroomsTotal)}</span>
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Baths</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <Ruler className="text-[#C9A24D]" size={18} />
                          <div className="flex flex-col sm:flex-row sm:items-baseline sm:space-x-2">
                            <span className="text-lg font-black text-gray-900 dark:text-white tracking-tight">{formatPropertyFeature(property.LivingArea, true)}</span>
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Sq Ft</span>
                          </div>
                        </div>

                        {property.PricePerSquareFoot && (
                          <div className="flex items-center space-x-3">
                            <span className="text-[#C9A24D] font-bold text-lg">$</span>
                            <div className="flex flex-col sm:flex-row sm:items-baseline sm:space-x-2">
                              <span className="text-lg font-black text-gray-900 dark:text-white tracking-tight">{property.PricePerSquareFoot.toFixed(0)}</span>
                              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">/ Sq Ft</span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center space-x-3">
                          <Calendar className="text-[#C9A24D]" size={18} />
                          <div className="flex flex-col sm:flex-row sm:items-baseline sm:space-x-2">
                            <span className="text-lg font-black text-gray-900 dark:text-white tracking-tight">{property.YearBuilt || '-'}</span>
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Built</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <ShieldCheck className="text-[#C9A24D]" size={18} />
                          <div className="flex flex-col sm:flex-row sm:items-baseline sm:space-x-2">
                            <span className="text-lg font-black text-gray-900 dark:text-white tracking-tight">
                              {property.AssociationYN || (property.AssociationFee && property.AssociationFee > 0) ? 'Yes' : 'No'}
                            </span>
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">HOA</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-center sm:justify-start space-x-3 pt-6 lg:pt-0 border-t lg:border-t-0 lg:border-l border-gray-100 dark:border-gray-800 lg:pl-8 h-auto lg:h-10">
                        <button
                          onClick={() => onLike?.(property.id!, !property.liked)}
                          className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl transition-all border font-black text-[9px] uppercase tracking-widest ${
                            property.liked
                              ? 'bg-green-500 border-green-500 text-white shadow-lg shadow-green-500/20'
                              : 'bg-white dark:bg-[#0B0B0B] border-gray-200 dark:border-gray-800 text-gray-400 hover:text-green-500 hover:border-green-200 shadow-sm'
                          }`}
                        >
                          <ThumbsUp size={14} fill={property.liked ? "currentColor" : "none"} />
                          <span className="hidden sm:inline">Like</span>
                        </button>
                        <button
                          onClick={() => onDislike?.(property.id!, !property.disliked)}
                          className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl transition-all border font-black text-[9px] uppercase tracking-widest ${
                            property.disliked
                              ? 'bg-gray-900 dark:bg-white border-gray-900 dark:border-white text-white dark:text-gray-900 shadow-lg'
                              : 'bg-white dark:bg-[#0B0B0B] border-gray-200 dark:border-gray-800 text-gray-400 hover:text-red-500 hover:border-red-200 shadow-sm'
                          }`}
                        >
                          <ThumbsDown size={14} fill={property.disliked ? "currentColor" : "none"} />
                          <span className="hidden sm:inline">Pass</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Description & Comments */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                  <div className="lg:col-span-2">
                    <div className="bg-white dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-800 rounded-3xl p-8 sm:p-10 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] h-full">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                        <h3 className="text-xs font-black text-[#C9A24D] uppercase tracking-[0.3em]">Property Description</h3>
                        
                        <div className="flex flex-wrap gap-4 text-[10px] font-black uppercase tracking-wider text-gray-400">
                          {property.MLSAreaMajor && (
                            <div className="flex items-center px-3 py-1.5 bg-gray-50 dark:bg-[#151517] rounded-lg border border-gray-100 dark:border-gray-800">
                              <span className="text-[#C9A24D] mr-2">Township:</span>
                              <span className="text-gray-900 dark:text-gray-200">{property.MLSAreaMajor}</span>
                            </div>
                          )}
                          {property.SchoolDistrictName && (
                            <div className="flex items-center px-3 py-1.5 bg-gray-50 dark:bg-[#151517] rounded-lg border border-gray-100 dark:border-gray-800">
                              <span className="text-[#C9A24D] mr-2">District:</span>
                              <span className="text-gray-900 dark:text-gray-200">{property.SchoolDistrictName}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {property.PublicRemarks ? (
                        <DescriptionSection 
                          description={property.PublicRemarks} 
                          details={property}
                        />
                      ) : (
                        <p className="text-gray-400 italic">No description available for this listing.</p>
                      )}
                    </div>
                  </div>

                  {/* Comments Sidebar */}
                  <div className="lg:col-span-1">
                    <div className="bg-white dark:bg-[#151517] rounded-3xl p-8 border border-gray-200 dark:border-gray-800 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] h-full">
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight leading-none">COMMENTS</h3>
                        <div className="bg-[#C9A24D] text-white text-[10px] font-black px-2 py-1 rounded-md">
                          {property.comments?.length || 0}
                        </div>
                      </div>

                      <div ref={commentsContainerRef} className="space-y-6 mb-8 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
                        {property.comments && property.comments.length > 0 ? (
                          property.comments.map((comment) => (
                            <div key={comment.id} className="pb-4 border-b border-gray-100 dark:border-gray-800 last:border-0 last:pb-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-wider">{comment.author}</span>
                                <span className="text-[9px] font-bold text-gray-400">{formatDate(comment.createdAt)}</span>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
                                {comment.content}
                              </p>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-12">
                            <MessageCircle className="mx-auto text-gray-300 dark:text-gray-800 mb-4" size={40} />
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No comments yet</p>
                          </div>
                        )}
                      </div>

                      <form onSubmit={handleSubmitComment} className="space-y-4">
                        <textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Type your message to the agent..."
                          className="w-full px-4 py-4 bg-gray-50 dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all resize-none"
                          rows={3}
                          disabled={isSubmittingComment}
                        />
                        <button
                          type="submit"
                          disabled={!newComment.trim() || isSubmittingComment}
                          className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black py-4 rounded-2xl transition-all hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] hover:text-white uppercase tracking-widest text-[10px] disabled:opacity-50 shadow-md"
                        >
                          {isSubmittingComment ? 'Sending...' : 'Send Message'}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>

                {/* Technical Report Section */}
                <section className="pt-8">
                  {!isLoadingDetails && !detailsError && (
                    <PropertyReport 
                      property={property as PropertyDetailResponse} 
                    />
                  )}
                </section>

                {/* Enhanced Compliance Footer */}
                <footer className="border-t border-gray-100 dark:border-gray-800 pt-12 pb-20 text-center space-y-4">
                  <div className="inline-block px-4 py-2 bg-gray-50 dark:bg-[#151517] rounded-full border border-gray-100 dark:border-gray-800">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Last Updated: {property.updated_at 
                        ? new Date(property.updated_at).toLocaleString()
                        : new Date().toLocaleString()}
                    </p>
                  </div>
                  <div className="max-w-3xl mx-auto space-y-4">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Information Deemed Reliable But Not Guaranteed.</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-600 leading-relaxed px-4">
                      The data relating to real estate for sale on this website appears in part through the BRIGHT Internet Data Exchange program, a voluntary cooperative exchange of property listing data between licensed real estate brokerage firms in which participates, and is provided by BRIGHT through a licensing agreement.
                    </p>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] pt-4">
                      © {new Date().getFullYear()} Bright MLS • All Rights Reserved
                    </p>
                  </div>
                </footer>

              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
