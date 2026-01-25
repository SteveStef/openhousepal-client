'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Collection, Property, Comment } from '@/types'
import { getToken } from '@/lib/auth'
import PropertyGrid from '@/components/PropertyGrid'
import PropertyDetailsModal from '@/components/PropertyDetailsModal'
import ScheduleTourModal, { TourRequest } from '@/components/ScheduleTourModal'
import Toast from '@/components/Toast'

export default function CustomerShowcasePage() {
  const params = useParams()
  const [showcase, setShowcase] = useState<Collection | null>(null)
  const [matchedProperties, setMatchedProperties] = useState<Property[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  
  // Property filtering states
  const [activeTab, setActiveTab] = useState<'all' | 'liked' | 'disliked'>('all')
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

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  })

  const shareToken = params.shareToken as string

  // Toast helper function
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type, isVisible: true })
  }

  const closeToast = () => {
    setToast(prev => ({ ...prev, isVisible: false }))
  }

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
    if (!showcase || !matchedProperties) return { all: 0, liked: 0, disliked: 0 }

    const properties = matchedProperties
    return {
      all: properties.filter(p => !p.disliked).length,
      liked: properties.filter(p => p.liked).length,
      disliked: properties.filter(p => p.disliked).length
    }
  }

  const tabCounts = getTabCounts()

  // Handle property interactions
  const handlePropertyLike = async (propertyId: string | number, liked: boolean) => {
    if (!showcase) return

    // Optimistic UI update - update immediately for instant feedback
    const optimisticProperties = matchedProperties.map(property =>
      String(property.id) === String(propertyId) ? {
        ...property,
        liked: liked,
        disliked: liked ? false : property.disliked  // Clear dislike if liking
      } : property
    )

    setMatchedProperties(optimisticProperties)

    // Update selected property if it's the one being modified
    if (selectedProperty && String(selectedProperty.id) === String(propertyId)) {
      setSelectedProperty(prevProperty => ({
        ...prevProperty!,
        liked: liked,
        disliked: liked ? false : prevProperty!.disliked
      }))
    }

    try {
      const response = await apiRequest(`/collections/${showcase.id}/properties/${String(propertyId)}/interact`, {
        method: 'POST',
        body: JSON.stringify({
          interaction_type: 'like',
          value: liked
        })
      })

      if (response.status === 200) {
        // Sync with server response
        const updatedProperties = matchedProperties.map(property =>
          String(property.id) === String(propertyId) ? {
            ...property,
            liked: response.data.interaction.liked,
            disliked: response.data.interaction.disliked
          } : property
        )

        setMatchedProperties(updatedProperties)

        if (selectedProperty && String(selectedProperty.id) === String(propertyId)) {
          setSelectedProperty(prevProperty => ({
            ...prevProperty!,
            liked: response.data.interaction.liked,
            disliked: response.data.interaction.disliked
          }))
        }

        // Show success toast
        showToast(
          liked ? 'Property added to your likes!' : 'Property removed from your likes',
          'success'
        )
      }
    } catch (error) {
      console.error('Error updating property like status:', error)

      // Rollback optimistic update on error
      const revertedProperties = matchedProperties.map(property =>
        String(property.id) === String(propertyId) ? {
          ...property,
          liked: !liked,
          disliked: property.disliked
        } : property
      )

      setMatchedProperties(revertedProperties)

      if (selectedProperty && String(selectedProperty.id) === String(propertyId)) {
        setSelectedProperty(prevProperty => ({
          ...prevProperty!,
          liked: !liked,
          disliked: prevProperty!.disliked
        }))
      }

      showToast('Failed to update like status. Please try again.', 'error')
    }
  }

  const handlePropertyDislike = async (propertyId: string | number, disliked: boolean) => {
    if (!showcase) return

    // Optimistic UI update - update immediately for instant feedback
    const optimisticProperties = matchedProperties.map(property =>
      String(property.id) === String(propertyId) ? {
        ...property,
        liked: disliked ? false : property.liked,  // Clear like if disliking
        disliked: disliked
      } : property
    )

    setMatchedProperties(optimisticProperties)

    // Update selected property if it's the one being modified
    if (selectedProperty && String(selectedProperty.id) === String(propertyId)) {
      setSelectedProperty(prevProperty => ({
        ...prevProperty!,
        liked: disliked ? false : prevProperty!.liked,
        disliked: disliked
      }))
    }

    try {
      const response = await apiRequest(`/collections/${showcase.id}/properties/${String(propertyId)}/interact`, {
        method: 'POST',
        body: JSON.stringify({
          interaction_type: 'dislike',
          value: disliked
        })
      })

      if (response.status === 200) {
        // Sync with server response
        const updatedProperties = matchedProperties.map(property =>
          String(property.id) === String(propertyId) ? {
            ...property,
            liked: response.data.interaction.liked,
            disliked: response.data.interaction.disliked
          } : property
        )

        setMatchedProperties(updatedProperties)

        if (selectedProperty && String(selectedProperty.id) === String(propertyId)) {
          setSelectedProperty(prevProperty => ({
            ...prevProperty!,
            liked: response.data.interaction.liked,
            disliked: response.data.interaction.disliked
          }))
        }

        // Show success toast
        showToast(
          disliked ? 'Property marked as not interested' : 'Property unmarked as not interested',
          'success'
        )
      }
    } catch (error) {
      console.error('Error updating property dislike status:', error)

      // Rollback optimistic update on error
      const revertedProperties = matchedProperties.map(property =>
        String(property.id) === String(propertyId) ? {
          ...property,
          liked: property.liked,
          disliked: !disliked
        } : property
      )

      setMatchedProperties(revertedProperties)

      if (selectedProperty && String(selectedProperty.id) === String(propertyId)) {
        setSelectedProperty(prevProperty => ({
          ...prevProperty!,
          liked: prevProperty!.liked,
          disliked: !disliked
        }))
      }

      showToast('Failed to update status. Please try again.', 'error')
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
      String(property.id) === String(propertyId) 
        ? { ...property, comments: [...(property.comments || []), newComment] }
        : property
    )
    
    setMatchedProperties(updatedProperties)

    // Update the selected property in modal if it's the same property
    if (selectedProperty && String(selectedProperty.id) === String(propertyId)) {
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
          content: comment,
          visitor_name: `${showcase.customer.firstName} ${showcase.customer.lastName}`
        })
      })

      if (response.status === 200) {
        const responseData = response.data
        const backendComment = responseData.comment || responseData

        // Transform backend response to frontend format (snake_case to camelCase)
        const serverComment = {
          ...backendComment,
          createdAt: backendComment.created_at || backendComment.createdAt,
          author: backendComment.author || backendComment.visitor_name || 'Anonymous'
        }

        // Replace optimistic comment with server response if different
        if (serverComment && serverComment.id !== newComment.id) {
          const replaceOptimisticComment = (comments: Comment[]) =>
            comments.map(c => c.id === newComment.id ? serverComment : c)

          setMatchedProperties(prev => prev.map(property =>
            String(property.id) === String(propertyId)
              ? { ...property, comments: replaceOptimisticComment(property.comments || []) }
              : property
          ))

          if (selectedProperty && String(selectedProperty.id) === String(propertyId)) {
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
        String(property.id) === String(propertyId)
          ? { ...property, comments: removeOptimisticComment(property.comments || []) }
          : property
      ))

      if (selectedProperty && String(selectedProperty.id) === String(propertyId)) {
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
        // Transform backend comments to frontend format (snake_case to camelCase)
        const transformedComments = (data || []).map((comment: any) => ({
          ...comment,
          createdAt: comment.created_at || comment.createdAt,
          author: comment.author || comment.visitor_name || 'Anonymous'
        }))

        // Update selected property with fresh comments
        setSelectedProperty(prev => prev ? {
          ...prev,
          comments: transformedComments
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
    // Open modal immediately with basic property data
    setSelectedProperty(property)
    setIsModalOpen(true)

    // Track property view
    if (showcase?.id && property.id) {
      try {
        const response = await apiRequest(`/collections/${showcase.id}/properties/${String(property.id)}/view`, {
          method: 'POST'
        })

        // Update local state after successful tracking
        if (response.status === 200) {
          // Update matchedProperties array
          setMatchedProperties(prev => prev.map(p =>
            String(p.id) === String(property.id) ? {
              ...p,
              viewed: true,
              viewCount: (p.viewCount || 0) + 1
            } : p
          ))

          // Update selectedProperty as well (since modal is already open)
          setSelectedProperty(prev => prev ? {
            ...prev,
            viewed: true,
            viewCount: (prev.viewCount || 0) + 1
          } : prev)
        }
      } catch (error) {
        console.error('Error tracking property view:', error)
        // Don't block the UI if view tracking fails
      }
    }

    // Show loading state for enhanced details
    setIsLoadingDetails(true)
    setDetailsError(null)

    try {
      // Fetch/cache detailed property information in background
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/properties/${property.id}/cache`)

      if (response.ok) {
        const cacheResponse = await response.json()

        if (cacheResponse.success && cacheResponse.details) {
          // Update property with enhanced details
          const enhancedProperty = {
            ...property,
            details: cacheResponse.details
          }
          setSelectedProperty(enhancedProperty)
        }
      }
    } catch (error) {
      console.error('Error fetching property details:', error)
      setDetailsError('Failed to load additional property details')
    } finally {
      // Hide loading state when done
      setIsLoadingDetails(false)
    }

    // Fetch comments in parallel
    const propertyIdAsNumber = Number(property.id)
    if (property.id && !isNaN(propertyIdAsNumber)) {
      fetchPropertyComments(propertyIdAsNumber)
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
      showToast('Collection information not available', 'error')
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

        showToast(successMessage, 'success')

        // Update local state to mark property as having tour scheduled
        const updatedProperties = matchedProperties.map(property =>
          String(property.id) === String(tourRequest.propertyId) ? {
            ...property,
            hasTourScheduled: true
          } : property
        )
        setMatchedProperties(updatedProperties)

        // Close the tour modal
        handleCloseTourModal()
      } else {
        throw new Error('Failed to submit tour request')
      }

    } catch (error) {
      console.error('Error submitting tour request:', error)
      showToast('Failed to submit tour request. Please try again.', 'error')
      throw error
    }
  }

  const handleCloseTourModal = () => {
    setIsTourModalOpen(false)
    setSelectedPropertyForTour(null)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] flex flex-col">
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#111827] mx-auto mb-4"></div>
            <p className="text-[#6B7280] font-medium">Loading showcase...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !showcase) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] flex flex-col">
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="text-center bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-md mx-auto">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
            </div>
            <h3 className="text-xl font-black text-[#0B0B0B] mb-2 tracking-tight">{error || 'Collection not found'}</h3>
            <p className="text-[#6B7280]">Please check the link and try again</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col">
      <div className="flex-1 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          {/* Customer Header */}
          <div className="bg-white/50 backdrop-blur-sm rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 p-4 sm:p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-[#0B0B0B] mb-1 tracking-tight">{showcase.customer.firstName} {showcase.customer.lastName}'s Showcase</h1>
                <p className="text-[#6B7280] text-sm font-light">Curated property recommendations</p>
              </div>
              
              <div className="flex items-center space-x-4">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${
                  showcase.status === 'ACTIVE' 
                    ? 'bg-green-50 text-green-700 border-green-100'
                    : 'bg-gray-50 text-[#6B7280] border-gray-200'
                }`}>
                  <div className={`w-2 h-2 rounded-full mr-2 ${showcase.status === 'ACTIVE' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                  {showcase.status}
                </span>
              </div>
            </div>
            
            {/* Property Status Tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { key: 'all', label: 'All Properties', count: tabCounts.all },
                { key: 'liked', label: 'Liked', count: tabCounts.liked },
                { key: 'disliked', label: 'Disliked', count: tabCounts.disliked }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition-all duration-300 flex items-center space-x-2 border ${
                    activeTab === tab.key
                      ? 'bg-[#111827] text-white border-[#111827] shadow-md'
                      : 'bg-white text-[#6B7280] hover:bg-gray-50 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                    activeTab === tab.key
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-100 text-[#6B7280]'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Sorting Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
              <div className="group">
                <label className="block text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-1.5">Sort by</label>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'price' | 'beds' | 'squareFeet')}
                    className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-[#0B0B0B] text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A24D]/20 focus:border-[#C9A24D] transition-all duration-300 appearance-none cursor-pointer hover:bg-gray-50"
                  >
                    <option value="price">Price</option>
                    <option value="beds">Bedrooms</option>
                    <option value="squareFeet">Square Feet</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#6B7280]">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="group">
                <label className="block text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-1.5">Sort Order</label>
                <div className="relative">
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                    className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-[#0B0B0B] text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A24D]/20 focus:border-[#C9A24D] transition-all duration-300 appearance-none cursor-pointer hover:bg-gray-50"
                  >
                    <option value="asc">Low to High</option>
                    <option value="desc">High to Low</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#6B7280]">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSortBy('price')
                    setSortOrder('asc')
                    setActiveTab('all')
                  }}
                  className="w-full px-4 py-2.5 bg-white text-[#6B7280] hover:text-[#111827] border border-gray-200 hover:border-gray-300 rounded-xl text-sm font-medium transition-all duration-300 hover:shadow-sm"
                >
                  Reset Filters
                </button>
              </div>
            </div>
          </div>

          {/* Professional Separator */}
          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-[#FAFAF7] px-4 text-[#6B7280] font-medium uppercase tracking-widest text-xs">
                {activeTab === 'all' ? 'All Properties' : 
                 activeTab === 'liked' ? 'Liked Properties' :
                 'Disliked Properties'}
              </span>
            </div>
          </div>

          {/* Property Grid */}
          <PropertyGrid
            properties={filteredProperties}
            title="Matched Properties"
            onLike={handlePropertyLike}
            onDislike={handlePropertyDislike}
            onPropertyClick={handlePropertyClick}
            onScheduleTour={handleScheduleTourClick}
            showNewForUnviewed={true}
          />

          {/* Property Details Modal */}
          <PropertyDetailsModal
            property={selectedProperty}
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            onLike={handlePropertyLike}
            onDislike={handlePropertyDislike}
            onAddComment={handleAddComment}
            isLoadingDetails={isLoadingDetails}
            detailsError={detailsError}
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

      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={closeToast}
      />
    </div>
  )
}
