'use client'

export const runtime = 'edge';

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Collection, Property, Comment } from '@/types'
import { getToken } from '@/lib/auth'
import PropertyGrid from '@/components/PropertyGrid'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import PropertyDetailsModal from '@/components/PropertyDetailsModal'
import ChatAssistant from '@/components/ChatAssistant'

// Mock data for development
const mockCollections: Collection[] = [
  {
    id: 1,
    customer: {
      id: 1,
      firstName: 'Sarah',
      lastName: 'Johnson',
      email: 'sarah.johnson@email.com',
      phone: '(555) 123-4567',
      preferredContact: 'EMAIL',
    },
    propertyId: 1,
    originalProperty: {
      id: 1,
      address: '123 Main Street, West Chester, PA 19380',
      city: 'West Chester',
      state: 'PA',
      zipCode: '19380',
      price: 1200000,
      beds: 5,
      baths: 3.5,
      squareFeet: 5000,
      propertyType: 'Single Family',
      imageUrl: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400'
    },
    matchedProperties: [
      {
        id: 2,
        address: '456 Oak Avenue, West Chester, PA 19380',
        city: 'West Chester',
        state: 'PA',
        price: 1150000,
        beds: 4,
        baths: 3,
        squareFeet: 4200,
        propertyType: 'Single Family',
        imageUrl: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=400',
        images: [
          'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=600',
          'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600',
          'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600',
          'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600',
          'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=600'
        ],
        liked: true,
        favorited: true,
        viewed: true,
        description: 'Beautiful colonial home featuring a recently renovated kitchen with granite countertops and stainless steel appliances. The spacious backyard is perfect for entertaining, and the mature trees provide excellent privacy. Located in a highly sought-after neighborhood with excellent schools.',
        listingUpdated: '2025-08-15T12:37:00Z',
        status: 'Active',
        mlsNumber: 'PADE2094478',
        daysOnMarket: 16,
        taxes: 8648,
        hoaFees: null,
        condoCoopFees: null,
        compassType: 'Single Family',
        mlsType: 'Residential / Fee Simple',
        yearBuilt: 1950,
        lotSizeAcres: 0.29,
        lotSizeSquareFeet: 12632,
        county: 'Delaware County',
        comments: [
          {
            id: 1,
            author: 'Agent Smith',
            content: 'Beautiful property with great potential. The kitchen has been recently renovated.',
            createdAt: '2024-01-20T10:30:00Z'
          },
          {
            id: 2,
            author: 'Sarah Johnson',
            content: 'Love the location and the spacious backyard. Perfect for families.',
            createdAt: '2024-01-20T14:15:00Z'
          }
        ]
      },
      {
        id: 3,
        address: '789 Pine Lane, West Chester, PA 19380',
        city: 'West Chester',
        state: 'PA',
        price: 1350000,
        beds: 5,
        baths: 4,
        squareFeet: 5500,
        propertyType: 'Single Family',
        imageUrl: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400',
        disliked: true,
        viewed: true,
        comments: [
          {
            id: 3,
            author: 'Michael Chen',
            content: 'Price seems a bit high for the area. Would like to see more photos of the interior.',
            createdAt: '2024-01-19T16:45:00Z'
          }
        ]
      },
      {
        id: 4,
        address: '321 Elm Street, West Chester, PA 19380',
        city: 'West Chester',
        state: 'PA',
        price: 1050000,
        beds: 4,
        baths: 2.5,
        squareFeet: 3800,
        propertyType: 'Single Family',
        imageUrl: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=400',
        images: [
          'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=600',
          'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600',
          'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=600',
          'https://images.unsplash.com/photo-1600607687644-c7171b42498b?w=600'
        ],
        liked: true,
        viewed: true,
        description: 'Charming traditional home with hardwood floors throughout and a cozy fireplace in the living room. The master suite features a walk-in closet and ensuite bathroom. Beautifully landscaped front and back yards with mature plantings.',
        listingUpdated: '2025-08-10T09:15:00Z',
        status: 'Active',
        mlsNumber: 'PADE2094512',
        daysOnMarket: 21,
        taxes: 7250,
        hoaFees: null,
        condoCoopFees: null,
        compassType: 'Single Family',
        mlsType: 'Residential / Fee Simple',
        yearBuilt: 1975,
        lotSizeAcres: 0.22,
        lotSizeSquareFeet: 9583,
        county: 'Delaware County',
        comments: [
          {
            id: 4,
            author: 'Agent Smith',
            content: 'Great value for money. Well-maintained property with excellent curb appeal.',
            createdAt: '2024-01-21T09:20:00Z'
          },
          {
            id: 5,
            author: 'Sarah Johnson',
            content: 'This one is definitely worth a visit. The neighborhood is very quiet.',
            createdAt: '2024-01-21T11:30:00Z'
          },
          {
            id: 6,
            author: 'John Davis',
            content: 'Interested in scheduling a showing. The layout looks perfect for our needs.',
            createdAt: '2024-01-21T15:45:00Z'
          }
        ]
      }
    ],
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-20T14:22:00Z',
    status: 'ACTIVE',
    preferences: {
      priceRange: '1M_1_5M',
      timeframe: '3_6_MONTHS',
      visitingReason: 'BUYING_SOON',
      additionalComments: 'Looking for modern kitchen and large backyard'
    },
    stats: {
      totalProperties: 12,
      viewedProperties: 8,
      likedProperties: 3,
      lastActivity: '2024-01-20T14:22:00Z'
    },
    shareToken: 'coll-sarah-johnson-xyz789',
    sharedAt: '2024-01-20T15:30:00Z',
    isPublic: true
  },
  {
    id: 2,
    customer: {
      id: 2,
      firstName: 'Michael',
      lastName: 'Chen',
      email: 'michael.chen@email.com',
      phone: '(555) 987-6543',
      preferredContact: 'PHONE',
    },
    propertyId: 5,
    originalProperty: {
      id: 5,
      address: '567 Maple Drive, Exton, PA 19341',
      city: 'Exton',
      state: 'PA',
      price: 850000,
      beds: 3,
      baths: 2.5,
      squareFeet: 2800,
      propertyType: 'Townhouse',
      imageUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400'
    },
    matchedProperties: [
      {
        id: 6,
        address: '890 Cedar Court, Exton, PA 19341',
        city: 'Exton',
        state: 'PA',
        price: 780000,
        beds: 3,
        baths: 2,
        squareFeet: 2600,
        propertyType: 'Townhouse',
        imageUrl: 'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=400',
        favorited: true,
        viewed: true,
        comments: [
          {
            id: 7,
            author: 'Michael Chen',
            content: 'Modern townhouse with excellent amenities. Close to shopping centers.',
            createdAt: '2024-01-18T12:00:00Z'
          }
        ]
      },
      {
        id: 7,
        address: '234 Birch Way, Exton, PA 19341',
        city: 'Exton',
        state: 'PA',
        price: 920000,
        beds: 4,
        baths: 3,
        squareFeet: 3200,
        propertyType: 'Townhouse',
        imageUrl: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400',
        viewed: true,
        comments: []
      }
    ],
    createdAt: '2024-01-18T09:15:00Z',
    updatedAt: '2024-01-19T16:45:00Z',
    status: 'ACTIVE',
    preferences: {
      priceRange: '750K_1M',
      timeframe: '1_3_MONTHS',
      visitingReason: 'INVESTMENT',
      additionalComments: 'Prefer newer construction'
    },
    stats: {
      totalProperties: 8,
      viewedProperties: 5,
      likedProperties: 1,
      lastActivity: '2024-01-19T16:45:00Z'
    },
    shareToken: 'coll-michael-chen-abc123',
    isPublic: false
  }
]

export default function CustomerCollectionPage() {
  const params = useParams()
  const [collection, setCollection] = useState<Collection | null>(null)
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
        
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/collections/shared/${shareToken}`)
        
        if (response.status === 404) {
          setError('Collection not found or not available for sharing')
          return
        }
        
        if (!response.ok) {
          throw new Error('Failed to fetch collection')
        }
        
        const collectionData = await response.json()
        setCollection(collectionData)
        
      } catch (err) {
        setError('Failed to load collection. Please try again.')
        console.error('Error fetching collection:', err)
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
    if (!collection) return []
    
    let filtered = collection.matchedProperties

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
    if (!collection) return { all: 0, liked: 0, disliked: 0, favorited: 0 }
    
    const properties = collection.matchedProperties
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
    if (!collection) return
    
    // Update local state immediately for better UX
    const updatedProperties = collection.matchedProperties.map(property =>
      property.id === propertyId ? { ...property, liked, disliked: liked ? false : property.disliked } : property
    )
    
    setCollection({
      ...collection,
      matchedProperties: updatedProperties
    })

    // Update selected property if it's the one being modified
    if (selectedProperty && selectedProperty.id === propertyId) {
      setSelectedProperty(prevProperty => ({
        ...prevProperty!,
        liked,
        disliked: liked ? false : prevProperty!.disliked
      }))
    }
    
    // Make API call to persist the interaction
    try {
      await apiRequest(`/collections/${collection.id}/properties/${propertyId}/interact`, {
        method: 'POST',
        body: JSON.stringify({
          interaction_type: 'like',
          value: liked,
          visitor_email: collection.customer.email
        })
      })
    } catch (error) {
      console.error('Error updating property like status:', error)
      // Could implement rollback logic here if needed
    }
  }

  const handlePropertyDislike = async (propertyId: number, disliked: boolean) => {
    if (!collection) return
    
    // Update local state immediately for better UX
    const updatedProperties = collection.matchedProperties.map(property =>
      property.id === propertyId ? { ...property, disliked, liked: disliked ? false : property.liked } : property
    )
    
    setCollection({
      ...collection,
      matchedProperties: updatedProperties
    })

    // Update selected property if it's the one being modified
    if (selectedProperty && selectedProperty.id === propertyId) {
      setSelectedProperty(prevProperty => ({
        ...prevProperty!,
        disliked,
        liked: disliked ? false : prevProperty!.liked
      }))
    }
    
    // Make API call to persist the interaction
    try {
      await apiRequest(`/collections/${collection.id}/properties/${propertyId}/interact`, {
        method: 'POST',
        body: JSON.stringify({
          interaction_type: 'dislike',
          value: disliked,
          visitor_email: collection.customer.email
        })
      })
    } catch (error) {
      console.error('Error updating property dislike status:', error)
      // Could implement rollback logic here if needed
    }
  }

  const handlePropertyFavorite = async (propertyId: number, favorited: boolean) => {
    if (!collection) return
    
    // Update local state immediately for better UX
    const updatedProperties = collection.matchedProperties.map(property =>
      property.id === propertyId ? { ...property, favorited } : property
    )
    
    setCollection({
      ...collection,
      matchedProperties: updatedProperties
    })

    // Update selected property if it's the one being modified
    if (selectedProperty && selectedProperty.id === propertyId) {
      setSelectedProperty(prevProperty => ({
        ...prevProperty!,
        favorited
      }))
    }
    
    // Make API call to persist the interaction
    try {
      await apiRequest(`/collections/${collection.id}/properties/${propertyId}/interact`, {
        method: 'POST',
        body: JSON.stringify({
          interaction_type: 'favorite',
          value: favorited,
          visitor_email: collection.customer.email
        })
      })
    } catch (error) {
      console.error('Error updating property favorite status:', error)
      // Could implement rollback logic here if needed
    }
  }

  const handleAddComment = async (propertyId: number, comment: string) => {
    if (!collection) return

    const newComment: Comment = {
      id: Date.now(), // Simple ID generation for demo
      author: `${collection.customer.firstName} ${collection.customer.lastName}`, // Customer name for shared view
      content: comment,
      createdAt: new Date().toISOString()
    }

    // Update local state immediately for better UX
    const updatedProperties = collection.matchedProperties.map(property =>
      property.id === propertyId 
        ? { ...property, comments: [...(property.comments || []), newComment] }
        : property
    )
    
    setCollection({
      ...collection,
      matchedProperties: updatedProperties
    })

    // Update the selected property in modal if it's the same property
    if (selectedProperty && selectedProperty.id === propertyId) {
      setSelectedProperty({
        ...selectedProperty,
        comments: [...(selectedProperty.comments || []), newComment]
      })
    }
    
    // Make API call to persist the comment
    try {
      await apiRequest(`/collections/${collection.id}/properties/${propertyId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          comment: comment,
          visitor_email: collection.customer.email,
          visitor_name: `${collection.customer.firstName} ${collection.customer.lastName}`
        })
      })
    } catch (error) {
      console.error('Error adding property comment:', error)
      // Could implement rollback logic here if needed
    }
  }

  const handlePropertyClick = (property: Property) => {
    setSelectedProperty(property)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedProperty(null)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#faf9f7] via-white to-[#f5f4f2] flex flex-col">
        <Header mode={isAuthenticated ? 'app' : 'shared'} />
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8b7355] mx-auto mb-4"></div>
            <p className="text-gray-600">Loading collection...</p>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  if (error || !collection) {
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
                <p className="text-gray-600 text-sm font-light">Curated properties for {collection.customer.firstName} {collection.customer.lastName}</p>
              </div>
              
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm">
                  {filteredProperties.length} of {collection.stats.totalProperties} properties
                </span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                  collection.status === 'ACTIVE' 
                    ? 'bg-green-100 text-green-800 border-green-200'
                    : collection.status === 'PAUSED'
                    ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                    : 'bg-gray-100 text-gray-700 border-gray-200'
                }`}>
                  {collection.status}
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
          />

          {/* AI Chat Assistant for Individual Collection */}
          <ChatAssistant 
            collectionData={collection}
            customerName={collection.customer.firstName}
          />
        </div>
      </div>
      <Footer />
    </div>
  )
}
