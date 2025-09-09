'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Collection, Property } from '@/types'
import PropertyGrid from '@/components/PropertyGrid'
import CollectionCard from '@/components/CollectionCard'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import PropertyDetailsModal from '@/components/PropertyDetailsModal'
import ShareCollectionModal from '@/components/ShareCollectionModal'
import EditPreferencesModal from '@/components/EditPreferencesModal'
import ChatAssistant from '@/components/ChatAssistant'
import { Share2 } from 'lucide-react'
import { apiRequest, checkAuth, updateCollectionPreferences } from '@/lib/auth'

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
  const [collections, setCollections] = useState<Collection[]>([])
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticating, setIsAuthenticating] = useState(true)
  const [matchedProperties, setMatchedProperties] = useState<Property[] | null>(null);
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED' | 'COMPLETED'>('ALL')
  
  // Property filtering states
  const [activeTab, setActiveTab] = useState<'all' | 'liked' | 'disliked' | 'favorited'>('all')
  const [sortBy, setSortBy] = useState<'price' | 'beds' | 'squareFeet'>('price')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Modal states
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  
  // Share modal states
  const [selectedCollectionForShare, setSelectedCollectionForShare] = useState<Collection | null>(null)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  
  // Edit preferences modal states
  const [selectedCollectionForEdit, setSelectedCollectionForEdit] = useState<Collection | null>(null)
  const [isEditPreferencesModalOpen, setIsEditPreferencesModalOpen] = useState(false)
  
  // Create collection modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  

  // Check authentication first
  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        const isAuthenticated = await checkAuth()
        if (!isAuthenticated) {
          router.push(`/login?redirect=${encodeURIComponent('/collections')}`)
          return
        }
        setIsAuthenticating(false)
      } catch (error) {
        console.error('Authentication check failed:', error)
        router.push('/login')
      }
    }
    
    checkAuthentication()
  }, [router])

  // Load property interactions when a collection is selected


  useEffect(() => {
    if (!isAuthenticating) {
      const fetchCollections = async () => {
      setIsLoading(true)
      try {
        const response = await apiRequest('/collections/')
        
        if (response.status === 200 && response.data) {
          console.log('[LOAD] Backend collections data:', JSON.stringify(response.data, null, 2))
          // Transform backend data to match frontend interface
          const transformedCollections: Collection[] = response.data.map((backendCollection: any) => {
            console.log(`[LOAD] Processing collection: ${backendCollection.name} - ID: ${backendCollection.id} - isPublic: ${backendCollection.is_public} - shareToken: ${backendCollection.share_token}`)
            console.log(`[DEBUG] Original property data:`, backendCollection.original_property)
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

  const filteredCollections = collections.filter(collection => {
    const matchesSearch = 
      collection.customer.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      collection.customer.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      collection.customer.email.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'ALL' || collection.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const formatTimeframe = (timeframe: string) => {
    return timeframe.replace(/_/g, '-').toLowerCase()
  }

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
  const getFilteredProperties = () => {
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
      case 'favorited':
        filtered = filtered.filter(property => property.favorited)
        break
      case 'all':
      default:
        // Show all properties
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
    if (!selectedCollection || !matchedProperties) return { all: 0, liked: 0, disliked: 0, favorited: 0 }
    
    const properties = matchedProperties
    return {
      all: properties.length,
      liked: properties.filter(p => p.liked).length,
      disliked: properties.filter(p => p.disliked).length,
      favorited: properties.filter(p => p.favorited).length
    }
  }

  const tabCounts = getTabCounts()

  // Handle property interactions
  const handlePropertyLike = async (propertyId: number, liked: boolean) => {
    if (!selectedCollection || !matchedProperties) return
    
    try {
      const response = await apiRequest(`/collections/${selectedCollection.id}/properties/${propertyId}/interact`, {
        method: 'POST',
        body: JSON.stringify({
          interaction_type: 'like',
          value: liked
        })
      })

      if (response.status === 200) {
        // Update local state with server response
        const updatedProperties = matchedProperties.map(property =>
          property.id === propertyId ? { 
            ...property, 
            liked: response.data.interaction.liked,
            disliked: response.data.interaction.disliked
          } : property
        )
        
        setMatchedProperties(updatedProperties)
      }
    } catch (error) {
      console.error('Error updating property like:', error)
    }
  }

  const handlePropertyDislike = async (propertyId: number, disliked: boolean) => {
    if (!selectedCollection || !matchedProperties) return
    
    try {
      const response = await apiRequest(`/collections/${selectedCollection.id}/properties/${propertyId}/interact`, {
        method: 'POST',
        body: JSON.stringify({
          interaction_type: 'dislike',
          value: disliked
        })
      })

      if (response.status === 200) {
        // Update local state with server response
        const updatedProperties = matchedProperties.map(property =>
          property.id === propertyId ? { 
            ...property, 
            liked: response.data.interaction.liked,
            disliked: response.data.interaction.disliked
          } : property
        )
        
        setMatchedProperties(updatedProperties)

      }
    } catch (error) {
      console.error('Error updating property dislike:', error)
    }
  }

  const handlePropertyFavorite = async (propertyId: number, favorited: boolean) => {
    if (!selectedCollection || !matchedProperties) return
    
    try {
      const response = await apiRequest(`/collections/${selectedCollection.id}/properties/${propertyId}/interact`, {
        method: 'POST',
        body: JSON.stringify({
          interaction_type: 'favorite',
          value: favorited
        })
      })

      if (response.status === 200) {
        // Update local state with server response
        const updatedProperties = matchedProperties.map(property =>
          property.id === propertyId ? { 
            ...property, 
            favorited: response.data.interaction.favorited
          } : property
        )
        setMatchedProperties(updatedProperties)
      }
    } catch (error) {
      console.error('Error updating property favorite:', error)
    }
  }

  const handleAddComment = async (propertyId: number, comment: string) => {
    if (!selectedCollection || !matchedProperties) return

    try {
      const response = await apiRequest(`/collections/${selectedCollection.id}/properties/${propertyId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          content: comment
        })
      })

      if (response.status === 200) {
        const newComment = response.data.comment

        const updatedProperties = matchedProperties.map(property =>
          property.id === propertyId 
            ? { ...property, comments: [...(property.comments || []), newComment] }
            : property
        )
        
        setMatchedProperties(updatedProperties)
      }
    } catch (error) {
      console.error('Error adding property comment:', error)
    }
  }

  const handlePropertyClick = async (property: Property) => {
    // Open modal immediately with basic property data
    setSelectedProperty(property)
    setIsModalOpen(true)
    setIsLoadingDetails(true)
    setDetailsError(null)
    
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
        console.log(cacheResponse);
        
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
    setIsModalOpen(false)
    setSelectedProperty(null)
    setIsLoadingDetails(false)
    setDetailsError(null)
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
      console.log(`[SHARE] Generating share link for collection ${collectionId}`)
      
      const response = await apiRequest(`/collections/${collectionId}/share`, {
        method: 'PATCH',
        body: JSON.stringify({ make_public: true })
      })

      if (response.status === 200) {
        const { share_token, is_public, share_url } = response.data
        console.log(`[SHARE] Generated: is_public=${is_public}, share_token=${share_token}`)
        
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
        
        console.log(`[SHARE] Generation complete: token ${share_token}`)
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
      console.log(`[SHARE] Toggling collection ${collectionId} to ${isPublic ? 'public' : 'private'}`)
      
      const response = await apiRequest(`/collections/${collectionId}/share`, {
        method: 'PATCH',
        body: JSON.stringify({ make_public: isPublic })
      })

      if (response.status === 200) {
        const { share_token, is_public } = response.data
        console.log(`[SHARE] API Response: is_public=${is_public}, share_token=${share_token}`)
        
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
        
        console.log(`[SHARE] Frontend state updated: isPublic=${is_public}`)
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
      console.log(`[SHARE] Regenerating share link for collection ${collectionId}`)
      
      const response = await apiRequest(`/collections/${collectionId}/share`, {
        method: 'PATCH',
        body: JSON.stringify({ make_public: true, force_regenerate: true })
      })

      if (response.status === 200) {
        const { share_token, is_public, share_url } = response.data
        console.log(`[SHARE] Regenerated: is_public=${is_public}, share_token=${share_token}`)
        
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
        
        console.log(`[SHARE] Regeneration complete: new token ${share_token}`)
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

  const handleSavePreferences = async (collectionId: string, preferences: any) => {
  console.log(preferences)
    try {
      console.log(`[PREFERENCES] Updating preferences for collection ${collectionId}:`, preferences)
      
      const response = await updateCollectionPreferences(collectionId, preferences)

      if (response.status === 200) {
        console.log('[PREFERENCES] Successfully updated preferences:', response.data)
        
        // Close the modal
        setIsEditPreferencesModalOpen(false)
        setSelectedCollectionForEdit(null)
        
        // Refresh collections to show updated preferences
        const collectionsResponse = await apiRequest('/collections/')
        if (collectionsResponse.status === 200 && collectionsResponse.data) {
          console.log('[PREFERENCES] Refreshing collections data after preference update')
          const transformedCollections: Collection[] = collectionsResponse.data.map((backendCollection: any) => {
            console.log(`[PREFERENCES] Processing updated collection: ${backendCollection.name} - ID: ${backendCollection.id}`)
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
        console.error('[PREFERENCES] Failed to update preferences:', response.status, response.data || response.error)
      }
    } catch (error) {
      console.error('[PREFERENCES] Error updating preferences:', error)
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
    try {
      const response = await apiRequest('/collections/create-from-address', {
        method: 'POST',
        body: JSON.stringify({
          name: collectionData.showcaseName,
          visitor_name: collectionData.fullName,
          visitor_email: collectionData.email,
          visitor_phone: collectionData.phone,
          visiting_reason: collectionData.visitingReason,
          timeframe: collectionData.timeframe,
          has_agent: collectionData.hasAgent,
          additional_comments: collectionData.additionalComments || '',
          
          // Preferences
          min_beds: collectionData.minBeds ? parseInt(collectionData.minBeds) : null,
          max_beds: collectionData.maxBeds ? parseInt(collectionData.maxBeds) : null,
          min_baths: collectionData.minBaths ? parseFloat(collectionData.minBaths) : null,
          max_baths: collectionData.maxBaths ? parseFloat(collectionData.maxBaths) : null,
          min_price: collectionData.minPrice ? parseInt(collectionData.minPrice) : null,
          max_price: collectionData.maxPrice ? parseInt(collectionData.maxPrice) : null,
          address: collectionData.address,
          diameter: parseFloat(collectionData.diameter) || 2.0,
          
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
            onClick={() => setSelectedCollection(null)}
            className="mb-6 flex items-center text-gray-600 hover:text-gray-900 transition-colors duration-200"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            Back to Showcases
          </button>

          {/* Combined Property Recommendations and Status Section */}
          <div className="bg-white/95 rounded-2xl shadow-xl border border-gray-200/60 backdrop-blur-lg p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1 font-light">Property Recommendations</h1>
                <p className="text-gray-600 text-sm font-light">Curated properties based on client preferences</p>
              </div>
              
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm">
                  {filteredProperties.length} of {selectedCollection.stats.totalProperties} properties
                </span>
                <button
                  onClick={() => handleStatusToggle(selectedCollection.id)}
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-200 hover:shadow-sm ${
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
            onLike={undefined}
            onDislike={undefined}
            onFavorite={undefined}
            onPropertyClick={handlePropertyClick}
          />

          {/* Property Details Modal */}
          <PropertyDetailsModal
            property={selectedProperty}
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            onLike={undefined}
            onDislike={undefined}
            onFavorite={undefined}
            onAddComment={handleAddComment}
            isLoadingDetails={isLoadingDetails}
            detailsError={detailsError}
            onRetryDetails={() => handlePropertyClick(selectedProperty!)}
          />

          {/* AI Chat Assistant for Individual Collection */}
          <ChatAssistant 
            collectionData={selectedCollection}
            customerName={selectedCollection.customer.firstName}
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
    <div className="min-h-screen bg-gradient-to-br from-[#faf9f7] via-white to-[#f5f4f2] flex flex-col">
      <Header />
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
        {/* Combined Header and Filters */}
        <div className="bg-white/95 rounded-2xl shadow-xl border border-gray-200/60 backdrop-blur-lg p-6 mb-8">
          {/* Header Section */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6">
            <div className="flex-1 mb-4 lg:mb-0">
              <h1 className="text-3xl font-bold text-gray-900 mb-2 font-light">Showcases</h1>
              <p className="text-gray-600 font-light">Manage customer property showcases and preferences</p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-6">
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-3 py-1.5 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-md text-sm font-medium hover:shadow-md hover:shadow-[#8b7355]/25 transition-all duration-200 flex items-center space-x-1.5"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Create Showcase</span>
              </button>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                <span className="text-sm text-gray-600 font-medium">Active Showcases</span>
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
              <span className="text-sm text-gray-500">{filteredCollections.length} showcases found</span>
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
                onClick={() => setSelectedCollection(collection)}
                onShare={handleShareShowcase}
                onEditPreferences={handleEditPreferences}
                formatTimeframe={formatTimeframe}
                formatPriceRange={formatPriceRange}
              />
            ))}
          </div>
        )}
        </div>
      </div>
      <Footer />
      
      {/* AI Chat Assistant for Showcases Overview */}
      <ChatAssistant 
        collectionData={collections}
        customerName="Agent"
      />
      
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
      
      {/* Create Showcase Modal */}
      <CreateCollectionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateCollection}
      />

    </div>
  )
}

// Create Showcase Modal Component
function CreateCollectionModal({ isOpen, onClose, onSubmit }: { 
  isOpen: boolean, 
  onClose: () => void, 
  onSubmit: (data: any) => void 
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
    timeframe: '3_6_MONTHS',
    hasAgent: 'NO',
    additionalComments: '',
    
    // Search Preferences
    minBeds: '',
    maxBeds: '',
    minBaths: '',
    maxBaths: '',
    minPrice: '',
    maxPrice: '',
    address: '',
    diameter: '2',
    isTownHouse: false,
    isLotLand: false,
    isCondo: false,
    isMultiFamily: false,
    isSingleFamily: false,
    isApartment: false
  })
  
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate that at least one property type is selected
    const propertyTypesSelected = [
      formData.isTownHouse,
      formData.isLotLand,
      formData.isCondo,
      formData.isMultiFamily,
      formData.isSingleFamily,
      formData.isApartment
    ]
    
    if (!propertyTypesSelected.some(type => type)) {
      alert('Please select at least one property type.')
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
        timeframe: '3_6_MONTHS',
        hasAgent: 'NO',
        additionalComments: '',
        minBeds: '',
        maxBeds: '',
        minBaths: '',
        maxBaths: '',
        minPrice: '',
        maxPrice: '',
        address: '',
        diameter: '2',
        isTownHouse: false,
        isLotLand: false,
        isCondo: false,
        isMultiFamily: false,
        isSingleFamily: false,
        isApartment: false
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
                  When to buy? *
                </label>
                <select
                  value={formData.timeframe}
                  onChange={(e) => handleInputChange('timeframe', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                  required
                >
                  <option value="IMMEDIATELY">Immediately</option>
                  <option value="1_3_MONTHS">1-3 months</option>
                  <option value="3_6_MONTHS">3-6 months</option>
                  <option value="6_12_MONTHS">6-12 months</option>
                  <option value="OVER_YEAR">Over a year</option>
                  <option value="NOT_SURE">Not sure</option>
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

              {/* Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                    placeholder="123 Main St, West Chester, PA 19380"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search Radius (miles)
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={formData.diameter}
                    onChange={(e) => handleInputChange('diameter', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                    placeholder="2"
                  />
                </div>
              </div>

              {/* Property Types */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Property Types
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { key: 'isSingleFamily', label: 'Single Family' },
                    { key: 'isTownHouse', label: 'Town House' },
                    { key: 'isCondo', label: 'Condo' },
                    { key: 'isApartment', label: 'Apartment' },
                    { key: 'isMultiFamily', label: 'Multi Family' },
                    { key: 'isLotLand', label: 'Lot/Land' }
                  ].map((type) => (
                    <label key={type.key} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData[type.key as keyof typeof formData] as boolean}
                        onChange={(e) => handleInputChange(type.key, e.target.checked)}
                        className="rounded border-gray-300 text-[#8b7355] focus:ring-[#8b7355]"
                      />
                      <span className="text-sm text-gray-700">
                        {type.label}
                      </span>
                    </label>
                  ))}
                </div>
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
