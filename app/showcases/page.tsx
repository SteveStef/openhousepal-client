'use client'

import OhpLoader from '@/components/brand/OhpLoader'

import { useState, useEffect, useMemo, useRef, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Collection, CollectionPreferences, Property, Comment, TourRequest, PropertyTour, Site, SiteDomain, ShowcaseInbox, ShowcaseActivityItem } from '@/types'
import Footer from '@/components/Footer'
import ShareCollectionModal from '@/components/ShareCollectionModal'
import ShowcaseMapEditor from '@/components/ShowcaseMapEditor'
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal'
import ViewToursModal from '@/components/ViewToursModal'
import AuthGuard from '@/components/AuthGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import BrokerAuthorizationGuard from '@/components/BrokerAuthorizationGuard'
import { useToast } from '@/contexts/ToastContext'
import api from '@/lib/api-service'
import { openHousePalPublicUrl, websitePublicUrl } from '@/lib/publicResourceLinks'
import { useAuth } from '@/contexts/AuthContext'
import { isPropertyAvailableStatus } from '@/lib/utils'

// Sub-components
import { DashboardView } from './components/DashboardView'
import { DetailView } from './components/DetailView'
import ShowcaseActivityInbox from './components/ShowcaseActivityInbox'
import { CreateCollectionModal, type ShowcaseClientInfo } from './components/CreateCollectionModal'
import { copyText } from '@/lib/copyText'

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
  const [idxSite, setIdxSite] = useState<Site | null>(null)
  const [idxDomains, setIdxDomains] = useState<SiteDomain[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null)
  const [matchedProperties, setMatchedProperties] = useState<Property[]>([])
  const [activeTab, setActiveTab] = useState<'all' | 'liked' | 'disliked' | 'sold_removed'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  
  // Sorting state
  const [sortBy, setSortBy] = useState<'price' | 'pricePerSqft' | 'beds' | 'baths' | 'squareFeet' | 'acres' | 'yearBuilt' | 'daysOnMarket' | 'lastUpdated'>('daysOnMarket')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  
  // Modal states
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [selectedCollectionForShare, setSelectedCollectionForShare] = useState<Collection | null>(null)
  const [isEditPreferencesModalOpen, setIsEditPreferencesModalOpen] = useState(false)
  const [selectedCollectionForEdit, setSelectedCollectionForEdit] = useState<Collection | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  // Create flow: the wizard (client + about them), then the map editor for the search area.
  // `createKey` remounts the wizard fresh after a create or cancel.
  const [createKey, setCreateKey] = useState(0)
  const [createInfo, setCreateInfo] = useState<ShowcaseClientInfo | null>(null)
  const [createPrefs, setCreatePrefs] = useState<Partial<CollectionPreferences> | undefined>(undefined)
  const [isCreateSearchOpen, setIsCreateSearchOpen] = useState(false)
  // A stand-in collection for the editor while creating - only changes between steps, never
  // while the editor is open (the editor reloads its form whenever this object changes).
  const createDraft = useMemo(() => {
    if (!createInfo) return null
    const [firstName, ...rest] = createInfo.fullName.split(/\s+/)
    return { id: '', name: createInfo.showcaseName, customer: { firstName, lastName: rest.join(' ') }, preferences: createPrefs } as unknown as Collection
  }, [createInfo, createPrefs])
  const resetCreate = () => {
    setIsCreateModalOpen(false)
    setIsCreateSearchOpen(false)
    setCreateInfo(null)
    setCreatePrefs(undefined)
    setCreateKey(k => k + 1)
  }
  // Header inboxes - tour requests still waiting on the agent + client activity, across Showcases.
  const [inbox, setInbox] = useState<ShowcaseInbox>({ tours: [], activity: [], unread_activity: 0 })
  const [isActivityInboxOpen, setIsActivityInboxOpen] = useState(false)
  const [deleteAlsoRemoves, setDeleteAlsoRemoves] = useState<string[] | null>(null)
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
  // Which collection the open tours modal belongs to - the modal can now be opened straight
  // from the dashboard without navigating into the showcase, so selectedCollection may be null.
  const [toursCollectionId, setToursCollectionId] = useState<string | null>(null)

  // Quick comment popover state - lets the agent reply from a property card without opening
  // the full details modal.
  const [quickCommentPropertyId, setQuickCommentPropertyId] = useState<string | number | null>(null)
  const [isQuickCommentOpen, setIsQuickCommentOpen] = useState(false)
  const [isLoadingQuickComments, setIsLoadingQuickComments] = useState(false)

  const fetchInProgressRef = useRef(false)
  const isInternalSyncRef = useRef(false)

  useEffect(() => {
    if (!user) return
    Promise.all([api.sites.getMine(), api.sites.getDomains()])
      .then(([siteResponse, domainsResponse]) => {
        if (siteResponse.success && siteResponse.data) setIdxSite(siteResponse.data)
        if (domainsResponse.success && domainsResponse.data) setIdxDomains(domainsResponse.data)
      })
      .catch(() => {})
  }, [user])

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
      propertyId: backendCollection.originalProperty?.id || 1,
      // Backend key is camelCase (originalProperty) - genuinely null/absent for showcases with no
      // linked open house and no agent-chosen compare property, not something to paper over with
      // a fake fallback object (that previously made match scores always compute against 0s).
      originalProperty: backendCollection.originalProperty ? {
        id: backendCollection.originalProperty.id || backendCollection.originalProperty.listingKey || "1",
        ListingKey: backendCollection.originalProperty.listingKey || "",
        FullStreetAddress: backendCollection.originalProperty.address || backendCollection.name || "Collection Name Not Set",
        City: backendCollection.originalProperty.city || "",
        StateOrProvince: backendCollection.originalProperty.state || "",
        PostalCode: backendCollection.originalProperty.zipCode || "",
        ListPrice: backendCollection.originalProperty.price || 0,
        BedroomsTotal: backendCollection.originalProperty.beds || 0,
        BathroomsTotal: backendCollection.originalProperty.baths || 0,
        LivingArea: backendCollection.originalProperty.squareFeet || 0,
        LotSizeAcres: backendCollection.originalProperty.acres || 0,
        SchoolDistrictName: backendCollection.originalProperty.schoolDistrictName || '',
        Latitude: backendCollection.originalProperty.latitude || null,
        Longitude: backendCollection.originalProperty.longitude || null,
        PropertyType: backendCollection.originalProperty.propertyType || "Single Family",
        ListPictureURL: backendCollection.originalProperty.image || backendCollection.cover_image_url || 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400',
        MlsStatus: backendCollection.originalProperty.homeStatus || 'ACTIVE'
      } : null,
      createdAt: backendCollection.created_at,
      updatedAt: backendCollection.updated_at,
      status: (backendCollection.status || 'ACTIVE') as 'ACTIVE' | 'INACTIVE',
      notifyVisitor: backendCollection.notify_visitor !== undefined ? backendCollection.notify_visitor : true,
      notifyAgent: backendCollection.notify_agent !== undefined ? backendCollection.notify_agent : true,
      isBlacklisted: backendCollection.is_blacklisted || false,
      source: backendCollection.source || null,
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
        lastActivity: backendCollection.stats?.lastActivity || null,
        lastAgentDismissedAt: backendCollection.stats?.lastAgentDismissedAt,
        activityCounts: backendCollection.stats?.activityCounts || {},
        tourRequestedCount: backendCollection.stats?.tourRequestedCount || 0,
        commentPropertyId: backendCollection.stats?.commentPropertyId || null
      },
      shareToken: backendCollection.share_token,
      sharedAt: backendCollection.created_at,
      isPublic: backendCollection.is_public || false,
      matchedProperties: backendCollection.matchedProperties || [],
      refineRequestMessage: backendCollection.refine_request_message || null,
      refineRequestAt: backendCollection.refine_request_at || null,
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

  const fetchInbox = useCallback(async () => {
    const { success, data } = await api.collections.getInbox()
    if (success && data) setInbox(data)
  }, [])

  // Refresh the inboxes whenever the Showcase list itself reloads (after any tour/comment action).
  useEffect(() => {
    if (isAuthenticated && !isLoading) fetchInbox()
  }, [collections, isAuthenticated, isLoading, fetchInbox])

  useEffect(() => {
    if (searchParams.get('new') === '1') setIsCreateModalOpen(true)
  }, [searchParams])

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

  // Opening a showcase - by any path (deep link from a Leads/Dashboard alert, or clicking a card
  // directly) - clears its pending like/dislike/comment/tour-request tags server-side, once per
  // collection per page load (a ref, not state, so it doesn't itself trigger a re-render).
  const markedSeenRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!selectedCollection?.id || markedSeenRef.current.has(selectedCollection.id)) return
    markedSeenRef.current.add(selectedCollection.id)
    api.collections.markSeen(selectedCollection.id)
    // Opening it = seeing its new matches: the card's NEW photos + "N NEW" clear (server does the
    // same). NEW on the homes inside stays until each one is opened.
    const seenId = selectedCollection.id
    setCollections(prev => prev.map(c => c.id === seenId
      ? { ...c, stats: { ...c.stats, newProperties: 0 }, matchedProperties: c.matchedProperties?.map(p => ({ ...p, is_new: false })) }
      : c))
  }, [selectedCollection?.id])

  // Deep link from Leads/the Daily Digest (?showcase=X&open=tours) - once, so re-opening the
  // tours modal later doesn't get fought by this effect re-firing on an unrelated re-render.
  const autoOpenedToursRef = useRef(false)
  useEffect(() => {
    if (autoOpenedToursRef.current) return
    const showcaseId = searchParams.get('showcase')
    if (searchParams.get('open') !== 'tours' || !showcaseId || collections.length === 0) return
    const collection = collections.find(c => c.id === showcaseId)
    if (!collection) return
    autoOpenedToursRef.current = true
    handleViewTours(collection)
  }, [searchParams, collections])

  // Which Showcase's homes are on screen - until the opened one's arrive, the logo loader shows
  // instead of an empty (or the previous client's) Showcase.
  const [loadedForId, setLoadedForId] = useState<string | null>(null)
  const fetchPropertiesFromCollection = async (collectionId: string) => {
    try {
      const { success, data } = await api.collections.getProperties(collectionId)
      if (success && data) {
        setMatchedProperties(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadedForId(collectionId)
    }
  }

  useEffect(() => {
    if (selectedCollection) {
      fetchPropertiesFromCollection(selectedCollection.id)
    }
  }, [selectedCollection])
  const openingShowcase = !!selectedCollection && loadedForId !== selectedCollection.id

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
      isAgent: true,
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
          author: data.comment.author || agentName,
          isAgent: true
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
      const transformedComments = data.map((c: any) => ({ ...c, createdAt: c.created_at || c.createdAt, author: c.author || c.visitor_name || 'Anonymous', isAgent: !!(c.is_agent ?? c.isAgent) }))
      setSelectedProperty(prev => prev ? { ...prev, comments: transformedComments } : null)
      // Actually reading the thread clears its unread badge on the card - the server already
      // marked it read, this just keeps the UI in sync without waiting for a refetch.
      setMatchedProperties(prev => prev.map(p => String(p.id) === propertyId ? { ...p, comments: transformedComments, unreadCommentCount: 0 } : p))
    }
    setIsLoadingComments(false)
  }

  const loadPropertyDetails = useCallback(async (property: Property) => {
    if (selectedCollection?.id) {
      api.collections.trackPropertyView(selectedCollection.id, String(property.id))
      if (property.is_new) {
        setMatchedProperties(prev => prev.map(p => p.id === property.id ? { ...p, is_new: false } : p))
        // Keep the dashboard card's own copy of this collection's properties - and its "N New"
        // count badge - in sync too, so both are already correct when the agent navigates back.
        setCollections(prev => prev.map(c => {
          if (c.id !== selectedCollection.id) return c
          const updatedMatched = c.matchedProperties?.map(p => p.id === property.id ? { ...p, is_new: false } : p)
          return {
            ...c,
            matchedProperties: updatedMatched,
            stats: { ...c.stats, newProperties: updatedMatched?.filter(p => p.is_new).length ?? c.stats.newProperties },
          }
        }))
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
          ? {
              ...c,
              stats: { ...c.stats, newProperties: 0, lastAgentDismissedAt: new Date().toISOString() },
              matchedProperties: c.matchedProperties?.map(p => ({ ...p, is_new: false })),
            }
          : c
      ))
      showToast('New listings dismissed', 'success')
    } else {
      showToast(error || 'Failed to dismiss listings', 'error')
    }
  }

  const handleDismissRefineRequest = async (collectionId: string) => {
    setSelectedCollection(prev => (prev && prev.id === collectionId) ? { ...prev, refineRequestMessage: null, refineRequestAt: null } : prev)
    setCollections(prev => prev.map(c => c.id === collectionId ? { ...c, refineRequestMessage: null, refineRequestAt: null } : c))
    await api.collections.dismissRefineRequest(collectionId)
  }

  // Most collections are public by default (is_public defaults true at creation), so the common
  // click here should just copy the right link with no interruption - the IDX site's own showcase
  // URL when the agent has a published site, otherwise the OpenHousePal one. Only fall back to the
  // full modal (with its "Enable Access" flow) for the rare collection that isn't public yet.
  const handleShareClick = async (c: Collection) => {
    if (!c.isPublic || !c.shareToken) {
      setSelectedCollectionForShare(c)
      setIsShareModalOpen(true)
      return
    }
    const link = websitePublicUrl(idxSite, idxDomains, `/showcase/${c.shareToken}`) || openHousePalPublicUrl(`/showcase/${c.shareToken}`)
    try {
      await copyText(link)
      showToast('Share link copied!', 'success')
    } catch {
      showToast('Failed to copy link', 'error')
    }
  }

  const handleDashboardCollectionClick = (c: Collection) => {
    setSelectedCollection(c)
    // Opening the showcase clears its unread like/dislike badges server-side (see
    // get_properties) - update the dashboard card's copy immediately instead of leaving it
    // stale until the next full page load. Comment counts are excluded on purpose: those only
    // clear once the agent actually reads that property's thread, not just from opening the
    // showcase (see handleOpenQuickComment / fetchPropertyComments).
    setCollections(prev => prev.map(col => col.id === c.id
      ? { ...col, stats: { ...col.stats, activityCounts: { ...col.stats.activityCounts, LIKE: 0, DISLIKE: 0 } } }
      : col
    ))
    // Use history.pushState for instant URL update without full router re-eval
    window.history.pushState(null, '', `?showcase=${c.id}`)
    // Smooth scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handlePropertyPreviewClick = (collection: Collection, property: Property) => {
    // Clicking a NEW-tagged photo in the dashboard card's preview strip removes that
    // property's own tag - and updates the "N New" count badge - immediately, on top of
    // opening the showcase as usual.
    api.collections.trackPropertyView(collection.id, String(property.id))
    setCollections(prev => prev.map(c => {
      if (c.id !== collection.id) return c
      const updatedMatched = c.matchedProperties?.map(p => p.id === property.id ? { ...p, is_new: false } : p)
      return {
        ...c,
        matchedProperties: updatedMatched,
        stats: { ...c.stats, newProperties: updatedMatched?.filter(p => p.is_new).length ?? c.stats.newProperties },
      }
    }))
    handleDashboardCollectionClick(collection)
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

  const handleCreateCollection = async (info: ShowcaseClientInfo, prefs: Partial<CollectionPreferences>) => {
    try {
      const payload = {
        name: info.showcaseName,
        visitor_name: info.fullName,
        visitor_email: info.email,
        visitor_phone: info.phone,
        visiting_reason: info.visitingReason,
        has_agent: info.hasAgent,
        email_client: info.emailClient !== false,
        additional_comments: prefs.special_features || '',

        // Search - everything the map editor sets (the same fields Edit saves)
        min_beds: prefs.min_beds ?? null,
        max_beds: prefs.max_beds ?? null,
        min_baths: prefs.min_baths ?? null,
        max_baths: prefs.max_baths ?? null,
        min_price: prefs.min_price ?? null,
        max_price: prefs.max_price ?? null,
        min_year_built: prefs.min_year_built ?? null,
        max_year_built: prefs.max_year_built ?? null,
        min_sqft: prefs.min_sqft ?? null,
        max_sqft: prefs.max_sqft ?? null,
        min_acres: prefs.min_acres ?? null,
        max_acres: prefs.max_acres ?? null,
        cities: prefs.cities || [],
        townships: prefs.townships || [],
        school_districts: prefs.school_districts || [],
        counties: prefs.counties || [],
        search_polygon: prefs.search_polygon ?? null,
        address: prefs.address || '',
        lat: prefs.lat ?? null,
        long: prefs.long ?? null,
        diameter: prefs.diameter ? parseFloat(Number(prefs.diameter).toFixed(1)) : 0,
        special_features: prefs.special_features || '',
        compare_property_listing_key: prefs.compare_property_listing_key ?? null,
        show_match_score: prefs.show_match_score !== false,

        // Property types
        is_town_house: !!prefs.is_town_house,
        is_lot_land: !!prefs.is_lot_land,
        is_condo: !!prefs.is_condo,
        is_multi_family: !!prefs.is_multi_family,
        is_single_family: !!prefs.is_single_family,
        is_apartment: !!prefs.is_apartment,
        is_commercial: !!prefs.is_commercial,
        is_farm: !!prefs.is_farm,
      }

      const { success, data, error } = await api.collections.createManually(payload)
      if (success && data) {
        resetCreate()
        showToast(info.emailClient !== false ? `Showcase created - emailed to ${info.fullName.split(/\s+/)[0] || 'your client'}.` : 'Showcase created successfully!', 'success')
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

  // Fetches tours + properties for a collection and enriches each tour with its property's
  // address/photo for display - shared by the initial open and every refresh after an update
  // (completion toggle, confirm, unconfirm), since the modal can now be opened straight from
  // the dashboard where matchedProperties isn't necessarily loaded for that collection.
  const refreshCollectionTours = async (collectionId: string) => {
    const [toursRes, propsRes] = await Promise.all([
      api.collections.getTours(collectionId),
      api.collections.getProperties(collectionId)
    ])
    if (toursRes.success && toursRes.data) {
      const propsForLookup = (propsRes.success && propsRes.data) ? propsRes.data : []
      const enrichedTours = toursRes.data.map((tour: PropertyTour) => {
        const prop = propsForLookup.find((p: Property) => p.id === tour.property_id)
        return { ...tour, property: prop ? { street_address: prop.FullStreetAddress, city: prop.City, state: prop.StateOrProvince, imageUrl: prop.ListPictureURL } : undefined }
      })
      setCollectionTours(enrichedTours)
    }
  }

  const handleViewTours = async (collectionOverride?: Collection) => {
    const collection = collectionOverride || selectedCollection
    if (!collection) return
    setToursCollectionId(collection.id)
    setIsLoadingTours(true)
    setIsToursModalOpen(true)
    await refreshCollectionTours(collection.id)
    setIsLoadingTours(false)

    // Just looking doesn't clear the tour marker - it stays until each request is confirmed or
    // marked handled (the counts come from the server's pending tours).
    fetchCollections()
  }

  // Tour requests inbox: every request still waiting on you, from every Showcase.
  const handleOpenTourInbox = () => {
    setToursCollectionId(null)
    setCollectionTours(inbox.tours)
    setIsLoadingTours(false)
    setIsToursModalOpen(true)
  }

  // After a confirm / handled / unconfirm: refresh the window's list, the cards and the inboxes.
  const afterTourChange = async (tourId: string, patch: Partial<PropertyTour>) => {
    if (toursCollectionId) {
      await refreshCollectionTours(toursCollectionId)
      if (toursCollectionId === selectedCollection?.id) fetchPropertiesFromCollection(toursCollectionId)
    } else {
      // Inbox mode - keep the row in view with its new state until the window closes.
      setCollectionTours(prev => prev.map(t => t.id === tourId ? { ...t, ...patch } : t))
    }
    fetchCollections()
    fetchInbox()
  }

  const handleOpenActivityInbox = () => {
    setIsActivityInboxOpen(true)
    if (inbox.unread_activity > 0) {
      // Seen now - the badge clears; rows keep their "new" highlight until the window closes.
      api.collections.markInboxRead()
      setInbox(prev => ({ ...prev, unread_activity: 0 }))
    }
  }

  const handleCloseActivityInbox = () => {
    setIsActivityInboxOpen(false)
    setInbox(prev => ({ ...prev, activity: prev.activity.map(a => ({ ...a, is_read: true })) }))
  }

  const handleOpenActivityItem = (item: ShowcaseActivityItem) => {
    handleCloseActivityInbox()
    const collection = collections.find(c => c.id === item.collection_id)
    if (item.type === 'TOUR_REQUEST' && collection) {
      handleViewTours(collection)
      return
    }
    router.push(item.link || `/showcases?showcase=${item.collection_id}`, { scroll: false })
  }

  // A card's comment badge opens the Showcase straight onto that home's conversation.
  const handleOpenComments = (c: Collection) => {
    const pid = c.stats.commentPropertyId
    setSelectedCollection(c)
    window.history.pushState(null, '', pid ? `?showcase=${c.id}&property=${pid}&comments=1` : `?showcase=${c.id}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleAskDelete = (c: Collection) => {
    setDeleteAlsoRemoves(null)
    setDeleteModalState({ isOpen: true, collection: c })
    api.collections.getDeletePreview(c.id).then(({ success, data }) => {
      if (success && data) setDeleteAlsoRemoves(data.followups)
    })
  }

  const handleDashboardTourClick = (collection: Collection) => {
    // Just opens the tours modal in place - doesn't also navigate into the showcase.
    handleViewTours(collection)
  }

  const handleOpenQuickComment = async (property: Property) => {
    setQuickCommentPropertyId(property.id)
    setIsQuickCommentOpen(true)
    if (!selectedCollection) return
    setIsLoadingQuickComments(true)
    const { success, data } = await api.collections.getPropertyComments(selectedCollection.id, String(property.id))
    if (success && data) {
      const transformedComments = data.map((c: any) => ({ ...c, createdAt: c.created_at || c.createdAt, author: c.author || c.visitor_name || 'Anonymous' }))
      setMatchedProperties(prev => prev.map(p => p.id === property.id ? { ...p, comments: transformedComments, unreadCommentCount: 0 } : p))
    }
    setIsLoadingQuickComments(false)
  }

  const handleCloseQuickComment = () => {
    setIsQuickCommentOpen(false)
    setQuickCommentPropertyId(null)
  }

  const quickCommentProperty = matchedProperties.find(p => p.id === quickCommentPropertyId) || null

  const handleUpdateTourCompletion = async (tourId: string, isCompleted: boolean) => {
    const { success } = await api.collections.updateTourCompletion(tourId, isCompleted)
    // Pending tours drive the card + header badges - refetch them so they clear right away.
    if (success) await afterTourChange(tourId, { is_completed: isCompleted })
  }

  const handleConfirmTour = async (tourId: string, confirmedDate: string, confirmedTime: string) => {
    const { success, error, data } = await api.collections.confirmTour(tourId, confirmedDate, confirmedTime)
    if (success) {
      await afterTourChange(tourId, { confirmed_date: confirmedDate, confirmed_time: confirmedTime })
      const cal = (data as { calendar_status?: string | null } | undefined)?.calendar_status
      if (cal === 'error') {
        showToast('Tour confirmed, but adding it to your Google Calendar failed - check Settings → Integrations.', 'error')
      } else {
        showToast(
          cal === 'added'
            ? 'Tour confirmed and added to your Google Calendar'
            : cal === 'not_connected'
              ? 'Tour confirmed. Connect Google Calendar in Settings to auto-add confirmed tours to your calendar.'
              : 'Tour confirmed - the visitor will see it as upcoming',
          'success'
        )
      }
    } else {
      showToast(error || 'Failed to confirm tour', 'error')
    }
  }

  const handleUnconfirmTour = async (tourId: string) => {
    const { success, error } = await api.collections.unconfirmTour(tourId)
    if (success) {
      await afterTourChange(tourId, { confirmed_date: null, confirmed_time: null })
    } else {
      showToast(error || 'Failed to unconfirm tour', 'error')
    }
  }

  // --- RENDERING ---

  if (isAuthenticating) {
    return (
      <OhpLoader />
    )
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B] flex flex-col transition-colors duration-300">
      {/* No initial={false} here - that prop suppresses the entrance animation for whatever's
          present on the very first render, which was silently killing the dashboard's own
          fade-in AND the nested ShowcaseCard stagger-fade on a fresh page load (they inherit
          the AnimatePresence's presence context even though they're several levels deep and set
          their own explicit initial/animate props). The Opens page has no such wrapper around
          its card grid, so its stagger always plays - dropping this here makes /showcases match. */}
      <AnimatePresence mode="wait">
      {selectedCollection && openingShowcase ? (
        <motion.div
          key="opening"
          className="flex min-h-[72vh] flex-1 items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.2 } }}
          exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.18 } }}
        >
          <OhpLoader fullScreen={false} label={`Opening ${selectedCollection.customer.firstName}'s Showcase`} />
        </motion.div>
      ) : selectedCollection ? (
        <motion.div
          key="detail"
          initial={{ opacity: 0, y: 26, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 30 } }}
          exit={{ opacity: 0, y: 14, scale: 0.99, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
        >
        <DetailView
          focusComments={searchParams.get('comments') === '1'}
          selectedCollection={selectedCollection}
          matchedProperties={matchedProperties}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tabCounts={{
            all: matchedProperties.filter(p => !p.disliked && isPropertyAvailableStatus(p.MlsStatus)).length,
            liked: matchedProperties.filter(p => p.liked && isPropertyAvailableStatus(p.MlsStatus)).length,
            disliked: matchedProperties.filter(p => p.disliked && isPropertyAvailableStatus(p.MlsStatus)).length,
            soldRemoved: matchedProperties.filter(p => !isPropertyAvailableStatus(p.MlsStatus)).length
          }}
          sortBy={sortBy}
          setSortBy={setSortBy}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          onBack={() => router.push('/showcases', { scroll: false })}
          onEditShowcase={() => { setSelectedCollectionForEdit(selectedCollection); setIsEditPreferencesModalOpen(true); }}
          onShare={() => { setSelectedCollectionForShare(selectedCollection); setIsShareModalOpen(true); }}
          onQuickSave={async (prefs) => {
            const before = new Set(matchedProperties.map(p => String(p.id)))
            const { success, error } = await api.collections.updatePreferencesAndRefresh(selectedCollection.id, prefs)
            if (!success) throw new Error(error || 'Could not update this search')
            fetchCollections()
            const fresh = await api.collections.getProperties(selectedCollection.id)
            const now: Property[] = fresh.success && fresh.data ? fresh.data : []
            if (fresh.success && fresh.data) setMatchedProperties(now)
            const after = new Set(now.map(p => String(p.id)))
            const added = now.filter(p => !before.has(String(p.id))).length
            const removed = Array.from(before).filter(id => !after.has(id)).length
            const change = [added ? `${added} new home${added === 1 ? '' : 's'} added` : '', removed ? `${removed} removed` : ''].filter(Boolean).join(', ')
            showToast(change ? `Search updated - ${change}` : 'Search updated', 'success')
            return { added, removed }
          }}
          onDismissRefineRequest={() => handleDismissRefineRequest(selectedCollection.id)}
          onStatusToggle={handleStatusToggle}
          onNotificationToggle={handleNotificationToggle}
          onViewTours={() => handleViewTours()}
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
          onCommentClick={handleOpenQuickComment}
          quickCommentProperty={quickCommentProperty}
          isQuickCommentOpen={isQuickCommentOpen}
          onCloseQuickComment={handleCloseQuickComment}
          isLoadingQuickComments={isLoadingQuickComments}
          highlightFirstProperty={searchParams.get('focus') === 'first'}
          idxSite={idxSite}
          idxDomains={idxDomains}
        />
        </motion.div>
      ) : (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
          exit={{ opacity: 0, scale: 0.985, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } }}
        >
        <DashboardView
          collections={collections}
          isLoading={isLoading}
          onCreateClick={() => setIsCreateModalOpen(true)}
          onCollectionClick={handleDashboardCollectionClick}
          onPropertyPreviewClick={handlePropertyPreviewClick}
          onShare={handleShareClick}

          onEditPreferences={(c) => { setSelectedCollectionForEdit(c); setIsEditPreferencesModalOpen(true); }}
          onDelete={handleAskDelete}
          onStatusToggle={handleStatusToggle}
          onDismissNew={handleDismissNew}
          onOpenTours={handleDashboardTourClick}
          onOpenComments={handleOpenComments}
          formatPriceRange={formatPriceRange}
          pendingTourCount={inbox.tours.length}
          unreadActivityCount={inbox.unread_activity}
          onOpenTourInbox={handleOpenTourInbox}
          onOpenActivityInbox={handleOpenActivityInbox}
        />
        </motion.div>
      )}
      </AnimatePresence>
      <Footer />

      <ViewToursModal
        isOpen={isToursModalOpen}
        onClose={() => setIsToursModalOpen(false)}
        tours={collectionTours}
        onUpdateCompletion={handleUpdateTourCompletion}
        onConfirmTour={handleConfirmTour}
        onUnconfirmTour={handleUnconfirmTour}
        isLoading={isLoadingTours}
        subtitle={toursCollectionId ? undefined : `${collectionTours.filter(t => !t.confirmed_date && !t.is_completed).length} waiting on you, from every Showcase`}
      />

      <ShowcaseActivityInbox
        isOpen={isActivityInboxOpen}
        onClose={handleCloseActivityInbox}
        items={inbox.activity}
        onOpenItem={handleOpenActivityItem}
      />

      <ShareCollectionModal
        collection={selectedCollectionForShare}
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        openHousePalUrl={selectedCollectionForShare?.shareToken ? openHousePalPublicUrl(`/showcase/${selectedCollectionForShare.shareToken}`) : null}
        websiteUrl={selectedCollectionForShare?.shareToken ? websitePublicUrl(idxSite, idxDomains, `/showcase/${selectedCollectionForShare.shareToken}`) : null}
        onGenerateShareLink={(id) => api.collections.share(id, { make_public: true }).then(fetchCollections)}
        onUpdateShareSettings={(id, isPub) => api.collections.share(id, { make_public: isPub }).then(fetchCollections)}
      />

      <ShowcaseMapEditor
        collection={selectedCollectionForEdit}
        isOpen={isEditPreferencesModalOpen}
        onClose={() => setIsEditPreferencesModalOpen(false)}
        onSave={handleSavePreferences}
        agentState={user?.state}
      />

      <DeleteConfirmationModal
        collection={deleteModalState.collection}
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ isOpen: false, collection: null })}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
        alsoRemoves={deleteAlsoRemoves}
      />

      <CreateCollectionModal
        key={createKey}
        isOpen={isCreateModalOpen}
        onClose={resetCreate}
        onContinue={(info) => { setCreateInfo(info); setIsCreateModalOpen(false); setIsCreateSearchOpen(true) }}
      />

      {/* Create flow, step 3 - the same map + grid editor Edit uses */}
      <ShowcaseMapEditor
        collection={createDraft}
        isOpen={isCreateSearchOpen && !!createDraft}
        onClose={resetCreate}
        onSave={(_, prefs) => createInfo ? handleCreateCollection(createInfo, prefs) : Promise.resolve()}
        agentState={user?.state}
        create={{
          clientName: createInfo?.fullName.split(/\s+/)[0] || '',
          onBack: (draft) => { setCreatePrefs(draft); setIsCreateSearchOpen(false); setIsCreateModalOpen(true) },
        }}
      />
    </div>
  )
}

export default function ShowcasesPage() {
  return (
    <AuthGuard>
      <BrokerAuthorizationGuard>
        <SubscriptionGuard requiredTier="PREMIUM">
          <Suspense fallback={null}>
            <ShowcaseContent />
          </Suspense>
        </SubscriptionGuard>
      </BrokerAuthorizationGuard>
    </AuthGuard>
  )
}
