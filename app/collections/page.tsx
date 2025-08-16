'use client'

import { useState, useEffect } from 'react'
import { Collection, Property, Comment } from '@/types'
import PropertyGrid from '@/components/PropertyGrid'
import CollectionCard from '@/components/CollectionCard'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import PropertyDetailsModal from '@/components/PropertyDetailsModal'
import ShareCollectionModal from '@/components/ShareCollectionModal'
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

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED' | 'COMPLETED'>('ALL')
  
  // Property filtering states
  const [activeTab, setActiveTab] = useState<'all' | 'liked' | 'disliked' | 'favorited'>('all')
  const [sortBy, setSortBy] = useState<'price' | 'beds' | 'squareFeet'>('price')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Modal states
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  // Share modal states
  const [selectedCollectionForShare, setSelectedCollectionForShare] = useState<Collection | null>(null)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)

  useEffect(() => {
    // Simulate API call
    const fetchCollections = async () => {
      setIsLoading(true)
      await new Promise(resolve => setTimeout(resolve, 1000))
      setCollections(mockCollections)
      setIsLoading(false)
    }

    fetchCollections()
  }, [])

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
    
    let filtered = selectedCollection.matchedProperties

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
    if (!selectedCollection) return { all: 0, liked: 0, disliked: 0, favorited: 0 }
    
    const properties = selectedCollection.matchedProperties
    return {
      all: properties.length,
      liked: properties.filter(p => p.liked).length,
      disliked: properties.filter(p => p.disliked).length,
      favorited: properties.filter(p => p.favorited).length
    }
  }

  const tabCounts = getTabCounts()

  // Handle property interactions
  const handlePropertyLike = (propertyId: number, liked: boolean) => {
    if (!selectedCollection) return
    
    const updatedProperties = selectedCollection.matchedProperties.map(property =>
      property.id === propertyId ? { ...property, liked, disliked: liked ? false : property.disliked } : property
    )
    
    setSelectedCollection({
      ...selectedCollection,
      matchedProperties: updatedProperties
    })

    // Also update the main collections array
    setCollections(prevCollections =>
      prevCollections.map(collection =>
        collection.id === selectedCollection.id
          ? { ...collection, matchedProperties: updatedProperties }
          : collection
      )
    )

    // Update selected property if it's the one being modified
    if (selectedProperty && selectedProperty.id === propertyId) {
      setSelectedProperty(prevProperty => ({
        ...prevProperty!,
        liked,
        disliked: liked ? false : prevProperty!.disliked
      }))
    }
  }

  const handlePropertyDislike = (propertyId: number, disliked: boolean) => {
    if (!selectedCollection) return
    
    const updatedProperties = selectedCollection.matchedProperties.map(property =>
      property.id === propertyId ? { ...property, disliked, liked: disliked ? false : property.liked } : property
    )
    
    setSelectedCollection({
      ...selectedCollection,
      matchedProperties: updatedProperties
    })

    // Also update the main collections array
    setCollections(prevCollections =>
      prevCollections.map(collection =>
        collection.id === selectedCollection.id
          ? { ...collection, matchedProperties: updatedProperties }
          : collection
      )
    )

    // Update selected property if it's the one being modified
    if (selectedProperty && selectedProperty.id === propertyId) {
      setSelectedProperty(prevProperty => ({
        ...prevProperty!,
        disliked,
        liked: disliked ? false : prevProperty!.liked
      }))
    }
  }

  const handlePropertyFavorite = (propertyId: number, favorited: boolean) => {
    if (!selectedCollection) return
    
    const updatedProperties = selectedCollection.matchedProperties.map(property =>
      property.id === propertyId ? { ...property, favorited } : property
    )
    
    setSelectedCollection({
      ...selectedCollection,
      matchedProperties: updatedProperties
    })

    // Also update the main collections array
    setCollections(prevCollections =>
      prevCollections.map(collection =>
        collection.id === selectedCollection.id
          ? { ...collection, matchedProperties: updatedProperties }
          : collection
      )
    )

    // Update selected property if it's the one being modified
    if (selectedProperty && selectedProperty.id === propertyId) {
      setSelectedProperty(prevProperty => ({
        ...prevProperty!,
        favorited
      }))
    }
  }

  const handleAddComment = (propertyId: number, comment: string) => {
    if (!selectedCollection) return

    const newComment: Comment = {
      id: Date.now(), // Simple ID generation for demo
      author: 'Current User', // In real app, this would be the logged-in user
      content: comment,
      createdAt: new Date().toISOString()
    }

    const updatedProperties = selectedCollection.matchedProperties.map(property =>
      property.id === propertyId 
        ? { ...property, comments: [...(property.comments || []), newComment] }
        : property
    )
    
    setSelectedCollection({
      ...selectedCollection,
      matchedProperties: updatedProperties
    })

    // Also update the main collections array
    setCollections(prevCollections =>
      prevCollections.map(collection =>
        collection.id === selectedCollection.id
          ? { ...collection, matchedProperties: updatedProperties }
          : collection
      )
    )

    // Update the selected property in modal if it's the same property
    if (selectedProperty && selectedProperty.id === propertyId) {
      setSelectedProperty({
        ...selectedProperty,
        comments: [...(selectedProperty.comments || []), newComment]
      })
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

  // Share functionality handlers
  const handleShareCollection = (collection: Collection) => {
    setSelectedCollectionForShare(collection)
    setIsShareModalOpen(true)
  }

  const handleCloseShareModal = () => {
    setIsShareModalOpen(false)
    setSelectedCollectionForShare(null)
  }

  const handleGenerateShareLink = (collectionId: number) => {
    // Generate a unique share token (in a real app, this would be a UUID from the server)
    const shareToken = `coll-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`
    
    setCollections(prevCollections =>
      prevCollections.map(collection =>
        collection.id === collectionId
          ? { 
              ...collection, 
              shareToken,
              sharedAt: new Date().toISOString(),
              isPublic: true
            }
          : collection
      )
    )

    // Update the selected collection for share modal if it's the same one
    if (selectedCollectionForShare && selectedCollectionForShare.id === collectionId) {
      setSelectedCollectionForShare(prev => prev ? {
        ...prev,
        shareToken,
        sharedAt: new Date().toISOString(),
        isPublic: true
      } : null)
    }
  }

  const handleUpdateShareSettings = (collectionId: number, isPublic: boolean) => {
    setCollections(prevCollections =>
      prevCollections.map(collection =>
        collection.id === collectionId
          ? { 
              ...collection, 
              isPublic,
              sharedAt: isPublic ? (collection.sharedAt || new Date().toISOString()) : collection.sharedAt
            }
          : collection
      )
    )

    // Update the selected collection for share modal if it's the same one
    if (selectedCollectionForShare && selectedCollectionForShare.id === collectionId) {
      setSelectedCollectionForShare(prev => prev ? {
        ...prev,
        isPublic,
        sharedAt: isPublic ? (prev.sharedAt || new Date().toISOString()) : prev.sharedAt
      } : null)
    }
  }

  if (selectedCollection) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-zinc-900 flex flex-col">
        <Header />
        <div className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => setSelectedCollection(null)}
            className="mb-6 flex items-center text-zinc-400 hover:text-white transition-colors duration-200"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            Back to Collections
          </button>

          {/* Combined Property Recommendations and Status Section */}
          <div className="bg-zinc-900/20 rounded-2xl shadow-xl border border-zinc-800/30 backdrop-blur-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2 font-light">Property Recommendations</h1>
                <p className="text-zinc-400 text-lg font-light">Curated properties based on client preferences</p>
              </div>
              
              <div className="flex items-center space-x-4">
                <span className="text-sm text-zinc-400 bg-zinc-900/60 px-3 py-1 rounded-full border border-zinc-700/40">
                  {filteredProperties.length} of {selectedCollection.stats.totalProperties} properties
                </span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                  selectedCollection.status === 'ACTIVE' 
                    ? 'bg-green-900/50 text-green-300 border-green-700/40'
                    : selectedCollection.status === 'PAUSED'
                    ? 'bg-yellow-900/50 text-yellow-300 border-yellow-700/40'
                    : 'bg-gray-900/50 text-gray-300 border-gray-700/40'
                }`}>
                  {selectedCollection.status}
                </span>
              </div>
            </div>
            
            {/* Property Status Tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
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
                      ? 'bg-white text-black border border-zinc-200'
                      : 'bg-zinc-800/40 text-zinc-300 hover:bg-zinc-700/60 border border-zinc-700/40 hover:border-zinc-600/60'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    activeTab === tab.key
                      ? 'bg-zinc-200 text-zinc-800'
                      : 'bg-zinc-700/60 text-zinc-400'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Sorting Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Sort by</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'price' | 'beds' | 'squareFeet')}
                  className="w-full px-3 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500/60 focus:border-zinc-400/60 transition-all duration-300"
                >
                  <option value="price">Price</option>
                  <option value="beds">Bedrooms</option>
                  <option value="squareFeet">Square Feet</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Sort Order</label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                  className="w-full px-3 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500/60 focus:border-zinc-400/60 transition-all duration-300"
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
                  className="w-full px-3 py-2 bg-zinc-700/40 text-zinc-300 hover:bg-zinc-600/60 border border-zinc-600/40 hover:border-zinc-500/60 rounded-lg text-sm transition-all duration-300"
                >
                  Reset Filters
                </button>
              </div>
            </div>
          </div>

          {/* Professional Separator */}
          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800/40"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-gradient-to-br from-black via-zinc-950 to-zinc-900 px-4 text-zinc-500 font-light">
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
            collectionData={selectedCollection}
            customerName={selectedCollection.customer.firstName}
          />
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-zinc-900 flex flex-col">
      <Header />
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Collections</h1>
          <p className="text-zinc-400">Manage customer property collections and preferences</p>
        </div>

        {/* Filters */}
        <div className="bg-zinc-900/40 rounded-xl border border-zinc-800/60 backdrop-blur-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400/60 transition-all duration-300 text-sm"
              />
            </div>
            <div className="sm:w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-3 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400/60 transition-all duration-300 text-sm"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
          </div>
        </div>


        {/* Collections Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-400 mx-auto mb-4"></div>
              <p className="text-zinc-400">Loading collections...</p>
            </div>
          </div>
        ) : filteredCollections.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-zinc-800/60 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2 font-light">No collections found</h3>
            <p className="text-zinc-400 font-light">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCollections.map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                onClick={() => setSelectedCollection(collection)}
                onShare={handleShareCollection}
                formatTimeframe={formatTimeframe}
                formatPriceRange={formatPriceRange}
              />
            ))}
          </div>
        )}
        </div>
      </div>
      <Footer />
      
      {/* AI Chat Assistant for Collections Overview */}
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
        onUpdateShareSettings={handleUpdateShareSettings}
      />

    </div>
  )
}
