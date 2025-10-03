'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Collection, Property, Comment } from '@/types'
import { getToken } from '@/lib/auth'
import PropertyGrid from '@/components/PropertyGrid'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import PropertyDetailsModal from '@/components/PropertyDetailsModal'
import ScheduleTourModal, { TourRequest } from '@/components/ScheduleTourModal'

export default function CustomerShowcasePage() {
  const params = useParams()
  const [showcase, setShowcase] = useState<Collection | null>(null)
  const [matchedProperties, setMatchedProperties] = useState<Property[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  
  // Property filtering states
  const [activeTab, setActiveTab] = useState<'all' | 'liked' | 'disliked' | 'favorited'>('all')
  const [sortBy, setSortBy] = useState<'price' | 'beds' | 'squareFeet'>('price')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Modal states
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [isLoadingComments, setIsLoadingComments] = useState(false)
  const [commentsError, setCommentsError] = useState<string | null>(null)

  // Tour modal states
  const [selectedPropertyForTour, setSelectedPropertyForTour] = useState<Property | null>(null)
  const [isTourModalOpen, setIsTourModalOpen] = useState(false)

  const shareToken = params.shareToken as string

  // Simple API request helper for this page
  const apiRequest = async (endpoint: string, options: any = {}) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })
    
    return {
      status: response.status,
      data: response.ok ? await response.json() : null
    }
  }

  // Check authentication status on component mount
  useEffect(() => {
    const checkAuthStatus = () => {
      const token = getToken()
      setIsAuthenticated(!!token)
    }
    
    checkAuthStatus()
  }, [])

  useEffect(() => {
    const fetchCollection = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        // First get the showcase data to get visitor email
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/collections/shared/${shareToken}`)
        
        if (response.status === 404) {
          setError('Collection not found or not available for sharing')
          return
        }
        
        if (!response.ok) {
          throw new Error('Failed to fetch showcase')
        }
        
        const showcaseData = await response.json()
        
        // Backend will resolve visitor interactions based on showcase context
        // No need to pass visitor_email in URL (security risk)
        setShowcase(showcaseData)
        
        // Extract properties and set them in separate state
        if (showcaseData.matchedProperties) {
          setMatchedProperties(showcaseData.matchedProperties)
        }
        
      } catch (err) {
        setError('Failed to load showcase. Please try again.')
        console.error('Error fetching showcase:', err)
      } finally {
        setIsLoading(false)
      }
    }

    if (shareToken) {
      fetchCollection()
    }
  }, [shareToken])

  // Filter and sort properties based on tabs and sorting
  const getFilteredProperties = () => {
    if (!showcase || !matchedProperties) return []
    
    let filtered = matchedProperties

    // Apply tab filter
    switch (activeTab) {
      case 'liked':
        filtered = filtered.filter(property => property.liked)
        break
      case 'disliked':
        filtered = filtered.filter(property => property.disliked)
        break
      case 'favorited':
        filtered = filtered.filter(property => property.favorited)
        break
      case 'all':
      default:
        // Show all properties except disliked ones
        filtered = filtered.filter(property => !property.disliked)
        break
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let aValue, bValue
      
      switch (sortBy) {
        case 'price':
          aValue = a.price || 0
          bValue = b.price || 0
          break
        case 'beds':
          aValue = a.beds || 0
          bValue = b.beds || 0
          break
        case 'squareFeet':
          aValue = a.squareFeet || 0
          bValue = b.squareFeet || 0
          break
        default:
          return 0
      }

      if (sortOrder === 'asc') {
        return aValue - bValue
      } else {
        return bValue - aValue
      }
    })

    return filtered
  }

  const filteredProperties = getFilteredProperties()

  const getTabCounts = () => {
    if (!showcase || !matchedProperties) return { all: 0, liked: 0, disliked: 0, favorited: 0 }

    const properties = matchedProperties
    return {
      all: properties.filter(p => !p.disliked).length,
      liked: properties.filter(p => p.liked).length,
      disliked: properties.filter(p => p.disliked).length,
      favorited: properties.filter(p => p.favorited).length
    }
  }

  const tabCounts = getTabCounts()

  // Handle property interactions
  const handlePropertyLike = async (propertyId: string | number, liked: boolean) => {
    console.log(showcase);
    console.log(propertyId);
    if (!showcase) return
    
    try {
      const response = await apiRequest(`/collections/${showcase.id}/properties/${String(propertyId)}/interact`, {
        method: 'POST',
        body: JSON.stringify({
          interaction_type: 'like',
          value: liked
        })
      })

      if (response.status === 200) {
        // Update local state with server response
        const updatedProperties = matchedProperties.map(property =>
          property.id === String(propertyId) ? { 
            ...property, 
            liked: response.data.interaction.liked,
            disliked: response.data.interaction.disliked
          } : property
        )
        
        setMatchedProperties(updatedProperties)

        // Update selected property if it's the one being modified
        if (selectedProperty && selectedProperty.id === String(propertyId)) {
          setSelectedProperty(prevProperty => ({
            ...prevProperty!,
            liked: response.data.interaction.liked,
            disliked: response.data.interaction.disliked
          }))
        }
      }
    } catch (error) {
      console.error('Error updating property like status:', error)
    }
  }

  const handlePropertyDislike = async (propertyId: string | number, disliked: boolean) => {
    if (!showcase) return
    
    try {
      const response = await apiRequest(`/collections/${showcase.id}/properties/${String(propertyId)}/interact`, {
        method: 'POST',
        body: JSON.stringify({
          interaction_type: 'dislike',
          value: disliked
        })
      })

      if (response.status === 200) {
        // Update local state with server response
        const updatedProperties = matchedProperties.map(property =>
          property.id === String(propertyId) ? { 
            ...property, 
            liked: response.data.interaction.liked,
            disliked: response.data.interaction.disliked
          } : property
        )
        
        setMatchedProperties(updatedProperties)

        // Update selected property if it's the one being modified
        if (selectedProperty && selectedProperty.id === String(propertyId)) {
          setSelectedProperty(prevProperty => ({
            ...prevProperty!,
            liked: response.data.interaction.liked,
            disliked: response.data.interaction.disliked
          }))
        }
      }
    } catch (error) {
      console.error('Error updating property dislike status:', error)
    }
  }

  const handlePropertyFavorite = async (propertyId: string | number, favorited: boolean) => {
    if (!showcase) return
    
    try {
      const response = await apiRequest(`/collections/${showcase.id}/properties/${String(propertyId)}/interact`, {
        method: 'POST',
        body: JSON.stringify({
          interaction_type: 'favorite',
          value: favorited
        })
      })

      if (response.status === 200) {
        // Update local state with server response
        const updatedProperties = matchedProperties.map(property =>
          property.id === String(propertyId) ? { 
            ...property, 
            favorited: response.data.interaction.favorited
          } : property
        )
        
        setMatchedProperties(updatedProperties)

        // Update selected property if it's the one being modified
        if (selectedProperty && selectedProperty.id === String(propertyId)) {
          setSelectedProperty(prevProperty => ({
            ...prevProperty!,
            favorited: response.data.interaction.favorited
          }))
        }
      }
    } catch (error) {
      console.error('Error updating property favorite status:', error)
    }
  }

  const handleAddComment = async (propertyId: string | number, comment: string) => {
    if (!showcase) return

    const newComment: Comment = {
      id: Date.now(), // Simple ID generation for demo
      author: `${showcase.customer.firstName} ${showcase.customer.lastName}`, // Customer name for shared view
      content: comment,
      createdAt: new Date().toISOString()
    }

    // Update local state immediately for better UX
    const updatedProperties = matchedProperties.map(property =>
      property.id === String(propertyId) 
        ? { ...property, comments: [...(property.comments || []), newComment] }
        : property
    )
    
    setMatchedProperties(updatedProperties)

    // Update the selected property in modal if it's the same property
    if (selectedProperty && selectedProperty.id === String(propertyId)) {
      setSelectedProperty({
        ...selectedProperty,
        comments: [...(selectedProperty.comments || []), newComment]
      })
    }
    
    // Make API call to persist the comment
    try {
      const response = await apiRequest(`/collections/${showcase.id}/properties/${String(propertyId)}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          comment: comment,
          visitor_name: `${showcase.customer.firstName} ${showcase.customer.lastName}`
        })
      })

      if (response.status === 200) {
        const responseData = response.data
        const serverComment = responseData.comment || responseData

        // Replace optimistic comment with server response if different
        if (serverComment && serverComment.id !== newComment.id) {
          const replaceOptimisticComment = (comments: Comment[]) =>
            comments.map(c => c.id === newComment.id ? serverComment : c)

          setMatchedProperties(prev => prev.map(property =>
            property.id === String(propertyId)
              ? { ...property, comments: replaceOptimisticComment(property.comments || []) }
              : property
          ))

          if (selectedProperty && selectedProperty.id === String(propertyId)) {
            setSelectedProperty(prev => prev ? {
              ...prev,
              comments: replaceOptimisticComment(prev.comments || [])
            } : prev)
          }
        }
      } else {
        throw new Error('Failed to post comment')
      }
    } catch (error) {
      console.error('Error adding property comment:', error)
      // Rollback optimistic update on error
      const removeOptimisticComment = (comments: Comment[]) =>
        comments.filter(c => c.id !== newComment.id)

      setMatchedProperties(prev => prev.map(property =>
        property.id === String(propertyId)
          ? { ...property, comments: removeOptimisticComment(property.comments || []) }
          : property
      ))

      if (selectedProperty && selectedProperty.id === String(propertyId)) {
        setSelectedProperty(prev => prev ? {
          ...prev,
          comments: removeOptimisticComment(prev.comments || [])
        } : prev)
      }
    }
  }

  const fetchPropertyComments = async (propertyId: number) => {
    if (!showcase) return

    setIsLoadingComments(true)
    setCommentsError(null)

    try {
      const response = await apiRequest(`/collections/${showcase.id}/properties/${String(propertyId)}/comments`)

      if (response.status === 200) {
        const data = response.data
        // Update selected property with fresh comments
        setSelectedProperty(prev => prev ? {
          ...prev,
          comments: data || []
        } : prev)
      } else {
        setCommentsError('Failed to load comments')
      }
    } catch (error) {
      console.error('Error fetching property comments:', error)
      setCommentsError('Failed to load comments')
    } finally {
      setIsLoadingComments(false)
    }
  }

  const handlePropertyClick = async (property: Property) => {
    try {
      // Fetch/cache detailed property information
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/properties/${property.id}/cache`)
      
      if (response.ok) {
        const cacheResponse = await response.json()
        
        if (cacheResponse.success && cacheResponse.details) {
          // Create enhanced property with detailed information
          const enhancedProperty = {
            ...property,
            details: cacheResponse.details
          }
          setSelectedProperty(enhancedProperty)
        } else {
          // Fallback to basic property if cache fails
          setSelectedProperty(property)
        }
      } else {
        // Fallback to basic property if API call fails
        setSelectedProperty(property)
      }
    } catch (error) {
      console.error('Error fetching property details:', error)
      // Fallback to basic property
      setSelectedProperty(property)
    }

    setIsModalOpen(true)

    // Always fetch fresh comments
    if (property.id) {
      fetchPropertyComments(Number(property.id))
    }
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedProperty(null)
  }

  const handleScheduleTourClick = (property: Property) => {
    setSelectedPropertyForTour(property)
    setIsTourModalOpen(true)
  }

  const handleScheduleTourSubmit = async (tourRequest: TourRequest) => {
    if (!showcase) {
      alert('Collection information not available')
      return
    }

    try {
      const response = await apiRequest(`/collections/${showcase.id}/properties/${tourRequest.propertyId}/schedule-tour`, {
        method: 'POST',
        body: JSON.stringify({
          preferred_date: tourRequest.preferredDate,
          preferred_time: tourRequest.preferredTime,
          preferred_date_2: tourRequest.preferredDate2,
          preferred_time_2: tourRequest.preferredTime2,
          preferred_date_3: tourRequest.preferredDate3,
          preferred_time_3: tourRequest.preferredTime3,
          message: tourRequest.message
        })
      })

      if (response.status === 200) {
        // Build success message with all preferred times
        let successMessage = `Tour request submitted successfully!\n\nProperty: ${tourRequest.propertyAddress}\n\nPreferred Times:\n1. ${tourRequest.preferredDate} at ${tourRequest.preferredTime}`
        if (tourRequest.preferredDate2 && tourRequest.preferredTime2) {
          successMessage += `\n2. ${tourRequest.preferredDate2} at ${tourRequest.preferredTime2}`
        }
        if (tourRequest.preferredDate3 && tourRequest.preferredTime3) {
          successMessage += `\n3. ${tourRequest.preferredDate3} at ${tourRequest.preferredTime3}`
        }
        successMessage += '\n\nThe agent will contact you to confirm.'

        alert(successMessage)
      } else {
        throw new Error('Failed to submit tour request')
      }

    } catch (error) {
      console.error('Error submitting tour request:', error)
      alert('Failed to submit tour request. Please try again.')
      throw error
    }
  }

  const handleCloseTourModal = () => {
    setIsTourModalOpen(false)
    setSelectedPropertyForTour(null)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#faf9f7] via-white to-[#f5f4f2] flex flex-col">
        <Header mode={isAuthenticated ? 'app' : 'shared'} />
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8b7355] mx-auto mb-4"></div>
            <p className="text-gray-600">Loading showcase...</p>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  if (error || !showcase) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#faf9f7] via-white to-[#f5f4f2] flex flex-col">
        <Header mode={isAuthenticated ? 'app' : 'shared'} />
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-red-500/20 to-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2 font-light">{error || 'Collection not found'}</h3>
            <p className="text-gray-600 font-light">Please check the link and try again</p>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf9f7] via-white to-[#f5f4f2] flex flex-col">
      <Header />
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Customer Header */}
          <div className="bg-white/95 rounded-2xl shadow-xl border border-gray-200/60 backdrop-blur-lg p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1 font-light">Property Recommendations</h1>
                <p className="text-gray-600 text-sm font-light">Curated properties for {showcase.customer.firstName} {showcase.customer.lastName}</p>
              </div>
              
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm">
                  {filteredProperties.length} of {showcase.stats.totalProperties} properties
                </span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                  showcase.status === 'ACTIVE' 
                    ? 'bg-green-100 text-green-800 border-green-200'
                    : 'bg-gray-100 text-gray-700 border-gray-200'
                }`}>
                  {showcase.status}
                </span>
              </div>
            </div>
            
            {/* Property Status Tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { key: 'all', label: 'All Properties', count: tabCounts.all },
                { key: 'liked', label: 'Liked', count: tabCounts.liked },
                { key: 'disliked', label: 'Disliked', count: tabCounts.disliked },
                { key: 'favorited', label: 'Favorited', count: tabCounts.favorited }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 flex items-center space-x-2 ${
                    activeTab === tab.key
                      ? 'bg-[#8b7355] text-white border border-[#8b7355]'
                      : 'bg-white text-gray-700 hover:bg-[#f5f4f2] border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    activeTab === tab.key
                      ? 'bg-white text-[#8b7355]'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Sorting Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Sort by</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'price' | 'beds' | 'squareFeet')}
                  className="w-full px-3 py-2 bg-white/60 border border-gray-200/50 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b7355]/60 focus:border-[#8b7355]/60 transition-all duration-300"
                >
                  <option value="price">Price</option>
                  <option value="beds">Bedrooms</option>
                  <option value="squareFeet">Square Feet</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Sort Order</label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                  className="w-full px-3 py-2 bg-white/60 border border-gray-200/50 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b7355]/60 focus:border-[#8b7355]/60 transition-all duration-300"
                >
                  <option value="asc">Low to High</option>
                  <option value="desc">High to Low</option>
                </select>
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSortBy('price')
                    setSortOrder('asc')
                    setActiveTab('all')
                  }}
                  className="w-full px-3 py-2 bg-gray-100/40 text-gray-700 hover:bg-gray-200/60 border border-gray-300/40 hover:border-gray-400/60 rounded-lg text-sm transition-all duration-300"
                >
                  Reset Filters
                </button>
              </div>
            </div>
          </div>

          {/* Professional Separator */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-4 text-gray-600 font-medium">
                {activeTab === 'all' ? 'All Properties' : 
                 activeTab === 'liked' ? 'Liked Properties' :
                 activeTab === 'disliked' ? 'Disliked Properties' :
                 'Favorited Properties'}
              </span>
            </div>
          </div>

          {/* Property Grid */}
          <PropertyGrid
            properties={filteredProperties}
            title="Matched Properties"
            onLike={handlePropertyLike}
            onDislike={handlePropertyDislike}
            onFavorite={handlePropertyFavorite}
            onPropertyClick={handlePropertyClick}
            onScheduleTour={handleScheduleTourClick}
          />

          {/* Property Details Modal */}
          <PropertyDetailsModal
            property={selectedProperty}
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            onLike={handlePropertyLike}
            onDislike={handlePropertyDislike}
            onFavorite={handlePropertyFavorite}
            onAddComment={handleAddComment}
            isLoadingComments={isLoadingComments}
            commentsError={commentsError}
          />

          {/* Schedule Tour Modal */}
          <ScheduleTourModal
            property={selectedPropertyForTour}
            isOpen={isTourModalOpen}
            onClose={handleCloseTourModal}
            onSubmit={handleScheduleTourSubmit}
          />

        </div>
      </div>
      <Footer />
    </div>
  )
}
