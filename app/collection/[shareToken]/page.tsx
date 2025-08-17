export const runtime = 'edge';

'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Collection, Property, Comment } from '@/types'
import CustomerCollectionView from '@/components/CustomerCollectionView'
import Footer from '@/components/Footer'

// Mock data - in a real app, this would come from an API
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

  const shareToken = params.shareToken as string

  useEffect(() => {
    const fetchCollection = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Find collection by share token
        const foundCollection = mockCollections.find(
          c => c.shareToken === shareToken && c.isPublic
        )
        
        if (!foundCollection) {
          setError('Collection not found or not available for sharing')
          return
        }
        
        setCollection(foundCollection)
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

  // Handle property interactions (these would sync back to the agent's view in a real app)
  const handlePropertyLike = (propertyId: number, liked: boolean) => {
    if (!collection) return
    
    const updatedProperties = collection.matchedProperties.map(property =>
      property.id === propertyId ? { ...property, liked, disliked: liked ? false : property.disliked } : property
    )
    
    setCollection({
      ...collection,
      matchedProperties: updatedProperties
    })
  }

  const handlePropertyDislike = (propertyId: number, disliked: boolean) => {
    if (!collection) return
    
    const updatedProperties = collection.matchedProperties.map(property =>
      property.id === propertyId ? { ...property, disliked, liked: disliked ? false : property.liked } : property
    )
    
    setCollection({
      ...collection,
      matchedProperties: updatedProperties
    })
  }

  const handlePropertyFavorite = (propertyId: number, favorited: boolean) => {
    if (!collection) return
    
    const updatedProperties = collection.matchedProperties.map(property =>
      property.id === propertyId ? { ...property, favorited } : property
    )
    
    setCollection({
      ...collection,
      matchedProperties: updatedProperties
    })
  }

  const handleAddComment = (propertyId: number, comment: string) => {
    if (!collection) return

    const newComment: Comment = {
      id: Date.now(),
      author: `${collection.customer.firstName} ${collection.customer.lastName}`,
      content: comment,
      createdAt: new Date().toISOString()
    }

    const updatedProperties = collection.matchedProperties.map(property =>
      property.id === propertyId 
        ? { ...property, comments: [...(property.comments || []), newComment] }
        : property
    )
    
    setCollection({
      ...collection,
      matchedProperties: updatedProperties
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-zinc-300">Loading your property collection...</p>
        </div>
      </div>
    )
  }

  if (error || !collection) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-zinc-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-zinc-900/60 rounded-2xl shadow-2xl p-8 text-center border border-zinc-800/40">
          <div className="w-16 h-16 bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Collection Not Available</h2>
          <p className="text-zinc-300 mb-6">{error || 'This collection is no longer available or the link has expired.'}</p>
          <p className="text-zinc-400 text-sm">
            Please contact your real estate agent for a new link or more information.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-zinc-900 flex flex-col">
      {/* Simple Customer Header */}
      <header className="bg-black/80 backdrop-blur-lg border-b border-zinc-800/60">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-center">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gradient-to-r from-zinc-700 via-zinc-800 to-black rounded-lg flex items-center justify-center mr-3 border border-zinc-600/40">
                <svg className="w-4 h-4 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1"></path>
                </svg>
              </div>
              <h1 className="text-xl font-bold text-white font-light">EntryPoint™</h1>
            </div>
          </div>
        </div>
      </header>
      
      <div className="flex-1">
        <CustomerCollectionView
          collection={collection}
          onLike={handlePropertyLike}
          onDislike={handlePropertyDislike}
          onFavorite={handlePropertyFavorite}
          onAddComment={handleAddComment}
        />
      </div>
      <Footer />
    </div>
  )
}