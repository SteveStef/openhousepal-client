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
  const { isAuthenticated, isLoading: isAuthenticating } = useAuth()
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
      const response = await apiRequest(`/collections/${selectedCollection.id}/properties/${String(propertyId)}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          content: comment,
          visitor_name: `${selectedCollection.customer.firstName} ${selectedCollection.customer.lastName}`,
          visitor_email: selectedCollection.customer.email
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
        // Update selected property with fresh comments
        setSelectedProperty(prev => prev ? {
          ...prev,
          comments: response.data
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

      // Use atomic update that saves preferences and refreshes properties together
      // Only commits if Zillow API succeeds, preventing empty collections on errors
      const response = await updatePreferencesAndRefresh(collectionId, preferences)

      if (response.status === 200) {
        console.log('[PREFERENCES] Successfully updated preferences and refreshed properties')

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
        console.error('[PREFERENCES] Failed to update preferences and refresh properties:', response.status, errorMessage)
        showToast(`Failed to save changes: ${errorMessage}. Your preferences and properties have not been changed.`, 'error')
      }
    } catch (error) {
      console.error('[PREFERENCES] Error updating preferences and refreshing properties:', error)
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
      <div className="min-h-screen bg-gradient-to-br from-[#faf9f7] via-white to-[#f5f4f2] flex flex-col">
        <Header />
        <div className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => {
              router.push('/showcases', { scroll: false })
              // Let the useEffect (lines 210-221) handle clearing selectedCollection
            }}
            className="mb-6 flex items-center text-gray-600 hover:text-gray-900 transition-colors duration-200"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            Back to Showcases
          </button>

          {/* Combined Property Recommendations and Status Section */}
          <div className="bg-white/95 rounded-2xl shadow-xl border border-gray-200/60 p-5 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 font-light">Property Recommendations</h1>
                <p className="text-gray-600 text-sm font-light">Curated properties based on client preferences</p>
              </div>

              <div className="flex items-center gap-2 sm:gap-4">
                <button
                  onClick={handleViewTours}
                  className="inline-flex items-center px-3 sm:px-4 py-2 rounded-lg text-sm font-medium border border-[#8b7355] text-[#8b7355] hover:bg-[#8b7355] hover:text-white transition-all duration-200 shadow-sm hover:shadow-md whitespace-nowrap"
                  title="View tour requests for this collection"
                >
                  <Calendar size={16} className="mr-2" />
                  <span className="hidden sm:inline">View Tours</span>
                  <span className="sm:hidden">Tours</span>
                </button>
                <button
                  onClick={() => handleStatusToggle(selectedCollection.id)}
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-200 hover:shadow-sm whitespace-nowrap ${
                    selectedCollection.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                  }`}
                  title={`Click to ${selectedCollection.status === 'ACTIVE' ? 'deactivate' : 'activate'} this collection`}
                >
                  <div className={`w-2 h-2 rounded-full mr-1.5 ${
                    selectedCollection.status === 'ACTIVE' ? 'bg-green-400' : 'bg-gray-400'
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
                  className="w-full px-3 py-2 bg-gray-100/40 text-gray-700 hover:bg-zinc-600/60 border border-gray-300/40 hover:border-zinc-500/60 rounded-lg text-sm transition-all duration-300"
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
      <div className="min-h-screen bg-gradient-to-br from-[#faf9f7] via-white to-[#f5f4f2] flex flex-col">
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
      <div className="min-h-screen bg-gradient-to-br from-[#faf9f7] via-white to-[#f5f4f2] flex flex-col">
        <Header />
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
        {/* Combined Header and Filters */}
        <div className="bg-white/95 rounded-2xl shadow-xl border border-gray-200/60 p-6 mb-8">
          {/* Header Section */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6">
            <div className="flex-1 mb-4 lg:mb-0">
              <h1 className="text-3xl font-bold text-gray-900 mb-2 font-light">Showcases</h1>
              <p className="text-gray-600 font-light">Manage customer property showcases and preferences</p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-6">
              <button
                onClick={() => setIsCreateModalOpen(true)}
                disabled={isAtLimit}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 flex items-center space-x-1.5 ${
                  isAtLimit
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white hover:shadow-md hover:shadow-[#8b7355]/25'
                }`}
                title={isAtLimit ? 'Maximum 10 active showcases reached' : 'Create a new showcase'}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>{isAtLimit ? 'Limit Reached' : 'Create Showcase'}</span>
              </button>

              {/* Active Showcases Counter */}
              <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border ${
                isAtLimit
                  ? 'bg-red-50 border-red-200'
                  : isNearLimit
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-green-50 border-green-200'
              }`}>
                <div className={`w-3 h-3 rounded-full ${
                  isAtLimit
                    ? 'bg-red-400'
                    : isNearLimit
                    ? 'bg-amber-400'
                    : 'bg-green-400'
                }`}></div>
                <span className={`text-sm font-medium ${
                  isAtLimit
                    ? 'text-red-800'
                    : isNearLimit
                    ? 'text-amber-800'
                    : 'text-green-800'
                }`}>
                  {activeShowcasesCount}/{maxActiveShowcases} Active Showcases
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                  <Share2 className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm text-gray-600 font-medium">Share showcases with buyers</span>
              </div>
            </div>
          </div>
          
          {/* Filters Section */}
          <div className="border-t border-gray-200/60 pt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Filter Showcases</h3>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-500">
                  {filteredCollections.length} showcases found • {activeShowcasesCount}/{maxActiveShowcases} active
                </span>
                {isAtLimit && (
                  <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full border border-red-200 font-medium">
                    Limit Reached
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 bg-white/60 border border-gray-200/50 rounded-lg text-gray-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#8b7355]/60 focus:border-[#8b7355]/60 transition-all duration-300 text-sm"
              />
            </div>
            <div className="sm:w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-3 py-2 bg-white/60 border border-gray-200/50 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#8b7355]/60 focus:border-[#8b7355]/60 transition-all duration-300 text-sm"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
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
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gradient-to-br from-[#8b7355]/20 to-[#8b7355]/10 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <svg className="w-8 h-8 text-[#8b7355]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2 font-light">No showcases found</h3>
            <p className="text-gray-600 font-light">Try adjusting your search or filters</p>
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
        // Check combined cities/townships limit (max 10 total)
        const newValue = value as string[]
        const newCities = field === 'cities' ? newValue : prevFormData.cities || []
        const newTownships = field === 'townships' ? newValue : prevFormData.townships || []

        // Prevent adding if it would exceed combined limit of 10
        if (newCities.length + newTownships.length > 10) {
          const otherFieldCount = field === 'cities' ? newTownships.length : newCities.length
          setValidationErrors(prev => ({
            ...prev,
            location: `Maximum 10 total cities and townships combined. You currently have ${otherFieldCount} ${field === 'cities' ? 'townships' : 'cities'}.`
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">Create New Showcase</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-gray-600 text-sm mt-1">Create a showcase based on customer preferences and search criteria</p>

          {/* Limit Warning */}
          {isNearLimit && (
            <div className={`mt-3 p-3 rounded-lg flex items-center ${
              activeShowcasesCount >= maxActiveShowcases
                ? 'bg-red-50 border border-red-200'
                : 'bg-amber-50 border border-amber-200'
            }`}>
              <svg className={`w-5 h-5 mr-2 flex-shrink-0 ${
                activeShowcasesCount >= maxActiveShowcases ? 'text-red-500' : 'text-amber-500'
              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className={`text-sm ${
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
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Collection Information */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-900">Showcase Information</h4>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Showcase Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.showcaseName}
                  onChange={(e) => handleInputChange('showcaseName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                  placeholder="e.g., West Chester Family Showcase"
                />
              </div>
            </div>
          </div>

          {/* Customer Information */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-900">Customer Information</h4>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => handleInputChange('fullName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                  placeholder="Customer's full name"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                    placeholder="customer@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-900">Customer Preferences</h4>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Why are they visiting? *
                </label>
                <select
                  value={formData.visitingReason}
                  onChange={(e) => handleInputChange('visitingReason', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                  required
                >
                  <option value="BUYING_SOON">Looking to buy soon</option>
                  <option value="BROWSING">Just browsing</option>
                  <option value="NEIGHBORHOOD">Interested in area</option>
                  <option value="INVESTMENT">Investment opportunity</option>
                  <option value="CURIOUS">Curious about property</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Do they have a real estate agent? *
                </label>
                <select
                  value={formData.hasAgent}
                  onChange={(e) => handleInputChange('hasAgent', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                  required
                >
                  <option value="YES">Yes, they have an agent</option>
                  <option value="NO">No, they don't have an agent</option>
                  <option value="LOOKING">They're looking for an agent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Special features they're looking for
                </label>
                <textarea
                  value={formData.additionalComments}
                  onChange={(e) => handleInputChange('additionalComments', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                  placeholder="pool, garage, modern kitchen..."
                />
              </div>
            </div>
          </div>

          {/* Property Search Preferences */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-900">Property Search Criteria</h4>
            <div className="grid grid-cols-1 gap-4">
              {/* Beds and Baths */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Min Beds
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.minBeds}
                    onChange={(e) => handleInputChange('minBeds', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Beds
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.maxBeds}
                    onChange={(e) => handleInputChange('maxBeds', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                    placeholder="Any"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Min Baths
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={formData.minBaths}
                    onChange={(e) => handleInputChange('minBaths', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Baths
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={formData.maxBaths}
                    onChange={(e) => handleInputChange('maxBaths', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                    placeholder="Any"
                  />
                </div>
              </div>

              {/* Price Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Min Price ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.minPrice}
                    onChange={(e) => handleInputChange('minPrice', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Price ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.maxPrice}
                    onChange={(e) => handleInputChange('maxPrice', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                    placeholder="No limit"
                  />
                </div>
              </div>

              {/* Year Built Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Min Year Built
                  </label>
                  <input
                    type="number"
                    min="1800"
                    max="2100"
                    value={formData.minYearBuilt}
                    onChange={(e) => handleInputChange('minYearBuilt', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                    placeholder="Any"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Year Built
                  </label>
                  <input
                    type="number"
                    min="1800"
                    max="2100"
                    value={formData.maxYearBuilt}
                    onChange={(e) => handleInputChange('maxYearBuilt', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                    placeholder="Any"
                  />
                </div>
              </div>

              {/* Location */}
              <div className="space-y-4">
                <p className="text-sm text-gray-600 mb-4">
                  Choose either address-based search OR city/township filtering (not both)
                </p>
                
                {/* Address-Based Search */}
                <div className={`p-4 rounded-lg border-2 ${isUsingAddressSearch() ? 'border-[#8b7355] bg-[#8b7355]/5' : 'border-gray-200 bg-gray-50/50'}`}>
                  <h5 className="text-md font-medium text-gray-800 mb-3 flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Address-Based Search
                  </h5>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Address
                      </label>
                      <GooglePlacesAutocomplete
                        value={formData.address}
                        onChange={(address) => handleInputChange('address', address)}
                        disabled={isUsingAreaSearch()}
                        className={`${
                          isUsingAreaSearch() 
                            ? 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed' 
                            : 'border-gray-300'
                        }`}
                        placeholder={isUsingAreaSearch() ? 'Disabled - using city/township search' : '123 Main Street, City, State'}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
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
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355] ${
                          isUsingAreaSearch() 
                            ? 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed' 
                            : 'border-gray-300'
                        }`}
                        placeholder="10"
                      />
                      {formData.address && (
                        <p className="text-xs text-gray-600 mt-1">* Required when using address search</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Area-Based Search */}
                <div className={`p-4 rounded-lg border-2 ${isUsingAreaSearch() ? 'border-[#8b7355] bg-[#8b7355]/5' : 'border-gray-200 bg-gray-50/50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-md font-medium text-gray-800 flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                      </svg>
                      City/Township Search
                    </h5>
                    {((formData.cities?.length || 0) + (formData.townships?.length || 0)) > 0 && (
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        ((formData.cities?.length || 0) + (formData.townships?.length || 0)) >= 10
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}>
                        {(formData.cities?.length || 0) + (formData.townships?.length || 0)}/10 locations
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cities
                      </label>
                      <MultiCityPlacesInput
                        cities={formData.cities}
                        onChange={(cities) => {
                          setFormData(prev => {
                            const newTownships = prev.townships || []
                            // Check combined limit (max 10 total)
                            if (cities.length + newTownships.length > 10) {
                              setValidationErrors(prevErrors => ({
                                ...prevErrors,
                                location: `Maximum 10 total cities and townships combined. You currently have ${newTownships.length} townships.`
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
                        maxCities={Math.max(1, 10 - (formData.townships?.length || 0))}
                        className="mb-4"
                        disabled={isUsingAddressSearch()}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Townships
                      </label>
                      <MultiTownshipPlacesInput
                        townships={formData.townships}
                        onChange={(townships) => {
                          setFormData(prev => {
                            const newCities = prev.cities || []
                            // Check combined limit (max 10 total)
                            if (townships.length + newCities.length > 10) {
                              setValidationErrors(prevErrors => ({
                                ...prevErrors,
                                location: `Maximum 10 total cities and townships combined. You currently have ${newCities.length} cities.`
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
                        maxTownships={Math.max(1, 10 - (formData.cities?.length || 0))}
                        className="mb-4"
                        disabled={isUsingAddressSearch()}
                      />
                    </div>
                  </div>
                </div>

                {/* Location Validation Error */}
                {validationErrors.location && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center">
                    <svg className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-red-700">{validationErrors.location}</p>
                  </div>
                )}
              </div>

              {/* Property Types */}
              <div className="space-y-4">
                <h4 className="text-lg font-medium text-gray-900">Home Type Preferences</h4>
                <p className="text-sm text-gray-600">Select at least one property type *</p>
                
                <div className={`p-4 rounded-lg border-2 ${validationErrors.propertyTypes ? 'border-red-200 bg-red-50/50' : 'border-gray-200 bg-gray-50/50'}`}>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isSingleFamily || false}
                        onChange={(e) => handleInputChange('isSingleFamily', e.target.checked)}
                        className="w-4 h-4 text-[#8b7355] border-gray-300 rounded focus:ring-[#8b7355] focus:ring-2"
                      />
                      <span className="text-sm font-medium text-gray-700">Single Family</span>
                    </label>

                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isCondo || false}
                        onChange={(e) => handleInputChange('isCondo', e.target.checked)}
                        className="w-4 h-4 text-[#8b7355] border-gray-300 rounded focus:ring-[#8b7355] focus:ring-2"
                      />
                      <span className="text-sm font-medium text-gray-700">Condo</span>
                    </label>

                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isTownHouse || false}
                        onChange={(e) => handleInputChange('isTownHouse', e.target.checked)}
                        className="w-4 h-4 text-[#8b7355] border-gray-300 rounded focus:ring-[#8b7355] focus:ring-2"
                      />
                      <span className="text-sm font-medium text-gray-700">Townhouse</span>
                    </label>

                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isApartment || false}
                        onChange={(e) => handleInputChange('isApartment', e.target.checked)}
                        className="w-4 h-4 text-[#8b7355] border-gray-300 rounded focus:ring-[#8b7355] focus:ring-2"
                      />
                      <span className="text-sm font-medium text-gray-700">Apartment</span>
                    </label>

                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isMultiFamily || false}
                        onChange={(e) => handleInputChange('isMultiFamily', e.target.checked)}
                        className="w-4 h-4 text-[#8b7355] border-gray-300 rounded focus:ring-[#8b7355] focus:ring-2"
                      />
                      <span className="text-sm font-medium text-gray-700">Multi-Family</span>
                    </label>

                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isLotLand || false}
                        onChange={(e) => handleInputChange('isLotLand', e.target.checked)}
                        className="w-4 h-4 text-[#8b7355] border-gray-300 rounded focus:ring-[#8b7355] focus:ring-2"
                      />
                      <span className="text-sm font-medium text-gray-700">Lot/Land</span>
                    </label>
                  </div>
                </div>

                {/* Property Type Validation Error */}
                {validationErrors.propertyTypes && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center">
                    <svg className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-red-700">{validationErrors.propertyTypes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-lg hover:shadow-lg hover:shadow-[#8b7355]/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Showcase'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
