'use client'

import { useState, useEffect, useCallback, Suspense, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowUpDown, SlidersHorizontal, MapPin } from 'lucide-react'
import { Collection, Property, Comment, TourRequest } from '@/types'
import { getToken } from '@/lib/token'
import api from '@/lib/api-service'
import PropertyGrid from '@/components/PropertyGrid'
import PropertyDetailsModal from '@/components/PropertyDetailsModal'
import ScheduleTourModal from '@/components/ScheduleTourModal'
import { useToast } from '@/contexts/ToastContext'
import MLSComplianceFooter from '@/components/MLSComplianceFooter'

export default function CustomerShowcasePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAFAF7] dark:bg-[#0B0B0B] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#111827] dark:border-white"></div>
      </div>
    }>
      <ShowcaseContent />
    </Suspense>
  )
}

function ShowcaseContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const [showcase, setShowcase] = useState<Collection | null>(null)
  const [matchedProperties, setMatchedProperties] = useState<Property[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  
  // Property filtering states
  const [activeTab, setActiveTab] = useState<'all' | 'liked' | 'disliked'>('all')
  const [sortBy, setSortBy] = useState<'price' | 'beds' | 'squareFeet' | 'daysOnMarket' | 'lastUpdated'>('daysOnMarket')
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
  
  const isInternalSyncRef = useRef(false)

  const shareToken = params.shareToken as string

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
      setIsLoading(true)
      setError(null)
      
      const { success, data, error: apiError } = await api.public.getSharedShowcase(shareToken)
      console.log(data)
      
      if (success && data) {
        setShowcase(data)
        if (data.matchedProperties) {
          setMatchedProperties(data.matchedProperties)
        }
      } else {
        setError(apiError || 'Failed to load showcase')
      }
      setIsLoading(false)
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
          aValue = a.ListPrice || 0
          bValue = b.ListPrice || 0
          break
        case 'beds':
          aValue = a.BedroomsTotal || 0
          bValue = b.BedroomsTotal || 0
          break
        case 'squareFeet':
          aValue = a.LivingArea || 0
          bValue = b.LivingArea || 0
          break
        case 'daysOnMarket':
          aValue = a.DaysOnMarket || 0
          bValue = b.DaysOnMarket || 0
          break
        case 'lastUpdated':
          aValue = a.ModificationTimestamp ? new Date(a.ModificationTimestamp).getTime() : 0
          bValue = b.ModificationTimestamp ? new Date(b.ModificationTimestamp).getTime() : 0
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

    // Optimistic UI update
    const optimisticProperties = matchedProperties.map(property =>
      String(property.id) === String(propertyId) ? {
        ...property,
        liked: liked,
        disliked: liked ? false : property.disliked
      } : property
    )

    setMatchedProperties(optimisticProperties)

    if (selectedProperty && String(selectedProperty.id) === String(propertyId)) {
      setSelectedProperty(prevProperty => ({
        ...prevProperty!,
        liked: liked,
        disliked: liked ? false : prevProperty!.disliked
      }))
    }

    const { success, data, error } = await api.public.interactWithProperty(
      showcase.id,
      String(propertyId),
      'like',
      liked
    )

    if (success && data?.interaction) {
      const updatedProperties = matchedProperties.map(property =>
        String(property.id) === String(propertyId) ? {
          ...property,
          liked: data.interaction.liked,
          disliked: data.interaction.disliked
        } : property
      )

      setMatchedProperties(updatedProperties)

      if (selectedProperty && String(selectedProperty.id) === String(propertyId)) {
        setSelectedProperty(prevProperty => ({
          ...prevProperty!,
          liked: data.interaction.liked,
          disliked: data.interaction.disliked
        }))
      }

      showToast(liked ? 'Property added to your likes!' : 'Property removed from your likes', 'success')
    } else {
      // Rollback on error
      setMatchedProperties(matchedProperties)
      showToast(error || 'Failed to update like status', 'error')
    }
  }

  const handlePropertyDislike = async (propertyId: string | number, disliked: boolean) => {
    if (!showcase) return

    // Optimistic UI update
    const optimisticProperties = matchedProperties.map(property =>
      String(property.id) === String(propertyId) ? {
        ...property,
        liked: disliked ? false : property.liked,
        disliked: disliked
      } : property
    )

    setMatchedProperties(optimisticProperties)

    if (selectedProperty && String(selectedProperty.id) === String(propertyId)) {
      setSelectedProperty(prevProperty => ({
        ...prevProperty!,
        liked: disliked ? false : prevProperty!.liked,
        disliked: disliked
      }))
    }

    const { success, data, error } = await api.public.interactWithProperty(
      showcase.id,
      String(propertyId),
      'dislike',
      disliked
    )

    if (success && data?.interaction) {
      const updatedProperties = matchedProperties.map(property =>
        String(property.id) === String(propertyId) ? {
          ...property,
          liked: data.interaction.liked,
          disliked: data.interaction.disliked
        } : property
      )

      setMatchedProperties(updatedProperties)

      if (selectedProperty && String(selectedProperty.id) === String(propertyId)) {
        setSelectedProperty(prevProperty => ({
          ...prevProperty!,
          liked: data.interaction.liked,
          disliked: data.interaction.disliked
        }))
      }

      showToast(disliked ? 'Property marked as not interested' : 'Property unmarked as not interested', 'success')
    } else {
      // Rollback
      setMatchedProperties(matchedProperties)
      showToast(error || 'Failed to update status', 'error')
    }
  }

  const handleAddComment = async (propertyId: string | number, comment: string) => {
    if (!showcase) return

    const visitorName = `${showcase.customer.firstName} ${showcase.customer.lastName}`
    const newComment: Comment = {
      id: Date.now(),
      author: visitorName,
      content: comment,
      createdAt: new Date().toISOString()
    }

    // Optimistic update
    setMatchedProperties(prev => prev.map(property =>
      String(property.id) === String(propertyId) 
        ? { ...property, comments: [...(property.comments || []), newComment] }
        : property
    ))

    if (selectedProperty && String(selectedProperty.id) === String(propertyId)) {
      setSelectedProperty({
        ...selectedProperty,
        comments: [...(selectedProperty.comments || []), newComment]
      })
    }
    
    const { success, data, error } = await api.public.addPropertyComment(
      showcase.id,
      String(propertyId),
      comment,
      visitorName
    )

    if (success && data) {
      const backendComment = data.comment || data
      const serverComment = {
        ...backendComment,
        createdAt: backendComment.created_at || backendComment.createdAt,
        author: backendComment.author || backendComment.visitor_name || 'Anonymous'
      }

      const replaceComment = (comments: Comment[]) =>
        comments.map(c => c.id === newComment.id ? serverComment : c)

      setMatchedProperties(prev => prev.map(property =>
        String(property.id) === String(propertyId)
          ? { ...property, comments: replaceComment(property.comments || []) }
          : property
      ))

      if (selectedProperty && String(selectedProperty.id) === String(propertyId)) {
        setSelectedProperty(prev => prev ? { ...prev, comments: replaceComment(prev.comments || []) } : prev)
      }
    } else {
      // Rollback
      setMatchedProperties(prev => prev.map(property =>
        String(property.id) === String(propertyId)
          ? { ...property, comments: (property.comments || []).filter(c => c.id !== newComment.id) }
          : property
      ))
      showToast(error || 'Failed to post comment', 'error')
    }
  }

  const fetchPropertyComments = async (propertyId: number) => {
    if (!showcase) return
    setIsLoadingComments(true)
    setCommentsError(null)

    const { success, data, error } = await api.public.getPropertyComments(showcase.id, String(propertyId))

    if (success && data) {
      const transformedComments = data.map((comment: any) => ({
        ...comment,
        createdAt: comment.created_at || comment.createdAt,
        author: comment.author || comment.visitor_name || 'Anonymous'
      }))

      setSelectedProperty(prev => prev ? { ...prev, comments: transformedComments } : prev)
    } else {
      setCommentsError(error || 'Failed to load comments')
    }
    setIsLoadingComments(false)
  }

  // Handle the async parts of property viewing (tracking, fetching details)
  const loadPropertyDetails = useCallback(async (property: Property) => {
    // Track property view
    if (showcase?.id && property.id) {
      const { success } = await api.public.trackPropertyView(showcase.id, String(property.id))
      if (success) {
        setMatchedProperties(prev => prev.map(p =>
          String(p.id) === String(property.id) ? { ...p, viewed: true, viewCount: (p.viewCount || 0) + 1 } : p
        ))
      }
    }

    setIsLoadingDetails(true)
    setDetailsError(null)
    try {
      const { success, data, error } = await api.properties.getById(property.id as string)
      if (success && data) {
        setSelectedProperty(prev => prev ? { ...prev, ...data } : null)
      } else {
        setDetailsError(error || 'Failed to load details')
      }
    } catch (err) {
      console.error('Error fetching property details:', err)
      setDetailsError('Failed to load additional property details')
    } finally {
      setIsLoadingDetails(false)
    }

    const propertyIdAsNumber = Number(property.id)
    if (property.id && !isNaN(propertyIdAsNumber)) {
      fetchPropertyComments(propertyIdAsNumber)
    }
  }, [showcase?.id])

  const handlePropertyClick = useCallback((property: Property) => {
    isInternalSyncRef.current = true

    const currentParams = new URLSearchParams(window.location.search)
    if (currentParams.get('property') !== String(property.id)) {
      currentParams.set('property', String(property.id))
      window.history.pushState(null, '', `?${currentParams.toString()}`)
    }

    // Set state immediately
    setSelectedProperty(property)
    setIsModalOpen(true)
    loadPropertyDetails(property)

    setTimeout(() => { isInternalSyncRef.current = false }, 100)
  }, [loadPropertyDetails])

  const handleCloseModal = useCallback(() => {
    isInternalSyncRef.current = true

    // Set state immediately
    setIsModalOpen(false)
    setSelectedProperty(null)

    const currentParams = new URLSearchParams(window.location.search)
    if (currentParams.has('property')) {
      currentParams.delete('property')
      const newUrl = currentParams.toString() ? `?${currentParams.toString()}` : window.location.pathname
      window.history.pushState(null, '', newUrl)
    }

    setTimeout(() => { isInternalSyncRef.current = false }, 100)
  }, [])

  // Handle URL sync for property details (Single Source of Truth)
  useEffect(() => {
    if (isInternalSyncRef.current) return

    const propertyId = searchParams.get('property')
    
    if (propertyId && matchedProperties.length > 0) {
      const property = matchedProperties.find(p => String(p.id) === propertyId)
      if (property) {
        // If it's a new property selection, update state and load details
        if (!selectedProperty || String(selectedProperty.id) !== propertyId) {
          setSelectedProperty(property)
          setIsModalOpen(true)
          loadPropertyDetails(property)
        }
      }
    } else if (!propertyId && isModalOpen) {
      // If URL cleared, close the modal
      setIsModalOpen(false)
      setSelectedProperty(null)
    }
  }, [searchParams, matchedProperties, selectedProperty?.id, isModalOpen, loadPropertyDetails])

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
      const { success, error } = await api.public.scheduleTour(showcase.id, tourRequest)

      if (success) {
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
        showToast(error || 'Failed to submit tour request', 'error')
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

  const handleNotificationToggle = async () => {
    if (!showcase || !shareToken) return

    const newNotifyVisitor = !showcase.notifyVisitor

    const { success, error } = await api.public.toggleNotifications(shareToken, newNotifyVisitor)

    if (success) {
      setShowcase(prev => prev ? { ...prev, notifyVisitor: newNotifyVisitor } : null)
      showToast(
        newNotifyVisitor 
          ? 'Notifications enabled! You will be notified of new matches.' 
          : 'Notifications disabled.',
        'success'
      )
    } else {
      showToast(error || 'Failed to update notification settings', 'error')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] dark:bg-[#0B0B0B] flex flex-col transition-colors">
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#111827] dark:border-white mx-auto mb-4"></div>
            <p className="text-[#6B7280] dark:text-gray-400 font-medium">Loading showcase...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !showcase) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] dark:bg-[#0B0B0B] flex flex-col transition-colors">
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="text-center bg-white dark:bg-[#151517] p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 max-w-md mx-auto">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
            </div>
            <h3 className="text-xl font-black text-[#0B0B0B] dark:text-white mb-2 tracking-tight">{error || 'Collection not found'}</h3>
            <p className="text-[#6B7280] dark:text-gray-400">Please check the link and try again</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7] dark:bg-[#0B0B0B] flex flex-col transition-colors">
      <div className="flex-1 p-4 sm:p-6 pb-20">
        <div className="max-w-7xl mx-auto">
          {/* Customer Header */}
          <div className="bg-white dark:bg-[#151517] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-4 sm:p-6 mb-6 relative overflow-hidden transition-colors">
            {/* Subtle Accent Bar */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#C9A24D]" />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center space-x-3 mb-1">
                  <h1 className="text-xl sm:text-2xl font-black text-[#0B0B0B] dark:text-white tracking-tight">
                    {showcase.customer.firstName} {showcase.customer.lastName}'s Showcase
                  </h1>
                  <span className="px-2.5 py-0.5 bg-[#C9A24D]/10 text-[#C9A24D] text-[10px] font-black uppercase tracking-widest rounded-full border border-[#C9A24D]/20">
                    {matchedProperties.length} Matched
                  </span>
                </div>
                <div className="flex items-center text-sm text-[#6B7280] dark:text-gray-400 font-light">
                  <MapPin size={14} className="mr-1.5 text-[#C9A24D]" />
                  <span>Curated property recommendations</span>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${
                  showcase.status === 'ACTIVE' 
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-100 dark:border-green-900/30'
                    : 'bg-gray-50 dark:bg-gray-800 text-[#6B7280] dark:text-gray-400 border-gray-200 dark:border-gray-700'
                }`}>
                  <div className={`w-2 h-2 rounded-full mr-2 ${showcase.status === 'ACTIVE' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                  {showcase.status}
                </span>
              </div>
            </div>
            
            {/* Actions Row: Tabs and Notification Toggle */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
              {/* Property Status Tabs (Left) */}
              <div className="flex flex-wrap gap-2">
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
                        ? 'bg-[#111827] dark:bg-white text-white dark:text-[#111827] border-[#111827] dark:border-white shadow-md'
                        : 'bg-white dark:bg-[#1A1A1C] text-[#6B7280] dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                      activeTab === tab.key
                        ? 'bg-white/20 dark:bg-[#111827]/10 text-white dark:text-[#111827]'
                        : 'bg-gray-100 dark:bg-gray-800 text-[#6B7280] dark:text-gray-400'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Notification Toggle (Right) */}
              <div className="flex items-center space-x-3 text-sm bg-gray-50/50 dark:bg-white/5 p-1.5 px-3 rounded-2xl border border-gray-100 dark:border-gray-800/50">
                <span className={`font-medium whitespace-nowrap hidden sm:inline ${showcase.customer?.is_blacklisted ? 'text-[#9CA3AF] dark:text-gray-500' : 'text-[#6B7280] dark:text-gray-400'}`}>Email Alerts:</span>
                <button
                  onClick={() => {
                    if (!showcase.customer?.is_blacklisted) {
                      handleNotificationToggle()
                    }
                  }}
                  disabled={showcase.customer?.is_blacklisted}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    showcase.customer?.is_blacklisted
                      ? 'bg-gray-200 dark:bg-gray-800 cursor-not-allowed'
                      : (showcase.notifyVisitor ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700')
                  }`}
                  title={showcase.customer?.is_blacklisted ? "You have unsubscribed from property update emails." : (showcase.notifyVisitor ? 'Click to disable property update emails' : 'Click to enable property update emails')}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      (showcase.notifyVisitor && !showcase.customer?.is_blacklisted) ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Sorting Controls */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-6 border-t border-gray-100 dark:border-gray-800">
              <div className="md:col-span-5 group">
                <label className="block text-[10px] font-bold text-[#6B7280] dark:text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Sort Properties</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#C9A24D] transition-colors">
                    <ArrowUpDown size={14} />
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50/50 dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-800 rounded-xl text-[#0B0B0B] dark:text-white text-sm font-medium focus:outline-none focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/5 transition-all appearance-none cursor-pointer"
                  >
                    <option value="daysOnMarket">Days on Market</option>
                    <option value="price">Price</option>
                    <option value="beds">Bedrooms</option>
                    <option value="squareFeet">Square Feet</option>
                    <option value="lastUpdated">Last Updated</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#6B7280] dark:text-gray-500">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>
              
              <div className="md:col-span-4 group">
                <label className="block text-[10px] font-bold text-[#6B7280] dark:text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Direction</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#C9A24D] transition-colors">
                    <SlidersHorizontal size={14} />
                  </div>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as any)}
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50/50 dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-800 rounded-xl text-[#0B0B0B] dark:text-white text-sm font-medium focus:outline-none focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/5 transition-all appearance-none cursor-pointer"
                  >
                    <option value="asc">Low to High</option>
                    <option value="desc">High to Low</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#6B7280] dark:text-gray-500">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>
              
              <div className="md:col-span-3 flex items-end">
                <button
                  onClick={() => {
                    setSortBy('daysOnMarket')
                    setSortOrder('asc')
                    setActiveTab('all')
                  }}
                  className="w-full py-2.5 bg-white dark:bg-[#151517] text-[#6B7280] dark:text-gray-400 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-[#1A1A1C] hover:text-[#111827] dark:hover:text-white transition-all shadow-sm"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Professional Separator */}
          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-[#FAFAF7] dark:bg-[#0B0B0B] px-4 text-[#6B7280] dark:text-gray-500 font-medium uppercase tracking-widest text-xs">
                {activeTab === 'all' ? 'All Properties' : 
                 activeTab === 'liked' ? 'Liked Properties' :
                 'Disliked Properties'}
              </span>
            </div>
          </div>

          {/* Property Grid */}
          <div className="mb-32">
            <PropertyGrid
              properties={filteredProperties}
              title="Matched Properties"
              onLike={handlePropertyLike}
              onDislike={handlePropertyDislike}
              onPropertyClick={handlePropertyClick}
              onScheduleTour={handleScheduleTourClick}
              showNewForUnviewed={true}
            />
          </div>

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
            showContactFields={
              showcase?.customer?.firstName === 'Anonymous' || 
              showcase?.customer?.email === 'anonymous@visitor.com'
            }
          />

        </div>
      </div>

      <MLSComplianceFooter />
    </div>
  )
}
