'use client'

import Image from 'next/image'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Property } from '@/types'
import { X, MessageCircle, Send, ThumbsUp, ThumbsDown, Star, ChevronLeft, ChevronRight, Maximize2, Home, User } from 'lucide-react'

interface PropertyDetailsModalProps {
  property: Property | null
  isOpen: boolean
  onClose: () => void
  onLike?: (propertyId: string | number, liked: boolean) => void
  onDislike?: (propertyId: string | number, disliked: boolean) => void
  onFavorite?: (propertyId: string | number, favorited: boolean) => void
  onAddComment?: (propertyId: string | number, comment: string) => void
  isLoadingDetails?: boolean
  detailsError?: string | null
  onRetryDetails?: () => void
  isLoadingComments?: boolean
  commentsError?: string | null
}

// Property Report Table Component
function PropertyReport({ resoFacts, propertyAddress }: { resoFacts: any, propertyAddress?: string }) {
  const formatList = (items: string[] | null | undefined): string | null => {
    if (!items || items.length === 0) return null;
    return items.join(", ");
  };

  const formatCurrency = (amount: number | null | undefined): string | null => {
    if (!amount) return null;
    return `$${amount.toLocaleString()}`;
  };

  const allReportData = [
    // Building & Construction
    { property: "BUILDING & CONSTRUCTION", value: "", isHeader: true },
    { property: "Year Built", value: resoFacts.yearBuilt },
    { property: "Architectural Style", value: resoFacts.architecturalStyle },
    { property: "Construction Materials", value: formatList(resoFacts.constructionMaterials) },
    { property: "Stories", value: resoFacts.stories },
    { property: "Square Footage", value: resoFacts.livingArea },

    // Interior Features
    { property: "INTERIOR FEATURES", value: "", isHeader: true },
    { property: "Appliances", value: formatList(resoFacts.appliances) },
    { property: "Interior Features", value: formatList(resoFacts.interiorFeatures) },
    { property: "Flooring", value: formatList(resoFacts.flooring) },
    { property: "Window Features", value: formatList(resoFacts.windowFeatures) },
    { property: "Fireplace Features", value: formatList(resoFacts.fireplaceFeatures) },

    // HVAC & Systems
    { property: "HVAC & SYSTEMS", value: "", isHeader: true },
    { property: "Heating", value: formatList(resoFacts.heating) },
    { property: "Cooling", value: formatList(resoFacts.cooling) },
    { property: "Water Source", value: formatList(resoFacts.waterSource) },
    { property: "Sewer", value: formatList(resoFacts.sewer) },
    { property: "Electric", value: formatList(resoFacts.electric) },

    // Parking & Access
    { property: "PARKING & ACCESS", value: "", isHeader: true },
    { property: "Total Parking", value: resoFacts.parkingCapacity ? `${resoFacts.parkingCapacity} spaces` : null },
    { property: "Garage Parking", value: resoFacts.garageParkingCapacity ? `${resoFacts.garageParkingCapacity} spaces` : null },
    { property: "Parking Features", value: formatList(resoFacts.parkingFeatures) },
    { property: "Accessibility Features", value: formatList(resoFacts.accessibilityFeatures) },

    // HOA & Fees (only if has association)
    ...(resoFacts.hasAssociation ? [
      { property: "HOA & FEES", value: "", isHeader: true },
      { property: "HOA Fee", value: resoFacts.hoaFee },
      { property: "Annual Property Tax", value: formatCurrency(resoFacts.taxAnnualAmount) },
      { property: "HOA Includes", value: formatList(resoFacts.associationFeeIncludes) },
    ] : []),

    // Schools & District
    { property: "SCHOOLS & DISTRICT", value: "", isHeader: true },
    { property: "Elementary School", value: resoFacts.elementarySchool ? `${resoFacts.elementarySchool}${resoFacts.elementarySchoolDistrict ? ` (${resoFacts.elementarySchoolDistrict} District)` : ''}` : null },
    { property: "Middle School", value: resoFacts.middleOrJuniorSchool ? `${resoFacts.middleOrJuniorSchool}${resoFacts.middleOrJuniorSchoolDistrict ? ` (${resoFacts.middleOrJuniorSchoolDistrict} District)` : ''}` : null },
    { property: "High School", value: resoFacts.highSchool ? `${resoFacts.highSchool}${resoFacts.highSchoolDistrict ? ` (${resoFacts.highSchoolDistrict} District)` : ''}` : null },

    // Additional Features
    { property: "ADDITIONAL FEATURES", value: "", isHeader: true },
    { property: "Exterior Features", value: formatList(resoFacts.exteriorFeatures) },
    { property: "Lot Features", value: formatList(resoFacts.lotFeatures) },
    { property: "Community Features", value: formatList(resoFacts.communityFeatures) },
    { property: "Security Features", value: formatList(resoFacts.securityFeatures) },
  ];

  // Filter out rows with null or empty values, but keep headers
  const reportData = allReportData.filter(row => row.isHeader || (row.value !== null && row.value !== undefined && row.value !== ''));

  // Filter out empty sections - keep headers only if they have data rows below them
  const filteredData = reportData.filter((row, index) => {
    if (!row.isHeader) return true; // Keep all data rows
    // For header rows, check if there are any actual data rows in the same section
    const nextRows = reportData.slice(index + 1);
    const hasDataInSection = nextRows.some((nextRow) => {
      if (nextRow.isHeader) return false; // Stop at next header
      return !nextRow.isHeader; // Only count actual data rows, not headers
    });
    return hasDataInSection;
  });

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
      {/* Report Header */}
      <div className="bg-gray-900 px-8 py-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Property Details Report</h2>
            <p className="text-gray-300 mt-1">Comprehensive Property Information</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-300">Generated</div>
            <div className="font-medium">{new Date().toLocaleDateString()}</div>
          </div>
        </div>
        {propertyAddress && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="text-sm text-gray-300">Property Address</div>
            <div className="font-medium">{propertyAddress}</div>
          </div>
        )}
      </div>

      {/* Report Content - Mobile Responsive Grid */}
      <div className="space-y-2 p-4 sm:p-6">
        {filteredData.map((row, index) => (
          row.isHeader ? (
            // Section Header
            <div
              key={index}
              className="bg-gray-800 px-4 sm:px-6 py-3 rounded-lg mt-4 first:mt-0"
            >
              <h3 className="font-bold text-white text-sm uppercase tracking-wide text-center">
                {row.property}
              </h3>
            </div>
          ) : (
            // Data Item Card
            <div
              key={index}
              className="bg-white hover:bg-gray-50 border border-gray-200 rounded-lg p-4 transition-colors duration-150"
            >
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <span className="font-medium text-gray-900 text-sm sm:text-base">
                  {row.property}
                </span>
                <span className="text-gray-700 text-sm sm:text-base break-words">
                  {row.value}
                </span>
              </div>
            </div>
          )
        ))}
      </div>

      {/* Report Footer */}
    </div>
  );
}

// Description component with truncation
function DescriptionSection({ description }: { description: string }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const maxLength = 532 // Maximum characters to show before truncating

  const shouldTruncate = description.length > maxLength
  const displayText = isExpanded || !shouldTruncate 
    ? description 
    : description.slice(0, maxLength) + '...'

  return (
    <div className="md:col-span-2 py-4 border-t border-gray-200 mt-4">
      <h4 className="text-gray-600 font-medium mb-3">Description:</h4>
      <div className="space-y-2">
        <p className="text-gray-900 leading-relaxed text-sm">{displayText}</p>
        {shouldTruncate && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors duration-200"
          >
            {isExpanded ? 'Show Less' : 'Show More'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function PropertyDetailsModal({
  property,
  isOpen,
  onClose,
  onLike,
  onDislike,
  onFavorite,
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
    if ((property?.details as any)?.originalPhotos && (property?.details as any)?.originalPhotos?.length > 0) {
      // Use high-quality photos from property data
      return (property?.details as any).originalPhotos
        .map((photo: any) => photo.mixedSources?.jpeg?.[0]?.url || photo.mixedSources?.webp?.[0]?.url)
        .filter(Boolean) as string[]
    }
    // Fallback to basic images
    return (property?.images || [property?.imageUrl].filter(Boolean)) as string[]
  }, [property])
  
  const images = getPropertyImages()

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

  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return 'Date unavailable'

      const date = new Date(dateString)

      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Date unavailable'
      }

      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch (error) {
      console.error('Error formatting date:', error)
      return 'Date unavailable'
    }
  }

  const formatListingDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    }) + ' ' + new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatCurrency = (amount?: number | null) => {
    if (amount === null || amount === undefined) return '-'
    return `$${amount.toLocaleString()}`
  }

  const formatTaxes = (amount?: number) => {
    if (!amount) return '-'
    return `${formatCurrency(amount)} / year`
  }

  const formatLotSize = (acres?: number, sqft?: number) => {
    if (!acres && !sqft) return '-'
    const parts = []
    if (acres) parts.push(`${acres} AC`)
    if (sqft) parts.push(`${sqft.toLocaleString()} SF`)
    return parts.join(' / ')
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
      // Scroll to bottom after adding comment
      setTimeout(() => scrollToBottom(), 100)
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const renderLightbox = () => {
    if (!isLightboxOpen || images.length === 0) return null
    
    const handleBackgroundClick = (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        setIsLightboxOpen(false)
      }
    }

    const handleCloseClick = (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsLightboxOpen(false)
    }
    
    return (
      <div 
        className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center"
        onClick={handleBackgroundClick}
      >
        <button
          onClick={handleCloseClick}
          className="absolute top-4 right-4 text-white hover:text-white p-3 rounded-full bg-black/40 hover:bg-black/60 transition-all z-[70] border border-white/20"
          type="button"
        >
          <X size={24} />
        </button>
        
        <div className="relative w-full h-full flex items-center justify-center p-8">
          <div className="relative w-full h-full" onClick={(e) => e.stopPropagation()}>
            <Image
              src={images[currentImageIndex]}
              alt={`${property.address} - Image ${currentImageIndex + 1}`}
              fill
              sizes="100vw"
              className="object-contain"
              quality={90}
              priority
            />
          </div>
          
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  prevImage()
                }}
                className="absolute left-8 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-4 rounded-full bg-black/20 hover:bg-black/40 transition-all"
                type="button"
              >
                <ChevronLeft size={32} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  nextImage()
                }}
                className="absolute right-8 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-4 rounded-full bg-black/20 hover:bg-black/40 transition-all"
                type="button"
              >
                <ChevronRight size={32} />
              </button>
            </>
          )}
          
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/80 text-sm">
            {currentImageIndex + 1} / {images.length}
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <>
      {renderLightbox()}
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" style={{transform: 'translate3d(0,0,0)'}}>
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200/60 max-w-7xl w-full max-h-[95vh] overflow-hidden" style={{contain: 'layout style', transform: 'translateZ(0)'}}>
          {/* Enhanced Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200/60 bg-gradient-to-r from-gray-50 to-white">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {(property.details as any)?.address?.streetAddress || property.address}
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                {(property.details as any)?.city || property.city}, {(property.details as any)?.address?.state || property.state} {(property.details as any)?.address?.zipcode || property.zipCode}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {(property.details as any)?.homeStatus && (
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                  (property.details as any).homeStatus === 'FOR_SALE' 
                    ? 'bg-green-100 text-green-800' 
                    : (property.details as any).homeStatus === 'FOR_RENT'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {(property.details as any).homeStatus === 'forSale' ? 'For Sale' :
                   (property.details as any).homeStatus === 'forRent' ? 'For Rent' :
                   (property.details as any).homeStatus === 'recentlySold' ? 'Recently Sold' :
                   (property.details as any)?.homeStatus?.replace("_", " ")}
                </span>
              )}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100/50 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          

          <div className="overflow-y-auto max-h-[calc(95vh-140px)] overscroll-contain" style={{transform: 'translate3d(0,0,0)', willChange: 'scroll-position'}}>
            <div className="p-6 space-y-8">
              {/* Loading State */}
              {isLoadingDetails && (
                <div className="text-center py-8">
                  <div className="inline-flex items-center space-x-2 text-blue-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                    <span className="text-sm font-medium">Loading additional property details...</span>
                  </div>
                </div>
              )}

              {/* Error State */}
              {detailsError && (
                <div className="text-center py-8 bg-red-50 rounded-2xl border border-red-200">
                  <div className="text-red-600 mb-4">
                    <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <p className="font-medium text-lg">{detailsError}</p>
                  </div>
                  {onRetryDetails && (
                    <button
                      onClick={onRetryDetails}
                      className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors duration-200 font-medium"
                    >
                      Try Again
                    </button>
                  )}
                </div>
              )}

              {/* Hero Section - Image Gallery and Key Stats */}
              <div className="space-y-8">
                  {/* Hero Section - Image and Key Info */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Enhanced Photo Gallery */}
                    <div className="lg:col-span-8">
                      <div className="relative h-[500px] bg-gray-100 rounded-2xl overflow-hidden group shadow-lg">
                        {images.length > 0 ? (
                          <>
                            <Image
                              src={images[currentImageIndex]}
                              alt={`${property.address} - Image ${currentImageIndex + 1}`}
                              fill
                              sizes="(max-width: 768px) 100vw, 80vw"
                              className="object-cover cursor-pointer"
                              onClick={() => setIsLightboxOpen(true)}
                              quality={85}
                              priority
                            />
                            
                            {/* Expand Button */}
                            <button
                              onClick={() => setIsLightboxOpen(true)}
                              className="absolute top-4 left-4 bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg transition-colors duration-150 opacity-0 group-hover:opacity-100"
                            >
                              <Maximize2 size={16} />
                            </button>
                            
                            {/* Photo Counter Badge */}
                            <div className="absolute top-4 right-4 bg-black/70 text-white text-sm px-3 py-1.5 rounded-full font-medium">
                              {currentImageIndex + 1} / {images.length}
                            </div>
                            
                            {/* Photo Caption */}
                            {(property.details as any)?.originalPhotos?.[currentImageIndex]?.caption && (
                              <div className="absolute bottom-20 left-4 right-4 bg-black/70 text-white text-sm p-3 rounded-lg">
                                {(property.details as any).originalPhotos[currentImageIndex].caption}
                              </div>
                            )}
                            
                            {/* Navigation */}
                            {images.length > 1 && (
                              <>
                                <button
                                  onClick={prevImage}
                                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 p-3 rounded-full shadow-lg transition-colors duration-150 opacity-0 group-hover:opacity-100"
                                >
                                  <ChevronLeft size={20} />
                                </button>
                                <button
                                  onClick={nextImage}
                                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 p-3 rounded-full shadow-lg transition-colors duration-150 opacity-0 group-hover:opacity-100"
                                >
                                  <ChevronRight size={20} />
                                </button>
                              </>
                            )}
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                            </svg>
                          </div>
                        )}
                      </div>
                      
                      {/* Enhanced Thumbnail Strip */}
                      {images.length > 1 && (
                        <div className="mt-6 relative">
                          <div className="flex space-x-3 overflow-x-auto pb-3 scrollbar-hide">
                            {images.map((imageUrl, index) => (
                              <button
                                key={index}
                                onClick={() => setCurrentImageIndex(index)}
                                className={`relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-3 transition-colors duration-150 ${
                                  index === currentImageIndex
                                    ? 'border-blue-500 ring-2 ring-blue-200 shadow-md'
                                    : 'border-gray-200 hover:border-gray-400'
                                }`}
                              >
                                <Image
                                  src={imageUrl}
                                  alt={`Thumbnail ${index + 1}`}
                                  fill
                                  sizes="80px"
                                  className="object-cover"
                                  quality={50}
                                  loading="lazy"
                                />
                              </button>
                            ))}
                          </div>
                          {/* Scroll Indicators */}
                          <div className="absolute -right-2 top-1/2 -translate-y-1/2 text-gray-400">
                            <ChevronRight size={16} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Price and Action Buttons Section */}
                    <div className="lg:col-span-4">
                      <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 h-fit">
                        {/* Price Section */}
                        <div className="text-center mb-8">
                          <div className="text-4xl font-bold text-gray-900 mb-2">
                            {formatPrice((property.details as any)?.price || property.price)}
                          </div>
                          <div className="text-gray-600 text-sm mb-2">List Price</div>
                          {(property.details as any)?.resoFacts?.pricePerSquareFoot && (
                            <div className="text-gray-500 text-xs mb-4">${(property.details as any).resoFacts.pricePerSquareFoot}/sq ft</div>
                          )}
                        </div>
                        
                        {/* Property Specs */}
                        <div className="grid grid-cols-3 gap-4 mb-8">
                          <div className="text-center">
                            <div className="text-3xl font-bold text-gray-900 mb-1">
                              {(property.details as any)?.bedrooms || property.beds || '-'}
                            </div>
                            <div className="text-gray-600 text-sm">Beds</div>
                          </div>
                          <div className="text-center">
                            <div className="text-3xl font-bold text-gray-900 mb-1">
                              {(property.details as any)?.bathrooms || property.baths || '-'}
                            </div>
                            <div className="text-gray-600 text-sm">Baths</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-gray-900 mb-1">
                              {(((property.details as any)?.livingArea || property.squareFeet || 0) / 1000).toFixed(1)}k
                            </div>
                            <div className="text-gray-600 text-sm">Sq Ft</div>
                          </div>
                        </div>
                        
                        {/* Key Details */}
                        <div className="space-y-3 text-sm border-t pt-6 mb-8">
                          {((property.details as any)?.homeType || property.propertyType) && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Home Type:</span>
                              <span className="text-gray-900 font-medium">
                                {(property.details as any)?.homeType?.replace(/_/g, ' ') || property.propertyType?.replace(/_/g, ' ')}
                              </span>
                            </div>
                          )}
                          {((property.details as any)?.yearBuilt || property.yearBuilt) && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Year Built:</span>
                              <span className="text-gray-900 font-medium">
                                {(property.details as any)?.yearBuilt || property.yearBuilt}
                              </span>
                            </div>
                          )}
                          {(property.details as any)?.resoFacts?.pricePerSquareFoot && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Price/Sq Ft:</span>
                              <span className="text-gray-900 font-medium">
                                ${(property.details as any).resoFacts.pricePerSquareFoot}
                              </span>
                            </div>
                          )}
                          {(property.details as any)?.resoFacts?.stories && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Stories:</span>
                              <span className="text-gray-900 font-medium">{(property.details as any).resoFacts.stories}</span>
                            </div>
                          )}
                          {(property.details as any)?.lotSize && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Lot Size:</span>
                              <span className="text-gray-900 font-medium">
                                {((property.details as any).lotSize / 43560).toFixed(2)} acres
                              </span>
                            </div>
                          )}
                          {((property.details as any)?.daysOnZillow || (property.details as any)?.resoFacts?.atAGlanceFacts?.find((fact: any) => fact.factLabel === 'Days on Zillow')?.factValue) && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Days on Market:</span>
                              <span className="text-gray-900 font-medium">
                                {(property.details as any)?.daysOnZillow || (property.details as any)?.resoFacts?.atAGlanceFacts?.find((fact: any) => fact.factLabel === 'Days on Zillow')?.factValue}
                              </span>
                            </div>
                          )}
                          {(property.details as any)?.resoFacts?.propertyCondition && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Condition:</span>
                              <span className="text-gray-900 font-medium">{(property.details as any).resoFacts.propertyCondition}</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              onClick={() => onLike?.(property.id!, !property.liked)}
                              className={`flex flex-col items-center p-2 rounded-xl transition-all ${
                                property.liked
                                  ? 'bg-green-100 text-green-600'
                                  : 'bg-gray-50 text-gray-400 hover:bg-green-50 hover:text-green-500'
                              }`}
                            >
                              <ThumbsUp size={18} fill={property.liked ? "currentColor" : "none"} />
                              <span className="text-xs mt-0.5 font-medium">Like</span>
                            </button>
                            <button
                              onClick={() => onFavorite?.(property.id!, !property.favorited)}
                              className={`flex flex-col items-center p-2 rounded-xl transition-all ${
                                property.favorited
                                  ? 'bg-amber-100 text-amber-600'
                                  : 'bg-gray-50 text-gray-400 hover:bg-amber-50 hover:text-amber-500'
                              }`}
                            >
                              <Star size={18} fill={property.favorited ? "currentColor" : "none"} />
                              <span className="text-xs mt-0.5 font-medium">Save</span>
                            </button>
                            <button
                              onClick={() => onDislike?.(property.id!, !property.disliked)}
                              className={`flex flex-col items-center p-2 rounded-xl transition-all ${
                                property.disliked
                                  ? 'bg-red-100 text-red-600'
                                  : 'bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500'
                              }`}
                            >
                              <ThumbsDown size={18} fill={property.disliked ? "currentColor" : "none"} />
                              <span className="text-xs mt-0.5 font-medium">Pass</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>


                {/* Property Overview and Comments Row */}
                <div className="flex flex-col lg:flex-row gap-8">
                  {/* Property Overview Section - 66.67% width */}
                  <div className="w-full lg:w-2/3">
                    <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
                      <h3 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center">
                        <div className="bg-orange-100 p-2 rounded-lg mr-3">
                          <Home className="text-orange-600" size={20} />
                        </div>
                        Property Overview
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {(property.details as any)?.resoFacts?.subdivisionName && (
                          <div className="flex justify-between py-2 border-b border-gray-100">
                            <span className="text-gray-600 font-medium">Subdivision:</span>
                            <span className="text-gray-900 font-semibold">{(property.details as any).resoFacts.subdivisionName}</span>
                          </div>
                        )}
                        {(property.details as any)?.resoFacts?.municipality && (
                          <div className="flex justify-between py-2 border-b border-gray-100">
                            <span className="text-gray-600 font-medium">Municipality:</span>
                            <span className="text-gray-900 font-semibold">{(property.details as any).resoFacts.municipality}</span>
                          </div>
                        )}
                        {((property.details as any)?.homeType || property.propertyType) && (
                          <div className="flex justify-between py-2 border-b border-gray-100">
                            <span className="text-gray-600 font-medium">Home Type:</span>
                            <span className="text-gray-900 font-semibold">{(property.details as any)?.homeType?.replace(/_/g, ' ') || property.propertyType?.replace(/_/g, ' ')}</span>
                          </div>
                        )}
                        {((property.details as any)?.yearBuilt || property.yearBuilt) && (
                          <div className="flex justify-between py-2 border-b border-gray-100">
                            <span className="text-gray-600 font-medium">Year Built:</span>
                            <span className="text-gray-900 font-semibold">{(property.details as any)?.yearBuilt || property.yearBuilt}</span>
                          </div>
                        )}
                        {(property.details as any)?.resoFacts?.pricePerSquareFoot && (
                          <div className="flex justify-between py-2 border-b border-gray-100">
                            <span className="text-gray-600 font-medium">Price/Square Feet:</span>
                            <span className="text-gray-900 font-semibold">${(property.details as any).resoFacts.pricePerSquareFoot}</span>
                          </div>
                        )}
                        {((property.details as any)?.livingArea || property.squareFeet) && (
                          <div className="flex justify-between py-2 border-b border-gray-100">
                            <span className="text-gray-600 font-medium">Square Footage:</span>
                            <span className="text-gray-900 font-semibold">{((property.details as any)?.livingArea || property.squareFeet)?.toLocaleString()} sq ft</span>
                          </div>
                        )}
                        
                        {/* Description Field - Full Width */}
                        {(property.details as any)?.description && (
                          <DescriptionSection description={(property.details as any).description} />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Comments Section - 33.33% width */}
                  <div className="w-full lg:w-1/3">
                    <div className="bg-gradient-to-br from-white to-indigo-50 rounded-3xl p-7 shadow-lg border border-indigo-100" style={{contain: 'layout style paint', transform: 'translateZ(0)'}}>
                      <div className="flex items-center mb-6">
                        <div className="bg-indigo-500 p-3 rounded-xl mr-4">
                          <MessageCircle className="text-white" size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">
                          Comments ({property.comments?.length || 0})
                        </h3>
                      </div>

                      {/* Comments List */}
                      <div ref={commentsContainerRef} className="space-y-4 mb-6 max-h-72 overflow-y-auto">
                        {isLoadingComments ? (
                          <div className="text-center py-8 bg-white rounded-2xl border border-indigo-100">
                            <div className="inline-flex items-center space-x-2 text-indigo-600">
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-600 border-t-transparent"></div>
                              <span className="text-sm font-medium">Loading comments...</span>
                            </div>
                          </div>
                        ) : commentsError ? (
                          <div className="text-center py-8 bg-red-50 rounded-2xl border border-red-200">
                            <div className="text-red-600 mb-3">
                              <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01"></path>
                              </svg>
                            </div>
                            <p className="text-red-600 text-sm font-medium">{commentsError}</p>
                          </div>
                        ) : property.comments && property.comments.length > 0 ? (
                          property.comments.map((comment, index) => (
                            <div key={comment.id} className="bg-white rounded-xl p-3 border border-indigo-100">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-bold text-gray-900 text-xs">{comment.author}</span>
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{formatDate(comment.createdAt)}</span>
                              </div>
                              <p className="text-gray-700 leading-snug text-xs">{comment.content}</p>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8 bg-white rounded-2xl border-2 border-dashed border-indigo-200">
                            <div className="bg-indigo-100 p-3 rounded-full w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                              <MessageCircle size={20} className="text-indigo-500" />
                            </div>
                            <h4 className="text-md font-bold text-gray-900 mb-2">No comments yet</h4>
                            <p className="text-gray-500 text-xs">Be the first to share your thoughts!</p>
                          </div>
                        )}
                      </div>

                      {/* Add Comment Form */}
                      <div className="border-t-2 border-indigo-100 pt-4">
                        <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center">
                          <div className="bg-purple-100 p-1.5 rounded-lg mr-2">
                            <Send className="text-purple-600" size={12} />
                          </div>
                          Send Comment to Agent
                        </h4>
                        <form onSubmit={handleSubmitComment} className="space-y-2">
                          <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Share your thoughts about this property..."
                            className="w-full px-3 py-2 bg-white border-2 border-indigo-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none text-sm"
                            rows={2}
                            disabled={isSubmittingComment}
                          />
                          <div className="flex justify-end">
                            <button
                              type="submit"
                              disabled={!newComment.trim() || isSubmittingComment}
                              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-300 disabled:text-gray-500 text-white font-medium py-1.5 px-3 rounded-xl transition-colors duration-150 flex items-center space-x-1.5 text-xs"
                            >
                              <Send size={12} />
                              <span>{isSubmittingComment ? 'Adding...' : 'Add Comment'}</span>
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Property Details Report - Professional Table Format */}
              {!isLoadingDetails && !detailsError && (property.details as any)?.resoFacts && (
                <PropertyReport 
                  resoFacts={(property.details as any).resoFacts} 
                  propertyAddress={(property.details as any).abbreviatedAddress}
                />
              )}
              

            </div>
          </div>
          </div>
        </div>
    </>
  )
}
