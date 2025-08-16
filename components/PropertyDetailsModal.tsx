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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800/60 max-w-7xl w-full max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800/40">
          <h2 className="text-2xl font-bold text-white">Property Details</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors p-2 hover:bg-zinc-800/50 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(95vh-80px)]">
          {/* Property Information */}
          <div className="p-6 space-y-8">
            {/* First Row - Image Carousel and Quick Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column - Image Carousel */}
              <div>
                <div className="relative aspect-square bg-zinc-800/60 rounded-xl overflow-hidden">
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
                      <svg className="w-16 h-16 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1"></path>
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column - Property Stats */}
              <div>
                <div className="bg-zinc-800/20 rounded-xl p-6 h-full">
                  <div className="mb-6">
                    <p className="text-zinc-400 text-sm mb-2">
                      {property.city}, {property.state} {property.zipCode}
                    </p>
                    <h3 className="text-2xl font-bold text-white mb-4">
                      {property.address}
                    </h3>
                  </div>

                  <h4 className="text-lg font-semibold text-white mb-4">Quick Stats</h4>
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-400">{formatPrice(property.price)}</div>
                      <div className="text-zinc-400 text-sm">List Price</div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3 text-center">
                      {property.beds && (
                        <div className="bg-zinc-700/30 rounded-lg p-4">
                          <div className="text-2xl font-bold text-white">{property.beds}</div>
                          <div className="text-zinc-400 text-sm">Beds</div>
                        </div>
                      )}
                      {property.baths && (
                        <div className="bg-zinc-700/30 rounded-lg p-4">
                          <div className="text-2xl font-bold text-white">{property.baths}</div>
                          <div className="text-zinc-400 text-sm">Baths</div>
                        </div>
                      )}
                      {property.squareFeet && (
                        <div className="bg-zinc-700/30 rounded-lg p-4">
                          <div className="text-xl font-bold text-white">{(property.squareFeet / 1000).toFixed(1)}k</div>
                          <div className="text-zinc-400 text-sm">Sq Ft</div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Status</span>
                        <span className="text-green-300">{property.status || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Days on Market</span>
                        <span className="text-white">{property.daysOnMarket || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Year Built</span>
                        <span className="text-white">{property.yearBuilt || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Lot Size</span>
                        <span className="text-white">{formatLotSize(property.lotSizeAcres, property.lotSizeSquareFeet)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Property Type</span>
                        <span className="text-white">{property.compassType || 'N/A'}</span>
                      </div>
                    </div>

                    {/* Property Actions */}
                    <div className="flex items-center justify-center space-x-4 pt-4 border-t border-zinc-700/30">
                      <button 
                        onClick={() => onLike?.(property.id!, !property.liked)}
                        className={`flex items-center transition-colors p-3 rounded-lg hover:bg-zinc-700/30 ${
                          property.liked 
                            ? 'text-green-400 hover:text-green-300' 
                            : 'text-zinc-400 hover:text-green-400'
                        }`}
                      >
                        <ThumbsUp 
                          size={24} 
                          fill={property.liked ? "currentColor" : "none"}
                        />
                      </button>
                      <button 
                        onClick={() => onDislike?.(property.id!, !property.disliked)}
                        className={`flex items-center transition-colors p-3 rounded-lg hover:bg-zinc-700/30 ${
                          property.disliked 
                            ? 'text-red-400 hover:text-red-300' 
                            : 'text-zinc-400 hover:text-red-400'
                        }`}
                      >
                        <ThumbsDown 
                          size={24} 
                          fill={property.disliked ? "currentColor" : "none"}
                        />
                      </button>
                      <button 
                        onClick={() => onFavorite?.(property.id!, !property.favorited)}
                        className={`flex items-center transition-colors p-3 rounded-lg hover:bg-zinc-700/30 ${
                          property.favorited 
                            ? 'text-amber-400 hover:text-amber-300' 
                            : 'text-zinc-400 hover:text-amber-400'
                        }`}
                      >
                        <Bookmark 
                          size={24} 
                          fill={property.favorited ? "currentColor" : "none"}
                        />
                      </button>
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
                    <h4 className="text-xl font-semibold text-white mb-3">Description</h4>
                    <p className="text-zinc-300 leading-relaxed">{property.description}</p>
                  </div>
                )}

                {/* Detailed Property Information */}
                <div className="bg-zinc-800/20 rounded-xl p-6">
                  <h4 className="text-xl font-semibold text-white mb-4">Property Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-zinc-400">LISTING UPDATED:</span>
                        <span className="text-white text-xs">{formatListingDate(property.listingUpdated)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">MLS #</span>
                        <span className="text-white">{property.mlsNumber || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Taxes</span>
                        <span className="text-white">{formatTaxes(property.taxes)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">HOA Fees</span>
                        <span className="text-white">{formatCurrency(property.hoaFees)}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Condo/Co-op Fees</span>
                        <span className="text-white">{formatCurrency(property.condoCoopFees)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">MLS Type</span>
                        <span className="text-white">{property.mlsType || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">County</span>
                        <span className="text-white">{property.county || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Comments Section */}
              <div>
                <div className="bg-zinc-800/20 rounded-xl p-6 h-fit">
                  <div className="flex items-center space-x-2 mb-6">
                    <MessageCircle size={20} className="text-blue-400" />
                    <h4 className="text-xl font-semibold text-white">
                      Comments ({property.comments?.length || 0})
                    </h4>
                  </div>

                  {/* Comments List */}
                  <div className="space-y-4 mb-6 max-h-80 overflow-y-auto">
                    {property.comments && property.comments.length > 0 ? (
                      property.comments.map((comment) => (
                        <div key={comment.id} className="bg-zinc-700/30 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-white text-sm">{comment.author}</span>
                            <span className="text-xs text-zinc-400">{formatDate(comment.createdAt)}</span>
                          </div>
                          <p className="text-zinc-300 text-sm leading-relaxed">{comment.content}</p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <MessageCircle size={32} className="text-zinc-500 mx-auto mb-2" />
                        <p className="text-zinc-400">No comments yet</p>
                        <p className="text-zinc-500 text-sm">Be the first to add a comment!</p>
                      </div>
                    )}
                  </div>

                  {/* Add Comment Form */}
                  <form onSubmit={handleSubmitComment} className="space-y-3">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment..."
                      className="w-full px-3 py-2 bg-zinc-700/40 border border-zinc-600/50 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400/60 transition-all duration-300 resize-none text-sm"
                      rows={3}
                      disabled={isSubmittingComment}
                    />
                    <button
                      type="submit"
                      disabled={!newComment.trim() || isSubmittingComment}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-400 text-white font-medium py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center space-x-2 text-sm"
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