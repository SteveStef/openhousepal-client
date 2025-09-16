'use client'

import { useState, useEffect, useCallback } from 'react'
import { Property, Comment } from '@/types'
import { X, MessageCircle, Send, ThumbsUp, ThumbsDown, Bookmark, ChevronLeft, ChevronRight, Maximize2, Home, User } from 'lucide-react'

interface PropertyDetailsModalProps {
  property: Property | null
  isOpen: boolean
  onClose: () => void
  onLike?: (propertyId: number, liked: boolean) => void
  onDislike?: (propertyId: number, disliked: boolean) => void
  onFavorite?: (propertyId: number, favorited: boolean) => void
  onAddComment?: (propertyId: number, comment: string) => void
  isLoadingDetails?: boolean
  detailsError?: string | null
  onRetryDetails?: () => void
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

      {/* Report Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b-2 border-gray-200">
              <th className="px-8 py-4 text-left text-sm font-semibold text-gray-900 uppercase tracking-wider w-1/2">
                Property
              </th>
              <th className="px-8 py-4 text-left text-sm font-semibold text-gray-900 uppercase tracking-wider w-1/2">
                Details
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, index) => (
              <tr
                key={index}
                className={`
                  ${row.isHeader 
                    ? 'bg-gray-800 border-t-2 border-gray-300' 
                    : index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  }
                  border-b border-gray-200 ${!row.isHeader ? 'hover:bg-gray-100 transition-colors duration-150' : ''}
                `}
              >
                {row.isHeader ? (
                  <td 
                    colSpan={2} 
                    className="px-8 py-4 font-bold text-white text-sm uppercase tracking-wide text-center"
                  >
                    {row.property}
                  </td>
                ) : (
                  <>
                    <td className="px-8 py-4 font-medium text-gray-900">
                      {row.property}
                    </td>
                    <td className="px-8 py-4 text-gray-700">
                      {row.value}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
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
  onRetryDetails
}: PropertyDetailsModalProps) {
  const [newComment, setNewComment] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)

  // Enhanced photo handling for Zillow API data
  const getPropertyImages = useCallback(() => {
    if (property?.details?.originalPhotos && property.details.originalPhotos.length > 0) {
      // Use high-quality photos from Zillow API
      return property.details.originalPhotos
        .map(photo => photo.mixedSources?.jpeg?.[0]?.url || photo.mixedSources?.webp?.[0]?.url)
        .filter(Boolean) as string[]
    }
    // Fallback to basic images
    return (property?.images || [property?.imageUrl].filter(Boolean)) as string[]
  }, [property])
  
  const images = getPropertyImages()
  
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

  console.log(property);
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
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
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
      onAddComment?.(Number(property.id), newComment.trim())
      setNewComment('')
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
          <img
            src={images[currentImageIndex]}
            alt={`${property.address} - Image ${currentImageIndex + 1}`}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          
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
                {property.details?.address?.streetAddress || property.address}
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                {property.details?.city || property.city}, {property.details?.address?.state || property.state} {property.details?.address?.zipcode || property.zipCode}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {property.details?.homeStatus && (
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                  property.details.homeStatus === 'forSale' 
                    ? 'bg-green-100 text-green-800' 
                    : property.details.homeStatus === 'forRent'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {property.details.homeStatus === 'forSale' ? 'For Sale' :
                   property.details.homeStatus === 'forRent' ? 'For Rent' :
                   property.details.homeStatus === 'recentlySold' ? 'Recently Sold' :
                   property.details.homeStatus}
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
                            <img
                              src={images[currentImageIndex]}
                              alt={`${property.address} - Image ${currentImageIndex + 1}`}
                              className="w-full h-full object-cover cursor-pointer"
                              onClick={() => setIsLightboxOpen(true)}
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
                            {property.details?.originalPhotos?.[currentImageIndex]?.caption && (
                              <div className="absolute bottom-20 left-4 right-4 bg-black/70 text-white text-sm p-3 rounded-lg">
                                {property.details.originalPhotos[currentImageIndex].caption}
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
                                className={`flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-3 transition-colors duration-150 ${
                                  index === currentImageIndex 
                                    ? 'border-blue-500 ring-2 ring-blue-200 shadow-md' 
                                    : 'border-gray-200 hover:border-gray-400'
                                }`}
                              >
                                <img
                                  src={imageUrl}
                                  alt={`Thumbnail ${index + 1}`}
                                  className="w-full h-full object-cover"
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
                            {formatPrice(property.details?.price || property.price)}
                          </div>
                          <div className="text-gray-600 text-sm mb-2">List Price</div>
                          {property.details?.resoFacts?.pricePerSquareFoot && (
                            <div className="text-gray-500 text-xs mb-4">${property.details.resoFacts.pricePerSquareFoot}/sq ft</div>
                          )}
                          {property.details?.zestimate && (
                            <div className="bg-blue-50 rounded-lg p-4 mt-3">
                              <div className="text-xl font-semibold text-blue-900 mb-1">
                                {formatPrice(property.details.zestimate)}
                              </div>
                              <div className="text-blue-700 text-xs mb-2">Zestimate®</div>
                              {(() => {
                                const listPrice = property.details?.price || property.price;
                                const zestimate = property.details.zestimate;
                                if (listPrice && zestimate) {
                                  const difference = zestimate - listPrice;
                                  const percentDiff = ((difference / listPrice) * 100).toFixed(1);
                                  return (
                                    <div className={`text-xs font-medium ${difference > 0 ? 'text-green-700' : difference < 0 ? 'text-red-700' : 'text-gray-700'}`}>
                                      {difference > 0 ? '+' : ''}{formatPrice(difference)} ({difference > 0 ? '+' : ''}{percentDiff}% vs list)
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          )}
                        </div>
                        
                        {/* Property Specs */}
                        <div className="grid grid-cols-3 gap-4 mb-8">
                          <div className="text-center">
                            <div className="text-3xl font-bold text-gray-900 mb-1">
                              {property.details?.bedrooms || property.beds || '-'}
                            </div>
                            <div className="text-gray-600 text-sm">Beds</div>
                          </div>
                          <div className="text-center">
                            <div className="text-3xl font-bold text-gray-900 mb-1">
                              {property.details?.bathrooms || property.baths || '-'}
                            </div>
                            <div className="text-gray-600 text-sm">Baths</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-gray-900 mb-1">
                              {((property.details?.livingArea || property.squareFeet || 0) / 1000).toFixed(1)}k
                            </div>
                            <div className="text-gray-600 text-sm">Sq Ft</div>
                          </div>
                        </div>
                        
                        {/* Key Details */}
                        <div className="space-y-3 text-sm border-t pt-6 mb-8">
                          {(property.details?.homeType || property.propertyType) && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Home Type:</span>
                              <span className="text-gray-900 font-medium">
                                {property.details?.homeType?.replace(/_/g, ' ') || property.propertyType?.replace(/_/g, ' ')}
                              </span>
                            </div>
                          )}
                          {(property.details?.yearBuilt || property.yearBuilt) && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Year Built:</span>
                              <span className="text-gray-900 font-medium">
                                {property.details?.yearBuilt || property.yearBuilt}
                              </span>
                            </div>
                          )}
                          {property.details?.resoFacts?.pricePerSquareFoot && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Price/Sq Ft:</span>
                              <span className="text-gray-900 font-medium">
                                ${property.details.resoFacts.pricePerSquareFoot}
                              </span>
                            </div>
                          )}
                          {property.details?.resoFacts?.stories && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Stories:</span>
                              <span className="text-gray-900 font-medium">{property.details.resoFacts.stories}</span>
                            </div>
                          )}
                          {property.details?.lotSize && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Lot Size:</span>
                              <span className="text-gray-900 font-medium">
                                {(property.details.lotSize / 43560).toFixed(2)} acres
                              </span>
                            </div>
                          )}
                          {(property.details?.daysOnZillow || property.details?.resoFacts?.atAGlanceFacts?.find(fact => fact.factLabel === 'Days on Zillow')?.factValue) && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Days on Market:</span>
                              <span className="text-gray-900 font-medium">
                                {property.details?.daysOnZillow || property.details?.resoFacts?.atAGlanceFacts?.find(fact => fact.factLabel === 'Days on Zillow')?.factValue}
                              </span>
                            </div>
                          )}
                          {property.details?.resoFacts?.propertyCondition && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Condition:</span>
                              <span className="text-gray-900 font-medium">{property.details.resoFacts.propertyCondition}</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-2">
                            <button 
                              onClick={() => onLike?.(Number(property.id!), !property.liked)}
                              className={`flex flex-col items-center p-3 rounded-xl transition-all ${
                                property.liked 
                                  ? 'bg-green-100 text-green-600' 
                                  : 'bg-gray-50 text-gray-400 hover:bg-green-50 hover:text-green-500'
                              }`}
                            >
                              <ThumbsUp size={20} fill={property.liked ? "currentColor" : "none"} />
                              <span className="text-xs mt-1 font-medium">Like</span>
                            </button>
                            <button 
                              onClick={() => onFavorite?.(Number(property.id!), !property.favorited)}
                              className={`flex flex-col items-center p-3 rounded-xl transition-all ${
                                property.favorited 
                                  ? 'bg-amber-100 text-amber-600' 
                                  : 'bg-gray-50 text-gray-400 hover:bg-amber-50 hover:text-amber-500'
                              }`}
                            >
                              <Bookmark size={20} fill={property.favorited ? "currentColor" : "none"} />
                              <span className="text-xs mt-1 font-medium">Save</span>
                            </button>
                            <button 
                              onClick={() => onDislike?.(Number(property.id!), !property.disliked)}
                              className={`flex flex-col items-center p-3 rounded-xl transition-all ${
                                property.disliked 
                                  ? 'bg-red-100 text-red-600' 
                                  : 'bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500'
                              }`}
                            >
                              <ThumbsDown size={20} fill={property.disliked ? "currentColor" : "none"} />
                              <span className="text-xs mt-1 font-medium">Pass</span>
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
                        {property.details?.resoFacts?.subdivisionName && (
                          <div className="flex justify-between py-2 border-b border-gray-100">
                            <span className="text-gray-600 font-medium">Subdivision:</span>
                            <span className="text-gray-900 font-semibold">{property.details.resoFacts.subdivisionName}</span>
                          </div>
                        )}
                        {property.details?.resoFacts?.municipality && (
                          <div className="flex justify-between py-2 border-b border-gray-100">
                            <span className="text-gray-600 font-medium">Municipality:</span>
                            <span className="text-gray-900 font-semibold">{property.details.resoFacts.municipality}</span>
                          </div>
                        )}
                        {property.details?.resoFacts?.parcelNumber && (
                          <div className="flex justify-between py-2 border-b border-gray-100">
                            <span className="text-gray-600 font-medium">Parcel Number:</span>
                            <span className="text-gray-900 font-mono text-sm">{property.details.resoFacts.parcelNumber}</span>
                          </div>
                        )}
                        {property.details?.resoFacts?.zoning && (
                          <div className="flex justify-between py-2 border-b border-gray-100">
                            <span className="text-gray-600 font-medium">Zoning:</span>
                            <span className="text-gray-900 font-semibold">{property.details.resoFacts.zoning}</span>
                          </div>
                        )}
                        {property.details?.resoFacts?.ownership && (
                          <div className="flex justify-between py-2 border-b border-gray-100">
                            <span className="text-gray-600 font-medium">Ownership Type:</span>
                            <span className="text-gray-900 font-semibold">{property.details.resoFacts.ownership}</span>
                          </div>
                        )}
                        {property.details?.propertyTaxRate && (
                          <div className="flex justify-between py-2 border-b border-gray-100">
                            <span className="text-gray-600 font-medium">Tax Rate:</span>
                            <span className="text-gray-900 font-semibold">{property.details.propertyTaxRate}%</span>
                          </div>
                        )}
                        
                        {/* Description Field - Full Width */}
                        {property.details?.description && (
                          <DescriptionSection description={property.details.description} />
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
                      <div className="space-y-4 mb-6 max-h-64 overflow-y-auto">
                        {property.comments && property.comments.length > 0 ? (
                          property.comments.map((comment, index) => (
                            <div key={comment.id} className="bg-white rounded-2xl p-4 border border-indigo-100">
                              <div className="flex items-start">
                                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-2 rounded-full mr-3 flex-shrink-0">
                                  <User className="text-white" size={14} />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-gray-900 text-sm">{comment.author}</span>
                                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{formatDate(comment.createdAt)}</span>
                                  </div>
                                  <p className="text-gray-700 leading-relaxed text-sm">{comment.content}</p>
                                </div>
                              </div>
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
                        <h4 className="text-md font-bold text-gray-900 mb-3 flex items-center">
                          <div className="bg-purple-100 p-2 rounded-lg mr-2">
                            <Send className="text-purple-600" size={14} />
                          </div>
                          Add Comment
                        </h4>
                        <form onSubmit={handleSubmitComment} className="space-y-3">
                          <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Share your thoughts about this property..."
                            className="w-full px-4 py-3 bg-white border-2 border-indigo-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none text-sm"
                            rows={3}
                            disabled={isSubmittingComment}
                          />
                          <div className="flex justify-end">
                            <button
                              type="submit"
                              disabled={!newComment.trim() || isSubmittingComment}
                              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-300 disabled:text-gray-500 text-white font-medium py-2 px-4 rounded-xl transition-colors duration-150 flex items-center space-x-2 text-sm"
                            >
                              <Send size={14} />
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
              {!isLoadingDetails && !detailsError && property.details?.resoFacts && (
                <PropertyReport 
                  resoFacts={property.details.resoFacts} 
                  propertyAddress={property.details.abbreviatedAddress}
                />
              )}
              

            </div>
          </div>
          </div>
        </div>
    </>
  )
}
