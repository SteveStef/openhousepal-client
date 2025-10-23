'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import GooglePlacesAutocomplete from '@/components/GooglePlacesAutocomplete'
import { apiRequest, getCurrentUser, checkAuth, hasValidSubscription } from '@/lib/auth'

interface PropertyImage {
  url: string;
  width: number;
  height: number;
  caption?: string;
}

interface OpenHouse {
  id: string;
  property_id: string;
  address: string;
  created_at: string;
  qr_code_url: string;
  cover_image_url: string;
  form_url: string;
  bedrooms?: number;
  bathrooms?: number;
  living_area?: number;
  price?: number;
}

export default function OpenHousesPage() {
  const router = useRouter()
  const [address, setAddress] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false)
  const [pdfPreview, setPdfPreview] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [error, setError] = useState('')
  const [propertyData, setPropertyData] = useState<any>(null)
  const [isLoadingProperty, setIsLoadingProperty] = useState(false)
  const [showImageSelection, setShowImageSelection] = useState(false)
  const [selectedImage, setSelectedImage] = useState<PropertyImage | null>(null)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [openHouses, setOpenHouses] = useState<OpenHouse[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isAuthenticating, setIsAuthenticating] = useState(true)
  const [notification, setNotification] = useState<{
    show: boolean
    type: 'success' | 'error'
    message: string
  }>({ show: false, type: 'success', message: '' })
  const [selectedOpenHouseForPDF, setSelectedOpenHouseForPDF] = useState<OpenHouse | null>(null)
  const [showPDFViewer, setShowPDFViewer] = useState(false)
  const [generatedOpenHouseId, setGeneratedOpenHouseId] = useState<string>('')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [openHouseToDelete, setOpenHouseToDelete] = useState<OpenHouse | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Notification helper function
  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ show: true, type, message })
    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }))
    }, 5000) // Hide after 5 seconds
  }

  const handleViewVisitors = (openHouse: any) => {
    console.log(openHouse);
    const url = `/open-houses/visitors/${openHouse.id}`;
    router.push(url);
  }

  // PDF viewing handler
  const handleViewPDF = async (openHouse: OpenHouse) => {
    try {
      console.log('Opening PDF viewer for:', openHouse)
      console.log('Setting selected open house:', openHouse)
      setSelectedOpenHouseForPDF(openHouse)
      console.log('Setting showPDFViewer to true')
      setShowPDFViewer(true)
      console.log('State should be updated now')
    } catch (error) {
      console.error('Error opening PDF viewer:', error)
      showNotification('error', 'Failed to load PDF')
    }
  }

  // Delete handlers
  const handleDeleteClick = (openHouse: OpenHouse) => {
    setOpenHouseToDelete(openHouse)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = async () => {
    if (!openHouseToDelete) return

    setIsDeleting(true)
    try {
      const response = await apiRequest(`/api/open-houses/${openHouseToDelete.id}`, {
        method: 'DELETE'
      })

      if (response.status === 200) {
        showNotification('success', '🗑️ Listing removed successfully. All related data is preserved.')
        await loadOpenHouseHistory() // Refresh the list
        setShowDeleteDialog(false)
        setOpenHouseToDelete(null)
      } else {
        throw new Error(response.error || 'Failed to delete open house')
      }
    } catch (error) {
      console.error('Error deleting open house:', error)
      showNotification('error', 'Failed to remove listing. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteCancel = () => {
    setShowDeleteDialog(false)
    setOpenHouseToDelete(null)
  }

  // Check authentication and load data
  useEffect(() => {
    checkAuthAndLoadData()
  }, [])

  const checkAuthAndLoadData = async () => {
    try {
      setIsAuthenticating(true)
      // Check if user is authenticated
      const isAuthenticated = await checkAuth()

      if (!isAuthenticated) {
        console.log('❌ Authentication failed')
        // Try to get user data anyway - maybe the token is valid but /auth/me endpoint has issues
        const userData = await getCurrentUser()
        if (userData) {
          console.log('✅ Got user data despite auth check failure - checking subscription')
          // Check subscription status
          if (!hasValidSubscription(userData)) {
            console.log('❌ Subscription invalid - redirecting to upgrade')
            router.push('/upgrade-required')
            return
          }
          setCurrentUser(userData)
          await loadOpenHouseHistory()
        } else {
          console.log('❌ No user data available - redirecting to login')
          // Redirect to login page with current path as redirect parameter
          router.push(`/login?redirect=${encodeURIComponent('/open-houses')}`)
          return
        }
      } else {
        console.log('✅ Authentication successful - loading user data')
        // Load user data and open house history
        await loadUserAndHistory()
      }
    } catch (error) {
      console.error('Authentication check failed:', error)
      router.push('/login')
    } finally {
      setIsAuthenticating(false)
    }
  }

  // Load current user and open house history
  const loadUserAndHistory = async () => {
    try {
      const user = await getCurrentUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Check subscription status
      if (!hasValidSubscription(user)) {
        console.log('❌ Subscription invalid - redirecting to upgrade')
        router.push('/upgrade-required')
        return
      }

      setCurrentUser(user)
      await loadOpenHouseHistory()
    } catch (error) {
      console.error('Error loading user data:', error)
      router.push('/login')
    }
  }


  const loadOpenHouseHistory = async () => {
    try {
      setIsLoadingHistory(true)
      const response = await apiRequest('/api/open-houses')
      if (response.status === 200 && response.data) {
        setOpenHouses(response.data || [])
      }
    } catch (error) {
      console.error('Error loading open house history:', error)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const generateQRCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!address.trim()) {
      setError('Please enter a property address')
      return
    }

    setIsGenerating(true)
    setIsLoadingProperty(true)

    try {
      const response = await apiRequest('/api/property', {
        method: 'POST',
        body: JSON.stringify({
          address: address
        })
      })
      
      if (response.status === 200 && response.data) {
        setPropertyData(response.data)
        setShowImageSelection(true)
      } else {
        setError(`Failed to fetch property data: ${response.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error fetching property data:', error)
      setError('Unable to fetch property data. Please check the address and try again.')
    } finally {
      setIsGenerating(false)
      setIsLoadingProperty(false)
    }
  }

  const handleImageSelect = async (image: PropertyImage) => {
    setSelectedImage(image)
    
    if (!currentUser) {
      setError('User not authenticated')
      return
    }

    // Generate actual UUID that will be used consistently as open house event ID
    const openHouseEventId = uuidv4()
    setGeneratedOpenHouseId(openHouseEventId)
    
    // Generate QR code URL with new routing pattern (no agent ID in path)
    const formLink = `${window.location.origin}/open-house/${openHouseEventId}`
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(formLink)}`
    
    setQrCode(qrCodeUrl)
    setShowSaveDialog(true)
  }

  //console.log(propertyData);

  const saveOpenHouse = async () => {
    try {
      if (!currentUser || !propertyData || !selectedImage || !qrCode || !generatedOpenHouseId) {
        setError('Missing required information to save open house')
        return
      }

      const response = await apiRequest('/api/open-houses', {
        method: 'POST',
        body: JSON.stringify({
          address: address,
          property_data: propertyData,
          cover_image_url: selectedImage.url,
          open_house_event_id: generatedOpenHouseId
        })
      })

      if (response.status === 200) {
        setShowSaveDialog(false)
        setShowImageSelection(false)
        
        // Refresh the history
        await loadOpenHouseHistory()
        
        // Reset form
        setAddress('')
        setPropertyData(null)
        setSelectedImage(null)
        setQrCode('')
        setGeneratedOpenHouseId('')
        
        showNotification('success', '🎉 Open House created successfully!')
      } else {
        throw new Error(response.error || 'Failed to save open house')
      }
      
    } catch (error) {
      console.error('Error saving open house:', error)
      showNotification('error', 'Failed to save open house. Please try again.')
    }
  }

  const downloadPDF = async () => {
    if (qrCode && address && propertyData && selectedImage) {
      setIsGeneratingPDF(true)
      setError('')
      
      try {
        const { generateQRCodePDF } = await import('@/lib/pdfGenerator')
        await generateQRCodePDF({
          qrCodeUrl: qrCode,
          address: address,
          propertyImageUrl: selectedImage.url,
          propertyDetails: {
            price: propertyData.price || 0,
            beds: propertyData.bedrooms || 0,
            baths: propertyData.bathrooms || 0,
            squareFeet: propertyData.livingArea || 0,
            yearBuilt: propertyData.yearBuilt,
            homeType: propertyData.homeType,
            lotSize: propertyData.lotSize
          },
          filename: `open-house-${address.replace(/\s+/g, '-').toLowerCase()}.pdf`
        })
      } catch (error) {
        console.error('Error generating PDF:', error)
        setError('Failed to generate PDF. Please try again.')
      } finally {
        setIsGeneratingPDF(false)
      }
    }
  }

  const previewPDF = async () => {
    if (qrCode && address && propertyData && selectedImage) {
      setIsGeneratingPreview(true)
      setError('')
      
      try {
        const { generatePDFPreview } = await import('@/lib/pdfGenerator')
        const previewUrl = await generatePDFPreview({
          qrCodeUrl: qrCode,
          address: propertyData.abbreviatedAddress || address,
          propertyImageUrl: selectedImage.url,
          propertyDetails: {
            price: propertyData.price || 0,
            beds: propertyData.bedrooms || 0,
            baths: propertyData.bathrooms || 0,
            squareFeet: propertyData.livingArea || 0,
            yearBuilt: propertyData.yearBuilt,
            homeType: propertyData.homeType,
            lotSize: propertyData.lotSize
          }
        })
        setPdfPreview(previewUrl)
        setShowPreview(true)
      } catch (error) {
        console.error('Error generating PDF preview:', error)
        setError('Failed to generate PDF preview. Please try again.')
      } finally {
        setIsGeneratingPreview(false)
      }
    }
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
      <div className="flex-1 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">

          {!showImageSelection ? (
            <div className="bg-white/95 rounded-2xl shadow-xl border border-gray-200/60 backdrop-blur-lg">
              {/* Page Header */}
              <div className="border-b border-gray-200/50 p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-gradient-to-r from-[#8b7355] to-[#7a6549] rounded-2xl flex items-center justify-center mr-4 shadow-lg">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1" />
                      </svg>
                    </div>
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Property Portfolio</h1>
                      <p className="text-sm sm:text-base text-gray-600 mt-1">Create new listings and manage your open house events</p>
                    </div>
                  </div>
                  {currentUser && (
                    <div className="flex flex-wrap items-center gap-3">
                      {openHouses.length > 0 && (
                        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/50 rounded-xl px-4 py-2">
                          <span className="text-emerald-700 font-semibold text-sm">
                            {openHouses.length} Active Listing{openHouses.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center space-x-3 bg-gray-50/60 rounded-xl px-4 py-2 border border-gray-200/50">
                        <div className="w-8 h-8 bg-gradient-to-r from-[#8b7355] to-[#7a6549] rounded-lg flex items-center justify-center">
                          <span className="text-white text-sm font-semibold">
                            {currentUser.first_name?.charAt(0)}{currentUser.last_name?.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {currentUser.first_name} {currentUser.last_name}
                          </p>
                          <p className="text-xs text-gray-500">Real Estate Agent</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Content Area */}
              <div className="p-4 sm:p-6">
                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Create Form - Left Side */}
                  <div>
                    <div className="sticky top-6">
                      <div className="bg-gradient-to-br from-[#8b7355]/5 to-[#7a6549]/10 rounded-2xl p-6 border border-[#8b7355]/20">
                        <div className="flex items-center mb-4">
                          <div className="w-8 h-8 bg-gradient-to-r from-[#8b7355] to-[#7a6549] rounded-lg flex items-center justify-center mr-3">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                          </div>
                          <h2 className="text-xl font-bold text-gray-900">Create New Listing</h2>
                        </div>
                        
                        <form onSubmit={generateQRCode} className="space-y-4">
                          <div>
                            <label htmlFor="address" className="block text-sm font-semibold text-gray-700 mb-2">
                              Property Address
                            </label>
                            <GooglePlacesAutocomplete
                              id="address"
                              name="address"
                              required
                              value={address}
                              onChange={setAddress}
                              placeholder="123 Main Street, City, State, ZIP"
                            />
                            {error && <p className="text-red-500 text-sm mt-2 flex items-center">
                              <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {error}
                            </p>}
                          </div>

                          <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 rounded-xl p-4 border border-blue-200/40">
                            <h3 className="text-gray-900 font-semibold mb-2 text-sm flex items-center">
                              <svg className="w-4 h-4 mr-2 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Quick Start Guide
                            </h3>
                            <ul className="text-gray-700 text-xs space-y-1">
                              <li>• Enter property address to begin</li>
                              <li>• Select the best cover image</li>
                              <li>• Generate QR code & materials</li>
                              <li>• Share with potential buyers</li>
                            </ul>
                          </div>

                          <button
                            type="submit"
                            disabled={isGenerating || isLoadingProperty}
                            className="w-full px-6 py-3 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-[#8b7355]/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isGenerating || isLoadingProperty ? (
                              <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                {isLoadingProperty ? 'Loading Property...' : 'Processing...'}
                              </div>
                            ) : (
                              <div className="flex items-center justify-center">
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                Find Property & Continue
                              </div>
                            )}
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>

                  {/* Listings History - Right Side */}
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center mr-3">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">Your Open Houses</h2>
                      </div>
                    </div>

                    {isLoadingHistory ? (
                      <div className="flex items-center justify-center py-16">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8b7355] mx-auto mb-4"></div>
                          <p className="text-gray-600 font-medium">Loading your listings...</p>
                        </div>
                      </div>
                    ) : openHouses.length === 0 ? (
                      <div className="text-center py-16 bg-gradient-to-br from-gray-50/50 to-gray-100/30 rounded-2xl border-2 border-dashed border-gray-200">
                        <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">No Open Houses Yet</h3>
                        <p className="text-gray-600 mb-4 max-w-sm mx-auto">Get started by creating your first open house listing with professional marketing materials.</p>
                        <div className="inline-flex items-center text-sm text-[#8b7355] font-medium">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                          </svg>
                          Enter an address to get started
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                        {openHouses.map((openHouse, index) => (
                          <div
                            key={openHouse.id}
                            onClick={() => handleViewVisitors(openHouse)}
                            className="bg-white rounded-lg border border-gray-200/60 shadow-sm hover:shadow-lg hover:border-[#8b7355]/50 transition-all duration-200 overflow-hidden group cursor-pointer"
                          >
                            <div className="p-3">
                              <div className="flex flex-wrap items-start gap-3">
                                {/* Property Image and Title Row */}
                                <div className="flex items-start gap-3 w-full sm:flex-1">
                                  {/* Property Image */}
                                  <div className="relative flex-shrink-0">
                                    <div className="w-14 h-14 bg-gray-100 rounded-lg border border-gray-200/60 overflow-hidden">
                                      <img
                                        src={openHouse.cover_image_url}
                                        alt={`Property at ${openHouse.address}`}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                      />
                                    </div>
                                    <div className="absolute -top-1 -left-1 w-5 h-5 bg-gradient-to-r from-[#8b7355] to-[#7a6549] rounded-full flex items-center justify-center shadow-sm">
                                      <span className="text-white text-[10px] font-bold">{index + 1}</span>
                                    </div>
                                  </div>

                                  {/* Property Info */}
                                  <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-bold text-gray-900 group-hover:text-[#8b7355] transition-colors truncate mb-1">
                                      {openHouse.address}
                                    </h3>
                                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
                                      {openHouse.price && (
                                        <span className="font-semibold text-[#8b7355]">${openHouse.price?.toLocaleString()}</span>
                                      )}
                                      {openHouse.bedrooms && (
                                        <span>{openHouse.bedrooms} bd</span>
                                      )}
                                      {openHouse.bathrooms && (
                                        <span>{openHouse.bathrooms} ba</span>
                                      )}
                                      <span className="text-gray-400">•</span>
                                      <span className="text-gray-500">
                                        {new Date(openHouse.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-1.5 w-full sm:w-auto sm:flex-shrink-0">
                                  <div className="inline-flex items-center px-2.5 py-1.5 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-lg font-medium text-xs shadow-sm group-hover:shadow-md transition-all">
                                    <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    Visitors
                                  </div>

                                  <a
                                    href={openHouse.form_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all"
                                    title="Open Form"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                  </a>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleViewPDF(openHouse)
                                    }}
                                    className="p-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all"
                                    title="View PDF"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                  </button>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDeleteClick(openHouse)
                                    }}
                                    className="p-1.5 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 hover:border-red-300 transition-all"
                                    title="Remove"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {/* Listing Count Footer */}
                        {openHouses.length > 5 && (
                          <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                            <p className="text-sm text-gray-500">
                              Showing all {openHouses.length} listings • Scroll to view more
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Coming Soon - Find Open Houses Section */}
              <div className="mt-6 sm:mt-8">
                <div className="bg-gradient-to-br from-[#8b7355]/5 via-[#7a6549]/3 to-amber-50/40 rounded-2xl border-2 border-dashed border-[#8b7355]/30 backdrop-blur-sm">
                  <div className="p-6 sm:p-8 text-center relative overflow-hidden">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-5 text-[#8b7355]">
                      <svg className="w-full h-full" fill="currentColor" viewBox="0 0 100 100">
                        <circle cx="20" cy="20" r="2"/>
                        <circle cx="80" cy="20" r="2"/>
                        <circle cx="50" cy="50" r="2"/>
                        <circle cx="20" cy="80" r="2"/>
                        <circle cx="80" cy="80" r="2"/>
                      </svg>
                    </div>
                    
                    {/* Coming Soon Badge */}
                    <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-[#8b7355]/10 to-amber-100/60 border border-[#8b7355]/20 rounded-full mb-6">
                      <svg className="w-4 h-4 mr-2 text-[#8b7355]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-[#7a6549] font-semibold text-sm">Coming Soon</span>
                    </div>

                    {/* Main Content */}
                    <div className="max-w-2xl mx-auto">
                      <div className="flex items-center justify-center mb-6">
                        <div className="w-16 h-16 bg-gradient-to-br from-[#8b7355] to-[#7a6549] rounded-2xl flex items-center justify-center shadow-lg">
                          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                      </div>
                      
                      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">Discover Open Houses</h2>
                      <p className="text-gray-600 mb-6 leading-relaxed">
                        Find and explore open houses from other agents in your area. Perfect for market research, 
                        networking, and staying informed about local property trends.
                      </p>

                      {/* Feature Preview */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 sm:mb-8">
                        <div className="bg-white/60 rounded-xl p-4 border border-[#8b7355]/15">
                          <div className="w-8 h-8 bg-[#8b7355]/10 rounded-lg flex items-center justify-center mb-3 mx-auto">
                            <svg className="w-4 h-4 text-[#8b7355]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                          <h3 className="font-semibold text-gray-900 text-sm mb-2">Location Search</h3>
                          <p className="text-xs text-gray-600">Find open houses by neighborhood, city, or radius</p>
                        </div>

                        <div className="bg-white/60 rounded-xl p-4 border border-[#8b7355]/15">
                          <div className="w-8 h-8 bg-[#8b7355]/10 rounded-lg flex items-center justify-center mb-3 mx-auto">
                            <svg className="w-4 h-4 text-[#8b7355]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                          </div>
                          <h3 className="font-semibold text-gray-900 text-sm mb-2">Smart Filters</h3>
                          <p className="text-xs text-gray-600">Filter by price range, property type, and dates</p>
                        </div>

                        <div className="bg-white/60 rounded-xl p-4 border border-[#8b7355]/15">
                          <div className="w-8 h-8 bg-[#8b7355]/10 rounded-lg flex items-center justify-center mb-3 mx-auto">
                            <svg className="w-4 h-4 text-[#8b7355]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a1 1 0 011-1h6a1 1 0 011 1v4h3a1 1 0 011 1v9a1 1 0 01-1 1H5a1 1 0 01-1-1V8a1 1 0 011-1h3z" />
                            </svg>
                          </div>
                          <h3 className="font-semibold text-gray-900 text-sm mb-2">Save Favorites</h3>
                          <p className="text-xs text-gray-600">Bookmark properties and track market insights</p>
                        </div>
                      </div>

                      {/* CTA */}
                      <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-500 rounded-xl font-medium cursor-not-allowed">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Feature In Development
                      </div>
                      
                      <p className="text-xs text-gray-500 mt-4">
                        We're working hard to bring you this feature. Stay tuned for updates!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Image Selection View */
            <ImageSelectionView
              propertyData={propertyData}
              address={address}
              onImageSelect={handleImageSelect}
              onBack={() => setShowImageSelection(false)}
            />
          )}
        </div>
      </div>
      <Footer />
      
      {/* Save Dialog */}
      {showSaveDialog && (
        <SaveOpenHouseDialog
          address={address}
          selectedImage={selectedImage}
          qrCode={qrCode}
          onSave={saveOpenHouse}
          onCancel={() => setShowSaveDialog(false)}
          onPreview={previewPDF}
          onDownload={downloadPDF}
          isGeneratingPreview={isGeneratingPreview}
          isGeneratingPDF={isGeneratingPDF}
        />
      )}
      
      {/* PDF Preview Modal */}
      {showPreview && pdfPreview && (
        <PDFPreviewModal
          pdfPreview={pdfPreview}
          onClose={() => setShowPreview(false)}
          onDownload={downloadPDF}
          isGeneratingPDF={isGeneratingPDF}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && openHouseToDelete && (
        <DeleteConfirmationDialog
          openHouse={openHouseToDelete}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
          isDeleting={isDeleting}
        />
      )}

      {/* Open House PDF Viewer Modal */}
      {showPDFViewer && selectedOpenHouseForPDF && (
        <OpenHousePDFViewer
          openHouse={selectedOpenHouseForPDF}
          onClose={() => {
            console.log('Closing PDF viewer')
            setShowPDFViewer(false)
            setSelectedOpenHouseForPDF(null)
          }}
        />
      )}
      
      {/* Toast Notification */}
      {notification.show && (
        <div className={`fixed bottom-6 right-6 z-50 transform transition-all duration-300 ease-in-out ${
          notification.show ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
        }`}>
          <div className={`p-4 rounded-xl shadow-lg border-l-4 min-w-[320px] max-w-md ${
            notification.type === 'success' 
              ? 'bg-white border-l-green-500 shadow-green-100' 
              : 'bg-white border-l-red-500 shadow-red-100'
          }`}>
            <div className="flex items-start space-x-3">
              <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                notification.type === 'success' 
                  ? 'bg-green-100 text-green-600' 
                  : 'bg-red-100 text-red-600'
              }`}>
                {notification.type === 'success' ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  notification.type === 'success' ? 'text-green-900' : 'text-red-900'
                }`}>
                  {notification.message}
                </p>
              </div>
              <button
                onClick={() => setNotification(prev => ({ ...prev, show: false }))}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Image Selection Component
function ImageSelectionView({ propertyData, address, onImageSelect, onBack }: any) {
  const availableImages = propertyData?.originalPhotos || []
  
  return (
    <div className="bg-white/95 rounded-2xl shadow-xl border border-gray-200/60 backdrop-blur-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Select Cover Image</h2>
          <p className="text-gray-600 text-sm mt-1">{address}</p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors duration-200 flex items-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {availableImages.map((photo: any, index: number) => {
          const imageUrl = photo.mixedSources?.jpeg?.[0]?.url || photo.url
          return (
            <div
              key={index}
              className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-[#8b7355] transition-all duration-200 group"
              onClick={() => onImageSelect({ url: imageUrl, width: 400, height: 300 })}
            >
              <img
                src={imageUrl}
                alt={`Property view ${index + 1}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 flex items-center justify-center">
                <div className="bg-white/90 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <svg className="w-5 h-5 text-[#8b7355]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      
      {availableImages.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-600">No images available for this property</p>
          <button
            onClick={() => onImageSelect({ url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=300&fit=crop', width: 400, height: 300 })}
            className="mt-4 px-4 py-2 bg-[#8b7355] text-white rounded-lg hover:bg-[#7a6549] transition-colors"
          >
            Use Default Image
          </button>
        </div>
      )}

    </div>
  )
}

// Save Dialog Component
function SaveOpenHouseDialog({ address, selectedImage, qrCode, onSave, onCancel, onPreview, onDownload, isGeneratingPreview, isGeneratingPDF }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Save Open House</h3>
          <p className="text-gray-600 text-sm mt-1">{address}</p>
        </div>
        
        <div className="p-6">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden">
              {selectedImage && (
                <img src={selectedImage.url} alt="Selected cover" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Cover Image Selected</p>
              <p className="text-xs text-gray-500 mt-1">This image will be featured on your open house materials</p>
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h4 className="text-sm font-medium text-gray-900 mb-2">What happens next?</h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• QR code and property data will be saved to your account</li>
              <li>• Visitors can scan QR code to access property details</li>
              <li>• Lead information will be collected automatically</li>
              <li>• You can download marketing materials anytime</li>
            </ul>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={onPreview}
              disabled={isGeneratingPreview}
              className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 hover:border-blue-300 rounded-lg transition-colors duration-200 disabled:opacity-50"
            >
              {isGeneratingPreview ? '...' : 'Preview'}
            </button>
            <button
              onClick={onSave}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-lg hover:shadow-lg hover:shadow-[#8b7355]/25 transition-all duration-300"
            >
              Save Open House
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// PDF Preview Modal Component
function PDFPreviewModal({ pdfPreview, onClose, onDownload, isGeneratingPDF }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">PDF Preview</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex-1 p-6 overflow-auto">
          <iframe
            src={pdfPreview}
            className="w-full h-[600px] border border-gray-200 rounded-lg"
            title="PDF Preview"
          />
        </div>
        
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors duration-200"
          >
            Close
          </button>
          <button
            onClick={onDownload}
            disabled={isGeneratingPDF}
            className="px-4 py-2 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-lg hover:shadow-lg hover:shadow-[#8b7355]/25 transition-all duration-300 disabled:opacity-50"
          >
            {isGeneratingPDF ? 'Downloading...' : 'Download PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Delete Confirmation Dialog Component
function DeleteConfirmationDialog({
  openHouse,
  onConfirm,
  onCancel,
  isDeleting
}: {
  openHouse: OpenHouse
  onConfirm: () => void
  onCancel: () => void
  isDeleting: boolean
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-4">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Remove Listing</h3>
              <p className="text-gray-600 text-sm mt-1">This action is safe and reversible</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-900 mb-2">
              {openHouse.address}
            </p>
            <p className="text-sm text-gray-600 mb-4">
              This listing will be removed from your dashboard, but all data will be preserved for your records.
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-green-900 mb-1">Data Protection</h4>
                <ul className="text-xs text-green-800 space-y-1">
                  <li>• All visitor information is preserved</li>
                  <li>• Property collections remain intact</li>
                  <li>• QR codes continue to work</li>
                  <li>• Visitor can still access their collections</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={onCancel}
              disabled={isDeleting}
              className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors duration-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:shadow-lg hover:shadow-red-500/25 transition-all duration-300 disabled:opacity-50"
            >
              {isDeleting ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Removing...
                </div>
              ) : (
                'Remove Listing'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Open House PDF Viewer Component
function OpenHousePDFViewer({ openHouse, onClose }: { openHouse: OpenHouse, onClose: () => void }) {
  const [pdfUrl, setPdfUrl] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  
  console.log('OpenHousePDFViewer component rendered with:', openHouse)

  // Generate PDF on mount
  useEffect(() => {
    const generatePDF = async () => {
      setIsGenerating(true)
      try {
        console.log('Generating PDF for open house:', openHouse)
        console.log('QR Code URL:', openHouse.qr_code_url)
        console.log('Cover Image URL:', openHouse.cover_image_url)
        
        // Generate PDF preview using the existing generatePDFPreview function
        const { generatePDFPreview } = await import('@/lib/pdfGenerator')
        const pdfDataUrl = await generatePDFPreview({
          qrCodeUrl: openHouse.qr_code_url,
          address: openHouse.address,
          propertyImageUrl: openHouse.cover_image_url,
          propertyDetails: {
            beds: openHouse.bedrooms,
            baths: openHouse.bathrooms,
            squareFeet: openHouse.living_area,
            price: openHouse.price
          }
        })
        console.log('Generated PDF data URL')
        setPdfUrl(pdfDataUrl)
      } catch (error) {
        console.error('Error generating PDF:', error)
      } finally {
        setIsGenerating(false)
      }
    }

    generatePDF()
  }, [openHouse])

  const downloadPDF = async () => {
    try {
      // Generate and download PDF using the download function
      const { generateQRCodePDF } = await import('@/lib/pdfGenerator')
      await generateQRCodePDF({
        qrCodeUrl: openHouse.qr_code_url,
        address: openHouse.address,
        propertyImageUrl: openHouse.cover_image_url,
        propertyDetails: {
          beds: openHouse.bedrooms,
          baths: openHouse.bathrooms,
          squareFeet: openHouse.living_area,
          price: openHouse.price
        },
        filename: `${openHouse.address.replace(/[^a-zA-Z0-9]/g, '_')}_OpenHouse.pdf`
      })
    } catch (error) {
      console.error('Error downloading PDF:', error)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Open House PDF</h3>
            <p className="text-gray-600 text-sm mt-1">{openHouse.address}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex-1 p-6 overflow-auto">
          {isGenerating ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8b7355] mx-auto mb-4"></div>
                <p className="text-gray-600">Generating PDF...</p>
              </div>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-[500px] border border-gray-200 rounded-lg"
              title="Open House PDF Preview"
            />
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-600">Failed to generate PDF</p>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors duration-200"
          >
            Close
          </button>
          {pdfUrl && (
            <button
              onClick={downloadPDF}
              className="px-4 py-2 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-lg hover:shadow-lg hover:shadow-[#8b7355]/25 transition-all duration-300"
            >
              Download PDF
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
