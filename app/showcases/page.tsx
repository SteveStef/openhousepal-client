'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Collection, Property } from '@/types'
import PropertyGrid from '@/components/PropertyGrid'
import CollectionCard from '@/components/CollectionCard'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import PropertyDetailsModal from '@/components/PropertyDetailsModal'
import ShareCollectionModal from '@/components/ShareCollectionModal'
import EditPreferencesModal from '@/components/EditPreferencesModal'
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal'
import ViewToursModal, { PropertyTour } from '@/components/ViewToursModal'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import Toast from '@/components/Toast'
import { Share2, Calendar } from 'lucide-react'
import { apiRequest, updatePreferencesAndRefresh } from '@/lib/auth'
import { collectionsApi } from '@/lib/api'
import MultiCityPlacesInput from '@/components/MultiCityPlacesInput'
import MultiTownshipPlacesInput from '@/components/MultiTownshipPlacesInput'
import GooglePlacesAutocomplete from '@/components/GooglePlacesAutocomplete'
import { useAuth } from '@/contexts/AuthContext'

// Helper function to format prices properly
const formatPrice = (price: number): string => {
  if (price >= 1000000) {
    return `${(price / 1000000).toFixed(2)}M`
  } else if (price >= 1000) {
    return `${Math.floor(price / 1000)}K`
  } else {
    return price.toString()
  }
}

export default function ShowcasesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isAuthenticated, isLoading: isAuthenticating } = useAuth()
  const [collections, setCollections] = useState<Collection[]>([])
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [matchedProperties, setMatchedProperties] = useState<Property[] | null>(null);
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED' | 'COMPLETED'>('ALL')

  // Property filtering states
  const [activeTab, setActiveTab] = useState<'all' | 'liked' | 'disliked'>('all')
  const [sortBy, setSortBy] = useState<'price' | 'beds' | 'squareFeet'>('price')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Modal states
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const isClosingModalRef = useRef(false)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [isLoadingComments, setIsLoadingComments] = useState(false)
  const [commentsError, setCommentsError] = useState<string | null>(null)

  // Share modal states
  const [selectedCollectionForShare, setSelectedCollectionForShare] = useState<Collection | null>(null)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)

  // Edit preferences modal states
  const [selectedCollectionForEdit, setSelectedCollectionForEdit] = useState<Collection | null>(null)
  const [isEditPreferencesModalOpen, setIsEditPreferencesModalOpen] = useState(false)

  // Create collection modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Delete confirmation modal states
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    collection: Collection | null;
  }>({ isOpen: false, collection: null })
  const [isDeleting, setIsDeleting] = useState(false)

  // Tour viewing modal states
  const [collectionTours, setCollectionTours] = useState<PropertyTour[]>([])
  const [isToursModalOpen, setIsToursModalOpen] = useState(false)
  const [isLoadingTours, setIsLoadingTours] = useState(false)

  // Toast notification state
  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error'
    isVisible: boolean
  }>({
    message: '',
    type: 'success',
    isVisible: false
  })

  // Toast helper functions
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type, isVisible: true })
  }

  const closeToast = () => {
    setToast(prev => ({ ...prev, isVisible: false }))
  }

  // Check authentication and redirect if needed
  useEffect(() => {
    if (!isAuthenticating && !isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent('/showcases')}`)
    }
  }, [isAuthenticating, isAuthenticated, router])

  // Load property interactions when a collection is selected


  useEffect(() => {
    if (!isAuthenticating) {
      const fetchCollections = async () => {
      setIsLoading(true)
      try {
        const response = await apiRequest('/collections/')
        
        if (response.status === 200 && response.data) {
          // Transform backend data to match frontend interface
          const transformedCollections: Collection[] = response.data.map((backendCollection: any) => {
            return {
            id: backendCollection.id, // Keep as string since backend uses UUID strings
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
              email: 'user@example.com',
              phone: '(000) 000-0000',
              preferredContact: 'EMAIL' as const,
            },
            // propertyId: 1, // This could be derived from actual property data if available
            originalProperty: {
              id: backendCollection.original_property?.id || 1,
              address: backendCollection.original_property?.address || backendCollection.name || "Collection Name Not Set",
              city: backendCollection.original_property?.city || "West Chester",
              state: backendCollection.original_property?.state || "PA",
              zipCode: backendCollection.original_property?.zipCode || "19380", 
              price: backendCollection.original_property?.price || 0,
              beds: backendCollection.original_property?.beds || 0,
              baths: backendCollection.original_property?.baths || 0,
              squareFeet: backendCollection.original_property?.squareFeet || 0,
              propertyType: backendCollection.original_property?.propertyType || "Property",
              imageUrl: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400'
            },
            createdAt: backendCollection.created_at,
            updatedAt: backendCollection.updated_at,
            status: (backendCollection.status || 'ACTIVE') as 'ACTIVE' | 'INACTIVE',
            preferences: backendCollection.preferences ? {
              // Include the detailed preferences from backend
              ...backendCollection.preferences,
              // Also provide formatted display values for compatibility
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
              totalProperties: backendCollection.property_count || 0,
              viewedProperties: 0,
              likedProperties: 0,
              lastActivity: backendCollection.updated_at
            },
            shareToken: backendCollection.share_token,
            sharedAt: backendCollection.created_at,
            isPublic: backendCollection.is_public || false
          }
        })
          
          setCollections(transformedCollections)
        } else {
          console.error('Failed to fetch collections:', response.error)
          // Fallback to empty array if API fails
          setCollections([])
        }
      } catch (error) {
        console.error('Error fetching collections:', error)
        // Fallback to empty array if API fails
        setCollections([])
      } finally {
        setIsLoading(false)
      }
    }

      fetchCollections()
    }
  }, [isAuthenticating]);

  // Sync URL query parameter with selected collection
  useEffect(() => {
    const showcaseId = searchParams.get('showcase')
    if (showcaseId && collections.length > 0) {
      const collection = collections.find(c => c.id === showcaseId)
      if (collection && selectedCollection?.id !== showcaseId) {
        setSelectedCollection(collection)
      }
    } else if (!showcaseId && selectedCollection) {
      // Clear selection when showcase query param is removed
      setSelectedCollection(null)
    }
  }, [searchParams, collections, selectedCollection?.id])

  // Sync URL query parameter with selected property modal
  useEffect(() => {
    const propertyId = searchParams.get('property')
    if (propertyId && matchedProperties && matchedProperties.length > 0) {
      const property = matchedProperties.find(p => String(p.id) === propertyId)
      if (property && !isModalOpen && !isClosingModalRef.current) {
        handlePropertyClick(property)
      }
    } else {
      // Reset ref when URL no longer has property param
      isClosingModalRef.current = false
    }
  }, [searchParams, matchedProperties, isModalOpen])

  useEffect(() => {
    if(!selectedCollection) return;

    const fetchPropertiesFromCollection = async () => {
      try {
        // Backend will return properties with visitor interactions already applied
        // Properties will have liked/disliked/favorited flags based on collection's visitor
        const response = await apiRequest(`/collections/${selectedCollection.id}/properties`);
        if(response.status === 200) {
          const matchedProperties = response.data;
          setMatchedProperties(matchedProperties);
        }
      } catch(err) {
        console.log(err);
      }
    }
    fetchPropertiesFromCollection();

  }, [selectedCollection]);

  const filteredCollections = useMemo(() => {
    return collections.filter(collection => {
      const matchesSearch =
        collection.customer.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        collection.customer.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        collection.customer.email.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesStatus = statusFilter === 'ALL' || collection.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [collections, searchTerm, statusFilter])

  // Calculate active showcases count and limit status
  const activeShowcasesCount = collections.filter(collection => collection.status === 'ACTIVE').length
  const maxActiveShowcases = 10
  const isAtLimit = activeShowcasesCount >= maxActiveShowcases
  const isNearLimit = activeShowcasesCount >= 8

  const formatPriceRange = (priceRange: string) => {
    const ranges: { [key: string]: string } = {
      'UNDER_500K': 'Under $500K',
      '500K_750K': '$500K - $750K',
      '750K_1M': '$750K - $1M',
      '1M_1_5M': '$1M - $1.5M',
      '1_5M_2M': '$1.5M - $2M',
      'OVER_2M': 'Over $2M',
      'FLEXIBLE': 'Flexible'
    }
    return ranges[priceRange] || priceRange
  }

  // Filter and sort properties based on tabs and sorting
  const filteredProperties = useMemo(() => {
    if (!selectedCollection) return []
    if (!matchedProperties) return []

    let filtered = matchedProperties;

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
  }, [matchedProperties, selectedCollection, activeTab, sortBy, sortOrder])

  const tabCounts = useMemo(() => {
    if (!selectedCollection || !matchedProperties) return { all: 0, liked: 0, disliked: 0 }

    const properties = matchedProperties
    return {
      all: properties.filter(p => !p.disliked).length,
      liked: properties.filter(p => p.liked).length,
      disliked: properties.filter(p => p.disliked).length
    }
  }, [selectedCollection, matchedProperties])

  // Handle property interactions
  const handlePropertyLike = async (propertyId: string | number, liked: boolean) => {
    if (!selectedCollection || !matchedProperties) return

    // Optimistic UI update - update immediately for instant feedback
    const optimisticProperties = matchedProperties.map(property =>
      property.id === propertyId ? {
        ...property,
        liked: liked,
        disliked: liked ? false : property.disliked  // Clear dislike if liking
      } : property
    )

    setMatchedProperties(optimisticProperties)

    // Update selected property if it's the one being modified
    if (selectedProperty && selectedProperty.id === propertyId) {
      setSelectedProperty(prevProperty => ({
        ...prevProperty!,
        liked: liked,
        disliked: liked ? false : prevProperty!.disliked
      }))
    }

    try {
      const response = await apiRequest(`/collections/${selectedCollection.id}/properties/${String(propertyId)}/interact`, {
        method: 'POST',
        body: JSON.stringify({
          interaction_type: 'like',
          value: liked
        })
      })

      if (response.status === 200) {
        // Sync with server response
        const updatedProperties = matchedProperties.map(property =>
          property.id === propertyId ? {
            ...property,
            liked: response.data.interaction.liked,
            disliked: response.data.interaction.disliked
          } : property
        )

        setMatchedProperties(updatedProperties)

        if (selectedProperty && selectedProperty.id === propertyId) {
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
      console.error('Error updating property like:', error)

      // Rollback optimistic update on error
      const revertedProperties = matchedProperties.map(property =>
        property.id === propertyId ? {
          ...property,
          liked: !liked,
          disliked: property.disliked
        } : property
      )

      setMatchedProperties(revertedProperties)

      if (selectedProperty && selectedProperty.id === propertyId) {
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
    if (!selectedCollection || !matchedProperties) return

    // Optimistic UI update - update immediately for instant feedback
    const optimisticProperties = matchedProperties.map(property =>
      property.id === propertyId ? {
        ...property,
        liked: disliked ? false : property.liked,  // Clear like if disliking
        disliked: disliked
      } : property
    )

    setMatchedProperties(optimisticProperties)

    // Update selected property if it's the one being modified
    if (selectedProperty && selectedProperty.id === propertyId) {
      setSelectedProperty(prevProperty => ({
        ...prevProperty!,
        liked: disliked ? false : prevProperty!.liked,
        disliked: disliked
      }))
    }

    try {
      const response = await apiRequest(`/collections/${selectedCollection.id}/properties/${String(propertyId)}/interact`, {
        method: 'POST',
        body: JSON.stringify({
          interaction_type: 'dislike',
          value: disliked
        })
      })

      if (response.status === 200) {
        // Sync with server response
        const updatedProperties = matchedProperties.map(property =>
          property.id === propertyId ? {
            ...property,
            liked: response.data.interaction.liked,
            disliked: response.data.interaction.disliked
          } : property
        )

        setMatchedProperties(updatedProperties)

        if (selectedProperty && selectedProperty.id === propertyId) {
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
      console.error('Error updating property dislike:', error)

      // Rollback optimistic update on error
      const revertedProperties = matchedProperties.map(property =>
        property.id === propertyId ? {
          ...property,
          liked: property.liked,
          disliked: !disliked
        } : property
      )

      setMatchedProperties(revertedProperties)

      if (selectedProperty && selectedProperty.id === propertyId) {
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
    if (!selectedCollection || !matchedProperties) return

    // Create optimistic comment for immediate UI update
    const optimisticComment = {
      id: `temp-${Date.now()}`,
      content: comment,
      author: 'You',
      createdAt: new Date().toISOString()
    }

    // Update selected property immediately for instant feedback
    setSelectedProperty(prev => prev && prev.id === propertyId ? {
      ...prev,
      comments: [...(prev.comments || []), optimisticComment]
    } : prev)

    try {
      // Determine the commenter's name and email
      // If we have an authenticated user (admin/agent), use their details
      // Otherwise fallback to the collection customer details (though this page is auth-protected)
      const visitorName = user?.first_name 
        ? `${user.first_name} ${user.last_name || ''}`.trim()
        : `${selectedCollection.customer.firstName} ${selectedCollection.customer.lastName}`;
        
      const visitorEmail = user?.email || selectedCollection.customer.email;

      const response = await apiRequest(`/collections/${selectedCollection.id}/properties/${String(propertyId)}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          content: comment,
          visitor_name: visitorName,
          visitor_email: visitorEmail
        })
      })

      if (response.status === 200) {
        const serverComment = {
          ...response.data.comment,
          createdAt: response.data.comment.created_at || response.data.comment.createdAt
        }

        // Replace optimistic comment with server response
        setSelectedProperty(prev => prev && prev.id === propertyId ? {
          ...prev,
          comments: (prev.comments || []).map(c =>
            c.id === optimisticComment.id ? serverComment : c
          )
        } : prev)

        // Also update the main properties list
        const updatedProperties = matchedProperties.map(property =>
          property.id === propertyId
            ? { ...property, comments: [...(property.comments || []).filter(c => c.id !== optimisticComment.id), serverComment] }
            : property
        )
        setMatchedProperties(updatedProperties)
      }
    } catch (error) {
      console.error('Error adding property comment:', error)
      // Remove optimistic comment on error
      setSelectedProperty(prev => prev && prev.id === propertyId ? {
        ...prev,
        comments: (prev.comments || []).filter(c => c.id !== optimisticComment.id)
      } : prev)
    }
  }

  const fetchCollectionTours = async (collectionId: string) => {
    setIsLoadingTours(true)
    try {
      const response = await apiRequest(`/collections/${collectionId}/tours`, {
        method: 'GET'
      })

      if (response.status === 200 && response.data) {
        // Enrich tours with property information from matchedProperties
        const enrichedTours = response.data.map((tour: PropertyTour) => {
          const property = matchedProperties?.find(p => p.id === tour.property_id)
          return {
            ...tour,
            property: property ? {
              street_address: property.address,
              city: property.city,
              state: property.state,
              imageUrl: property.imageUrl
            } : undefined
          }
        })
        setCollectionTours(enrichedTours)
      }
    } catch (error) {
      console.error('Error fetching tours:', error)
      alert('Failed to load tour requests')
    } finally {
      setIsLoadingTours(false)
    }
  }

  const handleViewTours = () => {
    if (selectedCollection) {
      fetchCollectionTours(selectedCollection.id)
      setIsToursModalOpen(true)
    }
  }

  const handleUpdateTourStatus = async (tourId: string, status: string) => {
    try {
      const response = await apiRequest(`/collections/tours/${tourId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      })

      if (response.status === 200) {
        // Refresh tours list
        if (selectedCollection) {
          await fetchCollectionTours(selectedCollection.id)
        }
      } else {
        throw new Error('Failed to update tour status')
      }
    } catch (error) {
      console.error('Error updating tour status:', error)
      alert('Failed to update tour status. Please try again.')
    }
  }

  const handleCloseToursModal = () => {
    setIsToursModalOpen(false)
    setCollectionTours([])
  }

  const fetchPropertyComments = async (propertyId: string) => {
    if (!selectedCollection) return

    setIsLoadingComments(true)
    setCommentsError(null)

    try {
      const response = await apiRequest(`/collections/${selectedCollection.id}/properties/${propertyId}/comments`)

      if (response.status === 200 && response.data) {
        // Transform backend comments to frontend format (snake_case to camelCase)
        const transformedComments = (response.data || []).map((comment: any) => ({
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
    setIsLoadingDetails(true)
    setDetailsError(null)

    // Update URL with property ID
    if (selectedCollection) {
      router.push(`?showcase=${selectedCollection.id}&property=${property.id}`, { scroll: false })
    }

    // Always fetch fresh comments
    if (property.id) {
      fetchPropertyComments(String(property.id))
    }

    // Skip loading if property already has details
    if (property.details) {
      setIsLoadingDetails(false)
      return
    }
    
    // Fetch detailed property information in background
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/properties/${property.id}/cache`)
      
      if (response.ok) {
        const cacheResponse = await response.json()
        
        if (cacheResponse.success && cacheResponse.details) {
          // Update property with detailed information
          const enhancedProperty = {
            ...property,
            details: cacheResponse.details
          }
          setSelectedProperty(enhancedProperty)
        } else {
          setDetailsError('Failed to load additional property details')
        }
      } else {
        setDetailsError('Failed to connect to property service')
      }
    } catch (error) {
      console.error('Error fetching property details:', error)
      setDetailsError('Failed to load additional property details')
    } finally {
      setIsLoadingDetails(false)
    }
  }

  const handleCloseModal = () => {
    isClosingModalRef.current = true
    setIsModalOpen(false)
    setSelectedProperty(null)
    setIsLoadingDetails(false)
    setDetailsError(null)

    // Remove property from URL but keep showcase
    if (selectedCollection) {
      router.push(`?showcase=${selectedCollection.id}`, { scroll: false })
    }
  }

  // Share functionality handlers
  const handleShareShowcase = (collection: Collection) => {
    setSelectedCollectionForShare(collection)
    setIsShareModalOpen(true)
  }

  const handleCloseShareModal = () => {
    setIsShareModalOpen(false)
    setSelectedCollectionForShare(null)
  }

  const handleGenerateShareLink = async (collectionId: string) => {
    try {
      
      const response = await apiRequest(`/collections/${collectionId}/share`, {
        method: 'PATCH',
        body: JSON.stringify({ make_public: true })
      })

      if (response.status === 200) {
        const { share_token, is_public, share_url } = response.data
        
        setCollections(prevShowcases =>
          prevShowcases.map(collection =>
            collection.id === collectionId
              ? { 
                  ...collection, 
                  shareToken: share_token, // Token from backend
                  isPublic: is_public, // Use actual backend value
                  sharedAt: is_public && !collection.sharedAt ? new Date().toISOString() : collection.sharedAt
                }
              : collection
          )
        )

        // Update the selected collection for share modal if it's the same one
        if (selectedCollectionForShare && selectedCollectionForShare.id === collectionId) {
          setSelectedCollectionForShare(prev => prev ? {
            ...prev,
            shareToken: share_token, // Token from backend
            isPublic: is_public, // Use actual backend value
            sharedAt: is_public && !prev.sharedAt ? new Date().toISOString() : prev.sharedAt
          } : null)
        }
        
      } else {
        console.error('[SHARE] Generation failed:', response.status, response.data)
      }
    } catch (error) {
      console.error('[SHARE] Error generating share link:', error)
      // Could add toast notification here
    }
  }

  const handleUpdateShareSettings = async (collectionId: string, isPublic: boolean) => {
    try {
      
      const response = await apiRequest(`/collections/${collectionId}/share`, {
        method: 'PATCH',
        body: JSON.stringify({ make_public: isPublic })
      })

      if (response.status === 200) {
        const { share_token, is_public } = response.data
        
        // Use actual backend response values, not assumptions
        setCollections(prevShowcases =>
          prevShowcases.map(collection =>
            collection.id === collectionId
              ? { 
                  ...collection, 
                  isPublic: is_public, // Use actual backend value
                  shareToken: share_token || collection.shareToken, // Always update token if provided
                  sharedAt: is_public && !collection.sharedAt ? new Date().toISOString() : collection.sharedAt
                }
              : collection
          )
        )

        // Update the selected collection for share modal if it's the same one
        if (selectedCollectionForShare && selectedCollectionForShare.id === collectionId) {
          setSelectedCollectionForShare(prev => prev ? {
            ...prev,
            isPublic: is_public, // Use actual backend value
            shareToken: share_token || prev.shareToken, // Always update token if provided
            sharedAt: is_public && !prev.sharedAt ? new Date().toISOString() : prev.sharedAt
          } : null)
        }
        
      } else {
        console.error('[SHARE] API request failed:', response.status, response.data)
      }
    } catch (error) {
      console.error('[SHARE] Error updating share settings:', error)
      // Could add toast notification here
    }
  }

  const handleRegenerateShareLink = async (collectionId: string) => {
    try {
      
      const response = await apiRequest(`/collections/${collectionId}/share`, {
        method: 'PATCH',
        body: JSON.stringify({ make_public: true, force_regenerate: true })
      })

      if (response.status === 200) {
        const { share_token, is_public, share_url } = response.data
        
        setCollections(prevShowcases =>
          prevShowcases.map(collection =>
            collection.id === collectionId
              ? { 
                  ...collection, 
                  shareToken: share_token, // New token from backend
                  isPublic: is_public, // Use actual backend value
                  sharedAt: is_public && !collection.sharedAt ? new Date().toISOString() : collection.sharedAt
                }
              : collection
          )
        )

        // Update the selected collection for share modal if it's the same one
        if (selectedCollectionForShare && selectedCollectionForShare.id === collectionId) {
          setSelectedCollectionForShare(prev => prev ? {
            ...prev,
            shareToken: share_token, // New token from backend
            isPublic: is_public, // Use actual backend value
            sharedAt: is_public && !prev.sharedAt ? new Date().toISOString() : prev.sharedAt
          } : null)
        }
        
      } else {
        console.error('[SHARE] Regeneration failed:', response.status, response.data)
      }
    } catch (error) {
      console.error('[SHARE] Error regenerating share link:', error)
      // Could add toast notification here
    }
  }

  // Edit preferences functionality handlers
  const handleEditPreferences = (collection: Collection) => {
    setSelectedCollectionForEdit(collection)
    setIsEditPreferencesModalOpen(true)
  }

  const handleCloseEditPreferencesModal = () => {
    setIsEditPreferencesModalOpen(false)
    setSelectedCollectionForEdit(null)
  }

  // Delete functionality handlers
  const handleDeleteCollection = (collection: Collection) => {
    setDeleteModalState({ isOpen: true, collection })
  }

  const handleCloseDeleteModal = () => {
    if (!isDeleting) {
      setDeleteModalState({ isOpen: false, collection: null })
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteModalState.collection) return

    setIsDeleting(true)
    try {
      const response = await collectionsApi.delete(deleteModalState.collection.id)
      if (response.success) {
        // Remove from local state
        setCollections(prev => prev.filter(c => c.id !== deleteModalState.collection!.id))
        // Clear selection if deleted collection was selected
        if (selectedCollection?.id === deleteModalState.collection.id) {
          setSelectedCollection(null)
        }
        // Close modal
        setDeleteModalState({ isOpen: false, collection: null })
      }
    } catch (error) {
      console.error('Error deleting collection:', error)
      alert('Failed to delete collection. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSavePreferences = async (collectionId: string, preferences: any) => {
    try {
      preferences.diameter = Math.round(preferences.diameter * 1.8 * 10) / 10

      const hasAddress = preferences.address && preferences.address.trim()
      if(hasAddress) {
        preferences.cities = [];
        preferences.townships = [];
      } else {
        preferences.lat = null;
        preferences.long = null;
      }

      // Use atomic update that saves preferences and refreshes properties together
      // Only commits if Zillow API succeeds, preventing empty collections on errors
      const response = await updatePreferencesAndRefresh(collectionId, preferences)

      if (response.status === 200) {

        // Show success toast
        const propertiesCount = response.data?.properties_count || 0
        showToast(`Preferences updated and ${propertiesCount} properties refreshed successfully!`, 'success')

        // Close the modal
        setIsEditPreferencesModalOpen(false)
        setSelectedCollectionForEdit(null)

        // Refresh collections to show updated preferences and properties
        const collectionsResponse = await apiRequest('/collections/')
        if (collectionsResponse.status === 200 && collectionsResponse.data) {
          const transformedCollections: Collection[] = collectionsResponse.data.map((backendCollection: any) => {
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
                email: 'user@example.com',
                phone: '(000) 000-0000',
                preferredContact: 'EMAIL' as const,
              },
              originalProperty: {
                id: backendCollection.original_property?.id || 1,
                address: backendCollection.original_property?.address || backendCollection.name || "Collection Name Not Set",
                city: backendCollection.original_property?.city || "West Chester",
                state: backendCollection.original_property?.state || "PA",
                zipCode: backendCollection.original_property?.zipCode || "19380", 
                price: backendCollection.original_property?.price || 0,
                beds: backendCollection.original_property?.beds || 0,
                baths: backendCollection.original_property?.baths || 0,
                squareFeet: backendCollection.original_property?.squareFeet || 0,
                propertyType: backendCollection.original_property?.propertyType || "Property",
              },
              createdAt: backendCollection.created_at,
              updatedAt: backendCollection.updated_at,
              status: (backendCollection.status || 'ACTIVE') as 'ACTIVE' | 'INACTIVE',
              preferences: backendCollection.preferences ? {
                // Include the detailed preferences from backend
                ...backendCollection.preferences,
                // Also provide formatted display values for compatibility
                priceRange: (backendCollection.preferences?.min_price && backendCollection.preferences?.max_price) ? 
                  `$${formatPrice(backendCollection.preferences.min_price)} - $${formatPrice(backendCollection.preferences.max_price)}` : 
                  backendCollection.preferences?.min_price ? 
                  `$${formatPrice(backendCollection.preferences.min_price)}+` :
                  backendCollection.preferences?.max_price ?
                  `Under $${formatPrice(backendCollection.preferences.max_price)}` :
                  'Not specified',
                timeframe: backendCollection.preferences?.timeframe || 'Not specified',
                visitingReason: backendCollection.preferences?.visiting_reason || 'Not specified',
                hasAgent: backendCollection.preferences?.has_agent || 'Not specified',
                additionalComments: backendCollection.preferences?.special_features || ''
              } : {
                priceRange: 'Not specified',
                timeframe: 'Not specified',
                visitingReason: 'Not specified',
                hasAgent: 'Not specified',
                additionalComments: ''
              },
              stats: {
                totalProperties: backendCollection.property_count || 0,
                viewedProperties: 0,
                likedProperties: 0,
                lastActivity: backendCollection.updated_at
              },
              shareToken: backendCollection.share_token,
              sharedAt: backendCollection.created_at,
              isPublic: backendCollection.is_public || false
            }
          })
          
          // Update the collections state
          setCollections(transformedCollections)
          
          // If we have a selected collection, update it with the refreshed data
          if (selectedCollection) {
            const updatedSelectedCollection = transformedCollections.find(c => c.id === selectedCollection.id)
            if (updatedSelectedCollection) {
              setSelectedCollection(updatedSelectedCollection)
            }
          }
        }

      } else {
        const errorMessage = response.data?.error || response.error || 'Unknown error'

        // Show specific error message for "No properties match" case
        if (errorMessage.includes('No properties match')) {
          showToast('No properties match these preferences. Please adjust your criteria and try again.', 'error')
        } else {
          showToast(`Failed to save changes: ${errorMessage}. Your preferences and properties have not been changed.`, 'error')
        }
      }
    } catch (error) {
      showToast('An error occurred while saving. Your preferences and properties have not been changed.', 'error')
    }
  }

  const handleStatusToggle = async (collectionId: string) => {
    const collection = collections.find(c => c.id === collectionId)
    if (!collection) return

    const newStatus = collection.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'

    try {
      const response = await apiRequest(`/collections/${collectionId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      })

      if (response.status === 200) {
        // Update collections list
        setCollections(prevShowcases =>
          prevShowcases.map(c =>
            c.id === collectionId
              ? { ...c, status: newStatus as 'ACTIVE' | 'INACTIVE' }
              : c
          )
        )

        // Update selected collection if it's the same one
        if (selectedCollection && selectedCollection.id === collectionId) {
          setSelectedCollection(prev => prev ? {
            ...prev,
            status: newStatus as 'ACTIVE' | 'INACTIVE'
          } : null)
        }
      } else {
        console.error('Failed to update collection status:', response.error)
      }
    } catch (error) {
      console.error('Error updating collection status:', error)
    }
  }

  const handleCreateCollection = async (collectionData: any) => {
    // Check active showcases limit before creating
    if (activeShowcasesCount >= maxActiveShowcases) {
      alert('You have reached the maximum limit of 10 active showcases. Please deactivate some showcases before creating a new one.')
      return
    }

    try {
      const response = await apiRequest('/collections/create-manually', {
        method: 'POST',
        body: JSON.stringify({
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
          diameter: parseFloat((parseFloat(collectionData.diameter) * 1.8).toFixed(1)),
          
          // Property types
          is_town_house: collectionData.isTownHouse || false,
          is_lot_land: collectionData.isLotLand || false,
          is_condo: collectionData.isCondo || false,
          is_multi_family: collectionData.isMultiFamily || false,
          is_single_family: collectionData.isSingleFamily || false,
          is_apartment: collectionData.isApartment || false
        })
      })

      if (response.status === 200 || response.status === 201) {
        setIsCreateModalOpen(false)
        // Refresh collections
        const collectionsResponse = await apiRequest('/collections/')
        if (collectionsResponse.status === 200 && collectionsResponse.data) {
          const transformedCollections: Collection[] = collectionsResponse.data.map((backendCollection: any) => ({
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
              email: 'user@example.com',
              phone: '(000) 000-0000',
              preferredContact: 'EMAIL' as const,
            },
            propertyId: 1,
            originalProperty: {
              id: 1,
              address: backendCollection.name || "Collection Name Not Set",
              city: "West Chester",
              state: "PA",
              zipCode: "19380", 
              price: backendCollection.preferences?.min_price || 0,
              beds: 0,
              baths: 0,
              squareFeet: 0,
              propertyType: "Collection",
              imageUrl: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400'
            },
            createdAt: backendCollection.created_at,
            updatedAt: backendCollection.updated_at,
            status: (backendCollection.status || 'ACTIVE') as 'ACTIVE' | 'INACTIVE',
            preferences: backendCollection.preferences ? {
              // Include the detailed preferences from backend
              ...backendCollection.preferences,
              // Also provide formatted display values for compatibility
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
              totalProperties: backendCollection.property_count || 0,
              viewedProperties: 0,
              likedProperties: 0,
              lastActivity: backendCollection.updated_at
            },
            shareToken: backendCollection.share_token,
            sharedAt: backendCollection.created_at,
            isPublic: backendCollection.is_public || false
          }))
          setCollections(transformedCollections)
        }
      } else {
        console.error('Failed to create collection:', response.error)
      }
    } catch (error) {
      console.error('Error creating collection:', error)
    }
  }

  if (selectedCollection) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] flex flex-col">
        <Header />
        <div className="flex-1 p-4 pb-20 sm:p-6 sm:pb-32">
          <div className="max-w-7xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => {
              router.push('/showcases', { scroll: false })
            }}
            className="group mb-6 flex items-center text-gray-500 hover:text-gray-900 transition-colors duration-200 font-medium"
          >
            <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center mr-3 group-hover:border-gray-300 group-hover:shadow-sm transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
              </svg>
            </div>
            Back to Showcases
          </button>

          {/* Combined Property Recommendations and Status Section */}
          <div className="bg-white/50 backdrop-blur-sm rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 p-4 sm:p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight mb-1">Property Recommendations</h1>
                <p className="text-sm text-gray-500 font-light">Curated properties based on client preferences</p>
              </div>

              <div className="flex items-center gap-3 sm:gap-4">
                <button
                  onClick={handleViewTours}
                  className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-br from-[#1a1614] via-[#3a2f25] to-[#8b7355] shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 whitespace-nowrap group"
                  title="View tour requests for this collection"
                >
                  <Calendar size={16} className="mr-2 group-hover:scale-110 transition-transform" />
                  <span className="hidden sm:inline">View Tours</span>
                  <span className="sm:hidden">Tours</span>
                </button>
                <button
                  onClick={() => handleStatusToggle(selectedCollection.id)}
                  className={`inline-flex items-center px-3 py-2 rounded-xl text-xs font-bold border transition-all duration-300 hover:shadow-md whitespace-nowrap uppercase tracking-wide ${
                    selectedCollection.status === 'ACTIVE'
                      ? 'bg-green-50 text-green-700 border-green-100 hover:bg-green-100'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                  title={`Click to ${selectedCollection.status === 'ACTIVE' ? 'deactivate' : 'activate'} this collection`}
                >
                  <div className={`w-2 h-2 rounded-full mr-2 ${
                    selectedCollection.status === 'ACTIVE' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                  }`} />
                  {selectedCollection.status}
                </button>
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
                      ? 'bg-[#1a1614] text-white border-[#1a1614] shadow-md'
                      : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                    activeTab === tab.key
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Sorting Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
              <div className="group">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Sort by</label>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'price' | 'beds' | 'squareFeet')}
                    className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b7355]/20 focus:border-[#8b7355] transition-all duration-300 appearance-none cursor-pointer hover:bg-gray-50"
                  >
                    <option value="price">Price</option>
                    <option value="beds">Bedrooms</option>
                    <option value="squareFeet">Square Feet</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="group">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Sort Order</label>
                <div className="relative">
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                    className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b7355]/20 focus:border-[#8b7355] transition-all duration-300 appearance-none cursor-pointer hover:bg-gray-50"
                  >
                    <option value="asc">Low to High</option>
                    <option value="desc">High to Low</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
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
                  className="w-full px-4 py-2.5 bg-white text-gray-500 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-xl text-sm font-medium transition-all duration-300 hover:shadow-sm"
                >
                  Reset Filters
                </button>
              </div>
            </div>
          </div>

          {/* Property Grid */}
          <PropertyGrid
            properties={filteredProperties}
            title="Matched Properties"
            onLike={handlePropertyLike}
            onDislike={handlePropertyDislike}
            onPropertyClick={handlePropertyClick}
            showDetailedViewCount={true}
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
            onRetryDetails={() => handlePropertyClick(selectedProperty!)}
            isLoadingComments={isLoadingComments}
            commentsError={commentsError}
          />

          {/* View Tours Modal */}
          <ViewToursModal
            isOpen={isToursModalOpen}
            onClose={handleCloseToursModal}
            tours={collectionTours}
            onUpdateStatus={handleUpdateTourStatus}
            isLoading={isLoadingTours}
          />

          </div>
        </div>
        <Footer />
      </div>
    )
  }

  // Show loading screen during authentication check
  if (isAuthenticating) {
    return (
      <div className="min-h-screen bg-[#f8f8f6] flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8b7355] mx-auto mb-4"></div>
            <p className="text-gray-600">Checking authentication...</p>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <SubscriptionGuard requiredPlan="PREMIUM">
      <div className="min-h-screen bg-[#FAFAF7] flex flex-col">
        <Header />
      <div className="flex-1 p-6 pb-20 sm:pb-32">
        <div className="max-w-7xl mx-auto">
        {/* Combined Header and Filters */}
        <div className="bg-white/50 backdrop-blur-sm rounded-2xl border border-gray-100 p-4 sm:p-6 mb-8">
          {/* Header Section */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-4">
            <div className="flex-1 mb-4 lg:mb-0">
              <h1 className="text-2xl sm:text-3xl font-black text-[#0B0B0B] tracking-tight">Showcases</h1>
              <p className="text-[#6B7280] font-medium text-sm">Manage customer property showcases and preferences</p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
              <button
                onClick={() => setIsCreateModalOpen(true)}
                disabled={isAtLimit}
                className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all duration-300 flex items-center space-x-2 shadow-lg hover:shadow-[0_0_20px_rgba(201,162,77,0.2)] hover:scale-[1.02] transform border-2 ${
                  isAtLimit
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none border-transparent'
                    : 'bg-[#111827] text-white border-[#C9A24D]/20 hover:border-[#C9A24D] hover:bg-[#1a2333]'
                }`}
                title={isAtLimit ? 'Maximum 10 active showcases reached' : 'Create a new showcase'}
              >
                <svg className={`w-3.5 h-3.5 ${isAtLimit ? 'text-gray-500' : 'text-[#C9A24D]'} transition-colors duration-300`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="tracking-widest uppercase">Create Showcase</span>
              </button>

              {/* Active Showcases Counter */}
              <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border ${
                isAtLimit
                  ? 'bg-red-50 border-red-100 text-red-700'
                  : isNearLimit
                  ? 'bg-amber-50 border-amber-100 text-amber-700'
                  : 'bg-white border-gray-200 text-[#111827] shadow-sm'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  isAtLimit
                    ? 'bg-red-500 animate-pulse'
                    : isNearLimit
                    ? 'bg-amber-500'
                    : 'bg-green-500'
                }`}></div>
                <span className="text-[10px] font-black uppercase tracking-wider">
                  {activeShowcasesCount}/{maxActiveShowcases} <span className="font-bold text-[#6B7280] ml-0.5">Active</span>
                </span>
              </div>
            </div>
          </div>
          
          {/* Filters Section */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-black text-[#0B0B0B] uppercase tracking-[0.2em]">Filter Showcases</h3>
              <div className="flex items-center space-x-4">
                <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">
                  {filteredCollections.length} results
                </span>
                {isAtLimit && (
                  <span className="text-[10px] px-2 py-0.5 bg-red-50 text-red-600 rounded-full border border-red-100 font-bold uppercase tracking-wide">
                    Limit Reached
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#6B7280] group-focus-within:text-[#C9A24D] transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-[#0B0B0B] placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/5 focus:border-[#C9A24D] transition-all duration-300 text-sm shadow-sm"
              />
            </div>
            <div className="sm:w-48 relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-[#0B0B0B] focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/5 focus:border-[#C9A24D] transition-all duration-300 text-sm shadow-sm appearance-none font-bold cursor-pointer"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#6B7280]">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
          </div>
        </div>


        {/* Showcases Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8b7355] mx-auto mb-4"></div>
              <p className="text-gray-600">Loading showcases...</p>
            </div>
          </div>
        ) : filteredCollections.length === 0 ? (
          <div className="text-center py-24 bg-white/50 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-gray-100">
              <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2 tracking-tight">No showcases found</h3>
            <p className="text-gray-500 max-w-sm mx-auto">We couldn't find any showcases matching your filters. Try adjusting your search criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCollections.map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                onClick={() => {
                  setSelectedCollection(collection)
                  router.push(`?showcase=${collection.id}`, { scroll: false })
                }}
                onShare={handleShareShowcase}
                onEditPreferences={handleEditPreferences}
                onDelete={handleDeleteCollection}
                onStatusToggle={(collection: Collection) => handleStatusToggle(collection.id)}
                formatPriceRange={formatPriceRange}
              />
            ))}
          </div>
        )}
        </div>
      </div>
      <Footer />
      
      {/* Share Collection Modal */}
      <ShareCollectionModal
        collection={selectedCollectionForShare}
        isOpen={isShareModalOpen}
        onClose={handleCloseShareModal}
        onGenerateShareLink={handleGenerateShareLink}
        onRegenerateShareLink={handleRegenerateShareLink}
        onUpdateShareSettings={handleUpdateShareSettings}
      />
      
      {/* Edit Preferences Modal */}
      <EditPreferencesModal
        collection={selectedCollectionForEdit}
        isOpen={isEditPreferencesModalOpen}
        onClose={handleCloseEditPreferencesModal}
        onSave={handleSavePreferences}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        collection={deleteModalState.collection}
        isOpen={deleteModalState.isOpen}
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />

      {/* Create Showcase Modal */}
      <CreateCollectionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateCollection}
        activeShowcasesCount={activeShowcasesCount}
        maxActiveShowcases={maxActiveShowcases}
        isNearLimit={isNearLimit}
      />

      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={closeToast}
      />

    </div>
    </SubscriptionGuard>
  )
}

// Create Showcase Modal Component
function CreateCollectionModal({
  isOpen,
  onClose,
  onSubmit,
  activeShowcasesCount = 0,
  maxActiveShowcases = 10,
  isNearLimit = false
}: {
  isOpen: boolean,
  onClose: () => void,
  onSubmit: (data: any) => void,
  activeShowcasesCount?: number,
  maxActiveShowcases?: number,
  isNearLimit?: boolean
}) {
  const [formData, setFormData] = useState({
    // Collection Info
    showcaseName: '',

    // Customer Info
    fullName: '',
    email: '',
    phone: '',

    // Customer Preferences
    visitingReason: 'BUYING_SOON',
    hasAgent: 'NO',
    additionalComments: '',

    // Search Preferences
    minBeds: '',
    maxBeds: '',
    minBaths: '',
    maxBaths: '',
    minPrice: '',
    maxPrice: '',
    minYearBuilt: '',
    maxYearBuilt: '',
    address: '',
    cities: [] as string[],
    townships: [] as string[],
    diameter: '0',
    isTownHouse: false,
    isLotLand: false,
    isCondo: false,
    isMultiFamily: false,
    isSingleFamily: false,
    isApartment: false
  })
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState({
    location: '',
    propertyTypes: ''
  })

  // Validation helper functions
  const validatePropertyTypes = () => {
    const hasPropertyType = formData.isSingleFamily || formData.isCondo || formData.isTownHouse || 
                           formData.isApartment || formData.isMultiFamily || formData.isLotLand
    return hasPropertyType
  }

  const validateLocationPreferences = () => {
    const hasAddress = formData.address && formData.address.trim()
    const hasAreaFilters = (formData.cities && formData.cities.length > 0) || 
                          (formData.townships && formData.townships.length > 0)
    
    // If address is provided, diameter must be provided
    if (hasAddress && !formData.diameter) {
      return { isValid: false, error: 'Search diameter is required when using address-based search' }
    }
    
    // Must have either address or area filters
    if (!hasAddress && !hasAreaFilters) {
      return { isValid: false, error: 'Please specify either an address with search diameter OR select cities/townships' }
    }
    
    return { isValid: true, error: '' }
  }

  const isUsingAddressSearch = () => {
    return !!(formData.address && formData.address.trim())
  }

  const isUsingAreaSearch = () => {
    return (formData.cities && formData.cities.length > 0) || 
           (formData.townships && formData.townships.length > 0)
  }

  // Helper to format number with commas
  const formatNumberWithCommas = (value: string | number | undefined) => {
    if (!value && value !== 0) return ''
    const stringValue = value.toString().replace(/,/g, '')
    if (isNaN(Number(stringValue))) return stringValue
    return stringValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  // Helper to remove commas for state/processing
  const stripCommas = (value: string) => {
    return value.replace(/,/g, '')
  }

  const handleInputChange = (field: string, value: string | number | boolean | string[]) => {
    // Use functional state update to avoid stale closure issues
    setFormData(prevFormData => {
      let updatedFormData = { ...prevFormData, [field]: value }

      // Handle location field conflicts
      if (field === 'address') {
        // If address is being filled and we have area filters, clear them
        if (value && (prevFormData.cities?.length || prevFormData.townships?.length)) {
          updatedFormData = {
            ...updatedFormData,
            cities: [],
            townships: []
          }
        }
      } else if (field === 'cities' || field === 'townships') {
        // Check combined cities/townships limit (max 5 total)
        const newValue = value as string[]
        const newCities = field === 'cities' ? newValue : prevFormData.cities || []
        const newTownships = field === 'townships' ? newValue : prevFormData.townships || []

        // Prevent adding if it would exceed combined limit of 5
        if (newCities.length + newTownships.length > 5) {
          const otherFieldCount = field === 'cities' ? newTownships.length : newCities.length
          setValidationErrors(prev => ({
            ...prev,
            location: `Maximum 5 total cities and townships combined. You currently have ${otherFieldCount} ${field === 'cities' ? 'townships' : 'cities'}.`
          }))
          return prevFormData // Don't update the form data
        }

        // If area filters are being used and we have an address, clear it
        if (newValue.length > 0 && prevFormData.address) {
          updatedFormData = {
            ...updatedFormData,
            address: ''
          }
        }
      }

      return updatedFormData
    })

    // Clear validation errors when relevant fields change
    if ((field === 'address' || field === 'diameter' || field === 'cities' || field === 'townships') && validationErrors.location) {
      setValidationErrors(prev => ({ ...prev, location: '' }))
    }

    if ((field === 'isSingleFamily' || field === 'isCondo' || field === 'isTownHouse' ||
         field === 'isApartment' || field === 'isMultiFamily' || field === 'isLotLand') && validationErrors.propertyTypes) {
      setValidationErrors(prev => ({ ...prev, propertyTypes: '' }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate form
    const locationValidation = validateLocationPreferences()
    const hasValidPropertyTypes = validatePropertyTypes()
    
    let hasErrors = false
    const errors = { location: '', propertyTypes: '' }
    
    if (!locationValidation.isValid) {
      errors.location = locationValidation.error
      hasErrors = true
    }
    
    if (!hasValidPropertyTypes) {
      errors.propertyTypes = 'Please select at least one property type'
      hasErrors = true
    }
    
    if (hasErrors) {
      setValidationErrors(errors)
      return
    }
    
    setIsSubmitting(true)
    
    try {
      await onSubmit(formData)
      // Reset form
      setFormData({
        showcaseName: '',
        fullName: '',
        email: '',
        phone: '',
        visitingReason: 'BUYING_SOON',
        hasAgent: 'NO',
        additionalComments: '',
        minBeds: '',
        maxBeds: '',
        minBaths: '',
        maxBaths: '',
        minPrice: '',
        maxPrice: '',
        minYearBuilt: '',
        maxYearBuilt: '',
        address: '',
        cities: [],
        townships: [],
        diameter: '2',
        isTownHouse: false,
        isLotLand: false,
        isCondo: false,
        isMultiFamily: false,
        isSingleFamily: false,
        isApartment: false
      })
      // Reset validation errors
      setValidationErrors({
        location: '',
        propertyTypes: ''
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-[#111827]/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-300">
      <div className="bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-gray-100 max-w-4xl w-full max-h-[90vh] overflow-y-auto transform transition-all">
        <div className="p-8 border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-md z-10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-black text-[#0B0B0B] tracking-tight">Create New Showcase</h3>
              <p className="text-sm font-medium text-[#6B7280] mt-1">Create a personalized property collection for your client.</p>
            </div>
            <button
              onClick={onClose}
              className="group p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              <svg className="w-6 h-6 text-gray-400 group-hover:text-[#111827] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Limit Warning */}
          {isNearLimit && (
            <div className={`mt-6 p-4 rounded-xl flex items-center ${
              activeShowcasesCount >= maxActiveShowcases
                ? 'bg-red-50 border border-red-100'
                : 'bg-amber-50 border border-amber-100'
            }`}>
              <svg className={`w-5 h-5 mr-3 flex-shrink-0 ${
                activeShowcasesCount >= maxActiveShowcases ? 'text-red-500' : 'text-amber-500'
              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className={`text-sm font-bold ${
                activeShowcasesCount >= maxActiveShowcases ? 'text-red-700' : 'text-amber-700'
              }`}>
                {activeShowcasesCount >= maxActiveShowcases
                  ? `You have reached the maximum limit of ${maxActiveShowcases} active showcases. Please deactivate some showcases before creating a new one.`
                  : `You are near the limit of ${maxActiveShowcases} active showcases (${activeShowcasesCount}/${maxActiveShowcases}). Consider deactivating inactive showcases.`
                }
              </p>
            </div>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-10">
          {/* Basic Information */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3 pb-2 border-b border-gray-100">
              <div className="w-1 h-6 bg-[#C9A24D] rounded-full"></div>
              <h4 className="text-lg font-black text-[#0B0B0B] tracking-tight uppercase">Basic Information</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-2 ml-1">
                  Showcase Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.showcaseName}
                  onChange={(e) => handleInputChange('showcaseName', e.target.value)}
                  className="block w-full px-4 py-3.5 bg-[#FAFAF7] border border-gray-200 rounded-xl text-[#0B0B0B] placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:bg-white hover:border-[#C9A24D]/30"
                  placeholder="e.g., West Chester Family Showcase"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-2 ml-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => handleInputChange('fullName', e.target.value)}
                  className="block w-full px-4 py-3.5 bg-[#FAFAF7] border border-gray-200 rounded-xl text-[#0B0B0B] placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:bg-white hover:border-[#C9A24D]/30"
                  placeholder="Customer's full name"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-2 ml-1">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="block w-full px-4 py-3.5 bg-[#FAFAF7] border border-gray-200 rounded-xl text-[#0B0B0B] placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:bg-white hover:border-[#C9A24D]/30"
                  placeholder="customer@email.com"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-2 ml-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="block w-full px-4 py-3.5 bg-[#FAFAF7] border border-gray-200 rounded-xl text-[#0B0B0B] placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:bg-white hover:border-[#C9A24D]/30"
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3 pb-2 border-b border-gray-100">
              <div className="w-1 h-6 bg-[#C9A24D] rounded-full"></div>
              <h4 className="text-lg font-black text-[#0B0B0B] tracking-tight uppercase">Customer Preferences</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-2 ml-1">
                  Why are they visiting? *
                </label>
                <div className="relative">
                  <select
                    value={formData.visitingReason}
                    onChange={(e) => handleInputChange('visitingReason', e.target.value)}
                    className="block w-full px-4 py-3.5 bg-[#FAFAF7] border border-gray-200 rounded-xl text-[#0B0B0B] focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:bg-white hover:border-[#C9A24D]/30 appearance-none cursor-pointer"
                    required
                  >
                    <option value="BUYING_SOON">Looking to buy soon</option>
                    <option value="BROWSING">Just browsing</option>
                    <option value="NEIGHBORHOOD">Interested in area</option>
                    <option value="INVESTMENT">Investment opportunity</option>
                    <option value="CURIOUS">Curious about property</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-2 ml-1">
                  Do they have a real estate agent? *
                </label>
                <div className="relative">
                  <select
                    value={formData.hasAgent}
                    onChange={(e) => handleInputChange('hasAgent', e.target.value)}
                    className="block w-full px-4 py-3.5 bg-[#FAFAF7] border border-gray-200 rounded-xl text-[#0B0B0B] focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:bg-white hover:border-[#C9A24D]/30 appearance-none cursor-pointer"
                    required
                  >
                    <option value="YES">Yes, they have an agent</option>
                    <option value="NO">No, they don't have an agent</option>
                    <option value="LOOKING">They're looking for an agent</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <label className="flex items-center text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-2 ml-1">
                Special features they're looking for
                <span 
                  className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold cursor-help border border-gray-200"
                  title="Separating keywords with commas will prioritize properties containing these terms in their descriptions (e.g., pool, garage, waterfront)."
                >
                  i
                </span>
              </label>
              <textarea
                value={formData.additionalComments}
                onChange={(e) => handleInputChange('additionalComments', e.target.value)}
                rows={3}
                className="block w-full px-4 py-3.5 bg-[#FAFAF7] border border-gray-200 rounded-xl text-[#0B0B0B] placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:bg-white hover:border-[#C9A24D]/30"
                placeholder="pool, garage, modern kitchen..."
              />
            </div>
          </div>

          {/* Property Search Preferences */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3 pb-2 border-b border-gray-100">
              <div className="w-1 h-6 bg-[#C9A24D] rounded-full"></div>
              <h4 className="text-lg font-black text-[#0B0B0B] tracking-tight uppercase">Property Search Criteria</h4>
            </div>
            
            <div className="grid grid-cols-1 gap-6">
              {/* Beds and Baths */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <label className="block text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-2 ml-1">
                    Min Beds
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.minBeds}
                    onChange={(e) => handleInputChange('minBeds', e.target.value)}
                    className="block w-full px-4 py-3.5 bg-[#FAFAF7] border border-gray-200 rounded-xl text-[#0B0B0B] placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:bg-white hover:border-[#C9A24D]/30"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-2 ml-1">
                    Max Beds
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.maxBeds}
                    onChange={(e) => handleInputChange('maxBeds', e.target.value)}
                    className="block w-full px-4 py-3.5 bg-[#FAFAF7] border border-gray-200 rounded-xl text-[#0B0B0B] placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:bg-white hover:border-[#C9A24D]/30"
                    placeholder="Any"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-2 ml-1">
                    Min Baths
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={formData.minBaths}
                    onChange={(e) => handleInputChange('minBaths', e.target.value)}
                    className="block w-full px-4 py-3.5 bg-[#FAFAF7] border border-gray-200 rounded-xl text-[#0B0B0B] placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:bg-white hover:border-[#C9A24D]/30"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-2 ml-1">
                    Max Baths
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={formData.maxBaths}
                    onChange={(e) => handleInputChange('maxBaths', e.target.value)}
                    className="block w-full px-4 py-3.5 bg-[#FAFAF7] border border-gray-200 rounded-xl text-[#0B0B0B] placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:bg-white hover:border-[#C9A24D]/30"
                    placeholder="Any"
                  />
                </div>
              </div>

              {/* Price Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-2 ml-1">
                    Min Price ($)
                  </label>
                  <input
                    type="text"
                    value={formatNumberWithCommas(formData.minPrice)}
                    onChange={(e) => {
                      const rawValue = stripCommas(e.target.value)
                      if (rawValue === '' || /^\d+$/.test(rawValue)) {
                        handleInputChange('minPrice', rawValue)
                      }
                    }}
                    className="block w-full px-4 py-3.5 bg-[#FAFAF7] border border-gray-200 rounded-xl text-[#0B0B0B] placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:bg-white hover:border-[#C9A24D]/30"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-2 ml-1">
                    Max Price ($)
                  </label>
                  <input
                    type="text"
                    value={formatNumberWithCommas(formData.maxPrice)}
                    onChange={(e) => {
                      const rawValue = stripCommas(e.target.value)
                      if (rawValue === '' || /^\d+$/.test(rawValue)) {
                        handleInputChange('maxPrice', rawValue)
                      }
                    }}
                    className="block w-full px-4 py-3.5 bg-[#FAFAF7] border border-gray-200 rounded-xl text-[#0B0B0B] placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:bg-white hover:border-[#C9A24D]/30"
                    placeholder="No limit"
                  />
                </div>
              </div>

              {/* Year Built Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-2 ml-1">
                    Min Year Built
                  </label>
                  <input
                    type="number"
                    min="1800"
                    max="2100"
                    value={formData.minYearBuilt}
                    onChange={(e) => handleInputChange('minYearBuilt', e.target.value)}
                    className="block w-full px-4 py-3.5 bg-[#FAFAF7] border border-gray-200 rounded-xl text-[#0B0B0B] placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:bg-white hover:border-[#C9A24D]/30"
                    placeholder="Any"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-2 ml-1">
                    Max Year Built
                  </label>
                  <input
                    type="number"
                    min="1800"
                    max="2100"
                    value={formData.maxYearBuilt}
                    onChange={(e) => handleInputChange('maxYearBuilt', e.target.value)}
                    className="block w-full px-4 py-3.5 bg-[#FAFAF7] border border-gray-200 rounded-xl text-[#0B0B0B] placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:bg-white hover:border-[#C9A24D]/30"
                    placeholder="Any"
                  />
                </div>
              </div>

              {/* Location */}
              <div className="space-y-6">
                <div className="flex items-center space-x-3 pb-2 border-b border-gray-100">
                  <div className="w-1 h-6 bg-[#C9A24D] rounded-full"></div>
                  <h4 className="text-lg font-black text-[#0B0B0B] tracking-tight uppercase">Location Preferences</h4>
                </div>
                
                <p className="text-sm font-medium text-[#6B7280] mb-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <span className="font-bold text-[#111827]">Note:</span> Choose either address-based search OR city/township filtering (not both).
                </p>
                
                {/* Address-Based Search */}
                <div className={`p-6 rounded-2xl border transition-all duration-300 ${isUsingAddressSearch() ? 'border-[#C9A24D] bg-[#FAFAF7] shadow-md' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                  <div className="flex items-center justify-between mb-6">
                    <h5 className={`text-md font-black uppercase tracking-wide flex items-center ${isUsingAddressSearch() ? 'text-[#111827]' : 'text-gray-500'}`}>
                      <div className={`p-2 rounded-full mr-3 ${isUsingAddressSearch() ? 'bg-[#C9A24D] text-white' : 'bg-gray-100 text-gray-400'}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      Address-Based Search
                    </h5>
                    {formData.address && (
                      <button
                        type="button"
                        onClick={() => {
                          handleInputChange('address', '')
                          handleInputChange('diameter', '0')
                        }}
                        className="text-xs font-bold text-[#C9A24D] hover:text-[#111827] uppercase tracking-widest transition-colors py-2 px-3 hover:bg-[#C9A24D]/10 rounded-lg"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-2 ml-1">
                        Address
                      </label>
                      <GooglePlacesAutocomplete
                        value={formData.address}
                        onChange={(address) => handleInputChange('address', address)}
                        disabled={isUsingAreaSearch()}
                        className={`block w-full px-4 py-3.5 border rounded-xl placeholder-gray-400 focus:outline-none focus:ring-4 transition-all duration-200 font-medium ${
                          isUsingAreaSearch() 
                            ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed' 
                            : 'bg-white border-gray-200 text-[#0B0B0B] focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] hover:border-[#C9A24D]/30'
                        }`}
                        placeholder={isUsingAreaSearch() ? 'Disabled - using city/township search' : '123 Main Street, City, State'}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-2 ml-1">
                        Search Radius (miles) {formData.address ? '*' : ''}
                      </label>
                      <input
                        type="number"
                        min="0.1"
                        max="50"
                        step="0.1"
                        value={formData.diameter}
                        onChange={(e) => handleInputChange('diameter', e.target.value)}
                        disabled={isUsingAreaSearch()}
                        className={`block w-full px-4 py-3.5 border rounded-xl placeholder-gray-400 focus:outline-none focus:ring-4 transition-all duration-200 font-medium ${
                          isUsingAreaSearch() 
                            ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed' 
                            : 'bg-white border-gray-200 text-[#0B0B0B] focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] hover:border-[#C9A24D]/30'
                        }`}
                        placeholder="10"
                      />
                      {formData.address && (
                        <p className="text-xs font-medium text-[#C9A24D] mt-2 ml-1">* Required when using address search</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Area-Based Search */}
                <div className={`p-6 rounded-2xl border transition-all duration-300 ${isUsingAreaSearch() ? 'border-[#C9A24D] bg-[#FAFAF7] shadow-md' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                  <div className="flex items-center justify-between mb-6">
                    <h5 className={`text-md font-black uppercase tracking-wide flex items-center ${isUsingAreaSearch() ? 'text-[#111827]' : 'text-gray-500'}`}>
                      <div className={`p-2 rounded-full mr-3 ${isUsingAreaSearch() ? 'bg-[#C9A24D] text-white' : 'bg-gray-100 text-gray-400'}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                      </div>
                      City/Township Search
                    </h5>
                    <div className="flex items-center space-x-3">
                      {((formData.cities?.length || 0) + (formData.townships?.length || 0)) > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              handleInputChange('cities', [])
                              handleInputChange('townships', [])
                            }}
                            className="text-xs font-bold text-[#C9A24D] hover:text-[#111827] uppercase tracking-widest transition-colors py-2 px-3 hover:bg-[#C9A24D]/10 rounded-lg"
                          >
                            Clear
                          </button>
                          <span className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-wider ${
                            ((formData.cities?.length || 0) + (formData.townships?.length || 0)) >= 5
                              ? 'bg-red-100 text-red-800 border border-red-200'
                              : 'bg-[#111827] text-white'
                          }`}>
                            {(formData.cities?.length || 0) + (formData.townships?.length || 0)}/5 locations
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-2 ml-1">
                        Cities
                      </label>
                      <MultiCityPlacesInput
                        cities={formData.cities}
                        maxCities={5 - (formData.townships?.length || 0)}
                        onChange={(cities) => {
                          setFormData(prev => {
                            const newTownships = prev.townships || []
                            // Check combined limit (max 5 total)
                            if (cities.length + newTownships.length > 5) {
                              setValidationErrors(prevErrors => ({
                                ...prevErrors,
                                location: `Maximum 5 total cities and townships combined. You currently have ${newTownships.length} townships.`
                              }))
                              return prev // Don't update
                            }
                            // Clear address if cities are being added
                            if (cities.length > 0 && prev.address) {
                              return { ...prev, cities, address: '' }
                            }
                            return { ...prev, cities }
                          })
                          // Clear validation errors
                          if (validationErrors.location) {
                            setValidationErrors(prev => ({ ...prev, location: '' }))
                          }
                        }}
                        placeholder={isUsingAddressSearch() ? 'Disabled - using address search' : 'Type city names and press Enter...'}
                        className="mb-4"
                        disabled={isUsingAddressSearch()}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-2 ml-1">
                        Townships
                      </label>
                      <MultiTownshipPlacesInput
                        townships={formData.townships}
                        maxTownships={5 - (formData.cities?.length || 0)}
                        onChange={(townships) => {
                          setFormData(prev => {
                            const newCities = prev.cities || []
                            // Check combined limit (max 5 total)
                            if (townships.length + newCities.length > 5) {
                              setValidationErrors(prevErrors => ({
                                ...prevErrors,
                                location: `Maximum 5 total cities and townships combined. You currently have ${newCities.length} cities.`
                              }))
                              return prev // Don't update
                            }
                            // Clear address if townships are being added
                            if (townships.length > 0 && prev.address) {
                              return { ...prev, townships, address: '' }
                            }
                            return { ...prev, townships }
                          })
                          // Clear validation errors
                          if (validationErrors.location) {
                            setValidationErrors(prev => ({ ...prev, location: '' }))
                          }
                        }}
                        placeholder={isUsingAddressSearch() ? 'Disabled - using address search' : 'Type township names and press Enter...'}
                        className="mb-4"
                        disabled={isUsingAddressSearch()}
                      />
                    </div>
                  </div>
                </div>

                {/* Location Validation Error */}
                {validationErrors.location && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center shadow-sm">
                    <div className="p-2 bg-red-100 rounded-full mr-3">
                      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-red-700">{validationErrors.location}</p>
                  </div>
                )}
              </div>

              {/* Property Types */}
              <div className="space-y-6">
                <div className="flex items-center space-x-3 pb-2 border-b border-gray-100">
                  <div className="w-1 h-6 bg-[#C9A24D] rounded-full"></div>
                  <h4 className="text-lg font-black text-[#0B0B0B] tracking-tight uppercase">Home Type Preferences</h4>
                </div>
                
                <p className="text-xs font-bold text-[#6B7280] uppercase tracking-widest ml-1">Select at least one property type *</p>
                
                <div className={`p-6 rounded-2xl border transition-all duration-300 ${validationErrors.propertyTypes ? 'border-red-200 bg-red-50/50' : 'border-gray-200 bg-[#FAFAF7]'}`}>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <label className="flex items-center space-x-3 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.isSingleFamily || false}
                          onChange={(e) => handleInputChange('isSingleFamily', e.target.checked)}
                          className="w-5 h-5 text-[#111827] border-gray-300 rounded focus:ring-[#C9A24D] focus:ring-offset-0 transition-all duration-200"
                        />
                      </div>
                      <span className="text-sm font-bold text-[#6B7280] group-hover:text-[#111827] transition-colors">Single Family</span>
                    </label>

                    <label className="flex items-center space-x-3 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.isCondo || false}
                          onChange={(e) => handleInputChange('isCondo', e.target.checked)}
                          className="w-5 h-5 text-[#111827] border-gray-300 rounded focus:ring-[#C9A24D] focus:ring-offset-0 transition-all duration-200"
                        />
                      </div>
                      <span className="text-sm font-bold text-[#6B7280] group-hover:text-[#111827] transition-colors">Condo</span>
                    </label>

                    <label className="flex items-center space-x-3 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.isTownHouse || false}
                          onChange={(e) => handleInputChange('isTownHouse', e.target.checked)}
                          className="w-5 h-5 text-[#111827] border-gray-300 rounded focus:ring-[#C9A24D] focus:ring-offset-0 transition-all duration-200"
                        />
                      </div>
                      <span className="text-sm font-bold text-[#6B7280] group-hover:text-[#111827] transition-colors">Townhouse</span>
                    </label>

                    <label className="flex items-center space-x-3 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.isApartment || false}
                          onChange={(e) => handleInputChange('isApartment', e.target.checked)}
                          className="w-5 h-5 text-[#111827] border-gray-300 rounded focus:ring-[#C9A24D] focus:ring-offset-0 transition-all duration-200"
                        />
                      </div>
                      <span className="text-sm font-bold text-[#6B7280] group-hover:text-[#111827] transition-colors">Apartment</span>
                    </label>

                    <label className="flex items-center space-x-3 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.isMultiFamily || false}
                          onChange={(e) => handleInputChange('isMultiFamily', e.target.checked)}
                          className="w-5 h-5 text-[#111827] border-gray-300 rounded focus:ring-[#C9A24D] focus:ring-offset-0 transition-all duration-200"
                        />
                      </div>
                      <span className="text-sm font-bold text-[#6B7280] group-hover:text-[#111827] transition-colors">Multi-Family</span>
                    </label>

                    <label className="flex items-center space-x-3 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.isLotLand || false}
                          onChange={(e) => handleInputChange('isLotLand', e.target.checked)}
                          className="w-5 h-5 text-[#111827] border-gray-300 rounded focus:ring-[#C9A24D] focus:ring-offset-0 transition-all duration-200"
                        />
                      </div>
                      <span className="text-sm font-bold text-[#6B7280] group-hover:text-[#111827] transition-colors">Lot/Land</span>
                    </label>
                  </div>
                </div>

                {/* Property Type Validation Error */}
                {validationErrors.propertyTypes && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center shadow-sm">
                    <div className="p-2 bg-red-100 rounded-full mr-3">
                      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-red-700">{validationErrors.propertyTypes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-4 pt-8 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3.5 bg-white border border-gray-200 hover:bg-gray-50 text-[#6B7280] font-bold rounded-xl transition-all duration-300 uppercase tracking-wide text-xs shadow-sm hover:shadow"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-3.5 bg-[#111827] hover:bg-[#C9A24D] text-white font-black rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed uppercase tracking-widest text-xs"
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </span>
              ) : 'Create Showcase'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
