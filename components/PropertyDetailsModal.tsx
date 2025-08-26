'use client'

import { useState } from 'react'
import { Property, Comment } from '@/types'
import { X, MessageCircle, Send, ThumbsUp, ThumbsDown, Bookmark, ChevronLeft, ChevronRight } from 'lucide-react'

interface PropertyDetailsModalProps {
  property: Property | null
  isOpen: boolean
  onClose: () => void
  onLike?: (propertyId: number, liked: boolean) => void
  onDislike?: (propertyId: number, disliked: boolean) => void
  onFavorite?: (propertyId: number, favorited: boolean) => void
  onAddComment?: (propertyId: number, comment: string) => void
}

export default function PropertyDetailsModal({
  property,
  isOpen,
  onClose,
  onLike,
  onDislike,
  onFavorite,
  onAddComment
}: PropertyDetailsModalProps) {
  const [newComment, setNewComment] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  if (!isOpen || !property) return null

  // Reset image index when property changes
  if (property && currentImageIndex >= (property.images?.length || 1)) {
    setCurrentImageIndex(0)
  }

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
      onAddComment?.(property.id, newComment.trim())
      setNewComment('')
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const images = property.images || [property.imageUrl].filter(Boolean)
  
  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length)
  }

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200/60 max-w-7xl w-full max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200/60">
          <h2 className="text-2xl font-bold text-gray-900">Property Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100/50 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(95vh-80px)]">
          {/* Property Information */}
          <div className="p-6 space-y-8">
            {/* First Row - Image Carousel and Quick Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Image Carousel */}
              <div className="lg:col-span-2">
                <div className="relative h-96 bg-gray-100 rounded-xl overflow-hidden">
                  {images.length > 0 ? (
                    <>
                      <img
                        src={images[currentImageIndex]}
                        alt={`${property.address} - Image ${currentImageIndex + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {images.length > 1 && (
                        <>
                          <button
                            onClick={prevImage}
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all duration-200"
                          >
                            <ChevronLeft size={20} />
                          </button>
                          <button
                            onClick={nextImage}
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all duration-200"
                          >
                            <ChevronRight size={20} />
                          </button>
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2">
                            {images.map((_, index) => (
                              <button
                                key={index}
                                onClick={() => setCurrentImageIndex(index)}
                                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                                  index === currentImageIndex 
                                    ? 'bg-white' 
                                    : 'bg-white/50 hover:bg-white/75'
                                }`}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1"></path>
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column - Property Stats */}
              <div>
                <div className="bg-gray-50/60 rounded-xl p-6 h-96 border border-gray-200/40 flex flex-col">
                  <div className="mb-6">
                    <p className="text-gray-600 text-sm mb-2">
                      {property.city}, {property.state} {property.zipCode}
                    </p>
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">
                      {property.address}
                    </h3>
                  </div>

                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h4>
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-[#8b7355]">{formatPrice(property.price)}</div>
                      <div className="text-gray-600 text-sm">List Price</div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3 text-center">
                      {property.beds && (
                        <div className="bg-white/60 rounded-lg p-4 border border-gray-200/30">
                          <div className="text-2xl font-bold text-gray-900">{property.beds}</div>
                          <div className="text-gray-600 text-sm">Beds</div>
                        </div>
                      )}
                      {property.baths && (
                        <div className="bg-white/60 rounded-lg p-4 border border-gray-200/30">
                          <div className="text-2xl font-bold text-gray-900">{property.baths}</div>
                          <div className="text-gray-600 text-sm">Baths</div>
                        </div>
                      )}
                      {property.squareFeet && (
                        <div className="bg-white/60 rounded-lg p-4 border border-gray-200/30">
                          <div className="text-xl font-bold text-gray-900">{(property.squareFeet / 1000).toFixed(1)}k</div>
                          <div className="text-gray-600 text-sm">Sq Ft</div>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              </div>
            </div>

            {/* Second Row - Property Details and Comments */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column - Property Details & Description */}
              <div>
                {/* Property Description */}
                {property.description && (
                  <div className="mb-6">
                    <h4 className="text-xl font-semibold text-gray-900 mb-3">Description</h4>
                    <p className="text-gray-700 leading-relaxed">{property.description}</p>
                  </div>
                )}

                {/* Detailed Property Information */}
                <div className="bg-gray-50/60 rounded-xl p-6 border border-gray-200/40">
                  <h4 className="text-xl font-semibold text-gray-900 mb-4">Property Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">LISTING UPDATED:</span>
                        <span className="text-gray-900 text-xs">{formatListingDate(property.listingUpdated)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">MLS #</span>
                        <span className="text-gray-900">{property.mlsNumber || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Taxes</span>
                        <span className="text-gray-900">{formatTaxes(property.taxes)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">HOA Fees</span>
                        <span className="text-gray-900">{formatCurrency(property.hoaFees)}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Condo/Co-op Fees</span>
                        <span className="text-gray-900">{formatCurrency(property.condoCoopFees)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">MLS Type</span>
                        <span className="text-gray-900">{property.mlsType || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">County</span>
                        <span className="text-gray-900">{property.county || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Property Status and Actions */}
                <div className="bg-gray-50/60 rounded-xl p-6 border border-gray-200/40 mt-6">
                  <h4 className="text-xl font-semibold text-gray-900 mb-4">Property Status & Actions</h4>
                  
                  {/* Status Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-6">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Status</span>
                        <span className="text-green-600">{property.status || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Days on Market</span>
                        <span className="text-gray-900">{property.daysOnMarket || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Year Built</span>
                        <span className="text-gray-900">{property.yearBuilt || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Lot Size</span>
                        <span className="text-gray-900">{formatLotSize(property.lotSizeAcres, property.lotSizeSquareFeet)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Property Type</span>
                        <span className="text-gray-900">{property.compassType || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Property Actions */}
                  <div className="border-t border-gray-200/60 pt-4">
                    <h5 className="text-lg font-medium text-gray-900 mb-3">Your Feedback</h5>
                    <div className="flex items-center justify-center space-x-6">
                      <button 
                        onClick={() => onLike?.(property.id!, !property.liked)}
                        className={`flex flex-col items-center transition-colors p-4 rounded-xl hover:bg-gray-100/60 ${
                          property.liked 
                            ? 'text-green-500 hover:text-green-600' 
                            : 'text-gray-400 hover:text-green-500'
                        }`}
                      >
                        <ThumbsUp 
                          size={24} 
                          fill={property.liked ? "currentColor" : "none"}
                        />
                        <span className="text-sm mt-1 font-medium">Like</span>
                      </button>
                      <button 
                        onClick={() => onDislike?.(property.id!, !property.disliked)}
                        className={`flex flex-col items-center transition-colors p-4 rounded-xl hover:bg-gray-100/60 ${
                          property.disliked 
                            ? 'text-red-500 hover:text-red-600' 
                            : 'text-gray-400 hover:text-red-500'
                        }`}
                      >
                        <ThumbsDown 
                          size={24} 
                          fill={property.disliked ? "currentColor" : "none"}
                        />
                        <span className="text-sm mt-1 font-medium">Dislike</span>
                      </button>
                      <button 
                        onClick={() => onFavorite?.(property.id!, !property.favorited)}
                        className={`flex flex-col items-center transition-colors p-4 rounded-xl hover:bg-gray-100/60 ${
                          property.favorited 
                            ? 'text-amber-500 hover:text-amber-600' 
                            : 'text-gray-400 hover:text-amber-500'
                        }`}
                      >
                        <Bookmark 
                          size={24} 
                          fill={property.favorited ? "currentColor" : "none"}
                        />
                        <span className="text-sm mt-1 font-medium">Save</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Comments Section */}
              <div>
                <div className="bg-gray-50/60 rounded-xl p-6 h-fit border border-gray-200/40">
                  <div className="flex items-center space-x-2 mb-6">
                    <MessageCircle size={20} className="text-[#8b7355]" />
                    <h4 className="text-xl font-semibold text-gray-900">
                      Comments ({property.comments?.length || 0})
                    </h4>
                  </div>

                  {/* Comments List */}
                  <div className="space-y-4 mb-6 max-h-80 overflow-y-auto">
                    {property.comments && property.comments.length > 0 ? (
                      property.comments.map((comment) => (
                        <div key={comment.id} className="bg-white/60 rounded-lg p-4 border border-gray-200/30">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-900 text-sm">{comment.author}</span>
                            <span className="text-xs text-gray-600">{formatDate(comment.createdAt)}</span>
                          </div>
                          <p className="text-gray-700 text-sm leading-relaxed">{comment.content}</p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <MessageCircle size={32} className="text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-600">No comments yet</p>
                        <p className="text-gray-500 text-sm">Be the first to add a comment!</p>
                      </div>
                    )}
                  </div>

                  {/* Add Comment Form */}
                  <form onSubmit={handleSubmitComment} className="space-y-3">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment..."
                      className="w-full px-3 py-2 bg-white/60 border border-gray-200/50 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8b7355]/60 focus:border-[#8b7355]/60 transition-all duration-300 resize-none text-sm"
                      rows={3}
                      disabled={isSubmittingComment}
                    />
                    <button
                      type="submit"
                      disabled={!newComment.trim() || isSubmittingComment}
                      className="w-full bg-[#8b7355] hover:bg-[#7a6549] disabled:bg-zinc-700 disabled:text-zinc-400 text-white font-medium py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center space-x-2 text-sm"
                    >
                      <Send size={16} />
                      <span>{isSubmittingComment ? 'Adding...' : 'Add Comment'}</span>
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}