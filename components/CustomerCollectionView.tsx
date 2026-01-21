'use client'

import { useState } from 'react'
import { Collection, Property } from '@/types'
import PropertyCard from './PropertyCard'
import PropertyDetailsModal from './PropertyDetailsModal'
import ChatAssistant from './ChatAssistant'
import { Phone, Mail, MessageSquare } from 'lucide-react'

interface CustomerCollectionViewProps {
  collection: Collection
  onLike?: (propertyId: string | number, liked: boolean) => void
  onDislike?: (propertyId: string | number, disliked: boolean) => void
  onAddComment?: (propertyId: string | number, comment: string) => void
}

export default function CustomerCollectionView({
  collection,
  onLike,
  onDislike,
  onAddComment
}: CustomerCollectionViewProps) {
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [isLoadingComments, setIsLoadingComments] = useState(false)
  const [commentsError, setCommentsError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'liked' | 'disliked'>('all')

  const fetchPropertyComments = async (propertyId: string) => {
    setIsLoadingComments(true)
    setCommentsError(null)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/collections/${collection.id}/properties/${propertyId}/comments`)

      if (response.ok) {
        const data = await response.json()
        
        // Transform backend comments to frontend format
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
    setIsLoadingDetails(true)
    setDetailsError(null)

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
    setIsModalOpen(false)
    setSelectedProperty(null)
    setIsLoadingDetails(false)
    setDetailsError(null)
  }

  // Filter properties based on active tab
  const getFilteredProperties = () => {
    let filtered: any[] = []

    switch (activeTab) {
      case 'liked':
        filtered = filtered.filter(property => property.liked)
        break
      case 'disliked':
        filtered = filtered.filter(property => property.disliked)
        break
      case 'all':
      default:
        break
    }

    return filtered
  }

  const filteredProperties = getFilteredProperties()

  const getTabCounts = () => {
    const properties: any[] = []
    return {
      all: properties.length,
      liked: properties.filter(p => p.liked).length,
      disliked: properties.filter(p => p.disliked).length
    }
  }

  const tabCounts = getTabCounts()

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

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Welcome Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-white">
          Welcome, {collection.customer.firstName}!
        </h1>
        <p className="text-xl text-zinc-300">
          Here are your personalized property recommendations
        </p>
        <div className="bg-zinc-900/40 rounded-xl p-4 border border-zinc-800/60 backdrop-blur-sm inline-block">
          <p className="text-zinc-400 text-sm">
            <span className="text-white font-medium">Budget:</span> {formatPriceRange((collection.preferences as any).priceRange)}
          </p>
        </div>
      </div>

      {/* Agent Contact Info */}
      <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-2xl p-6 border border-blue-800/30 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">Your Real Estate Agent</h3>
            <p className="text-blue-200 mb-1">Agent Smith</p>
            <p className="text-blue-300 text-sm">Licensed Real Estate Professional</p>
          </div>
          <div className="flex items-center space-x-4">
            <a
              href="tel:+15551234567"
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Phone size={16} />
              <span>Call</span>
            </a>
            <a
              href="mailto:agent@example.com"
              className="flex items-center space-x-2 bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Mail size={16} />
              <span>Email</span>
            </a>
            <a
              href="sms:+15551234567"
              className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <MessageSquare size={16} />
              <span>Text</span>
            </a>
          </div>
        </div>
      </div>


      {/* Property Tabs */}
      <div className="bg-white/95 rounded-2xl shadow-xl border border-gray-200/60 backdrop-blur-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-semibold text-white">Your Collection</h3>
          <div className="text-zinc-400 text-sm">
            {filteredProperties.length} of {[].length} properties
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { key: 'all', label: 'All Properties', count: tabCounts.all },
            { key: 'liked', label: 'Liked', count: tabCounts.liked },
            { key: 'disliked', label: 'Not Interested', count: tabCounts.disliked }
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

        {/* Properties Grid */}
        {filteredProperties.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-zinc-800/60 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1"></path>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No properties found</h3>
            <p className="text-zinc-400">
              {activeTab === 'all' 
                ? 'No properties available in this collection'
                : `You haven't ${activeTab === 'liked' ? 'liked' : 'marked as not interested in'} any properties yet`
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProperties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                onLike={onLike}
                onDislike={onDislike}
                onPropertyClick={handlePropertyClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Call to Action */}
      <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 rounded-2xl p-6 border border-green-800/30 backdrop-blur-sm text-center">
        <h3 className="text-xl font-semibold text-white mb-3">Ready to Schedule a Viewing?</h3>
        <p className="text-zinc-300 mb-4">
          Contact your agent to schedule tours for the properties you're interested in, or to discuss other options.
        </p>
        <div className="flex items-center justify-center space-x-4">
          <a
            href="tel:+15551234567"
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center space-x-2"
          >
            <Phone size={16} />
            <span>Call Your Agent</span>
          </a>
          <a
            href="mailto:agent@example.com?subject=Property Collection Inquiry"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center space-x-2"
          >
            <Mail size={16} />
            <span>Send Email</span>
          </a>
        </div>
      </div>

      {/* Property Details Modal */}
      <PropertyDetailsModal
        property={selectedProperty}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onLike={onLike}
        onDislike={onDislike}
        onAddComment={onAddComment}
        isLoadingDetails={isLoadingDetails}
        detailsError={detailsError}
        onRetryDetails={() => handlePropertyClick(selectedProperty!)}
        isLoadingComments={isLoadingComments}
        commentsError={commentsError}
      />

      {/* AI Chat Assistant */}
      <ChatAssistant 
        collectionData={collection}
        customerName={collection.customer.firstName}
      />
    </div>
  )
}