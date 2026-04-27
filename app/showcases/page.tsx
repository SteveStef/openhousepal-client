'use client'

import { useState, useEffect, useMemo, useRef, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Collection, Property, Comment, TourRequest, PropertyTour } from '@/types'
import Footer from '@/components/Footer'
import ShareCollectionModal from '@/components/ShareCollectionModal'
import EditPreferencesModal from '@/components/EditPreferencesModal'
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal'
import AuthGuard from '@/components/AuthGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import BrokerAuthorizationGuard from '@/components/BrokerAuthorizationGuard'
import { useToast } from '@/contexts/ToastContext'
import api from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'

// Sub-components
import { DashboardView } from './components/DashboardView'
import { DetailView } from './components/DetailView'
import { CreateCollectionModal } from './components/CreateCollectionModal'

// Helper function to format prices properly
const formatPrice = (price: number): string => {
  if (price >= 1000000) {
    return `${(price / 1000000).toFixed(1)}M`
  } else if (price >= 1000) {
    return `${(price / 1000).toFixed(0)}K`
  }
  return price.toString()
}

const formatPriceRange = (priceRange: string): string => {
  if (!priceRange || priceRange === 'Not specified') return 'Price not specified'
  return priceRange
}

function ShowcaseContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isAuthenticated, isLoading: isAuthenticating, refreshUser } = useAuth()
  const { showToast } = useToast()
  
  // State
  const [collections, setCollections] = useState<Collection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null)
  const [matchedProperties, setMatchedProperties] = useState<Property[]>([])
  const [activeTab, setActiveTab] = useState<'all' | 'liked' | 'disliked'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  
  // Sorting state
  const [sortBy, setSortBy] = useState<'price' | 'beds' | 'squareFeet' | 'daysOnMarket' | 'lastUpdated'>('daysOnMarket')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  
  // Modal states
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [selectedCollectionForShare, setSelectedCollectionForShare] = useState<Collection | null>(null)
  const [isEditPreferencesModalOpen, setIsEditPreferencesModalOpen] = useState(false)
  const [selectedCollectionForEdit, setSelectedCollectionForEdit] = useState<Collection | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [deleteModalState, setDeleteModalState] = useState<{ isOpen: boolean, collection: Collection | null }>({
    isOpen: false,
    collection: null
  })
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Property details and comments states
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [isLoadingComments, setIsLoadingComments] = useState(false)
  const [commentsError, setCommentsError] = useState<string | null>(null)
  
  // Tour states
  const [isToursModalOpen, setIsToursModalOpen] = useState(false)
  const [collectionTours, setCollectionTours] = useState<PropertyTour[]>([])
  const [isLoadingTours, setIsLoadingTours] = useState(false)
  
  const fetchInProgressRef = useRef(false)
  const isInternalSyncRef = useRef(false)

  // Helper to transform backend collection to frontend type
  const transformBackendCollection = useCallback((backendCollection: any): Collection => {
    return {
      id: backendCollection.id,
      customer: (backendCollection.visitor_name || backendCollection.visitor_email) ? {
        id: backendCollection.id,
        firstName: backendCollection.visitor_name?.split(' ')[0] || 'Anonymous',
        lastName: backendCollection.visitor_name?.split(' ').slice(1).join(' ') || 'Visitor',
        email: backendCollection.visitor_email || 'anonymous@example.com',
        phone: backendCollection.visitor_phone || '(000) 000-0000',
        preferredContact: 'EMAIL' as const,
      } : {
        id: backendCollection.id,
        firstName: 'Registered',
        lastName: 'User',
        email: 'user@email.com',
        phone: '(000) 000-0000',
        preferredContact: 'EMAIL' as const,
      },
      propertyId: backendCollection.original_property?.id || 1,
      originalProperty: {
        id: backendCollection.original_property?.id || "1",
        ListingKey: backendCollection.original_property?.listing_key || "",
        FullStreetAddress: backendCollection.original_property?.street_address || backendCollection.name || "Collection Name Not Set",
        City: backendCollection.original_property?.city || "",
        StateOrProvince: backendCollection.original_property?.state || "",
        PostalCode: backendCollection.original_property?.zip_code || "",
        ListPrice: backendCollection.original_property?.price || 0,
        BedroomsTotal: backendCollection.original_property?.beds || 0,
        BathroomsTotal: backendCollection.original_property?.baths || 0,
        LivingArea: backendCollection.original_property?.sqft || 0,
        PropertyType: backendCollection.original_property?.property_type || "Single Family",
        ListPictureURL: backendCollection.original_property?.image_url || backendCollection.cover_image_url || 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400',
        MlsStatus: 'ACTIVE'
      },
      createdAt: backendCollection.created_at,
      updatedAt: backendCollection.updated_at,
      status: (backendCollection.status || 'ACTIVE') as 'ACTIVE' | 'INACTIVE',
      notifyVisitor: backendCollection.notify_visitor !== undefined ? backendCollection.notify_visitor : true,
      notifyAgent: backendCollection.notify_agent !== undefined ? backendCollection.notify_agent : true,
      isBlacklisted: backendCollection.is_blacklisted || false,
      preferences: backendCollection.preferences ? {
        ...backendCollection.preferences,
        priceRange: (backendCollection.preferences?.min_price && backendCollection.preferences?.max_price) ? 
          `$${formatPrice(backendCollection.preferences.min_price)} - $${formatPrice(backendCollection.preferences.max_price)}` : 
          backendCollection.preferences?.min_price ? 
          `$${formatPrice(backendCollection.preferences.min_price)}+` :
          backendCollection.preferences?.max_price ?
          `Under $${formatPrice(backendCollection.preferences.max_price)}` :
          'Not specified',
        visitingReason: backendCollection.preferences?.visiting_reason || 'Not specified',
        hasAgent: backendCollection.preferences?.has_agent || 'Not specified',
        additionalComments: backendCollection.preferences?.special_features || ''
      } : {
        priceRange: 'Not specified',
        visitingReason: 'Not specified',
        hasAgent: 'Not specified',
        additionalComments: ''
      },
      stats: {
        totalProperties: backendCollection.stats?.totalProperties || 0,
        activeProperties: backendCollection.stats?.activeProperties || 0,
        newProperties: backendCollection.stats?.newProperties || 0,
        viewedProperties: backendCollection.stats?.viewedProperties || 0,
        likedProperties: backendCollection.stats?.likedProperties || 0,
        lastActivity: backendCollection.stats?.lastActivity || backendCollection.updated_at,
        lastAgentDismissedAt: backendCollection.stats?.lastAgentDismissedAt
      },
      shareToken: backendCollection.share_token,
      sharedAt: backendCollection.created_at,
      isPublic: backendCollection.is_public || false
    }
  }, [])

  // Load collections
  const fetchCollections = useCallback(async () => {
    if (isAuthenticating || !isAuthenticated) return
    if (fetchInProgressRef.current) return

    fetchInProgressRef.current = true
    setIsLoading(true)
    try {
      const { success, data, error } = await api.collections.getAll()
      
      if (success && data) {
        const transformedCollections = data.map(transformBackendCollection)
        setCollections(transformedCollections)
      } else {
        showToast(error || 'Failed to load showcases', 'error')
      }
    } catch (err) {
      console.error('Error loading collections:', err)
    } finally {
      setIsLoading(false)
      fetchInProgressRef.current = false
    }
  }, [isAuthenticating, isAuthenticated, showToast, transformBackendCollection])

  useEffect(() => {
    fetchCollections()
  }, [fetchCollections])

  // Handle URL sync
  useEffect(() => {
    const showcaseId = searchParams.get('showcase')
    if (showcaseId && collections.length > 0) {
      const collection = collections.find(c => c.id === showcaseId)
      if (collection) {
        setSelectedCollection(collection)
      }
    } else if (!showcaseId) {
      setSelectedCollection(null)
    }
  }, [searchParams, collections])

  const fetchPropertiesFromCollection = async (collectionId: string) => {
    try {
      const { success, data } = await api.collections.getProperties(collectionId)
      if (success && data) {
        setMatchedProperties(data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    if (selectedCollection) {
      fetchPropertiesFromCollection(selectedCollection.id)
    }
  }, [selectedCollection])

  // --- API HANDLERS ---

  const handlePropertyLike = async (propertyId: string | number, liked: boolean) => {
    if (!selectedCollection) return
    const { success, data, error } = await api.collections.interact(selectedCollection.id, String(propertyId), 'like', liked)
    if (success && data?.interaction) {
      setMatchedProperties(prev => prev.map(p => p.id === propertyId ? { ...p, liked: data.interaction.liked, disliked: data.interaction.disliked } : p))
      
      // Also update selectedProperty if it's the one being liked
      if (selectedProperty && selectedProperty.id === propertyId) {
        setSelectedProperty(prev => prev ? { 
          ...prev, 
          liked: data.interaction.liked, 
          disliked: data.interaction.disliked 
        } : null)
      }
      
      showToast(liked ? 'Property added to your likes!' : 'Property removed from your likes', 'success')
    } else {
      showToast(error || 'Failed to update like status', 'error')
    }
  }

  const handlePropertyDislike = async (propertyId: string | number, disliked: boolean) => {
    if (!selectedCollection) return
    const { success, data, error } = await api.collections.interact(selectedCollection.id, String(propertyId), 'dislike', disliked)
    if (success && data?.interaction) {
      setMatchedProperties(prev => prev.map(p => p.id === propertyId ? { ...p, liked: data.interaction.liked, disliked: data.interaction.disliked } : p))
      
      // Also update selectedProperty if it's the one being disliked
      if (selectedProperty && selectedProperty.id === propertyId) {
        setSelectedProperty(prev => prev ? { 
          ...prev, 
          liked: data.interaction.liked, 
          disliked: data.interaction.disliked 
        } : null)
      }
      
      showToast(disliked ? 'Property marked as not interested' : 'Property unmarked as not interested', 'success')
    } else {
      showToast(error || 'Failed to update status', 'error')
    }
  }

  const handleAddComment = async (propertyId: string | number, comment: string) => {
    if (!selectedCollection) return

    const agentName = user?.first_name 
      ? `${user.first_name} ${user.last_name || ''}`.trim()
      : 'You'

    const optimisticComment: Comment = {
      id: Date.now(),
      author: agentName,
      content: comment,
      createdAt: new Date().toISOString()
    }

    // Update local state immediately
    setSelectedProperty(prev => prev && prev.id === propertyId ? {
      ...prev,
      comments: [...(prev.comments || []), optimisticComment]
    } : prev)

    try {
      const { success, data, error } = await api.collections.addComment(
        selectedCollection.id,
        String(propertyId),
        comment,
        agentName
      )

      if (success && data) {
        const serverComment = { 
          ...data.comment, 
          createdAt: data.comment.created_at || data.comment.createdAt,
          author: data.comment.author || agentName
        }
        
        // Replace optimistic comment with server response
        setSelectedProperty(prev => prev && prev.id === propertyId ? {
          ...prev,
          comments: (prev.comments || []).map(c => c.id === optimisticComment.id ? serverComment : c)
        } : prev)

        setMatchedProperties(prev => prev.map(p => p.id === propertyId ? { 
          ...p, 
          comments: [...(p.comments || []).filter(c => c.id !== optimisticComment.id), serverComment] 
        } : p))
      } else {
        throw new Error(error || 'Failed to post comment')
      }
    } catch (error) {
      console.error('Error adding property comment:', error)
      showToast('Failed to post comment', 'error')
      // Rollback optimistic update
      setSelectedProperty(prev => prev && prev.id === propertyId ? {
        ...prev,
        comments: (prev.comments || []).filter(c => c.id !== optimisticComment.id)
      } : prev)
    }
  }

  const fetchPropertyComments = async (propertyId: string) => {
    if (!selectedCollection) return
    setIsLoadingComments(true)
    const { success, data } = await api.collections.getPropertyComments(selectedCollection.id, propertyId)
    if (success && data) {
      const transformedComments = data.map((c: any) => ({ ...c, createdAt: c.created_at || c.createdAt, author: c.author || c.visitor_name || 'Anonymous' }))
      setSelectedProperty(prev => prev ? { ...prev, comments: transformedComments } : null)
    }
    setIsLoadingComments(false)
  }

  const loadPropertyDetails = useCallback(async (property: Property) => {
    // Track property view (if needed for agent, optional, but keeping consistent)
    // api.collections.trackPropertyView(...)

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

    fetchPropertyComments(String(property.id))
  }, [selectedCollection?.id])

  const handlePropertyClick = useCallback((property: Property) => {
    // 1. Mark this as an internal update to prevent the useEffect from looping
    isInternalSyncRef.current = true
    
    // 2. Update state instantly for immediate UI response
    setSelectedProperty(property)
    setIsModalOpen(true)
    loadPropertyDetails(property)

    // 3. Update URL in background without triggering router overhead
    if (selectedCollection) {
      const currentParams = new URLSearchParams(window.location.search)
      currentParams.set('property', String(property.id))
      window.history.pushState(null, '', `?${currentParams.toString()}`)
    }

    // Reset the ref after a short delay to allow searchParams to catch up
    setTimeout(() => { isInternalSyncRef.current = false }, 100)
  }, [selectedCollection?.id, loadPropertyDetails])

  const handleCloseModal = useCallback(() => {
    isInternalSyncRef.current = true
    
    // 1. Update state instantly
    setIsModalOpen(false)
    setSelectedProperty(null)

    // 2. Update URL in background
    const currentParams = new URLSearchParams(window.location.search)
    if (currentParams.has('property')) {
      currentParams.delete('property')
      const newUrl = currentParams.toString() ? `?${currentParams.toString()}` : window.location.pathname
      window.history.pushState(null, '', newUrl)
    }

    setTimeout(() => { isInternalSyncRef.current = false }, 100)
  }, [])

  // Handle URL sync for property details (Refresh/Direct Link Support)
  useEffect(() => {
    // If we just updated the state manually, ignore this sync cycle
    if (isInternalSyncRef.current) return

    const propertyId = searchParams.get('property')
    
    // Only trigger if URL has a property that isn't currently selected
    if (propertyId && matchedProperties.length > 0) {
      if (!selectedProperty || String(selectedProperty.id) !== propertyId) {
        const property = matchedProperties.find(p => String(p.id) === propertyId)
        if (property) {
          setSelectedProperty(property)
          setIsModalOpen(true)
          loadPropertyDetails(property)
        }
      }
    } else if (!propertyId && isModalOpen) {
      // Handle browser 'Back' button
      setIsModalOpen(false)
      setSelectedProperty(null)
    }
  }, [searchParams, matchedProperties, selectedProperty?.id, isModalOpen, loadPropertyDetails])

  const handleStatusToggle = async (collectionId: string) => {
    const collection = collections.find(c => c.id === collectionId)
    if (!collection) return
    const newStatus = collection.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    const { success, error } = await api.collections.updateStatus(collectionId, newStatus)
    if (success) {
      setCollections(prev => prev.map(c => c.id === collectionId ? { ...c, status: newStatus } : c))
      if (selectedCollection?.id === collectionId) {
        setSelectedCollection(prev => prev ? { ...prev, status: newStatus } : null)
      }
    } else {
      showToast(error || 'Failed to update status', 'error')
    }
  }

  const handleNotificationToggle = async (collectionId: string, type: 'visitor' | 'agent') => {
    const collection = collections.find(c => c.id === collectionId)
    if (!collection) return
    const newNotifyVisitor = type === 'visitor' ? !collection.notifyVisitor : collection.notifyVisitor
    const newNotifyAgent = type === 'agent' ? !collection.notifyAgent : collection.notifyAgent
    const { success, error } = await api.collections.updateNotifications(collectionId, newNotifyVisitor, newNotifyAgent)
    if (success) {
      setCollections(prev => prev.map(c => c.id === collectionId ? { ...c, notifyVisitor: newNotifyVisitor, notifyAgent: newNotifyAgent } : c))
      if (selectedCollection?.id === collectionId) {
        setSelectedCollection(prev => prev ? { ...prev, notifyVisitor: newNotifyVisitor, notifyAgent: newNotifyAgent } : null)
      }
      showToast('Notification settings updated', 'success')
    } else {
      showToast(error || 'Failed to update notification settings', 'error')
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteModalState.collection) return
    setIsDeleting(true)
    const { success, error } = await api.collections.delete(deleteModalState.collection.id)
    if (success) {
      setCollections(prev => prev.filter(c => c.id !== deleteModalState.collection!.id))
      if (selectedCollection?.id === deleteModalState.collection.id) setSelectedCollection(null)
      setDeleteModalState({ isOpen: false, collection: null })
      showToast('Showcase deleted', 'success')
    } else {
      showToast(error || 'Failed to delete showcase', 'error')
    }
    setIsDeleting(false)
  }

  const handleDismissNew = async (collectionId: string) => {
    const { success, error } = await api.collections.dismiss(collectionId)
    if (success) {
      setCollections(prev => prev.map(c => 
        c.id === collectionId 
          ? { ...c, stats: { ...c.stats, newProperties: 0, lastAgentDismissedAt: new Date().toISOString() } } 
          : c
      ))
      showToast('New listings dismissed', 'success')
    } else {
      showToast(error || 'Failed to dismiss listings', 'error')
    }
  }

  const handleSavePreferences = async (collectionId: string, preferences: any) => {
    const { success, error } = await api.collections.updatePreferencesAndRefresh(collectionId, preferences)
    if (success) {
      showToast('Preferences updated and properties refreshed!', 'success')
      setIsEditPreferencesModalOpen(false)
      // Since backend doesn't return full transformed collection, refresh the list
      fetchCollections()
    } else {
      showToast(error || 'Failed to save preferences', 'error')
    }
  }

  const handleCreateCollection = async (collectionData: any) => {
    try {
      const payload = {
        name: collectionData.showcaseName,
        visitor_name: collectionData.fullName,
        visitor_email: collectionData.email,
        visitor_phone: collectionData.phone,
        visiting_reason: collectionData.visitingReason,
        has_agent: collectionData.hasAgent,
        additional_comments: collectionData.additionalComments || '',
        
        // Preferences
        min_beds: collectionData.minBeds ? parseInt(collectionData.minBeds) : null,
        max_beds: collectionData.maxBeds ? parseInt(collectionData.maxBeds) : null,
        min_baths: collectionData.minBaths ? parseFloat(collectionData.minBaths) : null,
        max_baths: collectionData.maxBaths ? parseFloat(collectionData.maxBaths) : null,
        min_price: collectionData.minPrice ? parseInt(collectionData.minPrice) : null,
        max_price: collectionData.maxPrice ? parseInt(collectionData.maxPrice) : null,
        min_year_built: collectionData.minYearBuilt ? parseInt(collectionData.minYearBuilt) : null,
        max_year_built: collectionData.maxYearBuilt ? parseInt(collectionData.maxYearBuilt) : null,
        cities: collectionData.cities || [],
        townships: collectionData.townships || [],
        address: collectionData.address,
        lat: collectionData.lat,
        long: collectionData.long,
        diameter: parseFloat(parseFloat(collectionData.diameter).toFixed(1)),
        
        // Property types
        is_town_house: collectionData.isTownHouse || false,
        is_lot_land: collectionData.isLotLand || false,
        is_condo: collectionData.isCondo || false,
        is_multi_family: collectionData.isMultiFamily || false,
        is_single_family: collectionData.isSingleFamily || false,
        is_apartment: collectionData.isApartment || false,
        is_commercial: collectionData.isCommercial || false,
        is_farm: collectionData.isFarm || false
      }

      const { success, data, error } = await api.collections.createManually(payload)
      if (success && data) {
        setIsCreateModalOpen(false)
        showToast('Showcase created successfully!', 'success')
        // Trigger full refresh to get the latest list including property counts
        await fetchCollections()
      } else {
        showToast(error || 'Failed to create showcase', 'error')
      }
    } catch (error) {
      console.error('Error creating collection:', error)
      showToast('Failed to create showcase', 'error')
    }
  }

  const handleViewTours = async () => {
    if (!selectedCollection) return
    setIsLoadingTours(true)
    setIsToursModalOpen(true)
    const { success, data } = await api.collections.getTours(selectedCollection.id)
    if (success && data) {
      const enrichedTours = data.map((tour: PropertyTour) => {
        const prop = matchedProperties?.find(p => p.id === tour.property_id)
        return { ...tour, property: prop ? { street_address: prop.FullStreetAddress, city: prop.City, state: prop.StateOrProvince, imageUrl: prop.ListPictureURL } : undefined }
      })
      setCollectionTours(enrichedTours)
    }
    setIsLoadingTours(false)
  }

  const handleUpdateTourCompletion = async (tourId: string, isCompleted: boolean) => {
    const { success } = await api.collections.updateTourCompletion(tourId, isCompleted)
    if (success && selectedCollection) {
      const { data } = await api.collections.getTours(selectedCollection.id)
      if (data) setCollectionTours(data)
    }
  }

  // --- RENDERING ---

  if (isAuthenticating) {
    return (
      <div className="min-h-screen bg-[#f8f8f6] dark:bg-[#0B0B0B] flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8b7355] mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Verifying session...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B] flex flex-col transition-colors duration-300">
      {selectedCollection ? (
        <DetailView
          selectedCollection={selectedCollection}
          matchedProperties={matchedProperties}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tabCounts={{
            all: matchedProperties.length,
            liked: matchedProperties.filter(p => p.liked).length,
            disliked: matchedProperties.filter(p => p.disliked).length
          }}
          sortBy={sortBy}
          setSortBy={setSortBy}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          onBack={() => router.push('/showcases', { scroll: false })}
          onStatusToggle={handleStatusToggle}
          onNotificationToggle={handleNotificationToggle}
          onViewTours={handleViewTours}
          onPropertyLike={handlePropertyLike}
          onPropertyDislike={handlePropertyDislike}
          onPropertyClick={handlePropertyClick}
          onAddComment={handleAddComment}
          selectedProperty={selectedProperty}
          isModalOpen={isModalOpen}
          onCloseModal={handleCloseModal}
          isLoadingDetails={isLoadingDetails}
          detailsError={detailsError}
          isLoadingComments={isLoadingComments}
          commentsError={commentsError}
          isToursModalOpen={isToursModalOpen}
          onCloseToursModal={() => setIsToursModalOpen(false)}
          collectionTours={collectionTours}
          onUpdateTourCompletion={handleUpdateTourCompletion}
          isLoadingTours={isLoadingTours}
        />
      ) : (
        <DashboardView
          collections={collections}
          isLoading={isLoading}
          onCreateClick={() => setIsCreateModalOpen(true)}
          onCollectionClick={(c) => {
            setSelectedCollection(c)
            // Use history.pushState for instant URL update without full router re-eval
            window.history.pushState(null, '', `?showcase=${c.id}`)
            // Smooth scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          onShare={(c) => { setSelectedCollectionForShare(c); setIsShareModalOpen(true); }}

          onEditPreferences={(c) => { setSelectedCollectionForEdit(c); setIsEditPreferencesModalOpen(true); }}
          onDelete={(c) => setDeleteModalState({ isOpen: true, collection: c })}
          onStatusToggle={handleStatusToggle}
          onDismissNew={handleDismissNew}
          formatPriceRange={formatPriceRange}
        />
      )}
      <Footer />

      <ShareCollectionModal
        collection={selectedCollectionForShare}
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        onGenerateShareLink={(id) => api.collections.share(id, { make_public: true }).then(fetchCollections)}
        onRegenerateShareLink={(id) => api.collections.share(id, { make_public: true, force_regenerate: true }).then(fetchCollections)}
        onUpdateShareSettings={(id, isPub) => api.collections.share(id, { make_public: isPub }).then(fetchCollections)}
      />

      <EditPreferencesModal
        collection={selectedCollectionForEdit}
        isOpen={isEditPreferencesModalOpen}
        onClose={() => setIsEditPreferencesModalOpen(false)}
        onSave={handleSavePreferences}
      />

      <DeleteConfirmationModal
        collection={deleteModalState.collection}
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ isOpen: false, collection: null })}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />

      <CreateCollectionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateCollection}
      />
    </div>
  )
}

export default function ShowcasesPage() {
  return (
    <AuthGuard>
      <BrokerAuthorizationGuard>
        <SubscriptionGuard requiredPlan="PREMIUM">
          <Suspense fallback={null}>
            <ShowcaseContent />
          </Suspense>
        </SubscriptionGuard>
      </BrokerAuthorizationGuard>
    </AuthGuard>
  )
}
